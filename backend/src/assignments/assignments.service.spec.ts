import { DateTime } from 'luxon';
import {
  AssignmentStatus,
  RecurrenceFrequency,
  UserRole,
} from '../generated/prisma/client';
import type { CreateAssignmentDto } from './dto/create-assignment.dto';
import type { CreateRecurringAssignmentDto } from './dto/create-recurring-assignment.dto';
import { AssignmentsService } from './assignments.service';

type TestableAssignmentsService = {
  generateOccurrences(
    input: CreateRecurringAssignmentDto,
  ): Array<{ startAt: Date; endAt: Date }>;
  assertWorkingDayRange(startAt: Date, endAt: Date): void;
};

const configService = {
  get: jest.fn().mockReturnValue('Europe/Berlin'),
};
const auditService = { record: jest.fn().mockResolvedValue(undefined) };

function createInput(startAt: string, endAt: string): CreateAssignmentDto {
  return {
    siteId: '00000000-0000-4000-8000-000000000001',
    title: 'Office cleaning',
    startAt,
    endAt,
    status: AssignmentStatus.SCHEDULED,
    clientCharge: 120,
    employeeIds: [],
    employees: [],
  };
}

function recurringInput(
  overrides: Partial<CreateRecurringAssignmentDto> = {},
): CreateRecurringAssignmentDto {
  return {
    siteId: '00000000-0000-4000-8000-000000000001',
    title: 'Recurring office cleaning',
    frequency: RecurrenceFrequency.DAILY,
    interval: 1,
    daysOfWeek: [],
    firstStartAt: '2026-09-18T09:00:00+02:00',
    durationMinutes: 60,
    untilAt: '2026-09-22T23:59:59+02:00',
    clientCharge: 120,
    employeeIds: [],
    employees: [],
    ...overrides,
  };
}

function localDates(occurrences: Array<{ startAt: Date }>): string[] {
  return occurrences.map(({ startAt }) =>
    DateTime.fromJSDate(startAt, { zone: 'Europe/Berlin' }).toISODate()!,
  );
}

describe('AssignmentsService weekday scheduling policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['Saturday', '2026-09-19T09:00:00+02:00', '2026-09-19T10:00:00+02:00'],
    ['Sunday', '2026-09-20T09:00:00+02:00', '2026-09-20T10:00:00+02:00'],
  ])('rejects a one-time assignment on %s', async (_day, startAt, endAt) => {
    const service = new AssignmentsService(
      {} as never,
      configService as never,
      auditService as never,
    );

    await expect(
      service.create('admin-1', createInput(startAt, endAt)),
    ).rejects.toThrow('Assignments cannot be scheduled on Saturday or Sunday.');
  });

  it('rejects an update that moves an assignment to the weekend', async () => {
    const prisma = {
      workAssignment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'assignment-1',
          status: AssignmentStatus.SCHEDULED,
          startAt: new Date('2026-09-18T07:00:00.000Z'),
          endAt: new Date('2026-09-18T08:00:00.000Z'),
          employees: [],
        }),
      },
    };
    const service = new AssignmentsService(
      prisma as never,
      configService as never,
      auditService as never,
    );

    await expect(
      service.update('admin-1', 'assignment-1', {
        startAt: '2026-09-20T09:00:00+02:00',
        endAt: '2026-09-20T10:00:00+02:00',
      }),
    ).rejects.toThrow('Assignments cannot be scheduled on Saturday or Sunday.');
  });

  it('rejects a Friday assignment that continues into Saturday', () => {
    const service = new AssignmentsService(
      {} as never,
      configService as never,
      auditService as never,
    ) as unknown as TestableAssignmentsService;

    expect(() =>
      service.assertWorkingDayRange(
        new Date('2026-09-18T21:00:00.000Z'),
        new Date('2026-09-18T23:30:00.000Z'),
      ),
    ).toThrow('Assignments cannot be scheduled on Saturday or Sunday.');
  });

  it('allows a Friday assignment that ends exactly at midnight', () => {
    const service = new AssignmentsService(
      {} as never,
      configService as never,
      auditService as never,
    ) as unknown as TestableAssignmentsService;

    expect(() =>
      service.assertWorkingDayRange(
        new Date('2026-09-18T20:00:00.000Z'),
        new Date('2026-09-18T22:00:00.000Z'),
      ),
    ).not.toThrow();
  });

  it('skips Saturday and Sunday in a daily recurring schedule', () => {
    const service = new AssignmentsService(
      {} as never,
      configService as never,
      auditService as never,
    ) as unknown as TestableAssignmentsService;

    const occurrences = service.generateOccurrences(recurringInput());

    expect(localDates(occurrences)).toEqual([
      '2026-09-18',
      '2026-09-21',
      '2026-09-22',
    ]);
  });

  it('rejects Saturday or Sunday in a weekly recurrence rule', () => {
    const service = new AssignmentsService(
      {} as never,
      configService as never,
      auditService as never,
    ) as unknown as TestableAssignmentsService;

    expect(() =>
      service.generateOccurrences(
        recurringInput({
          frequency: RecurrenceFrequency.WEEKLY,
          daysOfWeek: [1, 6],
        }),
      ),
    ).toThrow('Weekly assignments may only repeat from Monday to Friday.');
  });

  it('skips a monthly occurrence when the same date falls on a weekend', () => {
    const service = new AssignmentsService(
      {} as never,
      configService as never,
      auditService as never,
    ) as unknown as TestableAssignmentsService;

    const occurrences = service.generateOccurrences(
      recurringInput({
        frequency: RecurrenceFrequency.MONTHLY,
        firstStartAt: '2026-01-30T09:00:00+01:00',
        untilAt: '2026-03-31T23:59:59+02:00',
      }),
    );

    expect(localDates(occurrences)).toEqual(['2026-01-30', '2026-03-30']);
  });
});

