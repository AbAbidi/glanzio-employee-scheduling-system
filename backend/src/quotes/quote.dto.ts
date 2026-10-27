import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class QuoteDto {
  @IsUUID('4')
  submissionKey!: string;

  @Transform(trim)
  @IsString()
  @Length(2, 120)
  fullName!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(100)
  service = '';

  @Transform(trim)
  @IsString()
  @Length(2, 200)
  location!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(4000)
  message = '';

  @IsOptional()
  @IsString()
  @MaxLength(0)
  companyWebsite?: string;
}
