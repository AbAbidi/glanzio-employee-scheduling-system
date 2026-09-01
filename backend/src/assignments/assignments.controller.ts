import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../generated/prisma/client';
import { AssignmentsService } from './assignments.service';
import { AssignmentQueryDto } from './dto/assignment-query.dto';
import { CancelAssignmentDto } from './dto/cancel-assignment.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { UpdateAssignmentRecurrenceDto } from './dto/update-assignment-recurrence.dto';

@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateAssignmentDto,
  ) {
    return this.assignmentsService.create(user.id, input);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AssignmentQueryDto,
  ) {
    return this.assignmentsService.list(user, query);
  }

  @Get('history')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AssignmentQueryDto,
  ) {
    return this.assignmentsService.list(user, {
      ...query,
      status: 'COMPLETED',
      to: query.to ?? new Date().toISOString(),
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assignmentsService.findOne(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateAssignmentDto,
  ) {
    return this.assignmentsService.update(user.id, id, input);
  }

  @Patch(':id/recurrence')
  @Roles(UserRole.ADMIN)
  updateRecurrence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateAssignmentRecurrenceDto,
  ) {
    return this.assignmentsService.updateRecurrence(user.id, id, input);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CancelAssignmentDto,
  ) {
    return this.assignmentsService.cancel(user.id, id, input);
  }

  @Post(':id/cancel-series')
  @Roles(UserRole.ADMIN)
  cancelSeries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CancelAssignmentDto,
  ) {
    return this.assignmentsService.cancelSeries(user.id, id, input);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assignmentsService.remove(user.id, id);
  }
}
