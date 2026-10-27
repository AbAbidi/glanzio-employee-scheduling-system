import { DateTime } from 'luxon';

export const STUDENT_POLICY = {
  version: 'simulation-2026-10-v5',
  effectiveMonth: '2026-10',
  weeklyMinutes: 600,
  monthlyMinutes: 2400,
  maxCreditDayMinutes: 300,
  startHour: 8,
  endHour: 18,
  creditBufferMinutes: 30,
} as const;

export type CreditLot = {
  key: string;
  assignmentId: string;
  title: string;
  originMonth: string;
  sourceStart: string;
  sourceEnd: string;
  minutes: number;
  hourlyRate: number;
  availableFrom?: string;
};

export type StudentAllocation = {
  kind: 'WORK' | 'CREDIT';
  date: string;
  week: string;
  startAt: string;
  endAt: string;
  sourceKey: string;
  originMonth: string;
  minutes: number;
  hourlyRate: number;
};

export type StudentAccounting = {
  month: string;
  zone: string;
  policy: typeof STUDENT_POLICY;
  employeeName: string;
  workedMinutes: number;
  carryInMinutes: number;
  creditedMinutes: number;
  carryOutMinutes: number;
  workedAmount: number;
  creditedAmount: number;
  sources: CreditLot[];
  carryIn: CreditLot[];
  carryOut: CreditLot[];
  allocations: StudentAllocation[];
  previousWeeks: Record<string, number>;
  busyIntervals: { startAt: string; endAt: string }[];
  deferredSources: CreditLot[];
};

export function isoWeekKey(value: DateTime): string {
  return `${value.weekYear}-W${String(value.weekNumber).padStart(2, '0')}`;
}

export function sumMinutes(lots: CreditLot[]): number {
  return lots.reduce((total, lot) => total + lot.minutes, 0);
}

