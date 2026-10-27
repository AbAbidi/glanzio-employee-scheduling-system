// State public-holiday list, verified against the Baden-Württemberg Interior Ministry:
// https://im.baden-wuerttemberg.de/de/service/feiertage
// School holidays and religious observances that are not public holidays are excluded.
const holidayCache = new Map<number, ReadonlyMap<string, string>>();

function key(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && key(date) === value ? date : null;
}

function holidays(year: number): ReadonlyMap<string, string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  // Gregorian Easter (Meeus/Jones/Butcher), calculated in UTC to avoid DST shifts.
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  const easter = new Date(Date.UTC(year, Math.floor(n / 31) - 1, (n % 31) + 1, 12));
  const result = new Map<string, string>([
    [`${year}-01-01`, "Neujahr"],
    [`${year}-01-06`, "Heilige Drei Könige"],
    [`${year}-05-01`, "Tag der Arbeit"],
    [`${year}-10-03`, "Tag der Deutschen Einheit"],
    [`${year}-11-01`, "Allerheiligen"],
    [`${year}-12-25`, "1. Weihnachtsfeiertag"],
    [`${year}-12-26`, "2. Weihnachtsfeiertag"],
  ]);
  for (const [offset, name] of [
    [-2, "Karfreitag"], [1, "Ostermontag"], [39, "Christi Himmelfahrt"],
    [50, "Pfingstmontag"], [60, "Fronleichnam"],
  ] as const) {
    const date = new Date(easter);
    date.setUTCDate(date.getUTCDate() + offset);
    result.set(key(date), name);
  }
  holidayCache.set(year, result);
  return result;
}

export function badenWuerttembergHoliday(date: string): string | undefined {
  const parsed = parseDate(date);
  return parsed ? holidays(parsed.getUTCFullYear()).get(date) : undefined;
}

export type HolidaySchedule = {
  date: string;
  frequency?: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  interval?: number;
  until?: string;
  weekdays?: number[];
};

/** Preview follows the server's weekday skipping, ISO-week anchor and 366-visit cap. */
export function scheduledPublicHolidays({
  date, frequency = "NONE", interval = 1, until, weekdays = [],
}: HolidaySchedule): { date: string; name: string }[] {
  const first = parseDate(date);
  if (!first) return [];
  const end = until ? parseDate(until) : null;
  const step = Number.isInteger(interval) && interval > 0 ? interval : 1;
  const result: { date: string; name: string }[] = [];
  const visit = (candidate: Date) => {
    const name = badenWuerttembergHoliday(key(candidate));
    if (name) result.push({ date: key(candidate), name });
  };
  if (frequency === "NONE" || !end) {
    visit(first);
    return result;
  }
  if (end < first) return result;
  const anchorWeekday = (first.getUTCDay() + 6) % 7;
  let count = 0;
  for (let offset = 0; offset < 3660 && count < 366; offset++) {
    const candidate = new Date(first);
    if (frequency === "MONTHLY") {
      candidate.setUTCDate(1);
      candidate.setUTCMonth(first.getUTCMonth() + offset * step);
      const last = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, 0)).getUTCDate();
      candidate.setUTCDate(Math.min(first.getUTCDate(), last));
    } else {
      candidate.setUTCDate(first.getUTCDate() + offset * (frequency === "DAILY" ? step : 1));
    }
    if (candidate > end) break;
    const weekday = candidate.getUTCDay() || 7;
    if (weekday > 5) continue;
    if (frequency === "WEEKLY" && (
      Math.floor((offset + anchorWeekday) / 7) % step !== 0 || !weekdays.includes(weekday)
    )) continue;
    count++;
    visit(candidate);
  }
  return result;
}
