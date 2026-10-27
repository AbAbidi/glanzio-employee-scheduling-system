"use client";

import { useDashboardLanguage } from "./dashboard-language";

/* eslint-disable @next/next/no-img-element -- Vinext's local image optimizer requires an unavailable ASSETS binding. */

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import {
  API_BASE_URL, authenticatedFetch,
  responseMessage,
  restoreSession,
  type AuthenticationResult,
} from "../lib/auth-client";
import DashboardShellHeader from "./dashboard-shell-header";
import EmployeeLoginId from "./employee-login-id";
import HomeBrandIntro from "../home-brand-intro";
import { useLiveDataVersion } from "../lib/use-live-data-version";

type Assignment = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  site: { name: string; client: { companyName: string } };
};

type MonthAnalysis = {
  month: string;
  completedAssignments: number;
  assignmentsWithCalculatedRoute: number;
  routeKilometers: number;
  laborCost: number;
  revenue: number;
};

type EmployeeAnalysis = {
  month: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    isStudent: boolean;
    createdAt?: string;
  };
  completedAssignments: number;
  completedMinutes: number;
  creditedMinutes: number;
  carryInMinutes: number;
  carryOutMinutes: number;
  amount: number;
};

type DashboardData = {
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  maintenanceEnabled?: boolean;
  date: string;
  timeZone: string;
  activeEmployees?: number;
  unassignedWork?: number;
  todayAssignments: Assignment[];
  upcomingAssignments?: Assignment[];
  nextAssignment?: Assignment | null;
  studentHourWarnings?: unknown[];
  monthlyPlannedHours?: { plannedHours: number; warning: unknown } | null;
  operationsAnalysis?: {
    weeklyStudents?: { start: string; end: string; items: { employee: EmployeeAnalysis["employee"]; workedMinutes: number; exceededByMinutes: number }[] };
    months: MonthAnalysis[];
    employees: EmployeeAnalysis[];
  };
};

type ResetPreview = {
  studentStatements: number;
  studentCreditMovements: number;
  storedPdfs: number;
  assignments: number;
  recurringSchedules: number;
  notifications: number;
  invitations: number;
  refreshSessions: number;
  passwordResetTokens: number;
  employees: number;
  employeeAccounts: number;
  cleaningSites: number;
  clients: number;
  derivedAnalysis: string[];
  preserved: string[];
};

type ResetResult = {
  deletedStudentStatements: number;
  deletedStudentCreditMovements: number;
  deletedAssignments: number;
  deletedRecurringSchedules: number;
  deletedNotifications: number;
  deletedInvitations: number;
  deletedRefreshSessions: number;
  deletedPasswordResetTokens: number;
  deletedEmployees: number;
  deletedEmployeeAccounts: number;
  deletedCleaningSites: number;
  deletedClients: number;
  preserved: string[];
};

function formatAssignmentTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMonthLabel(value: string, long: boolean, locale: string) {
  return new Date(`${value}-01T12:00:00`).toLocaleDateString(locale, {
    month: long ? "long" : "short",
    year: long ? "numeric" : "2-digit",
  });
}