/** Preserve original work allocations; deferred credit uses later free weeks only. */
export function allocateStudentMonth(input: {
  month: string;
  zone: string;
  employeeName: string;
  sources: CreditLot[];
  carryIn?: CreditLot[];
  previousWeeks?: Record<string, number>;
  busyIntervals?: { startAt: string; endAt: string }[];
}): StudentAccounting {
  const order = (a: CreditLot, b: CreditLot) =>
    a.originMonth.localeCompare(b.originMonth) ||
    a.sourceStart.localeCompare(b.sourceStart) ||
    a.key.localeCompare(b.key);
  const sources = input.sources.map((lot) => ({ ...lot })).sort(order);
  const carryIn = (input.carryIn ?? []).map((lot) => ({ ...lot })).sort(order);
  const inputLots = [...carryIn, ...sources];
  if (new Set(inputLots.map((lot) => lot.key)).size !== inputLots.length) {
    throw new Error('Duplicate student credit source.');
  }
  if (
    inputLots.some((lot) => !Number.isInteger(lot.minutes) || lot.minutes < 0)
  ) {
    throw new Error('Credit must use non-negative integer minutes.');
  }
  const previousWeeks = { ...input.previousWeeks };
  const weekUsage = { ...previousWeeks };
  const allocations: StudentAllocation[] = [];
  const start = DateTime.fromISO(`${input.month}-01`, { zone: input.zone });
  const end = start.plus({ months: 1 });
  if (!start.isValid) throw new Error('Invalid student accounting period.');
  let creditedMinutes = 0;
  const dailyUsage: Record<string, number> = {};
  const busyIntervals = [
    ...(input.busyIntervals ?? []),
    ...sources.map((lot) => ({
      startAt: lot.sourceStart,
      endAt: lot.sourceEnd,
    })),
  ].sort(
    (a, b) =>
      a.startAt.localeCompare(b.startAt) || a.endAt.localeCompare(b.endAt),
  );
  const pending: CreditLot[] = carryIn.map((lot) => ({
    ...lot,
    availableFrom:
      lot.availableFrom ??
      DateTime.fromISO(lot.sourceEnd, { zone: input.zone })
        .minus({ milliseconds: 1 })
        .startOf('week')
        .plus({ weeks: 1 })
        .toUTC()
        .toISO()!,
  }));
  const append = (
    lot: CreditLot,
    from: DateTime,
    minutes: number,
    kind: 'WORK' | 'CREDIT',
  ) => {
    const week = isoWeekKey(from);
    const date = from.toISODate()!;
    allocations.push({
      kind,
      date,
      week,
      startAt: from.toUTC().toISO()!,
      endAt: from.plus({ minutes }).toUTC().toISO()!,
      sourceKey: lot.key,
      originMonth: lot.originMonth,
      minutes,
      hourlyRate: lot.hourlyRate,
    });
    weekUsage[week] = (weekUsage[week] ?? 0) + minutes;
    dailyUsage[date] = (dailyUsage[date] ?? 0) + minutes;
    creditedMinutes += minutes;
  };
  // First reserve the actual dates/times for every completed assignment.
  for (const lot of sources) {
    let cursor: DateTime = DateTime.max(
      start,
      DateTime.fromISO(lot.sourceStart, { zone: input.zone }),
    );
    const stop = DateTime.min(
      end,
      DateTime.fromISO(lot.sourceEnd, { zone: input.zone }),
    );
    if (
      !cursor.isValid ||
      !stop.isValid ||
      stop <= cursor ||
      Math.round(stop.diff(cursor, 'minutes').minutes) !== lot.minutes
    ) {
      throw new Error('Source duration must match its original interval.');
    }
    while (cursor < stop) {
      const segmentEnd: DateTime = DateTime.min(
        stop,
        cursor.startOf('day').plus({ days: 1 }),
      );
      const duration = Math.round(segmentEnd.diff(cursor, 'minutes').minutes);
      const week = isoWeekKey(cursor);
      const capacity =
        cursor.weekday <= 5
          ? Math.max(
              0,
              Math.min(
                duration,
                STUDENT_POLICY.weeklyMinutes - (weekUsage[week] ?? 0),
                STUDENT_POLICY.monthlyMinutes - creditedMinutes,
              ),
            )
          : 0;
      if (capacity > 0) append(lot, cursor, capacity, 'WORK');
      if (duration > capacity) {
        pending.push({
          ...lot,
          key: `${lot.key}:deferred:${cursor.toISODate()}`,
          minutes: duration - capacity,
          // Never move an overrun earlier or into another day of the same week.
          availableFrom: cursor
            .startOf('week')
            .plus({ weeks: 1 })
            .toUTC()
            .toISO()!,
        });
      }
      cursor = segmentEnd;
    }
  }
  const deferredSources = pending
    .filter((lot) => !carryIn.some((old) => old.key === lot.key))
    .map((lot) => ({ ...lot }));
  pending.sort(order);
  // Credit only: reserve 30 minutes before/after real calendar assignments.
  // Original WORK allocations and calendar scheduling validation stay unchanged.
  for (
    let day = start;
    day < end && creditedMinutes < STUDENT_POLICY.monthlyMinutes;
    day = day.plus({ days: 1 })
  ) {
    if (day.weekday > 5) continue;
    const week = isoWeekKey(day);
    const date = day.toISODate();
    const stop = day.set({ hour: STUDENT_POLICY.endHour });
    let cursor: DateTime = day.set({ hour: STUDENT_POLICY.startHour });
    const blocked = busyIntervals
      .map((interval) => ({
        start: DateTime.fromISO(interval.startAt, { zone: input.zone }).minus({
          minutes: STUDENT_POLICY.creditBufferMinutes,
        }),
        end: DateTime.fromISO(interval.endAt, { zone: input.zone }).plus({
          minutes: STUDENT_POLICY.creditBufferMinutes,
        }),
      }))
      .filter((interval) => interval.start < stop && interval.end > cursor)
      .sort((a, b) => a.start.toMillis() - b.start.toMillis());
    const gaps: { start: DateTime; end: DateTime }[] = [];
    for (const block of blocked) {
      if (block.start > cursor)
        gaps.push({ start: cursor, end: DateTime.min(block.start, stop) });
      cursor = DateTime.max(cursor, block.end);
      if (cursor >= stop) break;
    }
    if (cursor < stop) gaps.push({ start: cursor, end: stop });
    for (const gap of gaps) {
      let position = gap.start;
      for (const lot of pending) {
        if (lot.minutes <= 0) continue;
        const available = DateTime.fromISO(lot.availableFrom!, {
          zone: input.zone,
        });
        const from = DateTime.max(position, available);
        if (from >= gap.end) continue;
        const capacity = Math.max(
          0,
          Math.min(
            Math.floor(gap.end.diff(from, 'minutes').minutes),
            lot.minutes,
            STUDENT_POLICY.weeklyMinutes - (weekUsage[week] ?? 0),
            STUDENT_POLICY.monthlyMinutes - creditedMinutes,
            STUDENT_POLICY.maxCreditDayMinutes - (dailyUsage[date] ?? 0),
          ),
        );
        if (!capacity) continue;
        append(lot, from, capacity, 'CREDIT');
        lot.minutes -= capacity;
        position = from.plus({ minutes: capacity });
      }
    }
  }
  allocations.sort(
    (a, b) =>
      a.startAt.localeCompare(b.startAt) ||
      a.sourceKey.localeCompare(b.sourceKey),
  );
  const carryOut = pending.filter((lot) => lot.minutes > 0);
  const result: StudentAccounting = {
    month: input.month,
    zone: input.zone,
    policy: STUDENT_POLICY,
    employeeName: input.employeeName,
    workedMinutes: sumMinutes(sources),
    carryInMinutes: sumMinutes(carryIn),
    creditedMinutes,
    carryOutMinutes: sumMinutes(carryOut),
    workedAmount: Number(
      sources
        .reduce((sum, lot) => sum + (lot.minutes / 60) * lot.hourlyRate, 0)
        .toFixed(2),
    ),
    creditedAmount: Number(
      allocations
        .reduce((sum, row) => sum + (row.minutes / 60) * row.hourlyRate, 0)
        .toFixed(2),
    ),
    sources,
    carryIn,
    carryOut,
    allocations,
    previousWeeks,
    busyIntervals,
    deferredSources,
  };
  if (
    result.workedMinutes + result.carryInMinutes !==
    result.creditedMinutes + result.carryOutMinutes
  ) {
    throw new Error('Student credit conservation failed.');
  }
  return result;
}

export function nextWeekUsage(
  previous: StudentAccounting,
): Record<string, number> {
  const next = DateTime.fromISO(`${previous.month}-01`, {
    zone: previous.zone,
  }).plus({ months: 1 });
  const key = isoWeekKey(next);
  return {
    [key]:
      (previous.previousWeeks[key] ?? 0) +
      previous.allocations
        .filter((row) => row.week === key)
        .reduce((sum, row) => sum + row.minutes, 0),
  };
}
