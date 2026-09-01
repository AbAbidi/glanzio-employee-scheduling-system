import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LocationSearchDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  query!: string;
}

export class ReverseGeocodeDto {
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;
}
