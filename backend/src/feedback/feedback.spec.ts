import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { FeedbackStatus } from '../generated/prisma/client';
import { CreateFeedbackDto } from './feedback.dto';
import { FeedbackService } from './feedback.service';

const input = {
  submissionKey: 'ea214bda-0988-451d-9d4b-b35d494712bb',
  displayName: 'Example',
  message: 'A real submitted feedback message.',
  rating: 4,
  allowPublic: false,
};

describe('feedback privacy and validation', () => {
  it.each([
    { rating: 0 },
    { rating: 6 },
    { rating: 1.5 },
    { message: '   ' },
    { message: 'a'.repeat(2001) },
    { allowPublic: 'true' },
    { website: 'spam.example' },
  ])('rejects invalid submission %j', async (change) => {
    expect(
      (
        await validate(
          plainToInstance(CreateFeedbackDto, { ...input, ...change }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('accepts optional rating/name and normalizes whitespace', async () => {
    const dto = plainToInstance(CreateFeedbackDto, {
      ...input,
      rating: undefined,
      displayName: undefined,
      message: '  Useful feedback here.  ',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.message).toBe('Useful feedback here.');
  });
  it('stores private feedback, reuses a submission key without inserting a duplicate', async () => {
    const upsert = jest.fn().mockResolvedValue({
      id: 'private',
      ...input,
      status: FeedbackStatus.PRIVATE,
    });
    const service = new FeedbackService({ feedback: { upsert } } as never);
    expect(await service.submit(input)).toEqual({
      id: 'private',
      status: 'received',
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: 'PRIVATE' }) as {
          status: string;
        },
        update: {},
      }),
    );
    await expect(
      service.submit({
        ...input,
        message: 'Different payload for the same request key.',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('public listing selects only consented and approved rows without private metadata', () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new FeedbackService({ feedback: { findMany } } as never);
    void service.published();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PUBLISHED', allowPublic: true },
        select: {
          id: true,
          displayName: true,
          message: true,
          rating: true,
          createdAt: true,
        },
      }),
    );
  });
  it('never publishes private feedback even for an administrator', async () => {
    const update = jest.fn();
    const transaction = {
      feedback: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ allowPublic: false, status: 'PRIVATE' }),
        update,
      },
    };
    const service = new FeedbackService({
      $transaction: (callback: (tx: unknown) => unknown) =>
        callback(transaction),
    } as never);
    await expect(
      service.moderate('admin', 'private', {
        status: FeedbackStatus.PUBLISHED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
});
