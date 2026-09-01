import {
  Controller,
  Get,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../generated/prisma/client';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('monthly')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  monthly(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MonthlyReportQueryDto,
  ) {
    return this.reportsService.monthly(user, query);
  }

  @Get('monthly-payment-statement')
  @Roles(UserRole.ADMIN)
  async monthlyPaymentStatement(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MonthlyReportQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.reportsService.monthlyPaymentStatement(
      user,
      query,
    );
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(result.buffer);
  }
}
