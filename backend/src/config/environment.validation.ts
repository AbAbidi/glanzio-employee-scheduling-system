import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @IsUrl({ require_tld: false, protocols: ['postgresql'] })
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_ACCESS_EXPIRES_IN!: string;

  @IsInt()
  @Min(1)
  REFRESH_TOKEN_EXPIRES_IN_DAYS!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  INVITATION_EXPIRES_IN_HOURS = 72;

  @IsOptional()
  @IsEnum(['development', 'test', 'production'])
  NODE_ENV = 'development';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsOptional()
  @IsString()
  CORS_ORIGIN = 'http://localhost:5173';

  @IsOptional()
  @IsTimeZone()
  SYSTEM_TIME_ZONE = 'Europe/Paris';

  @IsOptional()
  @IsInt()
  @Min(1)
  STUDENT_MONTHLY_LIMIT_MINUTES = 4800;

  @IsOptional()
  @IsString()
  PAYROLL_COMPANY_LEGAL_NAME = 'Clarity Clean';

  @IsOptional()
  @IsString()
  PAYROLL_COMPANY_ADDRESS = 'Company address not configured';

  @IsOptional()
  @IsString()
  PAYROLL_COMPANY_REGISTRATION = 'Not configured';

  @IsOptional()
  @IsString()
  PAYROLL_CURRENCY = 'EUR';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  AUTH_MAX_FAILED_ATTEMPTS = 5;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  AUTH_LOCK_MINUTES = 15;
}

export function validateEnvironment(
  configuration: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfiguration = plainToInstance(
    EnvironmentVariables,
    configuration,
    { enableImplicitConversion: true },
  );

  const errors = validateSync(validatedConfiguration, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfiguration;
}
