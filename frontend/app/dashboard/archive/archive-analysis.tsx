"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL, authenticatedFetch, responseMessage } from "../../lib/auth-client";
import { useLiveDataVersion } from "../../lib/use-live-data-version";
import { useDashboardLanguage } from "../dashboard-language";

type Person = { id: string; firstName: string; lastName: string };
type ArchiveAnalysis = {
  employees: { month: string; employee: Person; completedAssignments: number; completedMinutes: number; creditedMinutes: number; carryOutMinutes: number; amount: number }[];
  weeklyStudents: { start: string; end: string; items: { employee: Person; workedMinutes: number; exceededByMinutes: number }[] };
};

export default function ArchivedAnalysis({ month, search }: { month: string; search: string }) {
  const { t } = useDashboardLanguage();
  const liveVersion = useLiveDataVersion();
  const [data, setData] = useState<ArchiveAnalysis | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const parameters = month ? `?${new URLSearchParams({ month })}` : "";
        const response = await authenticatedFetch(`${API_BASE_URL}/dashboard/archive-analysis${parameters}`, { signal: controller.signal });
        if (!response.ok) throw new Error(await responseMessage(response));
        const result = await response.json() as ArchiveAnalysis;
        if (!controller.signal.aborted) { setData(result); setError(""); }
      } catch (requestError) {
        if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "Archive could not be loaded.");
      }
    })();
    return () => controller.abort();
  }, [liveVersion, month]);
  const matches = (person: Person) => `${person.firstName} ${person.lastName}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const hours = (minutes: number) => `${(minutes / 60).toFixed(1)}h`;
  return <details className="archivedAnalysis">
    <summary>{t("Archived monthly and weekly analysis")}</summary>
    {error ? <p role="alert">{error}</p> : null}
    {data ? <>
      <h2>{t("Monthly analysis")} · {month}</h2>
      <div className="archiveTableScroll"><table><thead><tr>{["Employee", "Completed assignments", "Worked hours", "Credited hours", "Carry next", "Amount"].map((label) => <th key={label}>{t(label)}</th>)}</tr></thead><tbody>
        {data.employees.filter((row) => row.month === month && matches(row.employee)).map((row) => <tr key={row.employee.id}><td>{row.employee.firstName} {row.employee.lastName}<small className="archiveBadge"> · {t("Archived")}</small></td><td>{row.completedAssignments}</td><td>{hours(row.completedMinutes)}</td><td>{hours(row.creditedMinutes)}</td><td>{hours(row.carryOutMinutes)}</td><td>€{row.amount.toFixed(2)}</td></tr>)}
      </tbody></table></div>
      <h2>{t("Student hours this week")} · {data.weeklyStudents.start} — {data.weeklyStudents.end}</h2>
      <div className="archiveTableScroll"><table><thead><tr><th>{t("Employee")}</th><th>{t("Worked hours")}</th><th>{t("Excess above 10h")}</th></tr></thead><tbody>
        {data.weeklyStudents.items.filter((row) => matches(row.employee)).map((row) => <tr key={row.employee.id}><td>{row.employee.firstName} {row.employee.lastName}</td><td>{hours(row.workedMinutes)}</td><td>{hours(row.exceededByMinutes)}</td></tr>)}
      </tbody></table></div>
    </> : !error ? <p>{t("Loading archive…")}</p> : null}
  </details>;
}
