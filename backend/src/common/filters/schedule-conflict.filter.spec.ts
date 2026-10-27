import { isScheduleConstraintError } from './schedule-conflict.filter';
describe('Schedule constraint error classification', () => {
  it('handles pg and nested Prisma adapter errors without matching unrelated failures', () => {
    expect(isScheduleConstraintError({ code: '23P01' })).toBe(true);
    expect(
      isScheduleConstraintError({
        meta: { driverAdapterError: { cause: { originalCode: '23P01' } } },
      }),
    ).toBe(true);
    expect(
      isScheduleConstraintError(new Error('schedule_employee_no_overlap')),
    ).toBe(true);
    expect(isScheduleConstraintError({ code: 'P2002' })).toBe(false);
    expect(isScheduleConstraintError(null)).toBe(false);
  });
});
