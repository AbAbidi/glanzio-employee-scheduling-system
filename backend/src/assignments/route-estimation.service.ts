import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type Coordinate = {
  latitude: number;
  longitude: number;
  displayName: string;
};

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

type NominatimReverseResult = NominatimResult & {
  name?: string;
  address?: {
    house_number?: string;
    road?: string;
    pedestrian?: string;
    building?: string;
    amenity?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    country_code?: string;
  };
};

type OsrmResponse = {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: {
      type: 'LineString';
      coordinates: Array<[number, number]>;
    };
  }>;
};

type ReverseLocation = {
  latitude: number;
  longitude: number;
  displayName: string;
  siteName: string;
  addressLine1: string;
  city: string;
  countryCode: string;
};

@Injectable()
export class RouteEstimationService {
  private readonly coordinateCache = new Map<string, Coordinate>();
  private readonly reverseCoordinateCache = new Map<string, ReverseLocation>();

  constructor(private readonly configService: ConfigService) {}

  async estimate(
    originAddress: string,
    destinationAddress: string,
    originPosition?: { latitude: number; longitude: number },
    destinationPosition?: { latitude: number; longitude: number },
  ) {
    const [origin, destination] = await Promise.all([
      originPosition
        ? Promise.resolve({ ...originPosition, displayName: originAddress })
        : this.geocode(originAddress),
      destinationPosition
        ? Promise.resolve({
            ...destinationPosition,
            displayName: destinationAddress,
          })
        : this.geocode(destinationAddress),
    ]);
    const routingBaseUrl = this.configService
      .get<string>('ROUTING_BASE_URL', 'https://router.project-osrm.org')
      .replace(/\/$/, '');
    const coordinatePath =
      `${origin.longitude},${origin.latitude};` +
      `${destination.longitude},${destination.latitude}`;
    const response = await this.externalRequest(
      `${routingBaseUrl}/route/v1/driving/${coordinatePath}?overview=full&geometries=geojson&steps=false`,
      { headers: { Accept: 'application/json' } },
      'The travel route service is temporarily unavailable.',
    );

    if (!response.ok) {
      throw new BadGatewayException(
        'The travel route could not be calculated.',
      );
    }

    const result = (await response.json()) as OsrmResponse;
    const route = result.routes?.[0];

    if (result.code !== 'Ok' || !route) {
      throw new BadGatewayException(
        'No driving route was found between the two addresses.',
      );
    }

    return {
      originAddress: origin.displayName,
      originLatitude: origin.latitude,
      originLongitude: origin.longitude,
      destinationAddress: destination.displayName,
      destinationLatitude: destination.latitude,
      destinationLongitude: destination.longitude,
      travelDistanceMeters: Math.round(route.distance),
      estimatedTravelMinutes: Math.max(1, Math.round(route.duration / 60)),
      routeGeometry: route.geometry.coordinates.map(
        ([longitude, latitude]) => ({ latitude, longitude }),
      ),
      calculatedAt: new Date().toISOString(),
    };
  }

  async search(address: string) {
    return this.geocode(address);
  }

  async reverse(latitude: number, longitude: number) {
    const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
    const cached = this.reverseCoordinateCache.get(cacheKey);
    if (cached) return cached;

    const geocodingBaseUrl = this.configService
      .get<string>('GEOCODING_BASE_URL', 'https://nominatim.openstreetmap.org')
      .replace(/\/$/, '');
    const search = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      format: 'jsonv2',
      addressdetails: '1',
      zoom: '18',
    });
    const response = await this.externalRequest(
      `${geocodingBaseUrl}/reverse?${search}`,
      { headers: this.geocodingHeaders() },
      'The address lookup service is temporarily unavailable.',
    );

    if (!response.ok) {
      throw new BadGatewayException(
        'The selected map position could not be resolved.',
      );
    }

    const result = (await response.json()) as NominatimReverseResult;
    const address = result.address ?? {};
    const street = address.road ?? address.pedestrian ?? address.building;
    const addressLine1 = [address.house_number, street]
      .filter(Boolean)
      .join(' ');
    const city =
      address.city ??
      address.town ??
      address.village ??
      address.municipality ??
      'Unknown city';
    const siteName =
      result.name ?? address.amenity ?? address.building ?? street ?? city;

    const location = {
      latitude: Number(result.lat),
      longitude: Number(result.lon),
      displayName: result.display_name,
      siteName,
      addressLine1: addressLine1 || result.name || result.display_name,
      city,
      countryCode: (address.country_code ?? 'FR').toUpperCase(),
    };
    this.reverseCoordinateCache.set(cacheKey, location);
    return location;
  }

  private async geocode(address: string): Promise<Coordinate> {
    const key = address.trim().toLocaleLowerCase();
    const cached = this.coordinateCache.get(key);

    if (cached) return cached;

    const geocodingBaseUrl = this.configService
      .get<string>('GEOCODING_BASE_URL', 'https://nominatim.openstreetmap.org')
      .replace(/\/$/, '');
    const search = new URLSearchParams({
      q: address.trim(),
      format: 'jsonv2',
      limit: '1',
    });
    const response = await this.externalRequest(
      `${geocodingBaseUrl}/search?${search}`,
      { headers: this.geocodingHeaders() },
      'The address lookup service is temporarily unavailable.',
    );

    if (!response.ok) {
      throw new BadGatewayException(
        'The address lookup service is unavailable.',
      );
    }

    const results = (await response.json()) as NominatimResult[];
    const match = results[0];

    if (!match) {
      throw new BadGatewayException(
        `No location was found for: ${address.trim()}`,
      );
    }

    const coordinate = {
      latitude: Number(match.lat),
      longitude: Number(match.lon),
      displayName: match.display_name,
    };
    this.coordinateCache.set(key, coordinate);
    return coordinate;
  }

  private geocodingHeaders() {
    return {
      Accept: 'application/json',
      'Accept-Language': 'en,fr;q=0.9',
      'User-Agent': this.configService.get<string>(
        'GEOCODING_USER_AGENT',
        'ClarityCleanScheduling/1.0 (local development)',
      ),
    };
  }

  private async externalRequest(
    url: string,
    options: RequestInit,
    unavailableMessage: string,
  ) {
    try {
      return await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new BadGatewayException(unavailableMessage);
    }
  }
}
