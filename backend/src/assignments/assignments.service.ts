import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import {
  AssignmentStatus,
  NotificationType,
  Prisma,
  RecurrenceFrequency,
  UserRole,
  UserStatus,
} from '../generated/prisma/client';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.type';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AssignmentQueryDto } from './dto/assignment-query.dto';
import type { AssignmentEmployeeInputDto } from './dto/assignment-employee-input.dto';
import type { CancelAssignmentDto } from './dto/cancel-assignment.dto';
import type { CreateAssignmentDto } from './dto/create-assignment.dto';
import type { CreateRecurringAssignmentDto } from './dto/create-recurring-assignment.dto';
import type { SetRecurringStatusDto } from './dto/set-recurring-status.dto';
import type { UpdateAssignmentDto } from './dto/update-assignment.dto';
import type { UpdateAssignmentRecurrenceDto } from './dto/update-assignment-recurrence.dto';

const ASSIGNMENT_INCLUDE = {
  recurringTemplate: {
    select: {
      id: true,
      frequency: true,
      interval: true,
      daysOfWeek: true,
      untilAt: true,
      active: true,
    },
  },
  site: {
    include: {
      client: {
        select: {
          id: true,
          companyName: true,
          active: true,
        },
      },
    },
  },
  employees: {
    include: {
      employee: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              status: true,
            },
          },
        },
      },
    },
  },
} as const;

type Occurrence = {
  startAt: Date;
  endAt: Date;
};

