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
import { UserRole } from '../generated/prisma/client';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { SetEmployeeStatusDto } from './dto/set-employee-status.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateEmployeeDto,
  ) {
    return this.employeesService.create(user.id, input);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  list(@Query() query: EmployeeQueryDto) {
    return this.employeesService.list(query);
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
  @Roles(UserRole.EMPLOYEE)
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.getMyProfile(user.id);
  }

  @Patch('me')
  @Roles(UserRole.EMPLOYEE)
  updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateMyProfileDto,
  ) {
    return this.employeesService.updateMyProfile(user.id, input);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.findOne(id);
  }

  @Get(':id/analytics')
  @Roles(UserRole.ADMIN)
  analytics(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.analytics(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateEmployeeDto,
  ) {
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
}
