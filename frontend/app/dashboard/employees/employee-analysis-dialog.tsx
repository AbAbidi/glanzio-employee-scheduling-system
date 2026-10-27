"use client";

import { useDashboardLanguage } from "../dashboard-language";

import { useEffect, useState } from "react";
import { API_BASE_URL, authenticatedFetch, responseMessage } from "../../lib/auth-client";
import type { Employee, EmployeeAnalytics } from "./types";

type EmployeeAnalysisDialogProps = {
  accessToken: string;
  employee: Employee;
  onClose: () => void;
};

function hours(minutes: number) {
  return `${(minutes / 60).toFixed(1)}h`;
}

export default function EmployeeAnalysisDialog({ accessToken, employee, onClose }: EmployeeAnalysisDialogProps) {
  const { t } = useDashboardLanguage();
  const [analytics, setAnalytics] = useState<EmployeeAnalytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/employees/${employee.id}/analytics`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) throw new Error(await responseMessage(response));
        const result = (await response.json()) as EmployeeAnalytics;
        if (active) setAnalytics(result);
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "Employee analytics could not be loaded.");
      }
    }
    void load();
    return () => { active = false; };
  }, [accessToken, employee.id]);

  return (
    <section className="employeeAnalysisDialog" role="dialog" aria-modal="true" aria-labelledby="employee-analysis-title">
      <header>
        <div><p>{t("Completed-work analysis")}</p><h2 id="employee-analysis-title">{employee.firstName} {employee.lastName}</h2><span>{t("Only assignments whose scheduled end time has passed are included.")}</span></div>
        <button type="button" aria-label={t("Close analysis")} onClick={onClose}>×</button>
      </header>
      {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}
      {!analytics && !error ? <p className="formNotice">{t("Calculating completed work...")}</p> : null}
      {analytics ? (
        <>
          <div className="employeeAnalyticsMetrics">
            <article><span>{t("Completed assignments")}</span><strong>{analytics.metrics.completedAssignments}</strong></article>
            <article><span>{t("Completed hours")}</span><strong>{hours(analytics.metrics.completedMinutes)}</strong></article>
            <article><span>{t("This month")}</span><strong>{hours(analytics.metrics.currentMonthMinutes)}</strong></article>
            <article><span>{t("Completed labour cost")}</span><strong>€{analytics.metrics.totalCost.toFixed(2)}</strong></article>
          </div>
          <div className="employeeWorkTableWrap">
            <table className="employeeWorkTable">
              <thead><tr><th>{t("Completed assignment")}</th><th>{t("Client / site")}</th><th>{t("Hours")}</th><th>{t("Rate")}</th><th>{t("Cost")}</th></tr></thead>
              <tbody>
                {analytics.completedAssignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td><strong>{assignment.title}</strong><small>{new Date(assignment.endAt).toLocaleDateString()}</small></td>
                    <td><strong>{assignment.clientName}</strong><small>{assignment.siteName}</small></td>
                    <td>{hours(assignment.durationMinutes)}</td>
                    <td>{assignment.agreedHourlyRate ? `€${assignment.agreedHourlyRate}/h` : t("Not set")}</td>
                    <td><strong>€{assignment.cost.toFixed(2)}</strong></td>
                  </tr>
                ))}
                {analytics.completedAssignments.length === 0 ? <tr><td colSpan={5}>{t("No completed assignments yet.")}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      <footer><button type="button" onClick={onClose}>{t("Close analysis")}</button></footer>
    </section>
  );
}
