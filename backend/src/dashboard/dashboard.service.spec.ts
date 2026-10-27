import { UserRole } from '../generated/prisma/client';
import { DashboardService } from './dashboard.service';

describe('DashboardService operational reset', () => {
  const workAssignment = {
    count: jest.fn().mockResolvedValue(12),
    deleteMany: jest.fn().mockResolvedValue({ count: 12 }),
  };
  const recurringTemplate = {
    count: jest.fn().mockResolvedValue(3),
    deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
  };
  const notification = {
    count: jest.fn().mockResolvedValue(4),
    deleteMany: jest.fn().mockResolvedValue({ count: 4 }),
  };
  const transactionClient = {
    workAssignment,
    recurringTemplate,
    notification,
    studentStatement: {
      count: jest.fn().mockResolvedValue(2),
      deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    studentCreditMovement: {
      count: jest.fn().mockResolvedValue(3),
      deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
  };
  const prisma = {
    ...transactionClient,
    $transaction: jest.fn(async (operation: unknown) => {
      if (Array.isArray(operation)) return Promise.all(operation);
      return (operation as (client: typeof transactionClient) => unknown)(
        transactionClient,
      );
    }),
  };
  const auditService = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new DashboardService(
    prisma as never,
    { get: (_key: string, fallback: unknown) => fallback } as never,
    {} as never,
    auditService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('previews the records affected without deleting them', async () => {
    await expect(service.resetOperationalDataPreview()).resolves.toMatchObject({
      assignments: 12,
      recurringSchedules: 3,
      notifications: 4,
    });
    expect(workAssignment.deleteMany).not.toHaveBeenCalled();
    expect(recurringTemplate.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes operational records, preserves master data, and audits the reset', async () => {
    await expect(
      service.resetOperationalData('admin-1', {
        confirmation: 'RESET OPERATIONS',
      }),
    ).resolves.toEqual({
      deletedAssignments: 12,
      deletedRecurringSchedules: 3,
      deletedNotifications: 4,
      deletedStudentStatements: 2,
      deletedStudentCreditMovements: 3,
      preserved: ['administrators', 'employees', 'clients', 'cleaning sites'],
    });
    expect(workAssignment.deleteMany).toHaveBeenCalledTimes(1);
    expect(recurringTemplate.deleteMany).toHaveBeenCalledTimes(1);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'OPERATIONAL_DATA_RESET',
      }),
    );
  });
});

describe('DashboardService full test-workspace reset', () => {
  const model = (count: number) => ({
    count: jest.fn().mockResolvedValue(count),
    deleteMany: jest.fn().mockResolvedValue({ count }),
  });
  const workAssignment = model(12);
  const recurringTemplate = model(3);
  const notification = model(4);
  const accountInvitation = model(5);
  const refreshSession = model(6);
  const passwordResetToken = model(2);
  const employee = model(7);
  const user = model(8);
  const cleaningSite = model(9);
  const client = model(10);
  const studentStatement = model(2);
  const studentCreditMovement = model(3);
  const auditLog = {
    create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
  };
  const transactionClient = {
    workAssignment,
    recurringTemplate,
    notification,
    accountInvitation,
    refreshSession,
    passwordResetToken,
    employee,
    user,
    cleaningSite,
    client,
    auditLog,
    studentStatement,
    studentCreditMovement,
  };
  const prisma = {
    ...transactionClient,
    $transaction: jest.fn(async (operation: unknown) => {
      if (Array.isArray(operation)) return Promise.all(operation);
      return (operation as (client: typeof transactionClient) => unknown)(
        transactionClient,
      );
    }),
  };
  const configService = {
    get: jest.fn((key: string, fallback: string) =>
      key === 'NODE_ENV' ? 'development' : fallback,
    ),
  };
  const service = new DashboardService(
    prisma as never,
    configService as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('previews every test-data group without deleting anything', async () => {
    await expect(service.resetTestWorkspacePreview()).resolves.toMatchObject({
      assignments: 12,
      recurringSchedules: 3,
      notifications: 4,
      invitations: 5,
      refreshSessions: 6,
      passwordResetTokens: 2,
      employees: 7,
      employeeAccounts: 8,
      cleaningSites: 9,
      clients: 10,
      studentStatements: 2,
      studentCreditMovements: 3,
      storedPdfs: 2,
    });
    expect(employee.deleteMany).not.toHaveBeenCalled();
    expect(user.deleteMany).not.toHaveBeenCalled();
    expect(client.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes the complete test workspace while preserving administrators', async () => {
    await expect(
      service.resetTestWorkspace('admin-1', {
        confirmation: 'RESET TEST WORKSPACE',
      }),
    ).resolves.toEqual({
      deletedAssignments: 12,
      deletedRecurringSchedules: 3,
      deletedNotifications: 4,
      deletedInvitations: 5,
      deletedRefreshSessions: 6,
      deletedPasswordResetTokens: 2,
      deletedEmployees: 7,
      deletedEmployeeAccounts: 8,
      deletedCleaningSites: 9,
      deletedClients: 10,
      deletedStudentStatements: 2,
      deletedStudentCreditMovements: 3,
      preserved: [
        'administrator accounts',
        'administrator sessions',
        'audit history',
        'database schema and migrations',
      ],
    });

    expect(refreshSession.deleteMany).toHaveBeenCalledWith({
      where: { user: { role: { in: [UserRole.EMPLOYEE, UserRole.MANAGER] } } },
    });
    expect(passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { user: { role: { in: [UserRole.EMPLOYEE, UserRole.MANAGER] } } },
    });
    expect(user.deleteMany).toHaveBeenCalledWith({
      where: { role: { in: [UserRole.EMPLOYEE, UserRole.MANAGER] } },
    });
    expect(auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 'admin-1',
        action: 'TEST_WORKSPACE_RESET',
        entityType: 'SystemMaintenance',
        entityId: 'test-workspace',
        metadata: {
          deletedAssignments: 12,
          deletedRecurringSchedules: 3,
          deletedNotifications: 4,
          deletedInvitations: 5,
          deletedRefreshSessions: 6,
          deletedPasswordResetTokens: 2,
          deletedEmployees: 7,
          deletedEmployeeAccounts: 8,
          deletedCleaningSites: 9,
          deletedClients: 10,
          deletedStudentStatements: 2,
          deletedStudentCreditMovements: 3,
        },
      },
    });
    expect(notification.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      workAssignment.deleteMany.mock.invocationCallOrder[0],
    );
    expect(workAssignment.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      employee.deleteMany.mock.invocationCallOrder[0],
    );
    expect(employee.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      user.deleteMany.mock.invocationCallOrder[0],
    );
    expect(
      studentCreditMovement.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(studentStatement.deleteMany.mock.invocationCallOrder[0]);
    expect(
      studentStatement.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(employee.deleteMany.mock.invocationCallOrder[0]);
    expect(cleaningSite.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      client.deleteMany.mock.invocationCallOrder[0],
    );
  });

  it.each(['false', 'true'])(
    'blocks every test reset in production even with legacy opt-in %s',
    async (flag) => {
      const productionService = new DashboardService(
        prisma as never,
        {
          get: jest.fn((key: string, fallback: string) => {
            if (key === 'NODE_ENV') return 'production';
            if (key === 'ALLOW_TEST_WORKSPACE_RESET') return flag;
            return fallback;
          }),
        } as never,
        {} as never,
        {} as never,
      );

      await expect(
        productionService.resetTestWorkspacePreview(),
      ).rejects.toThrow('Test-data reset is disabled in production.');
      await expect(
        productionService.resetTestWorkspace('admin', {
          confirmation: 'RESET TEST WORKSPACE',
        }),
      ).rejects.toThrow('disabled in production');
      await expect(
        productionService.resetOperationalDataPreview(),
      ).rejects.toThrow('disabled in production');
      await expect(
        productionService.resetOperationalData('admin', {
          confirmation: 'RESET OPERATIONS',
        }),
      ).rejects.toThrow('disabled in production');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );
});
