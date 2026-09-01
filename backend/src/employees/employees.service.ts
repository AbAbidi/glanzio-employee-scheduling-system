import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import {
  AssignmentStatus,
  Prisma,
  UserRole,
  UserStatus,
} from '../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import type { CreateEmployeeDto } from './dto/create-employee.dto';
import type { EmployeeQueryDto } from './dto/employee-query.dto';
import type { SetEmployeeStatusDto } from './dto/set-employee-status.dto';
import type { UpdateEmployeeDto } from './dto/update-employee.dto';
import type { UpdateMyProfileDto } from './dto/update-my-profile.dto';

const EMPLOYEE_INCLUDE = {
  user: {
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async create(actorUserId: string, input: CreateEmployeeDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists.');
    }

    const invitation = this.createInvitationToken();
    const employee = await this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          email: input.email,
          passwordHash: null,
          role: UserRole.EMPLOYEE,
          status: UserStatus.INVITED,
          employee: {
            create: {
              firstName: input.firstName.trim(),
              lastName: input.lastName.trim(),
              phone: input.phone?.trim(),
              hourlyRate: input.hourlyRate,
              isStudent: input.isStudent,
            },
          },
        },
        select: {
          employee: {
            include: EMPLOYEE_INCLUDE,
          },
        },
      });

      if (!user.employee) {
        throw new Error('The employee profile was not created.');
      }

      await transaction.accountInvitation.create({
        data: {
          userId: user.employee.userId,
          createdById: actorUserId,
          tokenHash: invitation.tokenHash,
          expiresAt: invitation.expiresAt,
        },
      });

      return user.employee;
    });

    await this.auditService.record({
      actorUserId,
      action: 'EMPLOYEE_INVITED',
      entityType: 'Employee',
      entityId: employee.id,
      metadata: { email: input.email },
    });

    return {
      employee,
      invitation: this.invitationDelivery(
        invitation.plainToken,
        invitation.expiresAt,
      ),
    };
  }

  async resendInvitation(actorUserId: string, id: string) {
    const employee = await this.findOne(id);

    if (employee.user.status !== UserStatus.INVITED) {
      throw new BadRequestException(
        'Only an invited employee can receive a replacement invitation.',
      );
    }

    const invitation = this.createInvitationToken();
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.accountInvitation.updateMany({
        where: {
          userId: employee.userId,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      }),
      this.prisma.accountInvitation.create({
        data: {
          userId: employee.userId,
          createdById: actorUserId,
          tokenHash: invitation.tokenHash,
          expiresAt: invitation.expiresAt,
        },
      }),
    ]);

    await this.auditService.record({
      actorUserId,
      action: 'EMPLOYEE_INVITATION_REISSUED',
      entityType: 'Employee',
      entityId: id,
    });

    return this.invitationDelivery(invitation.plainToken, invitation.expiresAt);
  }

  async list(query: EmployeeQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.EmployeeWhereInput = {
      active: query.active,
      isStudent: query.isStudent,
      OR: search
        ? [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            {
              user: {
                email: { contains: search, mode: 'insensitive' },
              },
            },
          ]
        : undefined,
    };
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        include: EMPLOYEE_INCLUDE,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take: query.pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      pageCount: Math.ceil(total / query.pageSize),
    };
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        ...EMPLOYEE_INCLUDE,
        _count: {
          select: { assignmentLinks: true },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    return employee;
  }

  async update(actorUserId: string, id: string, input: UpdateEmployeeDto) {
    const employee = await this.findOne(id);

    if (input.email && input.email !== employee.user.email) {
      const duplicate = await this.prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });

      if (duplicate) {
        throw new ConflictException('A user with this email already exists.');
      }
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        firstName: input.firstName?.trim(),
        lastName: input.lastName?.trim(),
        phone: input.phone?.trim(),
        hourlyRate: input.hourlyRate,
        isStudent: input.isStudent,
        user: input.email
          ? {
              update: { email: input.email },
            }
          : undefined,
      },
      include: EMPLOYEE_INCLUDE,
    });

    await this.auditService.record({
      actorUserId,
      action: 'EMPLOYEE_UPDATED',
      entityType: 'Employee',
      entityId: id,
      metadata: {
        fields: Object.keys(input),
      },
    });

    return updated;
  }

  async setStatus(
    actorUserId: string,
    id: string,
    input: SetEmployeeStatusDto,
  ) {
    const employee = await this.findOne(id);

    if (employee.user.status === UserStatus.INVITED) {
      throw new BadRequestException(
        'Accept or reissue the employee invitation before changing status.',
      );
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: employee.userId },
        data: {
          status: input.active ? UserStatus.ACTIVE : UserStatus.INACTIVE,
        },
      });

      if (!input.active) {
        await transaction.refreshSession.updateMany({
          where: {
            userId: employee.userId,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
      }

      return transaction.employee.update({
        where: { id },
        data: { active: input.active },
        include: EMPLOYEE_INCLUDE,
      });
    });

    await this.auditService.record({
      actorUserId,
      action: input.active ? 'EMPLOYEE_ACTIVATED' : 'EMPLOYEE_DEACTIVATED',
      entityType: 'Employee',
      entityId: id,
    });

    return updated;
  }

  async archive(actorUserId: string, id: string) {
    const employee = await this.findOne(id);
    const now = new Date();
    const updated = await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: employee.userId },
        data: { status: UserStatus.INACTIVE },
      });
      await transaction.refreshSession.updateMany({
        where: { userId: employee.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await transaction.accountInvitation.updateMany({
        where: {
          userId: employee.userId,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });
      return transaction.employee.update({
        where: { id },
        data: { active: false },
        include: EMPLOYEE_INCLUDE,
      });
    });

    await this.auditService.record({
      actorUserId,
      action: 'EMPLOYEE_ARCHIVED',
      entityType: 'Employee',
      entityId: id,
    });

    return updated;
  }

  async analytics(id: string) {
    const employee = await this.findOne(id);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [completedLinks, scheduledLinks] = await Promise.all([
      this.prisma.assignmentEmployee.findMany({
        where: {
          employeeId: id,
          assignment: {
            endAt: { lte: now },
            status: {
              in: [AssignmentStatus.SCHEDULED, AssignmentStatus.COMPLETED],
            },
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
        orderBy: { assignment: { endAt: 'desc' } },
      }),
      this.prisma.assignmentEmployee.findMany({
        where: {
          employeeId: id,
          assignment: {
            status: {
              in: [AssignmentStatus.SCHEDULED, AssignmentStatus.COMPLETED],
            },
          },
        },
        select: {
          assignment: { select: { startAt: true, endAt: true } },
        },
      }),
    ]);

    const completedAssignments = completedLinks.map((link) => {
      const durationMinutes = Math.max(
        0,
        Math.round(
          (link.assignment.endAt.getTime() -
            link.assignment.startAt.getTime()) /
            60_000,
        ),
      );
      const hourlyRate = link.agreedHourlyRate
        ? Number(link.agreedHourlyRate)
        : 0;
      const cost = Number(((durationMinutes / 60) * hourlyRate).toFixed(2));

      return {
        id: link.assignment.id,
        title: link.assignment.title,
        startAt: link.assignment.startAt,
        endAt: link.assignment.endAt,
        siteName: link.assignment.site.name,
        clientName: link.assignment.site.client.companyName,
        durationMinutes,
        agreedHourlyRate: link.agreedHourlyRate,
        cost,
      };
    });
    const completedMinutes = completedAssignments.reduce(
      (total, assignment) => total + assignment.durationMinutes,
      0,
    );
    const currentMonthMinutes = completedAssignments
      .filter((assignment) => new Date(assignment.endAt) >= monthStart)
      .reduce((total, assignment) => total + assignment.durationMinutes, 0);
    const scheduledMinutes = scheduledLinks.reduce(
      (total, link) =>
        total +
        Math.max(
          0,
          Math.round(
            (link.assignment.endAt.getTime() -
              link.assignment.startAt.getTime()) /
              60_000,
          ),
        ),
      0,
    );
    const totalCost = Number(
      completedAssignments
        .reduce((total, assignment) => total + assignment.cost, 0)
        .toFixed(2),
    );

    return {
      employee,
      metrics: {
        completedAssignments: completedAssignments.length,
        completedMinutes,
        currentMonthMinutes,
        scheduledMinutes,
        totalCost,
      },
      completedAssignments,
    };
  }

  async resetPassword(
    actorUserId: string,
    id: string,
    input: AdminResetPasswordDto,
  ): Promise<void> {
    const employee = await this.findOne(id);

    if (employee.user.status === UserStatus.INVITED) {
      throw new BadRequestException(
        'Reissue the invitation instead of resetting an invited account password.',
      );
    }
    const passwordHash = await argon2.hash(input.newPassword, {
      type: argon2.argon2id,
    });
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: employee.userId },
        data: {
          passwordHash,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.refreshSession.updateMany({
        where: {
          userId: employee.userId,
          revokedAt: null,
        },
        data: { revokedAt: now },
      }),
    ]);

    await this.auditService.record({
      actorUserId,
      action: 'EMPLOYEE_PASSWORD_RESET',
      entityType: 'Employee',
      entityId: id,
    });
  }

  async getMyProfile(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: EMPLOYEE_INCLUDE,
    });

    if (!employee) {
      throw new NotFoundException('Employee profile not found.');
    }

    return employee;
  }

  async updateMyProfile(userId: string, input: UpdateMyProfileDto) {
    const employee = await this.getMyProfile(userId);
    if (input.email && input.email !== employee.user.email) {
      const duplicate = await this.prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException('A user with this email already exists.');
      }
    }

    const updated = await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        firstName: input.firstName?.trim(),
        lastName: input.lastName?.trim(),
        phone: input.phone?.trim(),
        user: input.email ? { update: { email: input.email } } : undefined,
      },
      include: EMPLOYEE_INCLUDE,
    });

    await this.auditService.record({
      actorUserId: userId,
      action: 'EMPLOYEE_SELF_PROFILE_UPDATED',
      entityType: 'Employee',
      entityId: employee.id,
      metadata: { fields: Object.keys(input) },
    });

    return updated;
  }

  private createInvitationToken(): {
    plainToken: string;
    tokenHash: string;
    expiresAt: Date;
  } {
    const plainToken = randomBytes(48).toString('base64url');
    const hours = this.configService.get<number>(
      'INVITATION_EXPIRES_IN_HOURS',
      72,
    );

    return {
      plainToken,
      tokenHash: createHash('sha256').update(plainToken).digest('hex'),
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
    };
  }

  private invitationDelivery(plainToken: string, expiresAt: Date) {
    const response: {
      expiresAt: Date;
      developmentInvitationUrl?: string;
    } = { expiresAt };

    if (this.configService.get<string>('NODE_ENV') !== 'production') {
      const frontendOrigin = this.configService
        .get<string>('CORS_ORIGIN', 'http://localhost:5173')
        .split(',')[0]
        .trim();
      response.developmentInvitationUrl = `${frontendOrigin}/login?invitation=${encodeURIComponent(plainToken)}`;
    }

    return response;
  }
}