type EmployeeLinkData = {
  employeeId: string;
  agreedHourlyRate: Prisma.Decimal | null;
  rateOverridden: boolean;
};

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async create(actorUserId: string, input: CreateAssignmentDto) {
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    this.assertValidRange(startAt, endAt);

    const employeeLinks = await this.buildEmployeeLinks(
      input.employeeIds,
      input.employees,
    );
    const employeeIds = employeeLinks.map((link) => link.employeeId);
    await this.assertActiveSite(input.siteId);

    if (this.occupiesSchedule(input.status)) {
      await this.assertNoConflicts(employeeIds, startAt, endAt);
    }

    const assignment = await this.prisma.workAssignment.create({
      data: {
        siteId: input.siteId,
        title: input.title.trim(),
        startAt,
        endAt,
        status: input.status,
        notes: input.notes?.trim(),
        departureAddress: input.departureAddress?.trim(),
        departureLatitude: input.departureLatitude,
        departureLongitude: input.departureLongitude,
        travelDistanceMeters: input.travelDistanceMeters,
        estimatedTravelMinutes: input.estimatedTravelMinutes,
        clientCharge: input.clientCharge,
        routeCalculatedAt:
          input.travelDistanceMeters !== undefined ? new Date() : undefined,
        createdById: actorUserId,
        employees: {
          create: employeeLinks,
        },
      },
      include: ASSIGNMENT_INCLUDE,
    });

    await this.notifyAssignment(
      assignment.id,
      NotificationType.ASSIGNMENT_CREATED,
      'New assignment',
      `${assignment.title} was added to your schedule.`,
      employeeIds,
    );
    const studentWarnings = await this.createStudentWarnings(
      assignment.id,
      employeeIds,
      startAt,
    );
    await this.auditService.record({
      actorUserId,
      action: 'ASSIGNMENT_CREATED',
      entityType: 'WorkAssignment',
      entityId: assignment.id,
      metadata: { employeeIds },
    });

    return { assignment, studentWarnings };
  }

  async list(user: AuthenticatedUser, query: AssignmentQueryDto) {
    const employeeId =
      user.role === UserRole.EMPLOYEE
        ? await this.employeeIdForUser(user.id)
        : query.employeeId;
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    if (from && to) {
      this.assertValidRange(from, to);
    }

    const where: Prisma.WorkAssignmentWhereInput = {
      status: query.status,
      siteId: query.siteId,
      employees: employeeId
        ? {
            some: { employeeId },
          }
        : undefined,
      startAt: to ? { lt: to } : undefined,
      endAt: from ? { gt: from } : undefined,
    };
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.workAssignment.findMany({
        where,
        include: ASSIGNMENT_INCLUDE,
        orderBy: { startAt: 'asc' },
        skip,
        take: query.pageSize,
      }),
      this.prisma.workAssignment.count({ where }),
    ]);

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      pageCount: Math.ceil(total / query.pageSize),
    };
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const assignment = await this.prisma.workAssignment.findUnique({
      where: { id },
      include: ASSIGNMENT_INCLUDE,
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found.');
    }

    if (user.role === UserRole.EMPLOYEE) {
      const employeeId = await this.employeeIdForUser(user.id);
      const isAssigned = assignment.employees.some(
        (link) => link.employeeId === employeeId,
      );

      if (!isAssigned) {
        throw new ForbiddenException(
          'Employees may only view their own assignments.',
        );
      }
    }

    return assignment;
  }

  async update(actorUserId: string, id: string, input: UpdateAssignmentDto) {
    const existing = await this.prisma.workAssignment.findUnique({
      where: { id },
      include: {
        employees: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Assignment not found.');
    }

    if (existing.status === AssignmentStatus.CANCELLED) {
      throw new BadRequestException(
        'A cancelled assignment cannot be modified.',
      );
    }

    if (input.status === AssignmentStatus.CANCELLED) {
      throw new BadRequestException(
        'Use the cancellation endpoint to cancel an assignment.',
      );
    }

    const startAt = input.startAt ? new Date(input.startAt) : existing.startAt;
    const endAt = input.endAt ? new Date(input.endAt) : existing.endAt;
    const status = input.status ?? existing.status;
    const employeesChanged =
      input.employeeIds !== undefined || input.employees !== undefined;
    const employeeLinks = employeesChanged
      ? await this.buildEmployeeLinks(
          input.employeeIds ?? [],
          input.employees ?? [],
        )
      : existing.employees.map((link) => ({
          employeeId: link.employeeId,
          agreedHourlyRate: link.agreedHourlyRate,
          rateOverridden: link.rateOverridden,
        }));
    const employeeIds = employeeLinks.map((link) => link.employeeId);
    const previousEmployeeIds = existing.employees.map(
      (link) => link.employeeId,
    );

    this.assertValidRange(startAt, endAt);

    if (input.siteId) {
      await this.assertActiveSite(input.siteId);
    }
    if (!employeesChanged) {
      await this.assertActiveEmployees(employeeIds);
    }

    if (this.occupiesSchedule(status)) {
      await this.assertNoConflicts(employeeIds, startAt, endAt, id);
    }

    const assignment = await this.prisma.workAssignment.update({
      where: { id },
      data: {
        siteId: input.siteId,
        title: input.title?.trim(),
        startAt: input.startAt ? startAt : undefined,
        endAt: input.endAt ? endAt : undefined,
        status: input.status,
        notes: input.notes?.trim(),
        departureAddress: input.departureAddress?.trim(),
        departureLatitude: input.departureLatitude,
        departureLongitude: input.departureLongitude,
        travelDistanceMeters: input.travelDistanceMeters,
        estimatedTravelMinutes: input.estimatedTravelMinutes,
        clientCharge: input.clientCharge,
        routeCalculatedAt:
          input.travelDistanceMeters !== undefined ? new Date() : undefined,
        updatedById: actorUserId,
        employees: employeesChanged
          ? {
              deleteMany: {},
              create: employeeLinks,
            }
          : undefined,
      },
      include: ASSIGNMENT_INCLUDE,
    });

    await this.notifyAssignment(
      assignment.id,
      NotificationType.ASSIGNMENT_UPDATED,
      'Assignment updated',
      `${assignment.title} was updated.`,
      this.uniqueIds([...previousEmployeeIds, ...employeeIds]),
    );
    const studentWarnings = await this.createStudentWarnings(
      assignment.id,
      employeeIds,
      startAt,
    );
    await this.auditService.record({
      actorUserId,
      action: 'ASSIGNMENT_UPDATED',
      entityType: 'WorkAssignment',
      entityId: id,
      metadata: { fields: Object.keys(input) },
    });

    return { assignment, studentWarnings };
  }

  async cancel(actorUserId: string, id: string, input: CancelAssignmentDto) {
    const existing = await this.prisma.workAssignment.findUnique({
      where: { id },
      include: { employees: true },
    });

    if (!existing) {
      throw new NotFoundException('Assignment not found.');
    }

    if (existing.status === AssignmentStatus.CANCELLED) {
      throw new BadRequestException('The assignment is already cancelled.');
    }

    const assignment = await this.prisma.workAssignment.update({
      where: { id },
      data: {
        status: AssignmentStatus.CANCELLED,
        cancellationReason: input.reason.trim(),
        updatedById: actorUserId,
      },
      include: ASSIGNMENT_INCLUDE,
    });
    const employeeIds = existing.employees.map((link) => link.employeeId);

    await this.notifyAssignment(
      assignment.id,
      NotificationType.ASSIGNMENT_CANCELLED,
      'Assignment cancelled',
      `${assignment.title} was cancelled.`,
      employeeIds,
    );
    await this.auditService.record({
      actorUserId,
      action: 'ASSIGNMENT_CANCELLED',
      entityType: 'WorkAssignment',
      entityId: id,
      metadata: { reason: input.reason.trim() },
    });

    return assignment;
  }

  async updateRecurrence(
    actorUserId: string,
    id: string,
    input: UpdateAssignmentRecurrenceDto,
  ) {
    const existing = await this.prisma.workAssignment.findUnique({
      where: { id },
      include: {
        employees: true,
        recurringTemplate: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Assignment not found.');
    }
    if (existing.status === AssignmentStatus.CANCELLED) {
      throw new BadRequestException(
        'A cancelled assignment cannot become a recurring schedule.',
      );
    }

    const durationMinutes = Math.round(
      (existing.endAt.getTime() - existing.startAt.getTime()) / 60000,
    );
    const recurrenceInput: CreateRecurringAssignmentDto = {
      siteId: existing.siteId,
      title: existing.title,
      frequency: input.frequency,
      interval: input.interval,
      daysOfWeek: input.daysOfWeek,
      firstStartAt: existing.startAt.toISOString(),
      durationMinutes,
      untilAt: input.untilAt,
      employeeIds: [],
      employees: [],
      clientCharge: Number(existing.clientCharge ?? 0),
    };
    const occurrences = this.generateOccurrences(recurrenceInput).filter(
      (occurrence) => occurrence.startAt > existing.startAt,
    );
    const employeeIds = existing.employees.map((link) => link.employeeId);

    for (const occurrence of occurrences) {
      await this.assertNoConflicts(
        employeeIds,
        occurrence.startAt,
        occurrence.endAt,
        id,
        existing.recurringTemplateId ?? undefined,
      );
    }

    const templateId = await this.prisma.$transaction(async (transaction) => {
      const template = existing.recurringTemplateId
        ? await transaction.recurringTemplate.update({
            where: { id: existing.recurringTemplateId },
            data: {
              siteId: existing.siteId,
              title: existing.title,
              frequency: input.frequency,
              interval: input.interval,
              daysOfWeek: input.daysOfWeek,
              firstStartAt: existing.startAt,
              durationMinutes,
              untilAt: new Date(input.untilAt),
              occurrenceCount: null,
              notes: existing.notes,
              departureAddress: existing.departureAddress,
              departureLatitude: existing.departureLatitude,
              departureLongitude: existing.departureLongitude,
              travelDistanceMeters: existing.travelDistanceMeters,
              estimatedTravelMinutes: existing.estimatedTravelMinutes,
              clientCharge: existing.clientCharge,
              routeCalculatedAt: existing.routeCalculatedAt,
              active: true,
              employees: {
                deleteMany: {},
                create: existing.employees.map((link) => ({
                  employeeId: link.employeeId,
                  agreedHourlyRate: link.agreedHourlyRate,
                  rateOverridden: link.rateOverridden,
                })),
              },
            },
          })
        : await transaction.recurringTemplate.create({
            data: {
              siteId: existing.siteId,
              title: existing.title,
              frequency: input.frequency,
              interval: input.interval,
              daysOfWeek: input.daysOfWeek,
              firstStartAt: existing.startAt,
              durationMinutes,
              untilAt: new Date(input.untilAt),
              notes: existing.notes,
              departureAddress: existing.departureAddress,
              departureLatitude: existing.departureLatitude,
              departureLongitude: existing.departureLongitude,
              travelDistanceMeters: existing.travelDistanceMeters,
              estimatedTravelMinutes: existing.estimatedTravelMinutes,
              clientCharge: existing.clientCharge,
              routeCalculatedAt: existing.routeCalculatedAt,
              createdById: actorUserId,
              employees: {
                create: existing.employees.map((link) => ({
                  employeeId: link.employeeId,
                  agreedHourlyRate: link.agreedHourlyRate,
                  rateOverridden: link.rateOverridden,
                })),
              },
            },
          });

      if (existing.recurringTemplateId) {
        await transaction.workAssignment.deleteMany({
          where: {
            recurringTemplateId: existing.recurringTemplateId,
            startAt: { gt: existing.startAt },
          },
        });
      } else {
        await transaction.workAssignment.update({
          where: { id },
          data: { recurringTemplateId: template.id, updatedById: actorUserId },
        });
      }

      for (const occurrence of occurrences) {
        await transaction.workAssignment.create({
          data: {
            siteId: existing.siteId,
            recurringTemplateId: template.id,
            title: existing.title,
            startAt: occurrence.startAt,
            endAt: occurrence.endAt,
            notes: existing.notes,
            departureAddress: existing.departureAddress,
            departureLatitude: existing.departureLatitude,
            departureLongitude: existing.departureLongitude,
            travelDistanceMeters: existing.travelDistanceMeters,
            estimatedTravelMinutes: existing.estimatedTravelMinutes,
            clientCharge: existing.clientCharge,
            routeCalculatedAt: existing.routeCalculatedAt,
            createdById: actorUserId,
            employees: {
              create: existing.employees.map((link) => ({
                employeeId: link.employeeId,
                agreedHourlyRate: link.agreedHourlyRate,
                rateOverridden: link.rateOverridden,
              })),
            },
          },
        });
      }

      return template.id;
    });

    await this.notifyUsers(
      employeeIds,
      NotificationType.ASSIGNMENT_UPDATED,
      'Recurring schedule updated',
      `${existing.title} now repeats through ${DateTime.fromISO(input.untilAt).toFormat('dd LLL yyyy')}.`,
    );
    await this.auditService.record({
      actorUserId,
      action: existing.recurringTemplateId
        ? 'RECURRING_TEMPLATE_UPDATED'
        : 'ASSIGNMENT_CONVERTED_TO_RECURRING',
      entityType: 'RecurringTemplate',
      entityId: templateId,
      metadata: {
        sourceAssignmentId: id,
        frequency: input.frequency,
        generatedAssignments: occurrences.length,
      },
    });

    const assignment = await this.prisma.workAssignment.findUnique({
      where: { id },
      include: ASSIGNMENT_INCLUDE,
    });
    return { assignment, generatedAssignmentCount: occurrences.length };
  }

  async cancelSeries(
    actorUserId: string,
    id: string,
    input: CancelAssignmentDto,
  ) {
    const existing = await this.prisma.workAssignment.findUnique({
      where: { id },
      include: { employees: true },
    });

    if (!existing) {
      throw new NotFoundException('Assignment not found.');
    }
    if (!existing.recurringTemplateId) {
      throw new BadRequestException(
        'This assignment is not part of a recurring series.',
      );
    }

    const reason = input.reason.trim();
    const result = await this.prisma.$transaction(async (transaction) => {
      const affected = await transaction.workAssignment.findMany({
        where: {
          recurringTemplateId: existing.recurringTemplateId!,
          OR: [{ endAt: { gt: new Date() } }, { id }],
          status: { not: AssignmentStatus.CANCELLED },
        },
        select: {
          id: true,
          employees: { select: { employeeId: true } },
        },
      });

      await transaction.workAssignment.updateMany({
        where: { id: { in: affected.map((assignment) => assignment.id) } },
        data: {
          status: AssignmentStatus.CANCELLED,
          cancellationReason: reason,
          updatedById: actorUserId,
        },
      });
      await transaction.recurringTemplate.update({
        where: { id: existing.recurringTemplateId! },
        data: { active: false },
      });

      return affected;
    });

    const employeeIds = this.uniqueIds(
      result.flatMap((assignment) =>
        assignment.employees.map((link) => link.employeeId),
      ),
    );
    await this.notifyUsers(
      employeeIds,
      NotificationType.ASSIGNMENT_CANCELLED,
      'Recurring schedule cancelled',
      `${result.length} scheduled occurrence${result.length === 1 ? '' : 's'} were cancelled.`,
    );
    await this.auditService.record({
      actorUserId,
      action: 'RECURRING_ASSIGNMENTS_CANCELLED',
      entityType: 'RecurringTemplate',
      entityId: existing.recurringTemplateId,
      metadata: { reason, cancelledCount: result.length, fromAssignmentId: id },
    });

    return { cancelledCount: result.length };
  }

  async remove(actorUserId: string, id: string) {
    const existing = await this.prisma.workAssignment.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        recurringTemplateId: true,
        startAt: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Assignment not found.');
    }

    await this.prisma.workAssignment.delete({ where: { id } });
    await this.auditService.record({
      actorUserId,
      action: 'ASSIGNMENT_DELETED',
      entityType: 'WorkAssignment',
      entityId: id,
      metadata: {
        title: existing.title,
        recurringTemplateId: existing.recurringTemplateId,
        startAt: existing.startAt.toISOString(),
      },
    });

    return { id, deleted: true };
  }

  async createRecurring(
    actorUserId: string,
    input: CreateRecurringAssignmentDto,
  ) {
    await this.assertActiveSite(input.siteId);
    const employeeLinks = await this.buildEmployeeLinks(
      input.employeeIds,
      input.employees,
    );
    const employeeIds = employeeLinks.map((link) => link.employeeId);
    const occurrences = this.generateOccurrences(input);

    for (const occurrence of occurrences) {
      await this.assertNoConflicts(
        employeeIds,
        occurrence.startAt,
        occurrence.endAt,
      );
    }

    const result = await this.prisma.$transaction(async (transaction) => {
      const template = await transaction.recurringTemplate.create({
        data: {
          siteId: input.siteId,
          title: input.title.trim(),
          frequency: input.frequency,
          interval: input.interval,
          daysOfWeek: input.daysOfWeek,
          firstStartAt: new Date(input.firstStartAt),
          durationMinutes: input.durationMinutes,
          untilAt: input.untilAt ? new Date(input.untilAt) : null,
          occurrenceCount: input.occurrenceCount,
          notes: input.notes?.trim(),
          departureAddress: input.departureAddress?.trim(),
          departureLatitude: input.departureLatitude,
          departureLongitude: input.departureLongitude,
          travelDistanceMeters: input.travelDistanceMeters,
          estimatedTravelMinutes: input.estimatedTravelMinutes,
          clientCharge: input.clientCharge,
          routeCalculatedAt:
            input.travelDistanceMeters !== undefined ? new Date() : undefined,
          createdById: actorUserId,
          employees: {
            create: employeeLinks,
          },
        },
      });

      const assignments: Array<{
        id: string;
        startAt: Date;
        endAt: Date;
      }> = [];
      for (const occurrence of occurrences) {
        assignments.push(
          await transaction.workAssignment.create({
            data: {
              siteId: input.siteId,
              recurringTemplateId: template.id,
              title: input.title.trim(),
              startAt: occurrence.startAt,
              endAt: occurrence.endAt,
              notes: input.notes?.trim(),
              departureAddress: input.departureAddress?.trim(),
              departureLatitude: input.departureLatitude,
              departureLongitude: input.departureLongitude,
              travelDistanceMeters: input.travelDistanceMeters,
              estimatedTravelMinutes: input.estimatedTravelMinutes,
              clientCharge: input.clientCharge,
              routeCalculatedAt:
                input.travelDistanceMeters !== undefined
                  ? new Date()
                  : undefined,
              createdById: actorUserId,
              employees: {
                create: employeeLinks,
              },
            },
            select: {
              id: true,
              startAt: true,
              endAt: true,
            },
          }),
        );
      }

      return { template, assignments };
    });

    await this.notifyUsers(
      employeeIds,
      NotificationType.ASSIGNMENT_CREATED,
      'Recurring schedule created',
      `${result.assignments.length} assignments were added for ${input.title.trim()}.`,
    );
    await this.auditService.record({
      actorUserId,
      action: 'RECURRING_TEMPLATE_CREATED',
      entityType: 'RecurringTemplate',
      entityId: result.template.id,
      metadata: {
        employeeIds,
        generatedAssignments: result.assignments.length,
      },
    });

    return {
      ...result.template,
      generatedAssignmentCount: result.assignments.length,
      assignments: result.assignments,
    };
  }

  async listRecurring() {
    return this.prisma.recurringTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        site: {
          include: {
            client: {
              select: { id: true, companyName: true },
            },
          },
        },
        employees: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: { select: { assignments: true } },
      },
    });
  }

  async setRecurringStatus(
    actorUserId: string,
    id: string,
    input: SetRecurringStatusDto,
  ) {
    const existing = await this.prisma.recurringTemplate.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Recurring template not found.');
    }

    const template = await this.prisma.recurringTemplate.update({
      where: { id },
      data: { active: input.active },
    });

    await this.auditService.record({
      actorUserId,
      action: input.active
        ? 'RECURRING_TEMPLATE_ACTIVATED'
        : 'RECURRING_TEMPLATE_DEACTIVATED',
      entityType: 'RecurringTemplate',
      entityId: id,
    });

    return template;
  }

  private async assertActiveSite(siteId: string): Promise<void> {
    const site = await this.prisma.cleaningSite.findUnique({
      where: { id: siteId },
      select: {
        active: true,
        client: { select: { active: true } },
      },
    });

    if (!site) {
      throw new NotFoundException('Cleaning site not found.');
    }

    if (!site.active || !site.client.active) {
      throw new BadRequestException(
        'Assignments require an active site and active client.',
      );
    }
  }

  private async buildEmployeeLinks(
    employeeIds: string[],
    employeeInputs: AssignmentEmployeeInputDto[],
  ): Promise<EmployeeLinkData[]> {
    const rateByEmployeeId = new Map(
      employeeInputs.map((employee) => [employee.employeeId, employee]),
    );
    const ids = this.uniqueIds([
      ...employeeIds,
      ...employeeInputs.map((employee) => employee.employeeId),
    ]);

    if (!ids.length) return [];

    const employees = await this.prisma.employee.findMany({
      where: {
        id: { in: ids },
        active: true,
        user: { status: UserStatus.ACTIVE },
      },
      select: {
        id: true,
        hourlyRate: true,
      },
    });

    if (employees.length !== ids.length) {
      throw new BadRequestException(
        'Every assigned employee must exist and be active.',
      );
    }

    const employeeById = new Map(
      employees.map((employee) => [employee.id, employee]),
    );

    return ids.map((employeeId) => {
      const employee = employeeById.get(employeeId)!;
      const requestedRate = rateByEmployeeId.get(employeeId)?.hourlyRate;

      return {
        employeeId,
        agreedHourlyRate:
          requestedRate === undefined
            ? employee.hourlyRate
            : new Prisma.Decimal(requestedRate),
        rateOverridden: requestedRate !== undefined,
      };
    });
  }

  private async assertActiveEmployees(employeeIds: string[]): Promise<void> {
    if (!employeeIds.length) {
      return;
    }

    const activeEmployees = await this.prisma.employee.count({
      where: {
        id: { in: employeeIds },
        active: true,
        user: { status: UserStatus.ACTIVE },
      },
    });

    if (activeEmployees !== employeeIds.length) {
      throw new BadRequestException(
        'Every assigned employee must exist and be active.',
      );
    }
  }

  private async assertNoConflicts(
    employeeIds: string[],
    startAt: Date,
    endAt: Date,
    excludedAssignmentId?: string,
    excludedRecurringTemplateId?: string,
  ): Promise<void> {
    if (!employeeIds.length) {
      return;
    }

    const conflict = await this.prisma.assignmentEmployee.findFirst({
      where: {
        employeeId: { in: employeeIds },
        assignment: {
          id: excludedAssignmentId ? { not: excludedAssignmentId } : undefined,
          recurringTemplateId: excludedRecurringTemplateId
            ? { not: excludedRecurringTemplateId }
            : undefined,
          status: {
            in: [AssignmentStatus.SCHEDULED, AssignmentStatus.COMPLETED],
          },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
      },
      include: {
        employee: {
          select: { firstName: true, lastName: true },
        },
        assignment: {
          select: { id: true, title: true, startAt: true, endAt: true },
        },
      },
    });

    if (conflict) {
      throw new ConflictException({
        message: `${conflict.employee.firstName} ${conflict.employee.lastName} already has an overlapping assignment.`,
        conflictingAssignment: conflict.assignment,
      });
    }
  }

  private generateOccurrences(
    input: CreateRecurringAssignmentDto,
  ): Occurrence[] {
    if (!input.untilAt && !input.occurrenceCount) {
      throw new BadRequestException(
        'A recurring assignment requires untilAt or occurrenceCount.',
      );
    }

    if (
      input.frequency === RecurrenceFrequency.WEEKLY &&
      input.daysOfWeek.length === 0
    ) {
      throw new BadRequestException(
        'Weekly recurrence requires at least one weekday.',
      );
    }

    const zone = this.configService.get<string>(
      'SYSTEM_TIME_ZONE',
      'Europe/Paris',
    );
    const first = DateTime.fromISO(input.firstStartAt, {
      setZone: true,
    }).setZone(zone);
    const until = input.untilAt
      ? DateTime.fromISO(input.untilAt, { setZone: true }).setZone(zone)
      : undefined;

    if (!first.isValid || (until && !until.isValid)) {
      throw new BadRequestException('The recurrence dates are invalid.');
    }

    if (until && until < first) {
      throw new BadRequestException('untilAt must be after firstStartAt.');
    }

    const targetCount = input.occurrenceCount ?? 366;
    const occurrences: Occurrence[] = [];

    if (input.frequency === RecurrenceFrequency.WEEKLY) {
      const anchorWeek = first.startOf('week');
      let day = first.startOf('day');
      let safetyDays = 0;

      while (occurrences.length < targetCount && safetyDays < 3660) {
        const weekOffset = Math.floor(
          day.startOf('week').diff(anchorWeek, 'weeks').weeks,
        );
        const candidate = day.set({
          hour: first.hour,
          minute: first.minute,
          second: first.second,
          millisecond: first.millisecond,
        });
        const selectedWeek =
          weekOffset >= 0 && weekOffset % input.interval === 0;
        const selectedDay = input.daysOfWeek.includes(candidate.weekday);

        if (
          selectedWeek &&
          selectedDay &&
          candidate >= first &&
          (!until || candidate <= until)
        ) {
          occurrences.push(this.occurrence(candidate, input.durationMinutes));
        }

        day = day.plus({ days: 1 });
        safetyDays += 1;

        if (until && day > until.endOf('day')) {
          break;
        }
      }
    } else if (input.frequency === RecurrenceFrequency.MONTHLY) {
      let monthOffset = 0;

      while (occurrences.length < targetCount) {
        const candidate = first.plus({ months: monthOffset });
        if (until && candidate > until) {
          break;
        }
        occurrences.push(this.occurrence(candidate, input.durationMinutes));
        monthOffset += input.interval;
      }
    } else {
      let candidate = first;

      while (
        occurrences.length < targetCount &&
        (!until || candidate <= until)
      ) {
        occurrences.push(this.occurrence(candidate, input.durationMinutes));
        candidate = candidate.plus({ days: input.interval });
      }
    }

    if (!occurrences.length) {
      throw new BadRequestException(
        'The recurrence rule did not produce any assignments.',
      );
    }

    if (occurrences.length > 366) {
      throw new BadRequestException(
        'A recurring request may generate at most 366 assignments.',
      );
    }

    return occurrences;
  }

  private occurrence(start: DateTime, durationMinutes: number): Occurrence {
    return {
      startAt: start.toUTC().toJSDate(),
      endAt: start.plus({ minutes: durationMinutes }).toUTC().toJSDate(),
    };
  }

  private async createStudentWarnings(
    assignmentId: string,
    employeeIds: string[],
    assignmentStart: Date,
  ) {
    if (!employeeIds.length) {
      return [];
    }

    const zone = this.configService.get<string>(
      'SYSTEM_TIME_ZONE',
      'Europe/Paris',
    );
    const month = DateTime.fromJSDate(assignmentStart, { zone });
    const monthStart = month.startOf('month').toUTC().toJSDate();
    const monthEnd = month
      .plus({ months: 1 })
      .startOf('month')
      .toUTC()
      .toJSDate();
    const limitMinutes = this.configService.get<number>(
      'STUDENT_MONTHLY_LIMIT_MINUTES',
      4800,
    );
    const students = await this.prisma.employee.findMany({
      where: {
        id: { in: employeeIds },
        isStudent: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        userId: true,
      },
    });
    const warnings: Array<{
      employeeId: string;
      employeeName: string;
      month: string;
      plannedMinutes: number;
      limitMinutes: number;
      exceededByMinutes: number;
      assignmentAllowed: boolean;
    }> = [];

    for (const student of students) {
      const links = await this.prisma.assignmentEmployee.findMany({
        where: {
          employeeId: student.id,
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
            select: { startAt: true, endAt: true },
          },
        },
      });
      const plannedMinutes = Math.round(
        links.reduce((total, link) => {
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

      if (plannedMinutes > limitMinutes) {
        const warning = {
          employeeId: student.id,
          employeeName: `${student.firstName} ${student.lastName}`,
          month: month.toFormat('yyyy-MM'),
          plannedMinutes,
          limitMinutes,
          exceededByMinutes: plannedMinutes - limitMinutes,
          assignmentAllowed: true,
        };
        warnings.push(warning);

        const existingWarning = await this.prisma.notification.findFirst({
          where: {
            userId: student.userId,
            assignmentId,
            type: NotificationType.STUDENT_HOUR_WARNING,
          },
          select: { id: true },
        });

        if (!existingWarning) {
          await this.prisma.notification.create({
            data: {
              userId: student.userId,
              assignmentId,
              type: NotificationType.STUDENT_HOUR_WARNING,
              title: 'Student planned-hour warning',
              message: `${warning.employeeName} has ${plannedMinutes} planned minutes in ${warning.month}, above the ${limitMinutes}-minute warning threshold.`,
            },
          });
        }
      }
    }

    return warnings;
  }

  private async notifyAssignment(
    assignmentId: string,
    type: NotificationType,
    title: string,
    message: string,
    employeeIds: string[],
  ): Promise<void> {
    const userIds = await this.userIdsForEmployees(employeeIds);

    if (!userIds.length) {
      return;
    }

    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        assignmentId,
        type,
        title,
        message,
      })),
    });
  }

  private async notifyUsers(
    employeeIds: string[],
    type: NotificationType,
    title: string,
    message: string,
  ): Promise<void> {
    const userIds = await this.userIdsForEmployees(employeeIds);

    if (!userIds.length) {
      return;
    }

    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type,
        title,
        message,
      })),
    });
  }

  private async userIdsForEmployees(employeeIds: string[]): Promise<string[]> {
    if (!employeeIds.length) {
      return [];
    }

    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { userId: true },
    });
    return employees.map((employee) => employee.userId);
  }

  private async employeeIdForUser(userId: string): Promise<string> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee profile not found.');
    }

    return employee.id;
  }

  private assertValidRange(startAt: Date, endAt: Date): void {
    if (
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime()) ||
      endAt <= startAt
    ) {
      throw new BadRequestException('endAt must be after startAt.');
    }
  }

  private occupiesSchedule(status: AssignmentStatus): boolean {
    return (
      status === AssignmentStatus.SCHEDULED ||
      status === AssignmentStatus.COMPLETED
    );
  }

  private uniqueIds(ids: string[]): string[] {
    return [...new Set(ids)];
  }
}
