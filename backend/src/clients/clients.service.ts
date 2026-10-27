import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentStatus, Prisma, UserRole } from '../generated/prisma/client';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.type';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ClientQueryDto } from './dto/client-query.dto';
import type { CreateClientDto } from './dto/create-client.dto';
import type { SetClientStatusDto } from './dto/set-client-status.dto';
import type { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(actorUserId: string, input: CreateClientDto) {
    const client = await this.prisma.client.create({
      data: {
        companyName: input.companyName.trim(),
        contactName: input.contactName?.trim(),
        email: input.email,
        phone: input.phone?.trim(),
        notes: input.notes?.trim(),
      },
    });

    await this.auditService.record({
      actorUserId,
      action: 'CLIENT_CREATED',
      entityType: 'Client',
      entityId: client.id,
    });

    return client;
  }

  async list(query: ClientQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.ClientWhereInput = {
      active: query.active ?? true,
      OR: search
        ? [
            { companyName: { contains: search, mode: 'insensitive' } },
            { contactName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { companyName: 'asc' },
        include: {
          _count: { select: { sites: true } },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      pageCount: Math.ceil(total / query.pageSize),
    };
  }

  async findOne(id: string, actor?: AuthenticatedUser) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        sites: {
          where:
            actor?.role === UserRole.MANAGER ? { active: true } : undefined,
          orderBy: { name: 'asc' },
          include: {
            _count: { select: { assignments: true } },
          },
        },
        _count: { select: { sites: true } },
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found.');
    }

    return client;
  }

  async overview(id: string, actor?: AuthenticatedUser) {
    const client = await this.findOne(id, actor);
    const assignments = await this.prisma.workAssignment.findMany({
      where: {
        site: {
          clientId: id,
          ...(actor?.role === UserRole.MANAGER ? { active: true } : {}),
        },
      },
      include: {
        site: { select: { id: true, name: true, city: true } },
        employees: {
          where:
            actor?.role === UserRole.MANAGER
              ? { employee: { active: true } }
              : undefined,
          include: {
            employee: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { startAt: 'desc' },
      take: 100,
    });

    return { client, assignments };
  }

  async update(actorUserId: string, id: string, input: UpdateClientDto) {
    await this.findOne(id);
    const client = await this.prisma.client.update({
      where: { id },
      data: {
        companyName: input.companyName?.trim(),
        contactName: input.contactName?.trim(),
        email: input.email,
        phone: input.phone?.trim(),
        notes: input.notes?.trim(),
      },
    });

    await this.auditService.record({
      actorUserId,
      action: 'CLIENT_UPDATED',
      entityType: 'Client',
      entityId: id,
      metadata: { fields: Object.keys(input) },
    });

    return client;
  }

  async setStatus(actorUserId: string, id: string, input: SetClientStatusDto) {
    if (!input.active) return this.archive(actorUserId, id);
    await this.findOne(id);
    const client = await this.prisma.client.update({
      where: { id },
      data: { active: input.active },
    });

    await this.auditService.record({
      actorUserId,
      action: input.active ? 'CLIENT_RESTORED' : 'CLIENT_ARCHIVED',
      entityType: 'Client',
      entityId: id,
    });

    return client;
  }

  async archive(actorUserId: string, id: string) {
    await this.findOne(id);
    const client = await this.prisma.$transaction(async (transaction) => {
      const openAssignments = await transaction.workAssignment.count({
        where: {
          site: { clientId: id },
          status: { in: [AssignmentStatus.DRAFT, AssignmentStatus.SCHEDULED] },
          endAt: { gt: new Date() },
        },
      });
      if (openAssignments > 0) {
        throw new ConflictException(
          'Resolve future or ongoing assignments before archiving this client. Reassign or cancel them first; no assignments have been changed.',
        );
      }
      await transaction.cleaningSite.updateMany({
        where: { clientId: id },
        data: { active: false },
      });
      return transaction.client.update({
        where: { id },
        data: { active: false },
        include: { _count: { select: { sites: true } } },
      });
    });

    await this.auditService.record({
      actorUserId,
      action: 'CLIENT_ARCHIVED',
      entityType: 'Client',
      entityId: id,
      metadata: { sitesArchived: client._count.sites },
    });

    return client;
  }
}