function formatEuro(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export default function DashboardPage() {
  const liveVersion = useLiveDataVersion();
  const { t, locale } = useDashboardLanguage();
  const assignmentTime = (value: string) => formatAssignmentTime(value, locale);
  const monthLabel = (value: string, long = false) => formatMonthLabel(value, long, locale);
  const euro = (value: number) => formatEuro(value, locale);
  const [session, setSession] = useState<AuthenticationResult | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analysisMonth, setAnalysisMonth] = useState(
    () => new Date().toISOString().slice(0, 7),
  );
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetPreview, setResetPreview] = useState<ResetPreview | null>(null);
  const [resetResult, setResetResult] = useState<ResetResult | null>(null);

  useEffect(() => {
    let isActive = true;
    async function loadDashboard() {
      try {
        const currentSession = await restoreSession();
        if (!currentSession) {
          if (isActive) setError("Please sign in to open your dashboard.");
          return;
        }
        const response = await authenticatedFetch(`${API_BASE_URL}/dashboard`, {
          headers: { Authorization: `Bearer ${currentSession.accessToken}` },
        });
        if (!response.ok) throw new Error("The dashboard could not be loaded.");
        const result = (await response.json()) as DashboardData;
        if (isActive) {
          setSession(currentSession);
          setDashboard(result);
          const newestMonth = result.operationsAnalysis?.months.at(-1)?.month;
          if (newestMonth) setAnalysisMonth((current) => result.operationsAnalysis?.months.some((item) => item.month === current) ? current : newestMonth);
          setError("");
        }
      } catch (requestError) {
        if (isActive) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "The dashboard could not be loaded.",
          );
        }
      } finally {
        if (isActive) setLoading(false);
      }
    }
    void loadDashboard();
    return () => { isActive = false; };
  }, [liveVersion]);

  async function reviewTestWorkspaceReset() {
    if (!session) return;
    setResetting(true);
    setResetError("");
    setResetResult(null);
    try {
      const response = await authenticatedFetch(
        `${API_BASE_URL}/dashboard/reset-test-workspace/preview`,
        { headers: { Authorization: `Bearer ${session.accessToken}` } },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      setResetPreview((await response.json()) as ResetPreview);
    } catch (requestError) {
      setResetError(
        requestError instanceof Error
          ? requestError.message
          : "The test-workspace reset preview could not be loaded.",
      );
    } finally {
      setResetting(false);
    }
  }

  async function resetTestWorkspace() {
    if (!session || resetConfirmation !== "RESET TEST WORKSPACE") return;
    setResetting(true);
    setResetError("");
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/dashboard/reset-test-workspace`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmation: resetConfirmation }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setResetResult((await response.json()) as ResetResult);
      setResetPreview(null);
      setResetConfirmation("");
    } catch (requestError) {
      setResetError(requestError instanceof Error ? requestError.message : "The test workspace could not be reset.");
    } finally {
      setResetting(false);
    }
  }

  if (loading) return <main className="dashboardLoading">{t("Preparing your workspace...")}</main>;
  if (!session || !dashboard) {
    return (
      <main className="dashboardGate">
        <img
          className="dashboardGateBrandLogo"
          src="/glanzio-reinigung-logo.png"
          alt="Glanzio Reinigung"
        />
        <p className="landingEyebrow">{t("Secure team portal")}</p>
        <h1>{t("Authentication required")}</h1>
        <p>{error}</p>
        <Link href="/login">{t("Go to sign in")}</Link>
      </main>
    );
  }

  const upcoming = dashboard.upcomingAssignments ??
    (dashboard.nextAssignment ? [dashboard.nextAssignment] : []);
  const analysis = dashboard.operationsAnalysis;
  const months = analysis?.months ?? [];
  const employees = analysis?.employees.filter((row) => row.month === analysisMonth) ?? [];
  const searchName = employeeSearch.trim().toLocaleLowerCase();
  const filteredEmployees = employees.filter((row) =>
    `${row.employee.firstName} ${row.employee.lastName}`
      .toLocaleLowerCase()
      .includes(searchName),
  );
  const selectedMonth = months.find((item) => item.month === analysisMonth) ?? months.at(-1);
  const maxProduction = Math.max(1, ...months.map((item) => item.completedAssignments));
  const latest = months.at(-1);
  const previous = months.at(-2);
  const productionDifference = (latest?.completedAssignments ?? 0) - (previous?.completedAssignments ?? 0);
  const sixMonthDistance = months.reduce((total, item) => total + item.routeKilometers, 0);
  const sixMonthCompleted = months.reduce((total, item) => total + item.completedAssignments, 0);
  const adminName = (session.user.employee?.firstName ?? session.user.email?.split("@")[0] ?? "Glanzio")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <main className="dashboardPage dashboardOverview">
      <HomeBrandIntro trigger="dashboard" />
      <DashboardShellHeader email={session.user.email} loginCode={session.user.employee?.loginCode} role={dashboard.role} />

      <div className="dashboardOverviewBody">
        <section className="dashboardCommandHero">
          <div>
            <p>{dashboard.date} · {dashboard.timeZone}</p>
            <h1>{t("Welcome, ")}{adminName}.</h1>
            <span>{dashboard.role !== "EMPLOYEE" ? t("Your private admin dashboard for scheduling, clients, employees and business performance.") : t("Your private employee dashboard for assignments and working hours.")}</span>
          </div>
        </section>

        {dashboard.role !== "ADMIN" ? <EmployeeLoginId code={session.user.employee?.loginCode} prominent /> : null}

        <section className="dashboardMetrics dashboardOverviewMetrics">
          {dashboard.role !== "EMPLOYEE" ? (
            <>
              <article><span>{t("Active employees")}</span><strong>{dashboard.activeEmployees ?? 0}</strong><small>{t("Available team members")}</small></article>
              <article><span>{t("Completed · 6 months")}</span><strong>{sixMonthCompleted}</strong><small>{t("Finished assignments")}</small></article>
              <article><span>{t("Travel · 6 months")}</span><strong>{sixMonthDistance.toFixed(1)}<em>{t(" km")}</em></strong><small>{t("Calculated completed routes")}</small></article>
              <article className={(dashboard.unassignedWork ?? 0) > 0 ? "needsAttention" : ""}><span>{t("Needs attention")}</span><strong>{(dashboard.unassignedWork ?? 0) + (dashboard.studentHourWarnings?.length ?? 0)}</strong><small>{t("Unassigned work + student warnings")}</small></article>
            </>
          ) : (
            <>
              <article><span>{t("Today")}</span><strong>{dashboard.todayAssignments.length}</strong><small>{t("Scheduled assignments")}</small></article>
              <article><span>{t("Next assignment")}</span><strong>{dashboard.nextAssignment ? assignmentTime(dashboard.nextAssignment.startAt) : "—"}</strong><small>{dashboard.nextAssignment?.title ?? t("Nothing upcoming")}</small></article>
              <article><span>{t("Planned this month")}</span><strong>{dashboard.monthlyPlannedHours?.plannedHours ?? 0}<em>{t(" h")}</em></strong><small>{t("Your scheduled hours")}</small></article>
            </>
          )}
        </section>

        {dashboard.role !== "EMPLOYEE" && analysis ? (
          <details className="dashboardFeatureBlock productionFeature" open>
            <summary>
              <span className="featureNumber">02</span>
              <span><small>{t("Monthly performance")}</small><strong>{t("Production trend")}</strong><em>{t("Completed assignments during the last six months")}</em></span>
              <span className={`featureKpi ${productionDifference < 0 ? "isDown" : ""}`}><strong>{latest?.completedAssignments ?? 0}</strong><small>{productionDifference >= 0 ? "+" : ""}{productionDifference}{t(" vs previous month")}</small></span>
              <b aria-hidden="true">⌄</b>
            </summary>
            <div className="featureContent productionChartLayout">
              <div className="productionChart" role="img" aria-label={t("Completed assignments by month")}>
                <div className="chartGrid" aria-hidden="true"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0</span></div>
                <div className="productionBars">
                  {months.map((item) => {
                    const height = item.completedAssignments === 0 ? 4 : Math.max(10, item.completedAssignments / maxProduction * 100);
                    return (
                      <button type="button" className={item.month === analysisMonth ? "isSelected" : ""} key={item.month} onClick={() => setAnalysisMonth(item.month)} aria-label={`${monthLabel(item.month, true)}: ${item.completedAssignments} completed assignments`}>
                        <span className="barValue">{item.completedAssignments}</span>
                        <i style={{ "--production-height": `${height}%` } as CSSProperties} />
                        <time>{monthLabel(item.month)}</time>
                      </button>
                    );
                  })}
                </div>
              </div>
              <aside className="productionInsight">
                <p>{t("Selected month")}</p>
                <h3>{selectedMonth ? monthLabel(selectedMonth.month, true) : t("No data")}</h3>
                <dl>
                  <div><dt>{t("Completed work")}</dt><dd>{selectedMonth?.completedAssignments ?? 0}</dd></div>
                  <div><dt>{t("Route distance")}</dt><dd>{selectedMonth?.routeKilometers.toFixed(1) ?? "0.0"}{t(" km")}</dd></div>
                  <div><dt>{t("Labor cost")}</dt><dd>{euro(selectedMonth?.laborCost ?? 0)}</dd></div>
                  <div><dt>{t("Client revenue")}</dt><dd>{euro(selectedMonth?.revenue ?? 0)}</dd></div>
                </dl>
              </aside>
            </div>
          </details>
        ) : null}

        <details className="dashboardFeatureBlock scheduleFeature" open>
          <summary>
            <span className="featureNumber">01</span>
            <span><small>{t("Calendar")}</small><strong>{t("Scheduling overview")}</strong><em>{t("Today’s operations and the next planned visits")}</em></span>
            <span className="featureKpi"><strong>{dashboard.todayAssignments.length}</strong><small>{t("today")}</small></span>
            <b aria-hidden="true">⌄</b>
          </summary>
          <div className="featureContent scheduleFeatureGrid">
            <article><header><span>{t("Today")}</span><strong>{t("Current assignments")}</strong></header>{dashboard.todayAssignments.length ? <div className="dashboardAssignments">{dashboard.todayAssignments.map((assignment) => <div key={assignment.id}><time>{assignmentTime(assignment.startAt)}</time><span><strong>{assignment.title}</strong><small>{assignment.site.name} · {assignment.site.client.companyName}</small></span></div>)}</div> : <p className="compactEmpty">{t("No assignments scheduled today.")}</p>}</article>
            <article><header><span>{t("Next")}</span><strong>{t("Upcoming work")}</strong></header>{upcoming.length ? <div className="dashboardAssignments">{upcoming.slice(0, 5).map((assignment) => <div key={assignment.id}><time>{new Date(assignment.startAt).toLocaleDateString()}</time><span><strong>{assignment.title}</strong><small>{assignment.site.name}</small></span></div>)}</div> : <p className="compactEmpty">{t("No upcoming assignments.")}</p>}</article>
          </div>
        </details>

        {dashboard.role !== "EMPLOYEE" && analysis ? (
          <div className="analysisFeatureGrid">
            <details className="dashboardFeatureBlock distanceFeature">
              <summary>
                <span className="featureNumber">03</span>
                <span><small>{t("Travel")}</small><strong>{t("Distance analysis")}</strong><em>{t("Monthly calculated kilometres")}</em></span>
                <span className="featureKpi"><strong>{selectedMonth?.routeKilometers.toFixed(1) ?? "0.0"}<i>{t(" km")}</i></strong><small>{monthLabel(analysisMonth, true)}</small></span>
                <b aria-hidden="true">⌄</b>
              </summary>
              <div className="featureContent compactMonthList">
                {months.map((item) => <button type="button" className={item.month === analysisMonth ? "isSelected" : ""} key={item.month} onClick={() => setAnalysisMonth(item.month)}><time>{monthLabel(item.month, true)}</time><span><strong>{item.routeKilometers.toFixed(1)}{t(" km")}</strong><small>{item.assignmentsWithCalculatedRoute}{t(" route")}{item.assignmentsWithCalculatedRoute === 1 ? "" : t("s")}{t(" calculated")}</small></span><em>{item.completedAssignments}{t(" completed")}</em></button>)}
              </div>
            </details>

            <details className="dashboardFeatureBlock employeeFeature">
              <summary>
                <span className="featureNumber">04</span>
                <span><small>{t("Team")}</small><strong>{t("Employee analysis")}</strong><em>{t("Hours, carryover and labor amount")}</em></span>
                <span className="featureKpi"><strong>{employees.length}</strong><small>{t("employees")}</small></span>
                <b aria-hidden="true">⌄</b>
              </summary>
              <div className="featureContent">
                <div className="employeeAnalysisToolbar">
                  <label className="employeeAnalysisSearch">{t("Search employee")}<input type="search" value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder={t("Search by employee name")} /></label>
                  <label>{t("Month")}<select value={analysisMonth} onChange={(event) => setAnalysisMonth(event.target.value)}>{months.map((item) => <option key={item.month} value={item.month}>{monthLabel(item.month, true)}</option>)}</select></label>
                </div>
                <p className="analysisColumnHint">{t("Completed assignments counts visits; worked hours adds their total duration.")}</p>
                <div className="employeeAnalysisTable">
                  <div className="tableHeader"><span>{t("Employee")}</span><span>{t("Profile created")}</span><span>{t("Completed assignments")}</span><span>{t("Worked hours")}</span><span>{t("Credited hours")}</span><span>{t("Carry next")}</span><span>{t("Amount")}</span></div>
                  {filteredEmployees.map((row) => <div key={row.employee.id}><span><strong>{row.employee.firstName} {row.employee.lastName}</strong><small>{row.employee.isStudent ? t(row.month >= "2026-10" ? "Student · 10h/week · 40h/month" : "Student · 80h cap") : t("Employee")}</small></span><time dateTime={row.employee.createdAt}>{row.employee.createdAt ? new Date(row.employee.createdAt).toLocaleDateString() : "—"}</time><strong>{row.completedAssignments}</strong><span>{(row.completedMinutes / 60).toFixed(1)}{t("h")}</span><span>{(row.creditedMinutes / 60).toFixed(1)}{t("h")}</span><span className={row.carryOutMinutes > 0 ? "hasCarry" : ""}>{(row.carryOutMinutes / 60).toFixed(1)}{t("h")}</span><strong>{euro(row.amount)}</strong></div>)}
                  {filteredEmployees.length === 0 ? <p className="compactEmpty">{searchName ? t("No matching employees.") : t("No completed employee work in this month.")}</p> : null}
                </div>
                <p className="analysisFootnote">{t("From October 2026: simulation credits are limited to 10h/week and 40h/month. Drafts can change; closed months are frozen. Labor cost stays with the original work.")}</p>
                {analysis?.weeklyStudents ? <section className="studentWeeklyPanel">
                  <h3>{t("Student hours this week")}</h3>
                  <p>{analysis.weeklyStudents.start} — {analysis.weeklyStudents.end}</p>
                  <div className="studentTableScroll"><table className="studentCreditTable">
                    <thead><tr><th>{t("Employee")}</th><th>{t("Worked hours")}</th><th>{t("Excess above 10h")}</th></tr></thead>
                    <tbody>{analysis.weeklyStudents.items.filter((row) => `${row.employee.firstName} ${row.employee.lastName}`.toLowerCase().includes(employeeSearch.toLowerCase())).map((row) => <tr key={row.employee.id}><td>{row.employee.firstName} {row.employee.lastName}</td><td>{(row.workedMinutes / 60).toFixed(1)}h</td><td className={row.exceededByMinutes ? "studentExcess" : ""}>{row.exceededByMinutes ? `${(row.exceededByMinutes / 60).toFixed(1)}h` : "—"}</td></tr>)}</tbody>
                  </table></div>
                </section> : null}
              </div>
            </details>
          </div>
        ) : null}

        {dashboard.role === "ADMIN" && dashboard.maintenanceEnabled !== false ? (
          <details className="dashboardFeatureBlock dangerFeature">
            <summary>
              <span className="featureNumber">!</span>
              <span><small>{t("Development maintenance")}</small><strong>{t("Clean the test workspace")}</strong><em>{t("Remove simulation data and return to an empty workspace")}</em></span>
              <span className="featureKpi"><strong>{t("Clean up")}</strong><small>{t("protected action")}</small></span>
              <b aria-hidden="true">⌄</b>
            </summary>
            <div className="featureContent dangerZoneContent">
              <div><h3>{t("What will be deleted")}</h3><ul><li>{t("All one-time and recurring assignments")}</li><li>{t("All employee and manager profiles, accounts, sessions and invitations")}</li><li>{t("All clients and cleaning sites")}</li><li>{t("Notifications and every analysis derived from test work")}</li></ul></div>
              <div><h3>{t("What will remain")}</h3><ul><li>{t("Owner accounts and owner sessions")}</li><li>{t("Database structure and Prisma migrations")}</li><li>{t("Audit history, including references to previous test activity")}</li><li>{t("Application configuration and public-site content")}</li></ul></div>
              <div className="resetConfirmationPanel">
                {resetResult ? (
                  <div className="resetSuccessPanel" role="status">
                    <span aria-hidden="true">✓</span>
                    <div>
                      <strong>{t("Test workspace cleanup completed")}</strong>
                      <p>{t("Removed")}{resetResult.deletedAssignments}{t(" assignments, ")}{resetResult.deletedEmployees}{t(" employee profiles, ")}{resetResult.deletedClients}{t(" clients and ")}{resetResult.deletedCleaningSites}{t("cleaning sites.")}</p>
                    </div>
                    <button type="button" onClick={() => window.location.reload()}>{t("Reload clean dashboard")}</button>
                  </div>
                ) : resetPreview ? (
                  <>
                    <div className="resetScenarioIntro">
                      <span>{t("Step 2 of 2")}</span>
                      <strong>{t("Review the exact impact before confirming")}</strong>
                      <p>{t("No data has been deleted yet. This action cannot be undone.")}</p>
                    </div>
                    <div className="resetPreviewGrid">
                      <span><strong>{resetPreview.assignments}</strong>{t("assignments")}</span>
                      <span><strong>{resetPreview.recurringSchedules}</strong>{t("recurring schedules")}</span>
                      <span><strong>{resetPreview.employees}</strong>{t("employee profiles")}</span>
                      <span><strong>{resetPreview.employeeAccounts}</strong>{t("employee accounts")}</span>
                      <span><strong>{resetPreview.clients}</strong>{t("clients")}</span>
                      <span><strong>{resetPreview.cleaningSites}</strong>{t("cleaning sites")}</span>
                      <span><strong>{resetPreview.invitations}</strong>{t("invitations")}</span>
                      <span><strong>{resetPreview.notifications}</strong>{t("notifications")}</span>
                      <span><strong>{resetPreview.studentStatements}</strong>{t("Student drafts and closures")}</span>
                      <span><strong>{resetPreview.studentCreditMovements}</strong>{t("Credit movements")}</span>
                      <span><strong>{resetPreview.storedPdfs}</strong>{t("Stored simulation PDFs")}</span>
                    </div>
                    <label>{t("Type")}<strong>{t("RESET TEST WORKSPACE")}</strong>{t("to authorize the deletion")}<input value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value)} autoComplete="off" />
                    </label>
                    <div className="resetScenarioActions">
                      <button className="resetCancelButton" type="button" disabled={resetting} onClick={() => { setResetPreview(null); setResetConfirmation(""); setResetError(""); }}>{t("Cancel")}</button>
                      <button type="button" disabled={resetting || resetConfirmation !== "RESET TEST WORKSPACE"} onClick={() => void resetTestWorkspace()}>
                        {resetting ? t("Cleaning…") : t("Permanently delete test data")}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="resetScenarioIntro">
                    <span>{t("Step 1 of 2")}</span>
                    <strong>{t("Review every record group before cleanup")}</strong>
                    <p>{t("This only targets workspace test data. Your administrator login and database structure are preserved.")}</p>
                    <button type="button" disabled={resetting} onClick={() => void reviewTestWorkspaceReset()}>
                      {resetting ? t("Loading preview…") : t("Review test-data cleanup")}
                    </button>
                  </div>
                )}
                {resetError ? <p role="alert">{resetError}</p> : null}
              </div>
            </div>
          </details>
        ) : null}
      </div>
    </main>
  );
}
