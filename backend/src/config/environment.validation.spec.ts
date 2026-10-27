import 'reflect-metadata';
import { validateEnvironment } from './environment.validation';

describe('Production configuration safety', () => {
  const valid = {
    DATABASE_URL: 'postgresql://ci:ci@localhost:5432/esms_ci',
    JWT_ACCESS_SECRET: 'a0'.repeat(32),
    JWT_ACCESS_EXPIRES_IN: '15m',
    REFRESH_TOKEN_EXPIRES_IN_DAYS: '30',
    NODE_ENV: 'production',
    CORS_ORIGIN: 'https://cleaning.example.invalid',
  };

  it('accepts an explicit HTTPS production setup with safe defaults', () => {
    expect(validateEnvironment(valid)).toMatchObject({
      PORT: 3000,
      TRUST_PROXY: 'false',
      ALLOW_TEST_WORKSPACE_RESET: 'false',
    });
  });

  it('requires complete SMTP configuration only when sending is enabled', () => {
    expect(validateEnvironment(valid).SMTP_ENABLED).toBe('false');
    expect(() =>
      validateEnvironment({ ...valid, SMTP_ENABLED: 'true' }),
    ).toThrow('SMTP_HOST');
    expect(
      validateEnvironment({
        ...valid,
        SMTP_ENABLED: 'true',
        SMTP_HOST: 'mail.example.test',
        SMTP_PORT: '587',
        SMTP_USER: 'site@example.test',
        SMTP_PASSWORD: 'private-test-fixture',
      }).SMTP_PORT,
    ).toBe(587);
    expect(() =>
      validateEnvironment({ ...valid, SMTP_FROM: 'invalid' }),
    ).toThrow('SMTP_FROM');
  });

  it('converts numeric .env strings before validating defaults with overrides', () => {
    expect(
      validateEnvironment({
        ...valid,
        PORT: '3000',
        INVITATION_EXPIRES_IN_HOURS: '72',
        AUTH_MAX_FAILED_ATTEMPTS: '5',
        AUTH_LOCK_MINUTES: '15',
        STUDENT_MONTHLY_LIMIT_MINUTES: '2400',
      }),
    ).toMatchObject({
      PORT: 3000,
      INVITATION_EXPIRES_IN_HOURS: 72,
      AUTH_MAX_FAILED_ATTEMPTS: 5,
      AUTH_LOCK_MINUTES: 15,
      STUDENT_MONTHLY_LIMIT_MINUTES: 2400,
    });
  });

  it('rejects non-HTTPS or path-based public invitation origins in production', () => {
    for (const origin of [
      'http://localhost:5173',
      'https://example.test/path',
    ]) {
      expect(() =>
        validateEnvironment({ ...valid, PUBLIC_FRONTEND_URL: origin }),
      ).toThrow('PUBLIC_FRONTEND_URL');
    }
  });

  it.each([
    '*',
    'http://cleaning.example.invalid',
    'https://localhost',
    'https://cleaning.example.invalid/path',
    '',
    'https://cleaning.example.invalid,',
  ])('rejects unsafe production origin %s', (origin) => {
    expect(() =>
      validateEnvironment({ ...valid, CORS_ORIGIN: origin }),
    ).toThrow('HTTPS frontend origins');
  });

  it('accepts multiple explicit origins and a deliberately trusted loopback proxy', () => {
    expect(
      validateEnvironment({
        ...valid,
        CORS_ORIGIN: 'https://a.example.invalid, https://b.example.invalid',
        TRUST_PROXY: 'loopback',
      }).TRUST_PROXY,
    ).toBe('loopback');
  });

  it('rejects the example signing secret in production', () => {
    expect(() =>
      validateEnvironment({
        ...valid,
        JWT_ACCESS_SECRET:
          'replace-with-a-random-secret-of-at-least-32-characters',
      }),
    ).toThrow('placeholder');
  });

  it('rejects production test-reset opt-in', () => {
    expect(() =>
      validateEnvironment({ ...valid, ALLOW_TEST_WORKSPACE_RESET: 'true' }),
    ).toThrow('cannot be enabled');
  });

  it('rejects trusting every public proxy', () => {
    expect(() =>
      validateEnvironment({ ...valid, TRUST_PROXY: 'true' }),
    ).toThrow('TRUST_PROXY');
  });

  it('does not print secret values in validation errors', () => {
    const secret = 'private-short-value';
    try {
      validateEnvironment({ ...valid, JWT_ACCESS_SECRET: secret });
    } catch (error) {
      expect((error as Error).message).toContain('JWT_ACCESS_SECRET');
      expect((error as Error).message).not.toContain(secret);
      return;
    }
    throw new Error('Expected validation failure');
  });

  it.each(['', '0m', 'forever', '15'])(
    'rejects invalid/ambiguous JWT lifetime %s',
    (duration) => {
      expect(() =>
        validateEnvironment({ ...valid, JWT_ACCESS_EXPIRES_IN: duration }),
      ).toThrow('JWT_ACCESS_EXPIRES_IN');
    },
  );

  it('keeps HTTP localhost usable for development', () => {
    expect(
      validateEnvironment({
        ...valid,
        NODE_ENV: 'development',
        CORS_ORIGIN: 'http://localhost:5173',
      }).NODE_ENV,
    ).toBe('development');
  });
});
