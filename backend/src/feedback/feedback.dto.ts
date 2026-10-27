import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { FeedbackStatus } from '../generated/prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateFeedbackDto {
  @IsUUID()
  submissionKey!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsBoolean()
  allowPublic!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(0)
  website?: string;
}

export class FeedbackQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(FeedbackStatus)
  status?: FeedbackStatus;
}

export class ModerateFeedbackDto {
  @IsEnum(FeedbackStatus)
  status!: FeedbackStatus;
}
