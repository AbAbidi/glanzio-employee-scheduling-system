import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AssignmentStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Persist the calendar's elapsed-time rule per visit, never per template. */
@Injectable()
export class AssignmentCompletionService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AssignmentCompletionService.name);
  private pending: Promise<number> | null = null;
  private lastChecked = 0;
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const run = () => {
      void this.reconcile().catch((error: unknown) => {
        this.logger.error(
          'Could not synchronize elapsed assignments',
          error instanceof Error ? error.stack : undefined,
        );
      });
    };
    run();
    this.timer = setInterval(run, 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  reconcile(): Promise<number> {
    if (this.pending) return this.pending;
    // A dashboard may request several student months in the same request.
    if (Date.now() - this.lastChecked < 1000) return Promise.resolve(0);
    const cutoff = new Date();
    const pending = this.prisma
      .$transaction(async (tx) => {
        const completed = await tx.workAssignment.updateManyAndReturn({
          where: { status: AssignmentStatus.SCHEDULED, endAt: { lte: cutoff } },
          data: { status: AssignmentStatus.COMPLETED },
          select: { id: true, endAt: true, recurringTemplateId: true },
        });
        if (completed.length)
          await tx.auditLog.createMany({
            data: completed.map((visit) => ({
              action: 'ASSIGNMENT_AUTO_COMPLETED',
              entityType: 'WorkAssignment',
              entityId: visit.id,
              metadata: {
                reason: 'SCHEDULED_END_REACHED',
                scheduledEnd: visit.endAt.toISOString(),
                recurringTemplateId: visit.recurringTemplateId,
              },
            })),
          });
        return completed.length;
      })
      .then((count) => {
        this.lastChecked = Date.now();
        return count;
      });
    this.pending = pending;
    void pending
      .finally(() => {
        if (this.pending === pending) this.pending = null;
      })
      .catch(() => {});
    return pending;
  }
}
