import { ConfigService } from '@nestjs/config';
import { PDFDocument } from 'pdf-lib';
import { UserRole } from '../generated/prisma/client';
import { ReportsService } from './reports.service';
import { PaymentStatementPdfService } from './payment-statement-pdf.service';
import { allocateStudentMonth, nextWeekUsage } from './student-accounting';
import type { StudentSnapshot } from './student-accounting.service';

describe('combined monthly statement exports', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-22T12:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('combines every individual PDF and carries unallocated October hours into November', async () => {
    const config = new ConfigService({ SYSTEM_TIME_ZONE: 'Europe/Paris' });
    const records = ['student', 'regular'].map((id) => ({
      id,
      firstName: id,
      lastName: 'Test',
      phone: null,
      active: true,
      isStudent: id === 'student',
      hourlyRate: 20,
      user: { email: id + '@example.test', status: 'ACTIVE' },
    }));
    const october = allocateStudentMonth({
      month: '2026-10',
      zone: 'Europe/Paris',
      employeeName: 'student Test',
      sources: [
        {
          key: 'october-work',
          assignmentId: 'october-work',
          title: 'Completed October work',
          originMonth: '2026-10',
          sourceStart: '2026-10-05T07:00:00Z',
          sourceEnd: '2026-10-07T19:00:00Z',
          minutes: 3600,
          hourlyRate: 20,
        },
      ],
    });
    const november = allocateStudentMonth({
      month: '2026-11',
      zone: 'Europe/Paris',
      employeeName: 'student Test',
      sources: [],
      carryIn: october.carryOut,
      previousWeeks: nextWeekUsage(october),
    });
    const cache = new Map<string, Buffer>();
    const accounting = {
      period: jest.fn((id: string, month: string) =>
        Promise.resolve({
          id: id + ':' + month,
          status: 'DRAFT',
          sourceHash: month,
          closedAt: null,
          data: month === '2026-10' ? october : november,
        }),
      ),
      pdf: jest.fn(
        async (snapshot: StudentSnapshot, generate: () => Promise<Buffer>) => {
          const existing = cache.get(snapshot.id);
          if (existing) return existing;
          const bytes = await generate();
          cache.set(snapshot.id, bytes);
          return bytes;
        },
      ),
    };
    const links = jest.fn().mockResolvedValue([]);
    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue({ id: 'student' }),
        findMany: jest.fn(
          (args: { select?: unknown; where?: { id?: { in: string[] } } }) =>
            Promise.resolve(
              args.select
                ? records.map(({ id }) => ({ id }))
                : records.filter((row) => args.where?.id?.in.includes(row.id)),
            ),
        ),
      },
      assignmentEmployee: { findMany: links },
      studentStatement: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const pdf = new PaymentStatementPdfService(config);
    const render = jest.spyOn(pdf, 'build');
    const reports = new ReportsService(
      prisma as never,
      config,
      pdf,
      accounting as never,
    );
    const actor = {
      id: 'admin',
      email: 'admin@example.test',
      role: UserRole.ADMIN,
    };
    const individual = await reports.monthlyPaymentStatement(actor, {
      month: '2026-10',
      employeeId: 'student',
    });
    const allOctober = await reports.monthlyPaymentStatement(actor, {
      month: '2026-10',
    });
    const allNovember = await reports.monthlyPaymentStatement(actor, {
      month: '2026-11',
    });
    expect((await PDFDocument.load(individual.buffer)).getPageCount()).toBe(1);
    expect((await PDFDocument.load(allOctober.buffer)).getPageCount()).toBe(2);
    expect((await PDFDocument.load(allNovember.buffer)).getPageCount()).toBe(2);
    expect(october.creditedMinutes).toBe(2400);
    expect(october.carryOutMinutes).toBe(1200);
    expect(november.workedMinutes).toBe(0);
    expect(november.carryInMinutes).toBe(1200);
    expect(november.creditedMinutes).toBe(1200);
    expect(
      november.allocations.every((row) => row.originMonth === '2026-10'),
    ).toBe(true);
    expect(
      render.mock.calls.filter(
        ([statements]) => statements[0]?.studentSimulation,
      ),
    ).toHaveLength(2);
    expect(cache.get('student:2026-10')).toEqual(individual.buffer);
    const queries = links.mock.calls as [
      { where: { assignment: { status: string; endAt: { lte: Date } } } },
    ][];
    expect(
      queries.every(([query]) => query.where.assignment.status === 'COMPLETED'),
    ).toBe(true);
    expect(queries.at(-1)?.[0].where.assignment.endAt.lte).toEqual(
      new Date('2026-10-22T12:00:00Z'),
    );
  });
});
