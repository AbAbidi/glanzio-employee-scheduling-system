import {
  ForbiddenException,
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import { AssignmentStatus, UserRole } from '../generated/prisma/client';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import type { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';
import { calculatePaymentStatement } from './payment-statement';
import { StudentAccountingService } from './student-accounting.service';
import { STUDENT_POLICY } from './student-accounting';
import { AssignmentCompletionService } from '../assignments/assignment-completion.service';
import { PDFDocument } from 'pdf-lib';
import {
  PaymentStatementPdfService,
  type EmployeePaymentStatement,
} from './payment-statement-pdf.service';

@Injectable()
export class ReportsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportsService.name);
  private closureRequest: Promise<void> | null = null;
  private lastClosureCheck = 0;
  private lastClosureMonth = '';
  private closureTimer?: ReturnType<typeof setInterval>;
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly paymentStatementPdf: PaymentStatementPdfService,
    readonly studentAccounting: StudentAccountingService,
    @Optional() private readonly completion?: AssignmentCompletionService,
  ) {}

  onModuleInit() {
    const run = () => {
      void this.closeFinishedStudentMonths().catch((error: unknown) => {
        this.logger.error(
          'Automatic student month closure will be retried',
          error instanceof Error ? error.stack : undefined,
        );
      });
    };
    run();
    this.closureTimer = setInterval(run, 60_000);
    this.closureTimer.unref();
  }

  async onModuleDestroy() {
    if (this.closureTimer) clearInterval(this.closureTimer);
    await this.closureRequest?.catch(() => {});
  }

  /** Server-owned rollover. No current/future month can be closed by this job. */
  closeFinishedStudentMonths(): Promise<void> {
    if (this.closureRequest) return this.closureRequest;
    const zone = this.configService.get<string>(
      'SYSTEM_TIME_ZONE',
      'Europe/Paris',
    );
    const currentMonth = DateTime.now().setZone(zone).toFormat('yyyy-MM');
    if (currentMonth <= STUDENT_POLICY.effectiveMonth) return Promise.resolve();
    if (
      this.lastClosureMonth === currentMonth &&
      Date.now() - this.lastClosureCheck < 30_000
    )
      return Promise.resolve();
    const pending = this.performAutomaticClosure(currentMonth).then(() => {
      this.lastClosureMonth = currentMonth;
      this.lastClosureCheck = Date.now();
    });
    this.closureRequest = pending;
    void pending
      .finally(() => {
        if (this.closureRequest === pending) this.closureRequest = null;
      })
      .catch(() => {});
    return pending;
  }

  private async performAutomaticClosure(currentMonth: string): Promise<void> {
    await this.completion?.reconcile();
    const students = await this.prisma.employee.findMany({
      where: { isStudent: true },
      select: { id: true },
    });
    if (!students.length) return;
    const where = {
      employeeId: { in: students.map((student) => student.id) },
      month: { gte: STUDENT_POLICY.effectiveMonth, lt: currentMonth },
      status: 'CLOSED',
    };
    const [closed, missingPdfs] = await Promise.all([
      this.prisma.studentStatement.findMany({
        where,
        select: { employeeId: true, month: true },
      }),
      this.prisma.studentStatement.findMany({
        where: { ...where, pdfBytes: null },
        select: { employeeId: true, month: true },
      }),
    ]);
    const key = (employeeId: string, month: string) => `${employeeId}:${month}`;
    const closedKeys = new Set(
      closed.map((row) => key(row.employeeId, row.month)),
    );
    const missingKeys = new Set(
      missingPdfs.map((row) => key(row.employeeId, row.month)),
    );
    let failures = 0;
    for (const student of students) {
      for (
        let month = STUDENT_POLICY.effectiveMonth as string;
        month < currentMonth;
        month = DateTime.fromISO(`${month}-01`)
          .plus({ months: 1 })
          .toFormat('yyyy-MM')
      ) {
        const periodKey = key(student.id, month);
        if (closedKeys.has(periodKey) && !missingKeys.has(periodKey)) continue;
        try {
          if (!closedKeys.has(periodKey))
            await this.studentAccounting.period(student.id, month, true);
          // The closed snapshot/PDF cache makes this safe on retries and other processes.
          await this.buildMonthlyPaymentStatement(
            { employeeId: student.id, month },
            [student.id],
          );
        } catch (error) {
          failures++;
          this.logger.error(
            `Could not finalize ${student.id} / ${month}`,
            error instanceof Error ? error.stack : undefined,
          );
          break; // Never finalize a later month without its predecessor.
        }
      }
    }
    if (failures)
      throw new ServiceUnavailableException(
        'Automatic month-end closure is being prepared. Please try again.',
      );
  }

  async monthlyPaymentStatement(
    user: AuthenticatedUser,
    query: MonthlyReportQueryDto,
  ) {
    await this.completion?.reconcile();
    await this.closeFinishedStudentMonths();
    const employeeIds = await this.allowedEmployeeIds(user, query.employeeId);
    return this.buildMonthlyPaymentStatement(query, employeeIds);
  }

  private async buildMonthlyPaymentStatement(
    query: MonthlyReportQueryDto,
    employeeIds: string[],
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
          status: AssignmentStatus.COMPLETED,
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
        employee.isStudent ? 4800 : null, // Preserve pre-October history.
      );

      return {
        statementNumber: `GLANZIO-${query.month.replace('-', '')}-${employee.id.slice(0, 8).toUpperCase()}`,
        monthLabel: month.setLocale('en').toFormat('LLLL yyyy'),
        employee: {
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.user.email ?? '',
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
    // Persist each student PDF independently so a repeated download is byte-identical.
    const pages: Buffer[] = [];
    let studentState: string | undefined;
    for (let index = 0; index < statements.length; index += 1) {
      const statement = statements[index];
      const frozen =
        query.month >= STUDENT_POLICY.effectiveMonth
          ? await this.prisma.studentStatement.findFirst({
              where: {
                employeeId: employees[index].id,
                month: query.month,
                status: 'CLOSED',
              },
            })
          : null;
      if (
        (statement.employee.isStudent || frozen) &&
        query.month >= STUDENT_POLICY.effectiveMonth
      ) {
        const snapshot = await this.studentAccounting.period(
          employees[index].id,
          query.month,
        );
        studentState = snapshot.status === 'CLOSED' ? 'final' : 'draft';
        statement.studentSimulation = {
          ...snapshot.data,
          status: snapshot.status,
        };
        pages.push(
          await this.studentAccounting.pdf(snapshot, () =>
            this.paymentStatementPdf.build([statement], query.month),
          ),
        );
      } else {
        pages.push(
          await this.paymentStatementPdf.build([statement], query.month),
        );
      }
    }
    let buffer: Buffer;
    if (pages.length === 1) buffer = pages[0];
    else if (!pages.length)
      buffer = await this.paymentStatementPdf.build([], query.month);
    else {
      const merged = await PDFDocument.create();
      for (const page of pages) {
        const document = await PDFDocument.load(page);
        for (const copied of await merged.copyPages(
          document,
          document.getPageIndices(),
        ))
          merged.addPage(copied);
      }
      merged.setTitle(`Glanzio internal statements ${query.month}`);
      buffer = Buffer.from(await merged.save());
    }
    const subject =
      statements.length === 1
        ? `${statements[0].employee.firstName}-${statements[0].employee.lastName}`
        : 'all-employees';

    return {
      buffer,
      filename:
        `glanzio-interne-abrechnung-${subject}-${query.month}${statements.length === 1 && studentState ? `-${studentState}` : ''}.pdf`
          .toLowerCase()
          .replace(/[^a-z0-9.-]+/g, '-'),
    };
  }

  async studentStatement(query: MonthlyReportQueryDto) {
    if (!query.employeeId)
      throw new BadRequestException('Select one student employee.');
    await this.closeFinishedStudentMonths();
    return this.studentAccounting.period(query.employeeId, query.month);
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
    const limitMinutes =
      query.month >= STUDENT_POLICY.effectiveMonth
        ? STUDENT_POLICY.monthlyMinutes
        : 4800;

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
          email: employee.user.email ?? '',
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
        select: { id: true, active: true },
      });

      if (!employee) {
        throw new NotFoundException('Employee not found.');
      }

      if (employee.active === false) {
        throw new ForbiddenException(
          'Archived employees are excluded from operational report exports. Review their retained history in the admin archive.',
        );
      }

      return [employee.id];
    }

    const employees = await this.prisma.employee.findMany({
      where: { active: true },
      select: { id: true },
    });
    return employees.map((employee) => employee.id);
  }
}
