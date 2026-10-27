import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUrl,
  Max,
  Min,
  MinLength,
  Matches,
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
  @Matches(/^[1-9]\d*(?:ms|s|m|h|d)$/)
  JWT_ACCESS_EXPIRES_IN!: string;

  @IsInt()
  @Min(1)
  REFRESH_TOKEN_EXPIRES_IN_DAYS!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  INVITATION_EXPIRES_IN_HOURS: number = 72;

  @IsOptional()
  @IsEnum(['development', 'test', 'production'])
  NODE_ENV = 'development';

  @IsOptional()
  @IsEnum(['true', 'false'])
  ALLOW_TEST_WORKSPACE_RESET = 'false';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsOptional()
  @IsString()
  CORS_ORIGIN = 'http://localhost:5173';

  @IsOptional()
  @IsEnum(['false', 'loopback'])
  TRUST_PROXY = 'false';

  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  PUBLIC_FRONTEND_URL?: string;

  @IsOptional()
  @IsEnum(['true', 'false'])
  SMTP_ENABLED = 'false';

  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT: number = 587;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;

  @IsOptional()
  @IsEmail()
  SMTP_FROM = 'info@glanzio-reinigung.de';

  @IsOptional()
  @IsTimeZone()
  SYSTEM_TIME_ZONE = 'Europe/Paris';

  @IsOptional()
  @IsInt()
  @Min(1)
  STUDENT_MONTHLY_LIMIT_MINUTES: number = 2400;

  @IsOptional()
  @IsString()
  PAYROLL_COMPANY_LEGAL_NAME = 'glanzio-reinigung';

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
  AUTH_MAX_FAILED_ATTEMPTS: number = 5;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  AUTH_LOCK_MINUTES: number = 15;
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
    throw new Error(
      `Invalid environment configuration: ${errors.map((error) => error.property).join(', ')}`,
    );
  }

  if (
    validatedConfiguration.SMTP_ENABLED === 'true' &&
    (!validatedConfiguration.SMTP_HOST ||
      !validatedConfiguration.SMTP_USER ||
      !validatedConfiguration.SMTP_PASSWORD)
  ) {
    throw new Error(
      'SMTP_ENABLED requires SMTP_HOST, SMTP_USER and SMTP_PASSWORD.',
    );
  }

  if (validatedConfiguration.NODE_ENV === 'production') {
    if (validatedConfiguration.PUBLIC_FRONTEND_URL) {
      const frontend = new URL(validatedConfiguration.PUBLIC_FRONTEND_URL);
      if (
        frontend.protocol !== 'https:' ||
        frontend.origin !==
          validatedConfiguration.PUBLIC_FRONTEND_URL.replace(/\/$/, '')
      ) {
        throw new Error(
          'Production PUBLIC_FRONTEND_URL must be an HTTPS origin.',
        );
      }
    }
    const secret = validatedConfiguration.JWT_ACCESS_SECRET.toLowerCase();
    if (/replace|change.?me|example|unit.?test|test.?only/.test(secret)) {
      throw new Error(
        'Production JWT_ACCESS_SECRET must not be a placeholder.',
      );
    }
    const origins = validatedConfiguration.CORS_ORIGIN.split(',').map((value) =>
      value.trim(),
    );
    if (
      !origins.length ||
      origins.some((origin) => {
        try {
          const url = new URL(origin);
          return (
            url.protocol !== 'https:' ||
            url.origin !== origin ||
            ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(
              url.hostname,
            )
          );
        } catch {
          return true;
        }
      })
    ) {
      throw new Error(
        'Production CORS_ORIGIN must contain explicit HTTPS frontend origins.',
      );
    }
    if (validatedConfiguration.ALLOW_TEST_WORKSPACE_RESET === 'true') {
      throw new Error('Test workspace reset cannot be enabled in production.');
    }
  }

  return validatedConfiguration;
}
