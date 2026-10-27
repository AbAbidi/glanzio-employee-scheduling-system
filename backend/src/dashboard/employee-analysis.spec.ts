import { ConfigService } from '@nestjs/config';
import { Settings } from 'luxon';
import { UserRole } from '../generated/prisma/client';
import { DashboardService } from './dashboard.service';

describe('employee monthly and weekly completion analysis', () => {
  beforeEach(() => {
    Settings.now = () => Date.parse('2026-10-22T13:00:00Z');
  });
  afterEach(() => {
    Settings.now = () => Date.now();
  });

  it('includes a completed recurring occurrence immediately while its later visits are scheduled', async () => {
    const employees = [
      {
        id: 'karim',
        firstName: 'Karim',
        lastName: 'monic',
        isStudent: true,
        active: true,
        createdAt: new Date('2026-10-22'),
      },
      {
        id: 'regular',
        firstName: 'Regular',
        lastName: 'Employee',
        isStudent: false,
        active: true,
        createdAt: new Date('2026-10-01'),
      },
    ];
    const assignments = [
      {
        id: 'today-occurrence',
        recurringTemplateId: 'weekly-series',
        status: 'COMPLETED',
        startAt: new Date('2026-10-22T05:00Z'),
        endAt: new Date('2026-10-22T08:00Z'),
        travelDistanceMeters: 1000,
        clientCharge: 100,
        employees: [
          {
            employeeId: 'karim',
            agreedHourlyRate: 20,
            employee: { hourlyRate: 20 },
          },
        ],
      },
      {
        id: 'regular-work',
        status: 'COMPLETED',
        startAt: new Date('2026-10-21T07:00Z'),
        endAt: new Date('2026-10-21T09:00Z'),
        travelDistanceMeters: null,
        clientCharge: 50,
        employees: [
          {
            employeeId: 'regular',
            agreedHourlyRate: null,
            employee: { hourlyRate: 15 },
          },
        ],
      },
    ];
    const findMany = jest.fn(({ where }: { where: { status: unknown } }) =>
      Promise.resolve(where.status === 'COMPLETED' ? assignments : []),
    );
    const period = jest.fn().mockResolvedValue({
      data: {
        workedMinutes: 180,
        creditedMinutes: 180,
        carryInMinutes: 0,
        carryOutMinutes: 0,
      },
    });
    const completion = { reconcile: jest.fn().mockResolvedValue(1) };
    const service = new DashboardService(
      {
        workAssignment: { findMany, count: jest.fn().mockResolvedValue(0) },
        employee: {
          findMany: jest.fn(({ where }: { where: { active: boolean } }) =>
            Promise.resolve(
              where.active
                ? employees
                : [{ ...employees[0], id: 'archived', active: false }],
            ),
          ),
          count: jest.fn().mockResolvedValue(2),
        },
      } as never,
      new ConfigService({ SYSTEM_TIME_ZONE: 'Europe/Berlin' }),
      {
        monthly: jest.fn().mockResolvedValue({ items: [] }),
        studentAccounting: { period },
      } as never,
      {} as never,
      completion as never,
    );
    const result = await service.get({
      id: 'admin',
      email: 'admin@example.test',
      role: UserRole.ADMIN,
    });
    if (!('operationsAnalysis' in result))
      throw new Error('Expected administrator dashboard');
    const monthly = result.operationsAnalysis.employees.filter(
      (row) => row.month === '2026-10',
    );
    expect(monthly.find((row) => row.employee.id === 'karim')).toMatchObject({
      completedAssignments: 1,
      completedMinutes: 180,
      creditedMinutes: 180,
      amount: 60,
    });
    expect(monthly.find((row) => row.employee.id === 'regular')).toMatchObject({
      completedAssignments: 1,
      completedMinutes: 120,
      amount: 30,
    });
    expect(result.operationsAnalysis.weeklyStudents.items[0]).toMatchObject({
      employee: { id: 'karim' },
      workedMinutes: 180,
      exceededByMinutes: 0,
    });
    expect(completion.reconcile).toHaveBeenCalledTimes(1);
    expect(monthly.every((row) => row.employee.active)).toBe(true);
    const archived = await service.archivedAnalysis();
    expect(archived.employees.every((row) => !row.employee.active)).toBe(true);
    expect(archived.weeklyStudents.items[0].employee.id).toBe('archived');
    expect(
      findMany.mock.calls.some(([query]) => query.where.status === 'COMPLETED'),
    ).toBe(true);
  });
});
