"use client";

import { useDashboardLanguage } from "../dashboard-language";
import { scheduledPublicHolidays, type HolidaySchedule } from "./public-holidays";

export default function HolidayWarning(props: HolidaySchedule) {
  const { t, locale } = useDashboardLanguage();
  const dates = scheduledPublicHolidays(props);
  if (!dates.length) return null;
  return (
    <aside className="assignmentHolidayWarning" role="status" aria-live="polite">
      <strong>{t("Public holiday warning — Baden-Württemberg")}</strong>
      <p>{t("This schedule includes public holidays. Check staffing and any required permission before saving. This warning does not block saving.")}</p>
      <ul>{dates.map((holiday) => (
        <li key={holiday.date}><time dateTime={holiday.date}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${holiday.date}T12:00:00Z`))}</time> · {holiday.name}</li>
      ))}</ul>
      <a href="https://im.baden-wuerttemberg.de/de/service/feiertage" target="_blank" rel="noreferrer">{t("Official public holiday information")}</a>
    </aside>
  );
}
