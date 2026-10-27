import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { UserRole } from '../generated/prisma/client';

describe('archive export isolation', () => {
  beforeEach(() =>
    jest.useFakeTimers().setSystemTime(new Date('2026-10-22T12:00:00Z')),
  );
  afterEach(() => jest.useRealTimers());

  const actor = {
    id: 'admin',
    email: 'admin@example.test',
    role: UserRole.ADMIN,
  };
  type Builder = {
    buildMonthlyPaymentStatement(
      query: unknown,
      ids: string[],
    ): Promise<unknown>;
  };

  it('only selects active employees for default combined exports', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'active' }]);
    const service = new ReportsService(
      { employee: { findMany } } as never,
      new ConfigService(),
      {} as never,
      {} as never,
    );
    const build = jest
      .spyOn(service as unknown as Builder, 'buildMonthlyPaymentStatement')
      .mockResolvedValue({ buffer: Buffer.from('test'), filename: 'test.pdf' });
    await service.monthlyPaymentStatement(actor, { month: '2026-10' });
    expect(findMany).toHaveBeenCalledWith({
      where: { active: true },
      select: { id: true },
    });
    expect(build).toHaveBeenCalledWith({ month: '2026-10' }, ['active']);
  });

  it('rejects explicit operational export of an archived employee without touching stored PDFs', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'archived', active: false });
    const service = new ReportsService(
      { employee: { findUnique } } as never,
      new ConfigService(),
      {} as never,
      {} as never,
    );
    const build = jest
      .spyOn(service as unknown as Builder, 'buildMonthlyPaymentStatement')
      .mockResolvedValue({});
    await expect(
      service.monthlyPaymentStatement(actor, {
        month: '2026-10',
        employeeId: 'archived',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(build).not.toHaveBeenCalled();
  });
});
