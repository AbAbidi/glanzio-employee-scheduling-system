import { DateTime } from 'luxon';
import {
  allocateStudentMonth,
  nextWeekUsage,
  type CreditLot,
} from './student-accounting';

function lot(
  key: string,
  hours: number,
  originMonth = '2026-10',
  rate = 20,
): CreditLot {
  return {
    key,
    assignmentId: key,
    title: key,
    originMonth,
    sourceStart: `${originMonth}-05T07:00:00.000Z`,
    sourceEnd: DateTime.fromISO(`${originMonth}-05T07:00:00.000Z`)
      .plus({ hours })
      .toISO()!,
    minutes: hours * 60,
    hourlyRate: rate,
  };
}
const base = {
  month: '2026-10',
  zone: 'Europe/Berlin',
  employeeName: 'Fictional Test Student',
};

describe('deterministic student simulation allocation', () => {
  it('caps at 40h and carries the remaining 20h, without changing sources', () => {
    const sources = [lot('a', 60)];
    const result = allocateStudentMonth({ ...base, sources });
    expect(result.workedMinutes).toBe(3600);
    expect(result.creditedMinutes).toBe(2400);
    expect(result.carryOutMinutes).toBe(1200);
    expect(sources[0].minutes).toBe(3600);
  });
  it('uses old credit in November and retains original rates', () => {
    const october = allocateStudentMonth({
      ...base,
      sources: [lot('old', 60, '2026-10', 15)],
    });
    const november = allocateStudentMonth({
      ...base,
      month: '2026-11',
      sources: [lot('new', 10, '2026-11', 25)],
      carryIn: october.carryOut,
      previousWeeks: nextWeekUsage(october),
    });
    expect(november.carryInMinutes).toBe(1200);
    expect(november.creditedMinutes).toBe(1800);
    expect(november.carryOutMinutes).toBe(0);
    expect(november.creditedAmount).toBe(550);
    expect(
      november.allocations.find((row) => row.kind === 'CREDIT')?.originMonth,
    ).toBe('2026-10');
  });
  it('does not invent hours when no credit is available', () => {
    const result = allocateStudentMonth({
      ...base,
      sources: [lot('a', 12.25)],
    });
    expect(result.creditedMinutes).toBe(735);
    expect(result.carryOutMinutes).toBe(0);
  });
  it('uses weekdays 08-18, max 5h/day for credit, and max 10h/week', () => {
    const result = allocateStudentMonth({
      ...base,
      sources: [],
      carryIn: [lot('a', 100, '2026-09')],
    });
    const days = new Map<string, number>();
    const weeks = new Map<string, number>();
    for (const row of result.allocations) {
      const date = DateTime.fromISO(row.startAt, { zone: base.zone });
      expect(date.weekday).toBeLessThanOrEqual(5);
      expect(date.hour).toBeGreaterThanOrEqual(8);
      expect(
        DateTime.fromISO(row.endAt, { zone: base.zone }).hour,
      ).toBeLessThanOrEqual(18);
      days.set(row.date, (days.get(row.date) ?? 0) + row.minutes);
      weeks.set(row.week, (weeks.get(row.week) ?? 0) + row.minutes);
    }
    expect(Math.max(...days.values())).toBeLessThanOrEqual(300);
    expect(Math.max(...weeks.values())).toBeLessThanOrEqual(600);
  });
  it('shares the weekly quota across a month boundary', () => {
    const october = allocateStudentMonth({ ...base, sources: [lot('a', 1)] });
    const remaining = Array.from({ length: 5 }, (_, index) =>
      lot(`b${index}`, 10, '2026-11'),
    );
    const november = allocateStudentMonth({
      ...base,
      month: '2026-11',
      sources: remaining,
      previousWeeks: { '2026-W45': 540 },
    });
    expect(
      november.allocations
        .filter((row) => row.week === '2026-W45')
        .reduce((sum, row) => sum + row.minutes, 0),
    ).toBe(60);
    expect(october.carryOutMinutes).toBe(0);
  });
  it('is deterministic even if source query ordering changes', () => {
    const sources = [
      lot('b', 4),
      {
        ...lot('a', 4),
        sourceStart: '2026-10-06T07:00:00.000Z',
        sourceEnd: '2026-10-06T11:00:00.000Z',
      },
    ];
    expect(allocateStudentMonth({ ...base, sources })).toEqual(
      allocateStudentMonth({ ...base, sources: [...sources].reverse() }),
    );
  });
  it('conserves every minute over a year of carry propagation', () => {
    let carry: CreditLot[] = [];
    let weeks = {};
    let input = 0;
    let allocated = 0;
    for (let index = 0; index < 12; index += 1) {
      const month = DateTime.fromISO('2026-10-01')
        .plus({ months: index })
        .toFormat('yyyy-MM');
      const sources = [lot(`source-${index}`, index % 2 ? 7.5 : 63, month)];
      const result = allocateStudentMonth({
        ...base,
        month,
        sources,
        carryIn: carry,
        previousWeeks: weeks,
      });
      input += result.workedMinutes;
      allocated += result.creditedMinutes;
      expect(input).toBe(allocated + result.carryOutMinutes);
      expect(result.creditedMinutes).toBeLessThanOrEqual(2400);
      carry = result.carryOut;
      weeks = nextWeekUsage(result);
    }
  });
  it('rejects duplicate credit sources rather than counting them twice', () => {
    expect(() =>
      allocateStudentMonth({
        ...base,
        sources: [lot('a', 1)],
        carryIn: [lot('a', 1)],
      }),
    ).toThrow('Duplicate');
  });

  it('keeps 4h + 4h + 2h on their actual dates and defers the extra 2h to a later week', () => {
    const sources = [5, 6, 8].map((day) => ({
      ...lot(`work-${day}`, 4),
      sourceStart: `2026-10-${String(day).padStart(2, '0')}T07:00:00.000Z`,
      sourceEnd: `2026-10-${String(day).padStart(2, '0')}T11:00:00.000Z`,
    }));
    const result = allocateStudentMonth({ ...base, sources });
    const work = result.allocations.filter((row) => row.kind === 'WORK');
    expect(work.map((row) => [row.date, row.minutes])).toEqual([
      ['2026-10-05', 240],
      ['2026-10-06', 240],
      ['2026-10-08', 120],
    ]);
    expect(work[0].startAt).toBe('2026-10-05T07:00:00.000Z');
    const credit = result.allocations.filter((row) => row.kind === 'CREDIT');
    expect(credit.reduce((sum, row) => sum + row.minutes, 0)).toBe(120);
    expect(credit.every((row) => row.date >= '2026-10-12')).toBe(true);
    expect(result.creditedMinutes).toBe(720);
  });

  it('blocks scheduled work too and never moves weekly overflow to an earlier week', () => {
    const sources = [26, 27, 29].map((day) => ({
      ...lot(`work-${day}`, 4),
      sourceStart: `2026-10-${day}T08:00:00.000Z`,
      sourceEnd: `2026-10-${day}T12:00:00.000Z`,
    }));
    const october = allocateStudentMonth({ ...base, sources });
    expect(october.creditedMinutes).toBe(600);
    expect(october.carryOutMinutes).toBe(120);
    const november = allocateStudentMonth({
      ...base,
      month: '2026-11',
      sources: [],
      carryIn: october.carryOut,
      previousWeeks: nextWeekUsage(october),
      busyIntervals: [
        {
          startAt: '2026-11-02T07:00:00.000Z',
          endAt: '2026-11-02T17:00:00.000Z',
        },
      ],
    });
    expect(november.creditedMinutes).toBe(120);
    expect(november.allocations[0].date).toBe('2026-11-03');
    expect(november.allocations[0].originMonth).toBe('2026-10');
  });

  it('leaves 30 minutes on both sides of a scheduled 10-12 assignment', () => {
    const result = allocateStudentMonth({
      ...base,
      month: '2026-11',
      sources: [],
      carryIn: [lot('old-credit', 2, '2026-10')],
      busyIntervals: [
        { startAt: '2026-11-02T09:00:00Z', endAt: '2026-11-02T11:00:00Z' },
      ],
    });
    expect(
      result.allocations.map((row) => [
        row.date,
        DateTime.fromISO(row.startAt, { zone: base.zone }).toFormat('HH:mm'),
        DateTime.fromISO(row.endAt, { zone: base.zone }).toFormat('HH:mm'),
      ]),
    ).toEqual([
      ['2026-11-02', '08:00', '09:30'],
      ['2026-11-02', '12:30', '13:00'],
    ]);
    expect(result.creditedMinutes).toBe(120);
    expect(result.carryOutMinutes).toBe(0);
  });

  it('fits credit between two assignments only after subtracting both buffers', () => {
    const result = allocateStudentMonth({
      ...base,
      month: '2026-11',
      sources: [],
      carryIn: [lot('old-credit', 2, '2026-10')],
      busyIntervals: [
        { startAt: '2026-11-02T07:00:00Z', endAt: '2026-11-02T09:00:00Z' },
        { startAt: '2026-11-02T13:00:00Z', endAt: '2026-11-02T15:00:00Z' },
      ],
    });
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].startAt).toBe('2026-11-02T09:30:00.000Z');
    expect(result.allocations[0].endAt).toBe('2026-11-02T11:30:00.000Z');
  });

  it('does not add transport buffers to actual completed work or change its times', () => {
    const first = {
      ...lot('work-a', 2, '2026-11'),
      sourceStart: '2026-11-02T07:00:00Z',
      sourceEnd: '2026-11-02T09:00:00Z',
    };
    const second = {
      ...lot('work-b', 2, '2026-11'),
      sourceStart: '2026-11-02T09:00:00Z',
      sourceEnd: '2026-11-02T11:00:00Z',
    };
    const result = allocateStudentMonth({
      ...base,
      month: '2026-11',
      sources: [first, second],
      carryIn: [lot('old-credit', 1, '2026-10')],
    });
    expect(
      result.allocations
        .filter((row) => row.kind === 'WORK')
        .map((row) => [row.startAt, row.endAt]),
    ).toEqual([
      ['2026-11-02T07:00:00.000Z', '2026-11-02T09:00:00.000Z'],
      ['2026-11-02T09:00:00.000Z', '2026-11-02T11:00:00.000Z'],
    ]);
    expect(
      result.allocations.find((row) => row.kind === 'CREDIT')?.startAt,
    ).toBe('2026-11-02T11:30:00.000Z');
  });

  it('moves credit to a later day when buffers consume all weekday capacity', () => {
    const result = allocateStudentMonth({
      ...base,
      month: '2026-11',
      sources: [],
      carryIn: [lot('old-credit', 2, '2026-10')],
      busyIntervals: [
        { startAt: '2026-11-02T07:30:00Z', endAt: '2026-11-02T16:30:00Z' },
      ],
    });
    expect(result.allocations[0].date).toBe('2026-11-03');
    expect(result.creditedMinutes).toBe(120);
  });
});