describe('recurring history preservation', () => {
  it('regenerates only scheduled visits and never deletes or recreates a completed occurrence', async () => {
    const existing = {
      id: 'origin',
      recurringTemplateId: 'series',
      recurringTemplate: { id: 'series' },
      siteId: 'site',
      title: 'Weekly cleaning',
      status: 'COMPLETED',
      startAt: new Date('2026-10-19T07:00Z'),
      endAt: new Date('2026-10-19T10:00Z'),
      clientCharge: 100,
      employees: [],
    };
    const deleted = jest.fn().mockResolvedValue({ count: 1 });
    const created = jest.fn().mockResolvedValue({ id: 'new-future' });
    const tx = {
      recurringTemplate: {
        update: jest.fn().mockResolvedValue({ id: 'series' }),
      },
      workAssignment: { deleteMany: deleted, create: created },
    };
    const prisma = {
      workAssignment: {
        findUnique: jest.fn().mockResolvedValue(existing),
        findMany: jest.fn().mockResolvedValue([
          {
            startAt: new Date('2026-10-26T08:00Z'),
            endAt: new Date('2026-10-26T11:00Z'),
          },
        ]),
      },
      $transaction: jest.fn((action: (client: typeof tx) => unknown) =>
        action(tx),
      ),
    };
    const service = new AssignmentsService(
      prisma as never,
      configService as never,
      auditService as never,
    );
    await service.updateRecurrence('admin', 'origin', {
      frequency: RecurrenceFrequency.WEEKLY,
      interval: 1,
      daysOfWeek: [1],
      untilAt: '2026-11-02T22:59:59Z',
    });
    expect(deleted).toHaveBeenCalledWith({
      where: {
        recurringTemplateId: 'series',
        startAt: { gt: existing.startAt },
        status: AssignmentStatus.SCHEDULED,
      },
    });
    // The next completed Monday is retained; only the following Monday is created.
    expect(created).toHaveBeenCalledTimes(1);
    const [createdInput] = created.mock.calls[0] as [
      {
        data: { startAt: Date };
      },
    ];
    expect(createdInput.data.startAt).toEqual(new Date('2026-11-02T08:00Z'));
  });
});

describe('AssignmentsService employee financial-data access', () => {
  it('redacts client prices and employee rates for employees but keeps them for administrators', async () => {
    const assignment = {
      id: 'assignment-1',
      clientCharge: 500,
      employees: [
        {
          assignmentId: 'assignment-1',
          employeeId: 'employee-1',
          assignedAt: new Date('2026-09-18T07:00:00.000Z'),
          agreedHourlyRate: 22,
          rateOverridden: true,
          employee: {
            id: 'employee-1',
            firstName: 'Lena',
            lastName: 'Worker',
            hourlyRate: 20,
            isStudent: false,
            active: true,
            user: {
              id: 'user-1',
              email: 'lena.worker@example.com',
              status: 'ACTIVE',
            },
          },
        },
      ],
      recurringTemplate: null,
      site: {
        id: 'site-1',
        client: { id: 'client-1', companyName: 'Example GmbH', active: true },
      },
    };
    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue({ id: 'employee-1' }),
      },
      workAssignment: {
        findMany: jest.fn().mockResolvedValue([assignment]),
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: jest.fn(async (operations: unknown[]) =>
        Promise.all(operations),
      ),
    };
    const service = new AssignmentsService(
      prisma as never,
      configService as never,
      auditService as never,
    );
    const query = { page: 1, pageSize: 100 };

    const employeeResult = await service.list(
      {
        id: 'user-1',
        email: 'lena.worker@example.com',
        role: UserRole.EMPLOYEE,
      },
      query,
    );
    const adminResult = await service.list(
      {
        id: 'admin-1',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      },
      query,
    );

    expect(employeeResult.items[0]).not.toHaveProperty('clientCharge');
    expect(employeeResult.items[0]).not.toHaveProperty(
      'employees.0.agreedHourlyRate',
    );
    expect(employeeResult.items[0]).not.toHaveProperty(
      'employees.0.rateOverridden',
    );
    expect(employeeResult.items[0]).not.toHaveProperty(
      'employees.0.employee.hourlyRate',
    );
    expect(employeeResult.items[0]).not.toHaveProperty(
      'employees.0.employee.user',
    );
    expect(adminResult.items[0]).toHaveProperty('clientCharge', 500);
    expect(adminResult.items[0]).toHaveProperty(
      'employees.0.agreedHourlyRate',
      22,
    );
  });
});
