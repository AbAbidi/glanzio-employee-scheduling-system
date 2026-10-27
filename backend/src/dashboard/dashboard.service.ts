import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import {
  AssignmentStatus,
  NotificationType,
  Prisma,
  UserRole,
} from '../generated/prisma/client';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { AuditService } from '../audit/audit.service';
import type { ResetOperationalDataDto } from './dto/reset-operational-data.dto';
import type { ResetTestWorkspaceDto } from './dto/reset-test-workspace.dto';
import { STUDENT_POLICY } from '../reports/student-accounting';
import { AssignmentCompletionService } from '../assignments/assignment-completion.service';

const DASHBOARD_ASSIGNMENT_INCLUDE = {
  site: {
    include: {
      client: {
        select: { id: true, companyName: true },
      },
    },
  },
} as const;

const EMPLOYEE_DASHBOARD_ASSIGNMENT_SELECT = {
  id: true,
  title: true,
  startAt: true,
  endAt: true,
  status: true,
  site: {
    select: {
      name: true,
      client: {
        select: { companyName: true },
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

type EmployeeMonthMetrics = {
  assignmentIds: Set<string>;
  minutes: number;
  amount: number;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly reportsService: ReportsService,
    private readonly auditService: AuditService,
    @Optional() private readonly completion?: AssignmentCompletionService,
  ) {}

  async get(user: AuthenticatedUser) {
    await this.completion?.reconcile();
    return user.role !== UserRole.EMPLOYEE
      ? this.adminDashboard(user)
      : this.employeeDashboard(user);
  }

  async archivedAnalysis(month?: string) {
    await this.completion?.reconcile();
    return this.operationsAnalysis(this.todayRange().zone, false, month);
  }

  async resetOperationalDataPreview() {
    this.assertTestWorkspaceResetAllowed();
    const [
      assignments,
      recurringSchedules,
      notifications,
      studentStatements,
      studentCreditMovements,
      storedPdfs,
    ] = await this.prisma.$transaction([
      this.prisma.workAssignment.count(),
      this.prisma.recurringTemplate.count(),
      this.prisma.notification.count({
        where: { type: { in: [...RESET_NOTIFICATION_TYPES] } },
      }),
      this.prisma.studentStatement.count(),
      this.prisma.studentCreditMovement.count(),
      this.prisma.studentStatement.count({
        where: { pdfBytes: { not: null } },
      }),
    ]);

    return {
      assignments,
      recurringSchedules,
      notifications,
      studentStatements,
      studentCreditMovements,
      storedPdfs,
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
    void _input;
    this.assertTestWorkspaceResetAllowed();

    const result = await this.prisma.$transaction(async (transaction) => {
      const assignmentCount = await transaction.workAssignment.count();
      const recurringTemplateCount =
        await transaction.recurringTemplate.count();

      const deletedNotifications = await transaction.notification.deleteMany({
        where: {
          type: { in: [...RESET_NOTIFICATION_TYPES] },
        },
      });
      const deletedStudentCreditMovements =
        await transaction.studentCreditMovement.deleteMany();
      const deletedStudentStatements =
        await transaction.studentStatement.deleteMany();
      await transaction.workAssignment.deleteMany();
      await transaction.recurringTemplate.deleteMany();

      return {
        deletedAssignments: assignmentCount,
        deletedRecurringSchedules: recurringTemplateCount,
        deletedNotifications: deletedNotifications.count,
        deletedStudentCreditMovements: deletedStudentCreditMovements.count,
        deletedStudentStatements: deletedStudentStatements.count,
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

  async resetTestWorkspacePreview() {
    this.assertTestWorkspaceResetAllowed();

    const [
      assignments,
      recurringSchedules,
      notifications,
      invitations,
      refreshSessions,
      passwordResetTokens,
      employees,
      employeeAccounts,
      cleaningSites,
      clients,
      studentStatements,
      studentCreditMovements,
      storedPdfs,
    ] = await this.prisma.$transaction([
      this.prisma.workAssignment.count(),
      this.prisma.recurringTemplate.count(),
      this.prisma.notification.count(),
      this.prisma.accountInvitation.count(),
      this.prisma.refreshSession.count({
        where: {
          user: { role: { in: [UserRole.EMPLOYEE, UserRole.MANAGER] } },
        },
      }),
      this.prisma.passwordResetToken.count({
        where: {
          user: { role: { in: [UserRole.EMPLOYEE, UserRole.MANAGER] } },
        },
      }),
      this.prisma.employee.count(),
      this.prisma.user.count({
        where: { role: { in: [UserRole.EMPLOYEE, UserRole.MANAGER] } },
      }),
      this.prisma.cleaningSite.count(),
      this.prisma.client.count(),
      this.prisma.studentStatement.count(),
      this.prisma.studentCreditMovement.count(),
      this.prisma.studentStatement.count({
        where: { pdfBytes: { not: null } },
      }),
    ]);

    return {
      assignments,
      recurringSchedules,
      notifications,
      invitations,
      refreshSessions,
      passwordResetTokens,
      employees,
      employeeAccounts,
      cleaningSites,
      clients,
      studentStatements,
      studentCreditMovements,
      storedPdfs,
      derivedAnalysis: [
        'employee hours',
        'labor cost',
        'client revenue',
        'travel distance',
        'production charts',
      ],
      preserved: [
        'administrator accounts',
        'administrator sessions',
        'audit history',
        'database schema and migrations',
      ],
    };
  }

  async resetTestWorkspace(actorUserId: string, _input: ResetTestWorkspaceDto) {
    void _input;
    this.assertTestWorkspaceResetAllowed();

    const result = await this.prisma.$transaction(
      async (transaction) => {
        const deletedStudentCreditMovements =
          await transaction.studentCreditMovement.deleteMany();
        const deletedStudentStatements =
          await transaction.studentStatement.deleteMany();
        const deletedNotifications =
          await transaction.notification.deleteMany();
        const deletedAssignments =
          await transaction.workAssignment.deleteMany();
        const deletedRecurringSchedules =
          await transaction.recurringTemplate.deleteMany();
        const deletedInvitations =
          await transaction.accountInvitation.deleteMany();
        const deletedRefreshSessions =
          await transaction.refreshSession.deleteMany({
            where: {
              user: { role: { in: [UserRole.EMPLOYEE, UserRole.MANAGER] } },
            },
          });
        const deletedPasswordResetTokens =
          await transaction.passwordResetToken.deleteMany({
            where: {
              user: { role: { in: [UserRole.EMPLOYEE, UserRole.MANAGER] } },
            },
          });
        const deletedEmployees = await transaction.employee.deleteMany();
        const deletedEmployeeAccounts = await transaction.user.deleteMany({
          where: { role: { in: [UserRole.EMPLOYEE, UserRole.MANAGER] } },
        });
        const deletedCleaningSites =
          await transaction.cleaningSite.deleteMany();
        const deletedClients = await transaction.client.deleteMany();

        const deleted = {
          deletedAssignments: deletedAssignments.count,
          deletedRecurringSchedules: deletedRecurringSchedules.count,
          deletedNotifications: deletedNotifications.count,
          deletedInvitations: deletedInvitations.count,
          deletedRefreshSessions: deletedRefreshSessions.count,
          deletedPasswordResetTokens: deletedPasswordResetTokens.count,
          deletedEmployees: deletedEmployees.count,
          deletedEmployeeAccounts: deletedEmployeeAccounts.count,
          deletedCleaningSites: deletedCleaningSites.count,
          deletedClients: deletedClients.count,
          deletedStudentStatements: deletedStudentStatements.count,
          deletedStudentCreditMovements: deletedStudentCreditMovements.count,
        };

        await transaction.auditLog.create({
          data: {
            actorUserId,
            action: 'TEST_WORKSPACE_RESET',
            entityType: 'SystemMaintenance',
            entityId: 'test-workspace',
            metadata: deleted,
          },
        });

        return deleted;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return {
      ...result,
      preserved: [
        'administrator accounts',
        'administrator sessions',
        'audit history',
        'database schema and migrations',
      ],
    };
  }

  private assertTestWorkspaceResetAllowed(): void {
    const environment = this.configService.get<string>(
      'NODE_ENV',
      'development',
    );
    if (environment === 'production') {
      throw new ForbiddenException(
        'Test-data reset is disabled in production.',
      );
    }
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
      role: user.role,
      maintenanceEnabled:
        user.role === UserRole.ADMIN &&
        this.configService.get<string>('NODE_ENV', 'development') !==
          'production',
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

  private async operationsAnalysis(
    zone: string,
    active = true,
    selectedMonth?: string,
  ) {
    const now = DateTime.now().setZone(zone);
    const displayedMonths = selectedMonth
      ? [DateTime.fromISO(`${selectedMonth}-01`, { zone }).startOf('month')]
      : Array.from({ length: 6 }, (_, index) =>
          now.minus({ months: 5 - index }).startOf('month'),
        );
    const firstDisplayedMonth = displayedMonths[0];
    const lastDisplayedMonth = displayedMonths[displayedMonths.length - 1];

    const [assignments, employees] = await Promise.all([
      this.prisma.workAssignment.findMany({
        where: {
          status: AssignmentStatus.COMPLETED,
          endAt: { lte: now.toUTC().toJSDate() },
        },
        select: {
          id: true,
          endAt: true,
          status: true,
          startAt: true,
          travelDistanceMeters: true,
          clientCharge: true,
          employees: {
            select: {
              employeeId: true,
              agreedHourlyRate: true,
              employee: { select: { hourlyRate: true } },
            },
          },
        },
        orderBy: { endAt: 'asc' },
      }),
      this.prisma.employee.findMany({
        where: { active },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          isStudent: true,
          createdAt: true,
          active: true,
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
    const employeeMonths = new Map<string, Map<string, EmployeeMonthMetrics>>();

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
        const amount =
          (durationMinutes / 60) *
          Number(link.agreedHourlyRate ?? link.employee.hourlyRate ?? 0);
        assignmentCost += amount;
        // Keep the fallback typed so map values remain EmployeeMonthMetrics.
        const byEmployee =
          employeeMonths.get(link.employeeId) ??
          new Map<string, EmployeeMonthMetrics>();
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
      const rawByMonth =
        employeeMonths.get(employee.id) ??
        new Map<string, EmployeeMonthMetrics>();
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

        if (cursor >= firstDisplayedMonth && cursor <= lastDisplayedMonth) {
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

    for (const row of employeeRows) {
      if (!row.employee.isStudent || row.month < STUDENT_POLICY.effectiveMonth)
        continue;
      const { data } = await this.reportsService.studentAccounting.period(
        row.employee.id,
        row.month,
      );
      // Actual completed work stays live even when the credit statement is closed.
      row.creditedMinutes = data.creditedMinutes;
      row.carryInMinutes = data.carryInMinutes;
      row.carryOutMinutes = data.carryOutMinutes;
    }
    const weekStart = now.startOf('week');
    const weekEnd = weekStart.plus({ weeks: 1 });
    const weeklyStudents = employees
      .filter((employee) => employee.isStudent)
      .map((employee) => {
        const workedMinutes = assignments.reduce((sum, assignment) => {
          if (assignment.status !== AssignmentStatus.COMPLETED) return sum;
          if (
            !assignment.employees.some(
              (link) => link.employeeId === employee.id,
            )
          )
            return sum;
          return (
            sum +
            Math.max(
              0,
              Math.round(
                (Math.min(weekEnd.toMillis(), assignment.endAt.getTime()) -
                  Math.max(
                    weekStart.toMillis(),
                    assignment.startAt.getTime(),
                  )) /
                  60000,
              ),
            )
          );
        }, 0);
        return {
          employee,
          workedMinutes,
          exceededByMinutes: Math.max(
            0,
            workedMinutes - STUDENT_POLICY.weeklyMinutes,
          ),
        };
      });
    return {
      weeklyStudents: {
        start: weekStart.toISODate(),
        end: weekEnd.minus({ days: 1 }).toISODate(),
        items: weeklyStudents,
      },
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
        select: EMPLOYEE_DASHBOARD_ASSIGNMENT_SELECT,
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.workAssignment.findFirst({
        where: {
          ...assignmentFilter,
          status: AssignmentStatus.SCHEDULED,
          startAt: { gte: range.end },
        },
        select: EMPLOYEE_DASHBOARD_ASSIGNMENT_SELECT,
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
