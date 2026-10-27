/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matchers intentionally use any in expected shapes. */
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { UserStatus } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('Password reset security', () => {
  const token = 'unit-only-reset-token-123456789012345678901234';
  const input = { token, newPassword: 'New-Unit-Password-2026' };
  const record = {
    id: 'reset-id',
    userId: 'user-id',
    usedAt: null,
    expiresAt: new Date('2099-01-01'),
  };
  let service: AuthService;
  let db: ReturnType<typeof database>;
  let environment: string;

  function database() {
    const tx = {
      user: { update: jest.fn().mockResolvedValue({}) },
      passwordResetToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      refreshSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    return {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'user-id', status: UserStatus.ACTIVE }),
      },
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue(record),
        create: jest.fn().mockResolvedValue({}),
      },
      tx,
      $transaction: jest.fn(
        (callback: (transaction: typeof tx) => Promise<void>) => callback(tx),
      ),
    };
  }

  beforeEach(() => {
    db = database();
    environment = 'production';
    const config = {
      get: (key: string) => (key === 'NODE_ENV' ? environment : undefined),
    };
    service = new AuthService(
      db as unknown as PrismaService,
      {} as JwtService,
      config as unknown as ConfigService,
    );
  });

  it.each([
    null,
    { ...record, usedAt: new Date() },
    { ...record, expiresAt: new Date(0) },
  ])(
    'rejects missing, used and expired links without writes',
    async (value) => {
      db.passwordResetToken.findUnique.mockResolvedValue(value);
      await expect(service.resetPassword(input)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );

  it('looks up only the token hash, never stores or queries a plain token', async () => {
    db.passwordResetToken.findUnique.mockResolvedValue(null);
    await expect(service.resetPassword(input)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(db.passwordResetToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: createHash('sha256').update(token).digest('hex') },
    });
  });

  it('consumes the link atomically before changing the password', async () => {
    await service.resetPassword(input);
    const [claim] = db.tx.passwordResetToken.updateMany.mock
      .calls[0] as unknown as [{ where: Record<string, unknown> }];
    expect(claim.where).toEqual({
      id: record.id,
      usedAt: null,
      expiresAt: { gt: expect.any(Date) },
    });
    expect(
      db.tx.passwordResetToken.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(db.tx.user.update.mock.invocationCallOrder[0]);
    const [update] = db.tx.user.update.mock.calls[0] as unknown as [
      { data: { passwordHash: string } },
    ];
    expect(update.data.passwordHash).not.toBe(input.newPassword);
    await expect(
      argon2.verify(update.data.passwordHash, input.newPassword),
    ).resolves.toBe(true);
    expect(db.tx.passwordResetToken.updateMany).toHaveBeenLastCalledWith({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(db.tx.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(db.tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('a lost concurrent claim cannot overwrite the password or create an audit success', async () => {
    db.tx.passwordResetToken.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.resetPassword(input)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(db.tx.user.update).not.toHaveBeenCalled();
    expect(db.tx.refreshSession.updateMany).not.toHaveBeenCalled();
    expect(db.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('does not expose a reset token in production', async () => {
    const response = await service.requestPasswordReset(
      'person@example.invalid',
    );
    expect(response).not.toHaveProperty('developmentResetToken');
    expect(db.passwordResetToken.create).toHaveBeenCalledWith({
      data: {
        userId: record.userId,
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      },
    });
  });

  it('returns the same generic message for missing/inactive/active accounts', async () => {
    const active = await service.requestPasswordReset('person@example.invalid');
    db.user.findUnique.mockResolvedValueOnce(null);
    const missing = await service.requestPasswordReset(
      'missing@example.invalid',
    );
    db.user.findUnique.mockResolvedValueOnce({
      id: record.userId,
      status: UserStatus.INACTIVE,
    });
    const inactive = await service.requestPasswordReset(
      'inactive@example.invalid',
    );
    expect(missing).toEqual(active);
    expect(inactive).toEqual(active);
    expect(db.passwordResetToken.create).toHaveBeenCalledTimes(1);
  });
});
