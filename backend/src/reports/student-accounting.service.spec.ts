/* eslint-disable @typescript-eslint/require-await -- Promise-based in-memory Prisma test double. */
import { ConfigService } from '@nestjs/config';
import { Settings } from 'luxon';
import { StudentAccountingService } from './student-accounting.service';

function harness() {
  type Row = {
    id: string;
    employeeId: string;
    month: string;
    revision: number;
    status: string;
    closedAt: Date | null;
    sourceHash: string;
    payload: unknown;
    pdfBytes: Uint8Array | null;
  };
  const rows: Row[] = [];
  const employee = {
    id: 'student',
    isStudent: true,
    firstName: 'Fictional',
    lastName: 'Student',
    hourlyRate: 20,
  };
  const links = [
    {
      assignmentId: 'assignment',
      agreedHourlyRate: 20,
      assignment: {
        title: 'Test work',
        status: 'COMPLETED',
        startAt: new Date('2026-10-05T07:00:00Z'),
        endAt: new Date('2026-10-07T19:00:00Z'),
      },
    },
  ];
  const db = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'student' }]),
    employee: { findUnique: jest.fn().mockResolvedValue(employee) },
    assignmentEmployee: { findMany: jest.fn().mockResolvedValue(links) },
    studentStatement: {
      findMany: jest.fn(async () => [...rows]),
      create: jest.fn(async ({ data }: { data: Partial<Row> }) => {
        const row = {
          id: `snapshot-${rows.length}`,
          revision: 1,
          status: 'DRAFT',
          closedAt: null,
          pdfBytes: null,
          ...data,
        } as Row;
        rows.push(row);
        return row;
      }),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<Row>;
        }) => {
          const row = rows.find((item) => item.id === where.id)!;
          Object.assign(row, data);
          return row;
        },
      ),
      findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) =>
        rows.find((row) => row.id === where.id)!,
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: Partial<Row>;
          data: Partial<Row>;
        }) => {
          const row = rows.find(
            (item) =>
              item.id === where.id &&
              item.sourceHash === where.sourceHash &&
              item.status === where.status &&
              item.pdfBytes === null,
          );
          if (row) Object.assign(row, data);
          return { count: row ? 1 : 0 };
        },
      ),
    },
    studentCreditMovement: { deleteMany: jest.fn(), createMany: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit' }) },
  };
  const prisma = {
    ...db,
    $transaction: jest.fn(async (operation: (tx: typeof db) => unknown) =>
      operation(db),
    ),
  };
  return {
    service: new StudentAccountingService(
      prisma as never,
      new ConfigService({ SYSTEM_TIME_ZONE: 'Europe/Berlin' }),
    ),
    db,
    rows,
    links,
  };
}

describe('student snapshots and idempotence', () => {
  beforeEach(() => {
    Settings.now = () => Date.parse('2026-12-01T12:00:00Z');
  });
  afterEach(() => {
    Settings.now = () => Date.now();
  });
  it('reuses the same draft and does not re-record credit on repeat calls', async () => {
    const { service, db } = harness();
    const first = await service.period('student', '2026-10');
    const again = await service.period('student', '2026-10');
    expect(again).toEqual(first);
    expect(db.studentStatement.create).toHaveBeenCalledTimes(1);
    expect(db.studentCreditMovement.createMany).toHaveBeenCalledTimes(1);
    expect(db.$queryRaw).toHaveBeenCalledTimes(2);
  });
  it('projects October credit into November without closing either month', async () => {
    const { service, rows } = harness();
    const november = await service.period('student', '2026-11');
    expect(november.data.workedMinutes).toBe(0);
    expect(november.data.carryInMinutes).toBe(1200);
    expect(november.data.creditedMinutes).toBe(1200);
    expect(rows.every((row) => row.status === 'DRAFT')).toBe(true);
  });
  it('excludes SCHEDULED work from credit but reserves its calendar interval', async () => {
    const { service, links } = harness();
    links[0].assignment.status = 'SCHEDULED';
    const snapshot = await service.period('student', '2026-10');
    expect(snapshot.data.workedMinutes).toBe(0);
    expect(snapshot.data.creditedMinutes).toBe(0);
    expect(snapshot.data.busyIntervals.length).toBeGreaterThan(0);
  });
  it('invalidates the PDF cache if sources change while the period is open', async () => {
    const { service, links, db } = harness();
    const before = await service.period('student', '2026-10');
    await service.pdf(before, async () => Buffer.from('old-pdf'));
    links[0].assignment.endAt = new Date('2026-10-07T18:00:00Z');
    const after = await service.period('student', '2026-10');
    expect(after.sourceHash).not.toBe(before.sourceHash);
    expect(
      (await db.studentStatement.findUniqueOrThrow({ where: { id: after.id } }))
        .pdfBytes,
    ).toBeNull();
    expect(after.id).toBe(before.id);
    expect(db.studentStatement.create).toHaveBeenCalledTimes(1);
    const newPdf = await service.pdf(after, async () =>
      Buffer.from('updated-monthly-draft'),
    );
    expect(newPdf.toString()).toBe('updated-monthly-draft');
    expect(
      await service.pdf(after, async () =>
        Buffer.from('must-not-render-again'),
      ),
    ).toEqual(newPdf);
  });
  it('freezes a closed month and returns exactly the cached PDF bytes', async () => {
    const { service, db, links } = harness();
    const closed = await service.period('student', '2026-10', true);
    const render = jest.fn(async () => Buffer.from('same-pdf'));
    expect(await service.pdf(closed, render)).toEqual(
      await service.pdf(closed, render),
    );
    expect(render).toHaveBeenCalledTimes(1);
    links[0].assignment.endAt = new Date('2026-10-07T17:00:00Z');
    expect(
      await service.pdf(await service.period('student', '2026-10'), render),
    ).toEqual(Buffer.from('same-pdf'));
    db.assignmentEmployee.findMany.mockClear();
    expect((await service.period('student', '2026-10')).status).toBe('CLOSED');
    expect(db.assignmentEmployee.findMany).not.toHaveBeenCalled();
  });
  it('requires chronological closure and rejects early closure', async () => {
    const { service } = harness();
    await expect(service.period('student', '2026-11', true)).rejects.toThrow(
      'Close 2026-10 first',
    );
    await expect(service.period('student', '2026-12', true)).rejects.toThrow(
      'Only finished months',
    );
    await service.period('student', '2026-10', true);
    expect((await service.period('student', '2026-11', true)).status).toBe(
      'CLOSED',
    );
  });
});
