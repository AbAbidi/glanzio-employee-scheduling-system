import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DashboardController } from '../dashboard/dashboard.controller';
import { DashboardService } from '../dashboard/dashboard.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { PaymentStatementPdfService } from './payment-statement-pdf.service';

@Module({
  imports: [AuthModule],
  controllers: [ReportsController, DashboardController],
  providers: [ReportsService, DashboardService, PaymentStatementPdfService],
  exports: [ReportsService],
})
export class ReportsModule {}
