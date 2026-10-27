import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../generated/prisma/client';
import { DashboardService } from './dashboard.service';
import { ResetOperationalDataDto } from './dto/reset-operational-data.dto';
import { ResetTestWorkspaceDto } from './dto/reset-test-workspace.dto';
import { ArchiveAnalysisQueryDto } from './dto/archive-analysis-query.dto';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE)
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.get(user);
  }

  @Get('reset-operational-data/preview')
  @Roles(UserRole.ADMIN)
  resetOperationalDataPreview() {
    return this.dashboardService.resetOperationalDataPreview();
  }

  @Get('archive-analysis')
  @Roles(UserRole.ADMIN)
  archivedAnalysis(@Query() query: ArchiveAnalysisQueryDto) {
    return this.dashboardService.archivedAnalysis(query.month);
  }

  @Post('reset-operational-data')
  @Roles(UserRole.ADMIN)
  resetOperationalData(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: ResetOperationalDataDto,
  ) {
    return this.dashboardService.resetOperationalData(user.id, input);
  }

  @Get('reset-test-workspace/preview')
  @Roles(UserRole.ADMIN)
  resetTestWorkspacePreview() {
    return this.dashboardService.resetTestWorkspacePreview();
  }

  @Post('reset-test-workspace')
  @Roles(UserRole.ADMIN)
  resetTestWorkspace(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: ResetTestWorkspaceDto,
  ) {
    return this.dashboardService.resetTestWorkspace(user.id, input);
  }
}
