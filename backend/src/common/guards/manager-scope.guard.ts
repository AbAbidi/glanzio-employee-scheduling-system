import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/authenticated-user.type';
import { UserRole } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Scope =
  'employee' | 'client' | 'site' | 'assignment' | 'recurrence' | 'report';
const KEY = 'manager-resource-scope';
export const ManagerScope = (scope: Scope) => SetMetadata(KEY, scope);

/** A manager cannot use direct IDs or filters to browse the owner-only archive. */
@Injectable()
export class ManagerScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    if (request.user?.role !== UserRole.MANAGER) return true;
    if (request.query.active === 'false')
      throw new ForbiddenException('Archive access is owner-only.');
    const scope = this.reflector.getAllAndOverride<Scope>(KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const id = request.params.id;
    if (typeof id === 'string' && isUUID(id)) {
      let visible = true;
      if (scope === 'employee')
        visible = !!(await this.prisma.employee.findFirst({
          where: { id, active: true },
          select: { id: true },
        }));
      if (scope === 'client')
        visible = !!(await this.prisma.client.findFirst({
          where: { id, active: true },
          select: { id: true },
        }));
      if (scope === 'site')
        visible = !!(await this.prisma.cleaningSite.findFirst({
          where: { id, active: true, client: { active: true } },
          select: { id: true },
        }));
      if (scope === 'assignment')
        visible = !!(await this.prisma.workAssignment.findFirst({
          where: {
            id,
            site: { active: true, client: { active: true } },
            OR: [
              { employees: { none: {} } },
              { employees: { some: { employee: { active: true } } } },
            ],
          },
          select: { id: true },
        }));
      if (scope === 'recurrence')
        visible = !!(await this.prisma.recurringTemplate.findFirst({
          where: { id, site: { active: true, client: { active: true } } },
          select: { id: true },
        }));
      if (!visible) throw new NotFoundException('Active record not found.');
    }
    const employeeId = request.query.employeeId;
    if (
      typeof employeeId === 'string' &&
      isUUID(employeeId) &&
      !(await this.prisma.employee.findFirst({
        where: { id: employeeId, active: true },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Active employee not found.');
    const clientId: unknown =
      request.query.clientId ??
      (request.body as Record<string, unknown> | undefined)?.clientId;
    if (
      typeof clientId === 'string' &&
      isUUID(clientId) &&
      !(await this.prisma.client.findFirst({
        where: { id: clientId, active: true },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Active client not found.');
    return true;
  }
}
