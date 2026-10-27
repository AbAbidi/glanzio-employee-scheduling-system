import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import {
  ManagerScope,
  ManagerScopeGuard,
} from '../common/guards/manager-scope.guard';
import { SetAccessRoleDto } from './dto/set-access-role.dto';
import { UserRole } from '../generated/prisma/client';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { SetEmployeeStatusDto } from './dto/set-employee-status.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard, ManagerScopeGuard)
@ManagerScope('employee')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateEmployeeDto,
  ) {
    return this.employeesService.create(user.id, input, user);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EmployeeQueryDto,
  ) {
    return this.employeesService.list(query, user);
  }

  @Post(':id/invitation')
  @Roles(UserRole.ADMIN)
  resendInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employeesService.resendInvitation(user.id, id);
  }

  @Get('me')
  @Roles(UserRole.EMPLOYEE, UserRole.MANAGER)
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.getMyProfile(user.id);
  }

  @Patch('me')
  @Roles(UserRole.EMPLOYEE, UserRole.MANAGER)
  updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateMyProfileDto,
  ) {
    return this.employeesService.updateMyProfile(user.id, input);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employeesService.findOne(id, user);
  }

  @Get(':id/analytics')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  analytics(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.analytics(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateEmployeeDto,
  ) {
    await this.employeesService.assertManagerCanEdit(user, id);
    return this.employeesService.update(user.id, id, input);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SetEmployeeStatusDto,
  ) {
    return this.employeesService.setStatus(user.id, id, input);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employeesService.archive(user.id, id);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN)
  resetPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AdminResetPasswordDto,
  ): Promise<void> {
    return this.employeesService.resetPassword(user.id, id, input);
  }

  @Patch(':id/access-role')
  @Roles(UserRole.ADMIN)
  setAccessRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SetAccessRoleDto,
  ) {
    return this.employeesService.setAccessRole(user, id, input);
  }
}
