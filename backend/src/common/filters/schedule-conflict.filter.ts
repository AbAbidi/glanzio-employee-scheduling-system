import {
  ArgumentsHost,
  Catch,
  ConflictException,
  type ExceptionFilter,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';

export function isScheduleConstraintError(value: unknown, depth = 0): boolean {
  if (depth > 8 || value == null) return false;
  if (typeof value === 'string')
    return value === '23P01' || value.includes('schedule_employee_no_overlap');
  if (typeof value !== 'object') return false;
  // Prisma's pg adapter nests the original PostgreSQL code differently from
  // Prisma's binary engine. Never return the original error/details to clients.
  const record = value as Record<string, unknown>;
  return [
    'message',
    'code',
    'originalCode',
    'constraint',
    'cause',
    'driverAdapterError',
    'meta',
  ].some((key) => isScheduleConstraintError(record[key], depth + 1));
}

@Catch()
export class ScheduleConflictFilter implements ExceptionFilter {
  constructor(private readonly adapter: HttpAdapterHost) {}
  catch(exception: unknown, host: ArgumentsHost) {
    new BaseExceptionFilter(this.adapter.httpAdapter).catch(
      isScheduleConstraintError(exception)
        ? new ConflictException(
            'An assigned employee already has overlapping work. Refresh the calendar and choose another employee or time.',
          )
        : exception,
      host,
    );
  }
}
