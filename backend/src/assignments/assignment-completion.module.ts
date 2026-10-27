import { Global, Module } from '@nestjs/common';
import { AssignmentCompletionService } from './assignment-completion.service';

@Global()
@Module({
  providers: [AssignmentCompletionService],
  exports: [AssignmentCompletionService],
})
export class AssignmentCompletionModule {}
