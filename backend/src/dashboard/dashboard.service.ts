import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import {
  AssignmentStatus,
  NotificationType,
  UserRole,
} from '../generated/prisma/client';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { AuditService } from '../audit/audit.service';
import type { ResetOperationalDataDto } from './dto/reset-operational-data.dto';

const DASHBOARD_ASSIGNMENT_INCLUDE = {
  site: {
    include: {
      client: {
        select: { id: true, companyName: true },
      },
    },
  },
} as const;

const RESET_NOTIFICATION_TYPES = [
  NotificationType.ASSIGNMENT_CREATED,
  NotificationType.ASSIGNMENT_UPDATED,
  NotificationType.ASSIGNMENT_CANCELLED,
  NotificationType.STUDENT_HOUR_WARNING,
] as const;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly reportsService: ReportsService,
    private readonly auditService: AuditService,
  ) {}

  async get(user: AuthenticatedUser) {
    return user.role === UserRole.ADMIN
      ? this.adminDashboard(user)
      : this.employeeDashboard(user);
  }

  async resetOperationalDataPreview() {
    const [assignments, recurringSchedules, notifications] =
      await this.prisma.$transaction([
        this.prisma.workAssignment.count(),
        this.prisma.recurringTemplate.count(),
        this.prisma.notification.count({
          where: { type: { in: [...RESET_NOTIFICATION_TYPES] } },
        }),
      ]);

    return {
      assignments,
      recurringSchedules,
      notifications,
      derivedAnalysis: [
        'employee hours',
        'labor cost',
        'client revenue',
        'travel distance',
        'production charts',
      ],
      preserved: ['administrators', 'employees', 'clients', 'cleaning sites'],
    };
  }

  async resetOperationalData(
    actorUserId: string,
    _input: ResetOperationalDataDto,
  ) {
    const result = await this.prisma.$transaction(async (transaction) => {
      const assignmentCount = await transaction.workAssignment.count();
      const recurringTemplateCount =
        await transaction.recurringTemplate.count();

      const deletedNotifications = await transaction.notification.deleteMany({
        where: {
          type: { in: [...RESET_NOTIFICATION_TYPES] },
        },
      });
      await transaction.workAssignment.deleteMany();
      await transaction.recurringTemplate.deleteMany();

      return {
        deletedAssignments: assignmentCount,
        deletedRecurringSchedules: recurringTemplateCount,
        deletedNotifications: deletedNotifications.count,
      };
    });

    await this.auditService.record({
      actorUserId,
      action: 'OPERATIONAL_DATA_RESET',
      entityType: 'SystemMaintenance',
      entityId: 'operational-data',
      metadata: result,
    });

    return {
      ...result,
      preserved: ['administrators', 'employees', 'clients', 'cleaning sites'],
    };
  }

  private async adminDashboard(user: AuthenticatedUser) {
    const range = this.todayRange();
    const month = DateTime.now().setZone(range.zone).toFormat('yyyy-MM');

    const [
      todayAssignments,
      upcomingAssignments,
      activeEmployees,
      unassignedWork,
      report,
      operationsAnalysis,
    ] = await Promise.all([
      this.prisma.workAssignment.findMany({
        where: {
          status: AssignmentStatus.SCHEDULED,
          startAt: { lt: range.end },
          endAt: { gt: range.start },
        },
        include: DASHBOARD_ASSIGNMENT_INCLUDE,
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.workAssignment.findMany({
        where: {
          status: AssignmentStatus.SCHEDULED,
          startAt: { gte: range.end },
        },
        include: DASHBOARD_ASSIGNMENT_INCLUDE,
        orderBy: { startAt: 'asc' },
        take: 10,
      }),
      this.prisma.employee.count({ where: { active: true } }),
      this.prisma.workAssignment.count({
        where: {
          status: AssignmentStatus.SCHEDULED,
          startAt: { gte: range.start },
          employees: { none: {} },
        },
      }),
      this.reportsService.monthly(user, { month }),
      this.operationsAnalysis(range.zone),
    ]);

    return {
      role: UserRole.ADMIN,
      date: DateTime.now().setZone(range.zone).toISODate(),
      timeZone: range.zone,
      activeEmployees,
      unassignedWork,
      todayAssignments,
      upcomingAssignments,
      studentHourWarnings: report.items
        .filter((item) => item.warning)
        .map((item) => ({
          employee: item.employee,
          plannedMinutes: item.plannedMinutes,
          warning: item.warning,
        })),
      operationsAnalysis,
    };
  }

  private async operationsAnalysis(zone: string) {
    const now = DateTime.now().setZone(zone);
    const displayedMonths = Array.from({ length: 6 }, (_, index) =>
      now.minus({ months: 5 - index }).startOf('month'),
    );
    const firstDisplayedMonth = displayedMonths[0];

    const [assignments, employees] = await Promise.all([
      this.prisma.workAssignment.findMany({
        where: {
          status: {
            in: [AssignmentStatus.SCHEDULED, AssignmentStatus.COMPLETED],
          },
          endAt: { lte: now.toUTC().toJSDate() },
        },
        select: {
          id: true,
          endAt: true,
          startAt: true,
          travelDistanceMeters: true,
          clientCharge: true,
          employees: {
            select: {
              employeeId: true,
              agreedHourlyRate: true,
            },
          },
        },
        orderBy: { endAt: 'asc' },
      }),
      this.prisma.employee.findMany({
        where: { active: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          isStudent: true,
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
    ]);

    const assignmentMonths = new Map<
      string,
      {
        completedAssignmentIds: Set<string>;
        routedAssignmentIds: Set<string>;
        distanceMeters: number;
        laborCost: number;
        revenue: number;
      }
    >();
    const employeeMonths = new Map<
      string,
      Map<
        string,
        { assignmentIds: Set<string>; minutes: number; amount: number }
      >
    >();

    for (const assignment of assignments) {
      const monthKey = DateTime.fromJSDate(assignment.endAt)
        .setZone(zone)
        .toFormat('yyyy-MM');
      const durationMinutes = Math.max(
        0,
        Math.round(
          (assignment.endAt.getTime() - assignment.startAt.getTime()) / 60000,
        ),
      );
      let assignmentCost = 0;

      for (const link of assignment.employees) {
        const amount = link.agreedHourlyRate
          ? (durationMinutes / 60) * Number(link.agreedHourlyRate)
          : 0;
        assignmentCost += amount;
        const byEmployee = employeeMonths.get(link.employeeId) ?? new Map();
        const value = byEmployee.get(monthKey) ?? {
          assignmentIds: new Set<string>(),
          minutes: 0,
          amount: 0,
        };
        value.assignmentIds.add(assignment.id);
        value.minutes += durationMinutes;
        value.amount += amount;
        byEmployee.set(monthKey, value);
        employeeMonths.set(link.employeeId, byEmployee);
      }

      if (DateTime.fromFormat(monthKey, 'yyyy-MM') >= firstDisplayedMonth) {
        const summary = assignmentMonths.get(monthKey) ?? {
          completedAssignmentIds: new Set<string>(),
          routedAssignmentIds: new Set<string>(),
          distanceMeters: 0,
          laborCost: 0,
          revenue: 0,
        };
        summary.completedAssignmentIds.add(assignment.id);
        if (assignment.travelDistanceMeters !== null) {
          summary.routedAssignmentIds.add(assignment.id);
        }
        summary.distanceMeters += assignment.travelDistanceMeters ?? 0;
        summary.laborCost += assignmentCost;
        summary.revenue += Number(assignment.clientCharge ?? 0);
        assignmentMonths.set(monthKey, summary);
      }
    }

    const employeeRows = employees.flatMap((employee) => {
      const rawByMonth = employeeMonths.get(employee.id) ?? new Map();
      let carryMinutes = 0;
      const allMonthKeys = Array.from(rawByMonth.keys()).sort();
      const firstKey =
        allMonthKeys[0] ?? displayedMonths[0].toFormat('yyyy-MM');
      const cursorStart = DateTime.fromFormat(firstKey, 'yyyy-MM').startOf(
        'month',
      );
      const results: Array<{
        month: string;
        employee: typeof employee;
        completedAssignments: number;
        completedMinutes: number;
        creditedMinutes: number;
        carryInMinutes: number;
        carryOutMinutes: number;
        amount: number;
      }> = [];

      for (
        let cursor = cursorStart;
        cursor <= now.startOf('month');
        cursor = cursor.plus({ months: 1 })
      ) {
        const monthKey = cursor.toFormat('yyyy-MM');
        const raw = rawByMonth.get(monthKey) ?? {
          assignmentIds: new Set<string>(),
          minutes: 0,
          amount: 0,
        };
        const carryInMinutes = employee.isStudent ? carryMinutes : 0;
        const availableMinutes = raw.minutes + carryInMinutes;
        const creditedMinutes = employee.isStudent
          ? Math.min(80 * 60, availableMinutes)
          : raw.minutes;
        carryMinutes = employee.isStudent
          ? Math.max(0, availableMinutes - 80 * 60)
          : 0;

        if (cursor >= firstDisplayedMonth) {
          results.push({
            month: monthKey,
            employee,
            completedAssignments: raw.assignmentIds.size,
            completedMinutes: raw.minutes,
            creditedMinutes,
            carryInMinutes,
            carryOutMinutes: carryMinutes,
            amount: Number(raw.amount.toFixed(2)),
          });
        }
      }

      return results;
    });

    return {
      months: displayedMonths.map((monthDate) => {
        const monthKey = monthDate.toFormat('yyyy-MM');
        const summary = assignmentMonths.get(monthKey);
        return {
          month: monthKey,
          completedAssignments: summary?.completedAssignmentIds.size ?? 0,
          assignmentsWithCalculatedRoute:
            summary?.routedAssignmentIds.size ?? 0,
          routeKilometers: Number(
            ((summary?.distanceMeters ?? 0) / 1000).toFixed(1),
          ),
          laborCost: Number((summary?.laborCost ?? 0).toFixed(2)),
          revenue: Number((summary?.revenue ?? 0).toFixed(2)),
          grossMargin: Number(
            ((summary?.revenue ?? 0) - (summary?.laborCost ?? 0)).toFixed(2),
          ),
        };
      }),
      employees: employeeRows,
    };
  }

  private async employeeDashboard(user: AuthenticatedUser) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee profile not found.');
    }

    const range = this.todayRange();
    const month = DateTime.now().setZone(range.zone).toFormat('yyyy-MM');
    const assignmentFilter = {
      employees: { some: { employeeId: employee.id } },
    };

    const [todayAssignments, nextAssignment, report] = await Promise.all([
      this.prisma.workAssignment.findMany({
        where: {
          ...assignmentFilter,
          status: AssignmentStatus.SCHEDULED,
          startAt: { lt: range.end },
          endAt: { gt: range.start },
        },
        include: DASHBOARD_ASSIGNMENT_INCLUDE,
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.workAssignment.findFirst({
        where: {
          ...assignmentFilter,
          status: AssignmentStatus.SCHEDULED,
          startAt: { gte: range.end },
        },
        include: DASHBOARD_ASSIGNMENT_INCLUDE,
        orderBy: { startAt: 'asc' },
      }),
      this.reportsService.monthly(user, {
        month,
        employeeId: employee.id,
      }),
    ]);

    return {
      role: UserRole.EMPLOYEE,
      date: DateTime.now().setZone(range.zone).toISODate(),
      timeZone: range.zone,
      todayAssignments,
      nextAssignment,
      monthlyPlannedHours: report.items[0] ?? null,
    };
  }

  private todayRange(): { start: Date; end: Date; zone: string } {
    const zone = this.configService.get<string>(
      'SYSTEM_TIME_ZONE',
      'Europe/Paris',
    );
    const now = DateTime.now().setZone(zone);
    return {
      start: now.startOf('day').toUTC().toJSDate(),
      end: now.plus({ days: 1 }).startOf('day').toUTC().toJSDate(),
      zone,
    };
  }
}
