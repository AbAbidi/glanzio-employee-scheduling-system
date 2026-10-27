import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { ReportsService } from './reports.service';
import type { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';

type ReportBuilder = {
  buildMonthlyPaymentStatement(
    query: MonthlyReportQueryDto,
    employeeIds: string[],
  ): Promise<{ buffer: Buffer; filename: string }>;
};

function harness() {
  const rows = new Map<
    string,
    { employeeId: string; month: string; pdf: boolean }
  >();
  const findMany = jest.fn((args: { where: { pdfBytes?: null } }) =>
    Promise.resolve(
      [...rows.values()].filter(
        (row) => args.where.pdfBytes !== null || !row.pdf,
      ),
    ),
  );
  const employees = jest.fn().mockResolvedValue([{ id: 'student' }]);
  const period = jest.fn(
    (employeeId: string, month: string, finalize = false) => {
      const key = employeeId + ':' + month;
      if (finalize && !rows.has(key))
        rows.set(key, { employeeId, month, pdf: false });
      return Promise.resolve({
        id: key,
        status: rows.has(key) ? 'CLOSED' : 'DRAFT',
        sourceHash: 'hash',
        data: {},
      });
    },
  );
  const service = new ReportsService(
    {
      employee: { findMany: employees },
      studentStatement: { findMany },
    } as never,
    new ConfigService({ SYSTEM_TIME_ZONE: 'Europe/Paris' }),
    {} as never,
    { period } as never,
  );
  const build = jest
    .spyOn(service as unknown as ReportBuilder, 'buildMonthlyPaymentStatement')
    .mockImplementation((query, ids) => {
      const row = rows.get(ids[0] + ':' + query.month);
      if (!row)
        throw new Error('Month must be closed before rendering final PDF');
      row.pdf = true;
      return Promise.resolve({
        buffer: Buffer.from('final-' + query.month),
        filename: 'final.pdf',
      });
    });
  return { service, rows, period, build, employees };
}

describe('automatic monthly PDF lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-22T12:00:00Z'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('leaves the current month open and previews without rendering a PDF', async () => {
    const { service, period, build, employees } = harness();
    expect(
      (
        await service.studentStatement({
          employeeId: 'student',
          month: '2026-10',
        })
      ).status,
    ).toBe('DRAFT');
    expect(period).toHaveBeenCalledWith('student', '2026-10');
    expect(build).not.toHaveBeenCalled();
    expect(employees).not.toHaveBeenCalled();
  });

  it('closes October only after the month boundary in Europe/Paris', async () => {
    jest.setSystemTime(new Date('2026-10-31T22:59:59Z'));
    const { service, period, build } = harness();
    await service.closeFinishedStudentMonths();
    expect(period).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2000);
    await service.closeFinishedStudentMonths();
    expect(period).toHaveBeenCalledWith('student', '2026-10', true);
    expect(period).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledWith(
      { employeeId: 'student', month: '2026-10' },
      ['student'],
    );
  });

  it('catches up chronologically after downtime and stores the final PDFs', async () => {
    jest.setSystemTime(new Date('2026-12-02T12:00:00Z'));
    const { service, period, rows } = harness();
    await service.closeFinishedStudentMonths();
    expect(period.mock.calls.map((call) => call[1])).toEqual([
      '2026-10',
      '2026-11',
    ]);
    expect([...rows.values()].every((row) => row.pdf)).toBe(true);
    expect(rows.has('student:2026-12')).toBe(false);
  });

  it('shares concurrent jobs and does not re-close or re-render frozen months', async () => {
    jest.setSystemTime(new Date('2026-11-02T12:00:00Z'));
    const { service, period, build } = harness();
    const first = service.closeFinishedStudentMonths();
    expect(service.closeFinishedStudentMonths()).toBe(first);
    await first;
    await service.closeFinishedStudentMonths();
    jest.advanceTimersByTime(31_000);
    await service.closeFinishedStudentMonths();
    expect(period).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('recovers failed PDF rendering without closing the month twice', async () => {
    jest.setSystemTime(new Date('2026-11-02T12:00:00Z'));
    const { service, rows, period, build } = harness();
    build.mockRejectedValueOnce(new Error('Temporary render failure'));
    await expect(service.closeFinishedStudentMonths()).rejects.toThrow(
      'Automatic month-end closure',
    );
    expect(rows.get('student:2026-10')?.pdf).toBe(false);
    await service.closeFinishedStudentMonths();
    expect(rows.get('student:2026-10')?.pdf).toBe(true);
    expect(period).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('runs without an administrator and stops its timer on shutdown', async () => {
    const { service, period, employees } = harness();
    service.onModuleInit();
    jest.setSystemTime(new Date('2026-11-01T00:00:00Z'));
    await jest.advanceTimersByTimeAsync(60_000);
    expect(period).toHaveBeenCalledWith('student', '2026-10', true);
    await service.onModuleDestroy();
    const calls = employees.mock.calls.length;
    await jest.advanceTimersByTimeAsync(60_000);
    expect(employees).toHaveBeenCalledTimes(calls);
  });

  it('closes the preceding month before returning the next preview', async () => {
    jest.setSystemTime(new Date('2026-11-02T12:00:00Z'));
    const { service, period } = harness();
    expect(
      (
        await service.studentStatement({
          employeeId: 'student',
          month: '2026-11',
        })
      ).status,
    ).toBe('DRAFT');
    expect(period.mock.calls.map((call) => call[1])).toEqual([
      '2026-10',
      '2026-11',
    ]);
  });
});
