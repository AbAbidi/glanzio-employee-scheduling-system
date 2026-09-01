import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RoutePreviewDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  originAddress!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  destinationAddress!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  originLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  originLongitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  destinationLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  destinationLongitude?: number;
}
