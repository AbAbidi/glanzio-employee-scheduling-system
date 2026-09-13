"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CircleMarker, Map as LeafletMap, Polyline } from "leaflet";
import { API_BASE_URL, responseMessage } from "../../lib/auth-client";
import type { MapLocation, RoutePreview } from "./types";

type PointMode = "departure" | "destination";

type LocationMapProps = {
  accessToken: string;
  departure: MapLocation | null;
  destination: MapLocation | null;
  allowDestinationSelection: boolean;
  onDepartureChange: (location: MapLocation) => void;
  onDestinationChange: (location: MapLocation) => void;
  onRouteChange: (route: RoutePreview | null) => void;
};

type SearchCoordinate = {
  latitude: number;
  longitude: number;
  displayName: string;
};

type PointSelectionState = {
  activePoint: PointMode;
  allowDestinationSelection: boolean;
};

const BERLIN_POSITION: [number, number] = [52.52, 13.405];

function pointDescription(location: MapLocation | null, fallback: string) {
  return location?.displayName ?? fallback;
}

export default function LocationMap({
  accessToken,
  departure,
  destination,
  allowDestinationSelection,
  onDepartureChange,
  onDestinationChange,
  onRouteChange,
}: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const departureMarkerRef = useRef<CircleMarker | null>(null);
  const destinationMarkerRef = useRef<CircleMarker | null>(null);
  const routeLineRef = useRef<Polyline | null>(null);
  const activePointRef = useRef<PointMode>("departure");
  const allowDestinationRef = useRef(allowDestinationSelection);
  const destinationRef = useRef(destination);
  const onDepartureRef = useRef(onDepartureChange);
  const onDestinationRef = useRef(onDestinationChange);
  const onRouteChangeRef = useRef(onRouteChange);
  const [pointSelection, setPointSelection] = useState<PointSelectionState>({
    activePoint: "departure",
    allowDestinationSelection,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState("");

  if (
    pointSelection.allowDestinationSelection !== allowDestinationSelection
  ) {
    setPointSelection({
      activePoint:
        !allowDestinationSelection &&
        pointSelection.activePoint === "destination"
          ? "departure"
          : pointSelection.activePoint,
      allowDestinationSelection,
    });
  }

  const activePoint = pointSelection.activePoint;
  const setActivePoint = useCallback((nextPoint: PointMode) => {
    setPointSelection((current) => ({
      ...current,
      activePoint: nextPoint,
    }));
  }, []);

  useEffect(() => {
    activePointRef.current = activePoint;
  }, [activePoint]);

  useEffect(() => {
    allowDestinationRef.current = allowDestinationSelection;
  }, [allowDestinationSelection]);

  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  useEffect(() => {
    onDepartureRef.current = onDepartureChange;
    onDestinationRef.current = onDestinationChange;
    onRouteChangeRef.current = onRouteChange;
  }, [onDepartureChange, onDestinationChange, onRouteChange]);

  const resolvePosition = useCallback(
    async (latitude: number, longitude: number) => {
      const selectedPoint = activePointRef.current;
      const provisionalLocation: MapLocation = {
        latitude,
        longitude,
        displayName: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        siteName: "Selected map position",
        addressLine1: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        city: "Berlin",
        countryCode: "DE",
      };

      if (selectedPoint === "destination" && allowDestinationRef.current) {
        onDestinationRef.current(provisionalLocation);
      } else {
        onDepartureRef.current(provisionalLocation);
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/calendar/reverse-geocode`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ latitude, longitude }),
        });

        if (!response.ok) throw new Error(await responseMessage(response));
        const location = (await response.json()) as MapLocation;

        if (selectedPoint === "destination" && allowDestinationRef.current) {
          onDestinationRef.current(location);
        } else {
          onDepartureRef.current(location);
          if (allowDestinationRef.current && !destinationRef.current) {
            setActivePoint("destination");
          }
        }
      } catch {
        setError("The address service is temporarily unavailable. Your exact map position is still selected.");
      } finally {
        setLoading(false);
      }
    },
    [accessToken, setActivePoint],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;

    async function initializeMap() {
      const L = await import("leaflet");
      if (disposed || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView(BERLIN_POSITION, 12);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      map.on("click", (event) => {
        void resolvePosition(event.latlng.lat, event.latlng.lng);
      });
      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 80);
    }

    void initializeMap();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [resolvePosition]);

  useEffect(() => {
    if (!mapRef.current) return;

    async function updateMarkers() {
      const L = await import("leaflet");
      const map = mapRef.current!;

      if (departure) {
        const position: [number, number] = [
          departure.latitude,
          departure.longitude,
        ];
        if (departureMarkerRef.current) {
          departureMarkerRef.current.setLatLng(position);
        } else {
          departureMarkerRef.current = L.circleMarker(position, {
            radius: 9,
            color: "#ffffff",
            weight: 4,
            fillColor: "#2563eb",
            fillOpacity: 1,
          }).addTo(map);
        }
      } else if (departureMarkerRef.current) {
        departureMarkerRef.current.remove();
        departureMarkerRef.current = null;
      }

      if (destination) {
        const position: [number, number] = [
          destination.latitude,
          destination.longitude,
        ];
        if (destinationMarkerRef.current) {
          destinationMarkerRef.current.setLatLng(position);
        } else {
          destinationMarkerRef.current = L.circleMarker(position, {
            radius: 9,
            color: "#ffffff",
            weight: 4,
            fillColor: "#174f43",
            fillOpacity: 1,
          }).addTo(map);
        }
      } else if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
        destinationMarkerRef.current = null;
      }

      if (departure && destination) {
        map.fitBounds(
          L.latLngBounds([
            [departure.latitude, departure.longitude],
            [destination.latitude, destination.longitude],
          ]).pad(0.25),
          { maxZoom: 15 },
        );
      } else {
        const location = departure ?? destination;
        if (location) map.setView([location.latitude, location.longitude], 15);
      }
    }

    void updateMarkers();
  }, [departure, destination]);

  useEffect(() => {
    const map = mapRef.current;
    routeLineRef.current?.remove();
    routeLineRef.current = null;
    onRouteChangeRef.current(null);

    if (!map || !departure || !destination) {
      setRouting(false);
      return;
    }
    const activeMap = map;

    const controller = new AbortController();

    async function drawDrivingRoute() {
      setRouting(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/calendar/route-preview`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            originAddress: departure!.displayName,
            originLatitude: departure!.latitude,
            originLongitude: departure!.longitude,
            destinationAddress: destination!.displayName,
            destinationLatitude: destination!.latitude,
            destinationLongitude: destination!.longitude,
          }),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(await responseMessage(response));
        const route = (await response.json()) as RoutePreview;
        if (controller.signal.aborted) return;

        const L = await import("leaflet");
        const points = route.routeGeometry.map(
          (point) => [point.latitude, point.longitude] as [number, number],
        );
        routeLineRef.current = L.polyline(points, {
          color: "#2563eb",
          weight: 6,
          opacity: 0.92,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(activeMap);
        routeLineRef.current.bringToBack();
        activeMap.fitBounds(routeLineRef.current.getBounds().pad(0.12), {
          maxZoom: 15,
        });
        onRouteChangeRef.current(route);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "The driving route could not be drawn.",
        );
      } finally {
        if (!controller.signal.aborted) setRouting(false);
      }
    }

    void drawDrivingRoute();
    return () => controller.abort();
  }, [accessToken, departure, destination]);

  async function handleSearch() {
    const query = search.trim();
    if (!query) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/calendar/location-search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) throw new Error(await responseMessage(response));
      const coordinate = (await response.json()) as SearchCoordinate;
      mapRef.current?.setView(
        [coordinate.latitude, coordinate.longitude],
        16,
      );
      await resolvePosition(coordinate.latitude, coordinate.longitude);
      setSearch("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The location could not be found.",
      );
      setLoading(false);
    }
  }

  const pointLabel = activePoint === "departure" ? "starting point" : "destination";

  return (
    <div className="locationPicker">
      <div className="locationPointSelector" aria-label="Route positions">
        <button
          className={activePoint === "departure" ? "isSelected" : ""}
          type="button"
          onClick={() => setActivePoint("departure")}
        >
          <span className="mapPointDot mapPointDeparture" aria-hidden="true" />
          <span>
            <small>Starting point</small>
            <strong>{pointDescription(departure, "Select departure position")}</strong>
          </span>
        </button>
        <button
          className={activePoint === "destination" ? "isSelected" : ""}
          type="button"
          disabled={!allowDestinationSelection}
          onClick={() => setActivePoint("destination")}
        >
          <span className="mapPointDot mapPointDestination" aria-hidden="true" />
          <span>
            <small>{allowDestinationSelection ? "Cleaning destination" : "Saved destination"}</small>
            <strong>{pointDescription(destination, "Select destination position")}</strong>
          </span>
        </button>
      </div>

      <div className="locationSearch">
        <input
          aria-label={`Search for the ${pointLabel}`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleSearch();
            }
          }}
          placeholder={`Search the ${pointLabel} in Berlin`}
        />
        <button type="button" disabled={loading} onClick={() => void handleSearch()}>
          {loading ? "Locating..." : "Search"}
        </button>
      </div>

      <div className="locationMap" ref={containerRef} aria-label="Select route positions on the map" />
      <div className="mapLegend" aria-hidden="true">
        <span><i className="mapPointDeparture" /> Starting point</span>
        <span><i className="mapPointDestination" /> Cleaning destination</span>
        <span><i className="mapRouteLine" /> Driving route</span>
      </div>
      {routing ? <p className="routeDrawingStatus">Drawing the fastest driving route...</p> : null}
      <p className="locationHint">
        Select a point above, then search or click on the map. The blue point is the departure; the green point is the cleaning site.
      </p>

      {error ? <p className="inlineFormError" role="alert">{error}</p> : null}
    </div>
  );
}
