import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import { AssignmentStatus, UserRole } from '../generated/prisma/client';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import type { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';
import { calculatePaymentStatement } from './payment-statement';
import {
  PaymentStatementPdfService,
  type EmployeePaymentStatement,
} from './payment-statement-pdf.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly paymentStatementPdf: PaymentStatementPdfService,
  ) {}

  async monthlyPaymentStatement(
    user: AuthenticatedUser,
    query: MonthlyReportQueryDto,
  ) {
    const zone = this.configService.get<string>(
      'SYSTEM_TIME_ZONE',
      'Europe/Paris',
    );
    const month = DateTime.fromISO(`${query.month}-01`, { zone });
    const monthStart = month.startOf('month').toUTC().toJSDate();
    const monthEnd = month
      .plus({ months: 1 })
      .startOf('month')
      .toUTC()
      .toJSDate();
    const completedUntil = new Date(Math.min(Date.now(), monthEnd.getTime()));
    const employeeIds = await this.allowedEmployeeIds(user, query.employeeId);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        user: {
          select: {
            email: true,
            status: true,
          },
        },
      },
    });
    const links = await this.prisma.assignmentEmployee.findMany({
      where: {
        employeeId: { in: employeeIds },
        assignment: {
          status: {
            in: [AssignmentStatus.SCHEDULED, AssignmentStatus.COMPLETED],
          },
          startAt: { lt: monthEnd },
          endAt: { gt: monthStart, lte: completedUntil },
        },
      },
      include: {
        assignment: {
          include: {
            site: {
              include: {
                client: { select: { companyName: true } },
              },
            },
          },
        },
      },
      orderBy: { assignment: { startAt: 'asc' } },
    });
    const studentLimitMinutes = this.configService.get<number>(
      'STUDENT_MONTHLY_LIMIT_MINUTES',
      4800,
    );

    const statements: EmployeePaymentStatement[] = employees.map((employee) => {
      const employeeLines = links
        .filter((link) => link.employeeId === employee.id)
        .map((link) => {
          const clippedStart = new Date(
            Math.max(link.assignment.startAt.getTime(), monthStart.getTime()),
          );
          const clippedEnd = new Date(
            Math.min(link.assignment.endAt.getTime(), monthEnd.getTime()),
          );

          return {
            id: link.assignment.id,
            title: link.assignment.title,
            clientName: link.assignment.site.client.companyName,
            siteName: link.assignment.site.name,
            startAt: clippedStart,
            endAt: clippedEnd,
            durationMinutes: Math.max(
              0,
              Math.round(
                (clippedEnd.getTime() - clippedStart.getTime()) / 60_000,
              ),
            ),
            hourlyRate: Number(
              link.agreedHourlyRate ?? employee.hourlyRate ?? 0,
            ),
          };
        });
      const calculation = calculatePaymentStatement(
        employeeLines,
        employee.isStudent ? studentLimitMinutes : null,
      );

      return {
        statementNumber: `CC-${query.month.replace('-', '')}-${employee.id.slice(0, 8).toUpperCase()}`,
        monthLabel: month.setLocale('en').toFormat('LLLL yyyy'),
        employee: {
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.user.email,
          phone: employee.phone,
          active: employee.active,
          isStudent: employee.isStudent,
          defaultHourlyRate:
            employee.hourlyRate === null ? null : Number(employee.hourlyRate),
        },
        lines: calculation.lines,
        totals: calculation.totals,
      };
    });
    const buffer = await this.paymentStatementPdf.build(
      statements,
      query.month,
    );
    const subject =
      statements.length === 1
        ? `${statements[0].employee.firstName}-${statements[0].employee.lastName}`
        : 'all-employees';

    return {
      buffer,
      filename: `clarity-clean-${subject}-${query.month}.pdf`
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, '-'),
    };
  }

  async monthly(user: AuthenticatedUser, query: MonthlyReportQueryDto) {
    const zone = this.configService.get<string>(
      'SYSTEM_TIME_ZONE',
      'Europe/Paris',
    );
    const month = DateTime.fromISO(`${query.month}-01`, { zone });
    const monthStart = month.startOf('month').toUTC().toJSDate();
    const monthEnd = month
      .plus({ months: 1 })
      .startOf('month')
      .toUTC()
      .toJSDate();
    const employeeIds = await this.allowedEmployeeIds(user, query.employeeId);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        user: {
          select: {
            email: true,
            status: true,
          },
        },
      },
    });
    const links = await this.prisma.assignmentEmployee.findMany({
      where: {
        employeeId: { in: employeeIds },
        assignment: {
          status: {
            in: [AssignmentStatus.SCHEDULED, AssignmentStatus.COMPLETED],
          },
          startAt: { lt: monthEnd },
          endAt: { gt: monthStart },
        },
      },
      include: {
        assignment: {
          select: {
            id: true,
            title: true,
            startAt: true,
            endAt: true,
            status: true,
          },
        },
      },
    });
    const limitMinutes = this.configService.get<number>(
      'STUDENT_MONTHLY_LIMIT_MINUTES',
      4800,
    );

    const items = employees.map((employee) => {
      const employeeLinks = links.filter(
        (link) => link.employeeId === employee.id,
      );
      const plannedMinutes = Math.round(
        employeeLinks.reduce((total, link) => {
          const start = Math.max(
            link.assignment.startAt.getTime(),
            monthStart.getTime(),
          );
          const end = Math.min(
            link.assignment.endAt.getTime(),
            monthEnd.getTime(),
          );
          return total + Math.max(0, end - start) / 60_000;
        }, 0),
      );
      const warning =
        employee.isStudent && plannedMinutes > limitMinutes
          ? {
              thresholdMinutes: limitMinutes,
              exceededByMinutes: plannedMinutes - limitMinutes,
              assignmentBlocked: false,
            }
          : null;

      return {
        employee: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.user.email,
          active: employee.active,
          isStudent: employee.isStudent,
        },
        month: query.month,
        plannedMinutes,
        plannedHours: Number((plannedMinutes / 60).toFixed(2)),
        assignmentCount: employeeLinks.length,
        warning,
      };
    });

    return {
      month: query.month,
      timeZone: zone,
      studentLimitMinutes: limitMinutes,
      terminology: 'planned-hours',
      items,
    };
  }

  private async allowedEmployeeIds(
    user: AuthenticatedUser,
    requestedEmployeeId?: string,
  ): Promise<string[]> {
    if (user.role === UserRole.EMPLOYEE) {
      const employee = await this.prisma.employee.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      if (!employee) {
        throw new NotFoundException('Employee profile not found.');
      }

      if (requestedEmployeeId && requestedEmployeeId !== employee.id) {
        throw new ForbiddenException(
          'Employees may only view their own reports.',
        );
      }

      return [employee.id];
    }

    if (requestedEmployeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: requestedEmployeeId },
        select: { id: true },
      });

      if (!employee) {
        throw new NotFoundException('Employee not found.');
      }

      return [employee.id];
    }

    const employees = await this.prisma.employee.findMany({
      select: { id: true },
    });
    return employees.map((employee) => employee.id);
  }
}
