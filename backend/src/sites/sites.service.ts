import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSiteDto } from './dto/create-site.dto';
import type { SetSiteStatusDto } from './dto/set-site-status.dto';
import type { SiteQueryDto } from './dto/site-query.dto';
import type { UpdateSiteDto } from './dto/update-site.dto';

const SITE_INCLUDE = {
  client: {
    select: {
      id: true,
      companyName: true,
      active: true,
    },
  },
} as const;

@Injectable()
export class SitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(actorUserId: string, input: CreateSiteDto) {
    await this.assertActiveClient(input.clientId);

    const site = await this.prisma.cleaningSite.create({
      data: this.createSiteData(input),
      include: SITE_INCLUDE,
    });

    await this.auditService.record({
      actorUserId,
      action: 'SITE_CREATED',
      entityType: 'CleaningSite',
      entityId: site.id,
      metadata: { clientId: input.clientId },
    });

    return site;
  }

  async list(query: SiteQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.CleaningSiteWhereInput = {
      active: query.active ?? true,
      client: query.active === false ? undefined : { active: true },
      clientId: query.clientId,
      OR: search
        ? [
            { name: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
            { addressLine1: { contains: search, mode: 'insensitive' } },
            {
              client: {
                companyName: { contains: search, mode: 'insensitive' },
              },
            },
          ]
        : undefined,
    };
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.cleaningSite.findMany({
        where,
        include: SITE_INCLUDE,
        skip,
        take: query.pageSize,
        orderBy: [{ name: 'asc' }],
      }),
      this.prisma.cleaningSite.count({ where }),
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
    const site = await this.prisma.cleaningSite.findUnique({
      where: { id },
      include: {
        ...SITE_INCLUDE,
        _count: {
          select: {
            assignments: true,
            recurringTemplates: true,
          },
        },
      },
    });

    if (!site) {
      throw new NotFoundException('Cleaning site not found.');
    }

    return site;
  }

  async update(actorUserId: string, id: string, input: UpdateSiteDto) {
    await this.findOne(id);

    if (input.clientId) {
      await this.assertActiveClient(input.clientId);
    }

    const site = await this.prisma.cleaningSite.update({
      where: { id },
      data: this.updateSiteData(input),
      include: SITE_INCLUDE,
    });

    await this.auditService.record({
      actorUserId,
      action: 'SITE_UPDATED',
      entityType: 'CleaningSite',
      entityId: id,
      metadata: { fields: Object.keys(input) },
    });

    return site;
  }

  async setStatus(actorUserId: string, id: string, input: SetSiteStatusDto) {
    const existing = await this.findOne(id);

    if (input.active && !existing.client.active) {
      throw new BadRequestException(
        'Restore the client before restoring this cleaning site.',
      );
    }

    const site = await this.prisma.cleaningSite.update({
      where: { id },
      data: { active: input.active },
      include: SITE_INCLUDE,
    });

    await this.auditService.record({
      actorUserId,
      action: input.active ? 'SITE_RESTORED' : 'SITE_ARCHIVED',
      entityType: 'CleaningSite',
      entityId: id,
    });

    return site;
  }

  private async assertActiveClient(clientId: string): Promise<void> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { active: true },
    });

    if (!client) {
      throw new NotFoundException('Client not found.');
    }

    if (!client.active) {
      throw new BadRequestException(
        'An archived client cannot receive new cleaning sites.',
      );
    }
  }

  private createSiteData(
    input: CreateSiteDto,
  ): Prisma.CleaningSiteUncheckedCreateInput {
    return {
      clientId: input.clientId,
      name: input.name.trim(),
      addressLine1: input.addressLine1.trim(),
      addressLine2: input.addressLine2?.trim(),
      postalCode: input.postalCode?.trim(),
      city: input.city.trim(),
      countryCode: input.countryCode.trim().toUpperCase(),
      latitude: input.latitude,
      longitude: input.longitude,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      requiredEquipment: input.requiredEquipment.map((item) => item.trim()),
      notes: input.notes?.trim(),
    };
  }

  private updateSiteData(
    input: UpdateSiteDto,
  ): Prisma.CleaningSiteUncheckedUpdateInput {
    return {
      clientId: input.clientId,
      name: input.name?.trim(),
      addressLine1: input.addressLine1?.trim(),
      addressLine2: input.addressLine2?.trim(),
      postalCode: input.postalCode?.trim(),
      city: input.city?.trim(),
      countryCode: input.countryCode?.trim().toUpperCase(),
      latitude: input.latitude,
      longitude: input.longitude,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      requiredEquipment: input.requiredEquipment?.map((item) => item.trim()),
      notes: input.notes?.trim(),
    };
  }
}
