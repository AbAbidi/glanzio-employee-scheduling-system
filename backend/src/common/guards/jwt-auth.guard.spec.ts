import {
  ServiceUnavailableException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard security boundaries', () => {
  const id = '00000000-0000-4000-8000-000000000099';
  const user = {
    id,
    email: 'guard@example.invalid',
    role: UserRole.EMPLOYEE,
    status: UserStatus.ACTIVE,
    passwordChangedAt: null,
  };
  let jwt: { verifyAsync: jest.Mock };
  let prisma: { user: { findUnique: jest.Mock } };
  let guard: JwtAuthGuard;
  const context = (authorization?: string) => {
    const request = { headers: { authorization } };
    return {
      request,
      execution: {
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext,
    };
  };

  beforeEach(() => {
    jwt = {
      verifyAsync: jest
        .fn()
        .mockResolvedValue({ sub: id, role: UserRole.ADMIN, iat: 100 }),
    };
    prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
    guard = new JwtAuthGuard(
      jwt as unknown as JwtService,
      { getOrThrow: () => 'unit-test-secret' } as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
  });

  it.each([undefined, '', 'Basic abc'])(
    'rejects missing/wrong authorization: %s',
    async (header) => {
      await expect(
        guard.canActivate(context(header).execution),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwt.verifyAsync).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    },
  );

  it('rejects expired/invalid signatures before querying the database', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    await expect(
      guard.canActivate(context('Bearer expired').execution),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it.each([{}, { sub: 'not-a-uuid' }, null])(
    'rejects malformed signed claims',
    async (claims) => {
      jwt.verifyAsync.mockResolvedValue(claims);
      await expect(
        guard.canActivate(context('Bearer malformed').execution),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    },
  );

  it.each([
    null,
    { ...user, status: UserStatus.INACTIVE },
    { ...user, status: UserStatus.INVITED },
  ])('denies missing/disabled/invited accounts immediately', async (record) => {
    prisma.user.findUnique.mockResolvedValue(record);
    await expect(
      guard.canActivate(context('Bearer signed').execution),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('takes authorization roles from the database, never stale JWT roles', async () => {
    const { execution, request } = context('Bearer signed');
    await expect(guard.canActivate(execution)).resolves.toBe(true);
    expect(request).toHaveProperty('user', {
      id,
      email: user.email,
      role: UserRole.EMPLOYEE,
    });
  });

  it('rejects tokens issued before a password change', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...user,
      passwordChangedAt: new Date(101_000),
    });
    await expect(
      guard.canActivate(context('Bearer signed').execution),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokes stale access immediately after a role change, including within the same second', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, authVersion: 1 });
    await expect(
      guard.canActivate(context('Bearer signed').execution),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    jwt.verifyAsync.mockResolvedValue({ sub: id, ver: 1, iat: 100 });
    await expect(
      guard.canActivate(context('Bearer fresh').execution),
    ).resolves.toBe(true);
  });

  it('returns 503 for database outages, not a false expired-token 401', async () => {
    prisma.user.findUnique.mockRejectedValue(
      new Error('database host unavailable; private diagnostic'),
    );
    await expect(
      guard.canActivate(context('Bearer signed').execution),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      guard.canActivate(context('Bearer signed').execution),
    ).rejects.not.toThrow('private diagnostic');
  });
});
