import {
  ForbiddenException,
  NotFoundException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ManagerScopeGuard } from './manager-scope.guard';
import type { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '../../generated/prisma/client';

describe('Manager archive boundary', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const employee = { findFirst: jest.fn() };
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new ManagerScopeGuard(
    reflector as unknown as Reflector,
    { employee } as unknown as PrismaService,
  );
  function context(
    role: UserRole,
    query: Record<string, unknown> = {},
    params: Record<string, unknown> = {},
  ) {
    return {
      getHandler: () => context,
      getClass: () => ManagerScopeGuard,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role }, query, params }),
      }),
    } as unknown as ExecutionContext;
  }
  beforeEach(() => {
    jest.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue('employee');
    employee.findFirst.mockResolvedValue(null);
  });
  it('does not restrict owner archive access', async () => {
    await expect(
      guard.canActivate(context(UserRole.ADMIN, { active: 'false' }, { id })),
    ).resolves.toBe(true);
    expect(employee.findFirst).not.toHaveBeenCalled();
  });
  it('denies archive filters before any database read', async () => {
    await expect(
      guard.canActivate(context(UserRole.MANAGER, { active: 'false' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(employee.findFirst).not.toHaveBeenCalled();
  });
  it('denies guessed inactive record IDs and report employee IDs', async () => {
    await expect(
      guard.canActivate(context(UserRole.MANAGER, {}, { id })),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      guard.canActivate(context(UserRole.MANAGER, { employeeId: id })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('lets the UUID validation pipe handle malformed IDs without a database cast error', async () => {
    await expect(
      guard.canActivate(context(UserRole.MANAGER, {}, { id: 'invalid' })),
    ).resolves.toBe(true);
    expect(employee.findFirst).not.toHaveBeenCalled();
  });
  it('permits active employee detail requests', async () => {
    employee.findFirst.mockResolvedValue({ id });
    await expect(
      guard.canActivate(context(UserRole.MANAGER, {}, { id })),
    ).resolves.toBe(true);
    expect(employee.findFirst).toHaveBeenCalledWith({
      where: { id, active: true },
      select: { id: true },
    });
  });
});
