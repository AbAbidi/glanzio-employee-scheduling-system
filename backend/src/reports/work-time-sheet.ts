import { DateTime } from 'luxon';
import type { PaymentStatementLine } from './payment-statement';

export type WorkTimeSheetDay = {
  day: number;
  startTime: string;
  endTime: string;
  workedMinutes: number;
  remarks: string[];
};

type WorkInterval = {
  start: DateTime;
  end: DateTime;
  remark: string;
};

export function buildWorkTimeSheetDays(
  lines: PaymentStatementLine[],
  period: string,
  zone: string,
): WorkTimeSheetDay[] {
  const monthStart = DateTime.fromISO(`${period}-01`, { zone }).startOf('day');
  const monthEnd = monthStart.plus({ months: 1 });
  const intervalsByDay = new Map<number, WorkInterval[]>();

  for (const line of lines) {
    let cursor = DateTime.fromJSDate(line.startAt, { zone });
    const rawEnd = DateTime.fromJSDate(line.endAt, { zone });
    cursor = DateTime.max(cursor, monthStart);
    const end = DateTime.min(rawEnd, monthEnd);

    while (cursor < end) {
      const segmentEnd = DateTime.min(
        end,
        cursor.startOf('day').plus({ days: 1 }),
      );
      const day = cursor.day;
      const intervals = intervalsByDay.get(day) ?? [];
      intervals.push({
        start: cursor,
        end: segmentEnd,
        remark: assignmentRemark(line.clientName, line.siteName),
      });
      intervalsByDay.set(day, intervals);
      cursor = segmentEnd;
    }
  }

  return [...intervalsByDay.entries()]
    .sort(([firstDay], [secondDay]) => firstDay - secondDay)
    .map(([day, intervals]) => aggregateDay(day, intervals));
}

function aggregateDay(
  day: number,
  intervals: WorkInterval[],
): WorkTimeSheetDay {
  const ordered = [...intervals].sort(
    (first, second) => first.start.toMillis() - second.start.toMillis(),
  );
  const merged: Array<{ start: DateTime; end: DateTime }> = [];

  for (const interval of ordered) {
    const previous = merged.at(-1);
    if (!previous || interval.start > previous.end) {
      merged.push({ start: interval.start, end: interval.end });
      continue;
    }
    if (interval.end > previous.end) previous.end = interval.end;
  }

  const workedMinutes = Math.round(
    merged.reduce(
      (total, interval) =>
        total + interval.end.diff(interval.start, 'minutes').minutes,
      0,
    ),
  );
  const firstStart = merged[0].start;
  const lastEnd = merged.at(-1)!.end;

  return {
    day,
    startTime: firstStart.toFormat('HH:mm'),
    endTime: lastEnd.toFormat('HH:mm'),
    workedMinutes,
    remarks: [...new Set(ordered.map((interval) => interval.remark))],
  };
}

function assignmentRemark(clientName: string, siteName: string): string {
  const client = cleanRemarkPart(clientName);
  const site = cleanRemarkPart(siteName);
  const repeatedClientPrefix = `${client.toLocaleLowerCase()} - `;

  if (site.toLocaleLowerCase().startsWith(repeatedClientPrefix)) return site;
  if (site.toLocaleLowerCase() === client.toLocaleLowerCase()) return client;
  return `${client} - ${site}`;
}

function cleanRemarkPart(value: string): string {
  return value
    .replace(/\u00ad/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${remainder
    .toString()
    .padStart(2, '0')}`;
}
