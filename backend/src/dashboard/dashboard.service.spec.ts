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
    {} as never,
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
