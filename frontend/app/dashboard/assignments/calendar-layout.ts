type TimedEvent = { id: string; startAt: string; endAt: string };

/** Connected half-open intervals: touching endpoints are not simultaneous. */
export function groupCalendarEvents<T extends TimedEvent>(events: readonly T[]): T[][] {
  const sorted = [...events].sort((a, b) =>
    Date.parse(a.startAt) - Date.parse(b.startAt) || a.id.localeCompare(b.id));
  const groups: T[][] = [];
  let end = -Infinity;
  for (const event of sorted) {
    const start = Date.parse(event.startAt);
    if (!groups.length || start >= end) {
      groups.push([event]);
      end = Date.parse(event.endAt);
    } else {
      groups[groups.length - 1].push(event);
      end = Math.max(end, Date.parse(event.endAt));
    }
  }
  return groups;
}
