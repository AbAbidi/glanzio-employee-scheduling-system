export const WORKING_WEEKDAYS = [
  { value: 1, label: "M", name: "Monday" },
  { value: 2, label: "T", name: "Tuesday" },
  { value: 3, label: "W", name: "Wednesday" },
  { value: 4, label: "T", name: "Thursday" },
  { value: 5, label: "F", name: "Friday" },
] as const;

export const WEEKEND_SCHEDULING_MESSAGE =
  "Assignments cannot be scheduled on Saturday or Sunday. Choose Monday to Friday.";

export function isWeekendDate(date: Date): boolean {
  return date.getDay() === 0 || date.getDay() === 6;
}

export function isWeekendDateValue(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
  );
  return isWeekendDate(date);
}

export function nextWorkingDate(date: Date): Date {
  const result = new Date(date);
  while (isWeekendDate(result)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}
