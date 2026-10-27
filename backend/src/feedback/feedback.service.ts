import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeedbackStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateFeedbackDto,
  FeedbackQueryDto,
  ModerateFeedbackDto,
} from './feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(input: CreateFeedbackDto) {
    const data = {
      submissionKey: input.submissionKey,
      displayName: input.displayName?.trim() || 'Anonym',
      message: input.message.trim(),
      rating: input.rating ?? null,
      allowPublic: input.allowPublic,
      status: input.allowPublic
        ? FeedbackStatus.PENDING
        : FeedbackStatus.PRIVATE,
    };
    const stored = await this.prisma.feedback.upsert({
      where: { submissionKey: input.submissionKey },
      create: data,
      update: {},
    });
    if (
      stored.displayName !== data.displayName ||
      stored.message !== data.message ||
      stored.rating !== data.rating ||
      stored.allowPublic !== data.allowPublic
    ) {
      throw new ConflictException(
        'This submission key was already used for different feedback.',
      );
    }
    return { id: stored.id, status: 'received' as const };
  }

  published() {
    return this.prisma.feedback.findMany({
      where: { status: FeedbackStatus.PUBLISHED, allowPublic: true },
      select: {
        id: true,
        displayName: true,
        message: true,
        rating: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 12,
    });
  }

  async list(query: FeedbackQueryDto) {
    const where = { status: query.status };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.feedback.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.feedback.count({ where }),
    ]);
    return {
      items,
      total,
      page: query.page,
      pageCount: Math.ceil(total / query.pageSize),
    };
  }

  async moderate(actorUserId: string, id: string, input: ModerateFeedbackDto) {
    return this.prisma.$transaction(
      async (transaction) => {
        const row = await transaction.feedback.findUnique({ where: { id } });
        if (!row) throw new NotFoundException('Feedback not found.');
        if (input.status === FeedbackStatus.PUBLISHED && !row.allowPublic)
          throw new BadRequestException(
            'The author did not allow publication.',
          );
        if (input.status === row.status) return row;
        const updated = await transaction.feedback.update({
          where: { id },
          data: {
            status: input.status,
            publishedAt:
              input.status === FeedbackStatus.PUBLISHED ? new Date() : null,
          },
        });
        await transaction.auditLog.create({
          data: {
            actorUserId,
            action: 'FEEDBACK_MODERATED',
            entityType: 'Feedback',
            entityId: id,
            metadata: { previousStatus: row.status, status: input.status },
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
