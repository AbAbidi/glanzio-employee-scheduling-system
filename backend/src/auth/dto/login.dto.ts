import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { normalizeEmail } from '../../common/transforms/input.transforms';

export class LoginDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(320)
  identifier?: string;

  // Transitional compatibility for existing clients; new UI sends identifier.
  @IsOptional()
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}
