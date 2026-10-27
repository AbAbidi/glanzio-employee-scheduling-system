import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  ManagerScope,
  ManagerScopeGuard,
} from '../common/guards/manager-scope.guard';
import { UserRole } from '../generated/prisma/client';
import { AssignmentsService } from './assignments.service';
import { CreateRecurringAssignmentDto } from './dto/create-recurring-assignment.dto';
import { SetRecurringStatusDto } from './dto/set-recurring-status.dto';

@Controller('recurring-assignments')
@UseGuards(JwtAuthGuard, RolesGuard, ManagerScopeGuard)
@ManagerScope('recurrence')
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class RecurringAssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateRecurringAssignmentDto,
  ) {
    return this.assignmentsService.createRecurring(user.id, input);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.assignmentsService.listRecurring(user);
  }

  @Patch(':id/status')
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SetRecurringStatusDto,
  ) {
    return this.assignmentsService.setRecurringStatus(user.id, id, input);
  }
}
