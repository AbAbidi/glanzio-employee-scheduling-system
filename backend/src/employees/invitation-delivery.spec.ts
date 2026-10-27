import { ConfigService } from '@nestjs/config';
import { EmployeesService } from './employees.service';

describe('Manual invitation links in production', () => {
  it('returns the real public activation link to the admin flow without the development-only field', () => {
    const service = new EmployeesService(
      {} as never,
      {} as never,
      new ConfigService({
        NODE_ENV: 'production',
        PUBLIC_FRONTEND_URL: 'https://glanzio.example/',
      }),
    );
    const delivery = service as unknown as {
      invitationDelivery(
        token: string,
        expiresAt: Date,
      ): { invitationUrl: string; developmentInvitationUrl?: string };
    };
    const result = delivery.invitationDelivery(
      'test-token-only',
      new Date('2026-11-01T00:00:00Z'),
    );
    expect(result.invitationUrl).toBe(
      'https://glanzio.example/login?invitation=test-token-only',
    );
    expect(result).not.toHaveProperty('developmentInvitationUrl');
  });
});
