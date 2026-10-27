"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL, authenticatedFetch, responseMessage } from "../../lib/auth-client";
import { useDashboardLanguage } from "../dashboard-language";
import type { Employee } from "./types";
import { useLiveDataVersion } from "../../lib/use-live-data-version";

type Snapshot = {
  id: string; status: string; sourceHash: string;
  data: {
    employeeName: string; month: string;
    workedMinutes: number; carryInMinutes: number; creditedMinutes: number; carryOutMinutes: number;
    carryOut: { key: string; title: string; originMonth: string; minutes: number }[];
    zone: string;
    sources: { key: string; title: string; sourceStart: string; sourceEnd: string; minutes: number }[];
    allocations: { kind?: "WORK" | "CREDIT"; date: string; startAt?: string; endAt?: string; originMonth: string; minutes: number; sourceKey: string }[];
  };
};

export default function StudentCreditPanel({ employee, month, accessToken, onClose }: {
  employee: Employee; month: string; accessToken: string; onClose: () => void;
}) {
  const liveVersion = useLiveDataVersion();
  const { t } = useDashboardLanguage();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const hours = (minutes: number) => `${(minutes / 60).toFixed(2)}h`;
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ employeeId: employee.id, month });
    void authenticatedFetch(`${API_BASE_URL}/reports/student-statement?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error(await responseMessage(response));
      return response.json() as Promise<Snapshot>;
    }).then((result) => { if (!controller.signal.aborted) { setSnapshot((current) => current?.id === result.id && current.status === "CLOSED" ? current : result); setError(""); } }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Preview failed.");
    });
    return () => controller.abort();
  }, [employee.id, month, accessToken, liveVersion]);

  return <section id={`student-credit-${employee.id}`} className="studentCreditPanel" aria-label={`${t("Student credit simulation")} — ${employee.firstName} ${employee.lastName}`}>
    <header><div><p>{t("Student credit simulation")}</p><h2>{employee.firstName} {employee.lastName} · {month}</h2></div><button type="button" onClick={onClose} aria-label={t("Close")}>×</button></header>
    <p className="formNotice">{t("SIMULATION — COMPLETED work keeps its original dates up to the credit limits. Credit uses later free weeks, weekdays 08:00–18:00, with 30 minutes before and after calendar assignments. Maximum 10h/week and 40h/month; credit slots are not actual attendance.")}</p>
    {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}
    {!snapshot && !error ? <p role="status">{t("Calculating completed work...")}</p> : null}
    {snapshot ? <>
      <strong>{snapshot.status === "CLOSED" ? t("Closed — frozen") : t("Draft / projection — recalculable")}</strong>
      <div className="studentCreditMetrics">
        <span>{t("Worked hours")}<b>{hours(snapshot.data.workedMinutes)}</b></span>
        <span>{t("Credit brought forward")}<b>{hours(snapshot.data.carryInMinutes)}</b></span>
        <span>{t("Credited hours")}<b>{hours(snapshot.data.creditedMinutes)}</b></span>
        <span>{t("Carry next")}<b>{hours(snapshot.data.carryOutMinutes)}</b></span>
      </div>
      <p className="analysisColumnHint">{t("Updates automatically. Finished months close automatically and their final PDF stays unchanged.")}</p>
      <h3>{t("Allocation trace")}</h3>
      <div className="studentTableScroll"><div className="studentAllocationScroll" tabIndex={0} role="region" aria-label={`${t("Allocation trace")} — ${employee.firstName} ${employee.lastName}`}><table className="studentCreditTable"><thead><tr><th>{t("Allocation day")}</th><th>{t("Allocation type")}</th><th>{t("Time")}</th><th>{t("Source month")}</th><th>{t("Credited hours")}</th></tr></thead><tbody>{snapshot.data.allocations.map((row, index) => <tr key={`${row.sourceKey}-${index}`}><td>{row.date}</td><td>{t(row.kind === "WORK" ? "Completed-work portion" : "Credit regularization")}</td><td>{row.startAt && row.endAt ? `${new Date(row.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: snapshot.data.zone })}–${new Date(row.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: snapshot.data.zone })}` : "—"}</td><td>{row.originMonth}</td><td>{hours(row.minutes)}</td></tr>)}</tbody></table></div></div>
    </> : null}
  </section>;
}
