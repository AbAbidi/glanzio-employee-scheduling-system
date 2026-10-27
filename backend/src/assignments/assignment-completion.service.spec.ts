import { AssignmentCompletionService } from './assignment-completion.service';

function harness() {
  const visits = [
    {
      id: 'series-today',
      recurringTemplateId: 'series',
      status: 'SCHEDULED',
      endAt: new Date('2026-10-22T08:00:00Z'),
    },
    {
      id: 'series-next-week',
      recurringTemplateId: 'series',
      status: 'SCHEDULED',
      endAt: new Date('2026-10-29T08:00:00Z'),
    },
    {
      id: 'single-today',
      recurringTemplateId: null,
      status: 'SCHEDULED',
      endAt: new Date('2026-10-22T09:00:00Z'),
    },
    {
      id: 'cancelled',
      recurringTemplateId: 'series',
      status: 'CANCELLED',
      endAt: new Date('2026-10-21T09:00:00Z'),
    },
    {
      id: 'draft',
      recurringTemplateId: null,
      status: 'DRAFT',
      endAt: new Date('2026-10-21T09:00:00Z'),
    },
    {
      id: 'done',
      recurringTemplateId: 'series',
      status: 'COMPLETED',
      endAt: new Date('2026-10-20T09:00:00Z'),
    },
  ];
  const audit = jest.fn().mockResolvedValue({ count: 2 });
  const update = jest.fn(
    ({
      where,
      data,
    }: {
      where: { status: string; endAt: { lte: Date } };
      data: { status: string };
    }) => {
      const changed = visits.filter(
        (visit) =>
          visit.status === where.status && visit.endAt <= where.endAt.lte,
      );
      for (const visit of changed) visit.status = data.status;
      return Promise.resolve(changed);
    },
  );
  const transaction = jest.fn((action: (tx: unknown) => unknown) =>
    action({
      workAssignment: { updateManyAndReturn: update },
      auditLog: { createMany: audit },
    }),
  );
  const service = new AssignmentCompletionService({
    $transaction: transaction,
  } as never);
  return { service, visits, audit, update, transaction };
}

describe('individual occurrence completion', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-22T13:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('completes the ended visit without waiting for or completing the rest of its series', async () => {
    const { service, visits, audit } = harness();
    expect(await service.reconcile()).toBe(2);
    expect(visits.find((visit) => visit.id === 'series-today')?.status).toBe(
      'COMPLETED',
    );
    expect(visits.find((visit) => visit.id === 'single-today')?.status).toBe(
      'COMPLETED',
    );
    expect(
      visits.find((visit) => visit.id === 'series-next-week')?.status,
    ).toBe('SCHEDULED');
    expect(visits.find((visit) => visit.id === 'cancelled')?.status).toBe(
      'CANCELLED',
    );
    expect(visits.find((visit) => visit.id === 'draft')?.status).toBe('DRAFT');
    const [auditInput] = audit.mock.calls[0] as [
      {
        data: { entityId: string; action: string }[];
      },
    ];
    expect(
      auditInput.data.map((row) => ({
        entityId: row.entityId,
        action: row.action,
      })),
    ).toContainEqual({
      entityId: 'series-today',
      action: 'ASSIGNMENT_AUTO_COMPLETED',
    });
  });

  it('is idempotent and shares concurrent synchronizations', async () => {
    const { service, audit, transaction } = harness();
    const first = service.reconcile();
    expect(service.reconcile()).toBe(first);
    await first;
    expect(transaction).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1100);
    expect(await service.reconcile()).toBe(0);
    expect(audit).toHaveBeenCalledTimes(1);
  });

  it('retries a failed transaction instead of caching failure', async () => {
    const { service, transaction } = harness();
    transaction.mockRejectedValueOnce(new Error('Database unavailable'));
    await expect(service.reconcile()).rejects.toThrow('Database unavailable');
    expect(await service.reconcile()).toBe(2);
  });

  it('checks again periodically and clears the background timer on shutdown', async () => {
    const { service, transaction } = harness();
    service.onModuleInit();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(transaction).toHaveBeenCalledTimes(2);
    service.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(transaction).toHaveBeenCalledTimes(2);
  });
});
