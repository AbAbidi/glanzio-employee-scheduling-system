import type { PaymentStatementLine } from './payment-statement';
import { buildWorkTimeSheetDays, formatMinutes } from './work-time-sheet';

function line(
  id: string,
  startAt: string,
  endAt: string,
  clientName = 'Client A',
  siteName = 'Site A',
): PaymentStatementLine {
  const durationMinutes = Math.round(
    (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000,
  );
  return {
    id,
    title: `Assignment ${id}`,
    clientName,
    siteName,
    startAt: new Date(startAt),
    endAt: new Date(endAt),
    durationMinutes,
    hourlyRate: 20,
    payableMinutes: durationMinutes,
    deferredMinutes: 0,
    amount: (durationMinutes / 60) * 20,
  };
}

describe('buildWorkTimeSheetDays', () => {
  it('places completed work on its calendar day', () => {
    const result = buildWorkTimeSheetDays(
      [line('1', '2026-09-15T08:00:00.000Z', '2026-09-15T10:30:00.000Z')],
      '2026-09',
      'UTC',
    );

    expect(result).toEqual([
      {
        day: 15,
        startTime: '08:00',
        endTime: '10:30',
        workedMinutes: 150,
        remarks: ['Client A - Site A'],
      },
    ]);
  });

  it('combines same-day work without recording a pause value', () => {
    const result = buildWorkTimeSheetDays(
      [
        line('1', '2026-09-15T08:00:00.000Z', '2026-09-15T10:00:00.000Z'),
        line(
          '2',
          '2026-09-15T11:30:00.000Z',
          '2026-09-15T13:00:00.000Z',
          'Client B',
          'Site B',
        ),
      ],
      '2026-09',
      'UTC',
    );

    expect(result[0]).toMatchObject({
      day: 15,
      startTime: '08:00',
      endTime: '13:00',
      workedMinutes: 210,
      remarks: ['Client A - Site A', 'Client B - Site B'],
    });
  });

  it('does not double-count overlapping assignments', () => {
    const result = buildWorkTimeSheetDays(
      [
        line('1', '2026-09-15T08:00:00.000Z', '2026-09-15T10:00:00.000Z'),
        line('2', '2026-09-15T09:00:00.000Z', '2026-09-15T11:00:00.000Z'),
      ],
      '2026-09',
      'UTC',
    );

    expect(result[0]).toMatchObject({
      workedMinutes: 180,
    });
  });

  it('does not repeat the client when the site already includes it', () => {
    const result = buildWorkTimeSheetDays(
      [
        line(
          '1',
          '2026-09-18T08:00:00.000Z',
          '2026-09-18T10:00:00.000Z',
          'Bürgerhospital Frankfurt',
          'Bürgerhospital Frankfurt - Nibelungenallee',
        ),
      ],
      '2026-09',
      'UTC',
    );

    expect(result[0].remarks).toEqual([
      'Bürgerhospital Frankfurt - Nibelungenallee',
    ]);
  });

  it('splits work that crosses midnight into separate calendar days', () => {
    const result = buildWorkTimeSheetDays(
      [line('1', '2026-09-15T23:00:00.000Z', '2026-09-16T01:00:00.000Z')],
      '2026-09',
      'UTC',
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ day: 15, workedMinutes: 60 });
    expect(result[1]).toMatchObject({ day: 16, workedMinutes: 60 });
  });
});

describe('formatMinutes', () => {
  it('formats totals as HH:mm', () => {
    expect(formatMinutes(0)).toBe('00:00');
    expect(formatMinutes(135)).toBe('02:15');
  });
});
