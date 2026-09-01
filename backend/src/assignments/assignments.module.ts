import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { CalendarController } from './calendar.controller';
import { RecurringAssignmentsController } from './recurring-assignments.controller';
import { RouteEstimationService } from './route-estimation.service';

@Module({
  imports: [AuthModule],
  controllers: [
    AssignmentsController,
    RecurringAssignmentsController,
    CalendarController,
  ],
  providers: [AssignmentsService, RouteEstimationService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
