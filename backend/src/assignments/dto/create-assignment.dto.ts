import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AssignmentStatus } from '../../generated/prisma/client';
import { AssignmentEmployeeInputDto } from './assignment-employee-input.dto';

export class CreateAssignmentDto {
  @IsUUID()
  siteId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsEnum(AssignmentStatus)
  status: AssignmentStatus = AssignmentStatus.SCHEDULED;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  departureAddress?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  departureLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  departureLongitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  travelDistanceMeters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedTravelMinutes?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  clientCharge!: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  employeeIds: string[] = [];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignmentEmployeeInputDto)
  employees: AssignmentEmployeeInputDto[] = [];
}
