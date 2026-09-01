"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import {
  API_BASE_URL,
  responseMessage,
  restoreSession,
  type AuthenticationResult,
} from "../lib/auth-client";
import DashboardShellHeader from "./dashboard-shell-header";

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
  grossMargin: number;
};

type EmployeeAnalysis = {
  month: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    isStudent: boolean;
  };
  completedAssignments: number;
  completedMinutes: number;
  creditedMinutes: number;
  carryInMinutes: number;
  carryOutMinutes: number;
  amount: number;
};

type DashboardData = {
  role: "ADMIN" | "EMPLOYEE";
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
    months: MonthAnalysis[];
    employees: EmployeeAnalysis[];
  };
};

type ResetPreview = {
  assignments: number;
  recurringSchedules: number;
  notifications: number;
  derivedAnalysis: string[];
  preserved: string[];
};

type ResetResult = {
  deletedAssignments: number;
  deletedRecurringSchedules: number;
  deletedNotifications: number;
  preserved: string[];
};

function assignmentTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function monthLabel(value: string, long = false) {
  return new Date(`${value}-01T12:00:00`).toLocaleDateString(undefined, {
    month: long ? "long" : "short",
    year: long ? "numeric" : "2-digit",
  });
}

function euro(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export default function DashboardPage() {
  const [session, setSession] = useState<AuthenticationResult | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analysisMonth, setAnalysisMonth] = useState(
    () => new Date().toISOString().slice(0, 7),
  );
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
        const response = await fetch(`${API_BASE_URL}/dashboard`, {
          headers: { Authorization: `Bearer ${currentSession.accessToken}` },
        });
        if (!response.ok) throw new Error("The dashboard could not be loaded.");
        const result = (await response.json()) as DashboardData;
        if (isActive) {
          setSession(currentSession);
          setDashboard(result);
          const newestMonth = result.operationsAnalysis?.months.at(-1)?.month;
          if (newestMonth) setAnalysisMonth(newestMonth);
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
  }, []);

  async function reviewOperationalReset() {
    if (!session) return;
    setResetting(true);
    setResetError("");
    setResetResult(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/dashboard/reset-operational-data/preview`,
        { headers: { Authorization: `Bearer ${session.accessToken}` } },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      setResetPreview((await response.json()) as ResetPreview);
    } catch (requestError) {
      setResetError(
        requestError instanceof Error
          ? requestError.message
          : "The reset preview could not be loaded.",
      );
    } finally {
      setResetting(false);
    }
  }

  async function resetOperationalData() {
    if (!session || resetConfirmation !== "RESET OPERATIONS") return;
    setResetting(true);
    setResetError("");
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/reset-operational-data`, {
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
      setResetError(requestError instanceof Error ? requestError.message : "Operational data could not be reset.");
    } finally {
      setResetting(false);
    }
  }

  if (loading) return <main className="dashboardLoading">Preparing your workspace...</main>;
  if (!session || !dashboard) {
    return (
      <main className="dashboardGate">
        <span className="publicBrandMark" aria-hidden="true">CC</span>
        <p className="landingEyebrow">Secure team portal</p>
        <h1>Authentication required</h1>
        <p>{error}</p>
        <Link href="/login">Go to sign in</Link>
      </main>
    );
  }

  const upcoming = dashboard.upcomingAssignments ??
    (dashboard.nextAssignment ? [dashboard.nextAssignment] : []);
  const analysis = dashboard.operationsAnalysis;
  const months = analysis?.months ?? [];
  const employees = analysis?.employees.filter((row) => row.month === analysisMonth) ?? [];
  const selectedMonth = months.find((item) => item.month === analysisMonth) ?? months.at(-1);
  const maxProduction = Math.max(1, ...months.map((item) => item.completedAssignments));
  const latest = months.at(-1);
  const previous = months.at(-2);
  const productionDifference = (latest?.completedAssignments ?? 0) - (previous?.completedAssignments ?? 0);
  const sixMonthDistance = months.reduce((total, item) => total + item.routeKilometers, 0);
  const sixMonthCompleted = months.reduce((total, item) => total + item.completedAssignments, 0);
  const adminName = (session.user.employee?.firstName ?? session.user.email.split("@")[0])
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <main className="dashboardPage dashboardOverview">
      <DashboardShellHeader email={session.user.email} role={dashboard.role} />

      <div className="dashboardOverviewBody">
        <section className="dashboardCommandHero">
          <div>
            <p>{dashboard.date} · {dashboard.timeZone}</p>
            <h1>Welcome, {adminName}.</h1>
            <span>{dashboard.role === "ADMIN" ? "Your private admin dashboard for scheduling, clients, employees and business performance." : "Your private employee dashboard for assignments and working hours."}</span>
          </div>
          <div className="dashboardHeroPulse">
            <i aria-hidden="true" />
            <span>Live workspace<strong>{dashboard.todayAssignments.length} assignment{dashboard.todayAssignments.length === 1 ? "" : "s"} today</strong></span>
          </div>
        </section>

        <section className="dashboardMetrics dashboardOverviewMetrics">
          {dashboard.role === "ADMIN" ? (
            <>
              <article><span>Active employees</span><strong>{dashboard.activeEmployees ?? 0}</strong><small>Available team members</small></article>
              <article><span>Completed · 6 months</span><strong>{sixMonthCompleted}</strong><small>Finished assignments</small></article>
              <article><span>Travel · 6 months</span><strong>{sixMonthDistance.toFixed(1)}<em> km</em></strong><small>Calculated completed routes</small></article>
              <article className={(dashboard.unassignedWork ?? 0) > 0 ? "needsAttention" : ""}><span>Needs attention</span><strong>{(dashboard.unassignedWork ?? 0) + (dashboard.studentHourWarnings?.length ?? 0)}</strong><small>Unassigned work + student warnings</small></article>
            </>
          ) : (
            <>
              <article><span>Today</span><strong>{dashboard.todayAssignments.length}</strong><small>Scheduled assignments</small></article>
              <article><span>Next assignment</span><strong>{dashboard.nextAssignment ? assignmentTime(dashboard.nextAssignment.startAt) : "—"}</strong><small>{dashboard.nextAssignment?.title ?? "Nothing upcoming"}</small></article>
              <article><span>Planned this month</span><strong>{dashboard.monthlyPlannedHours?.plannedHours ?? 0}<em> h</em></strong><small>Your scheduled hours</small></article>
            </>
          )}
        </section>

        {dashboard.role === "ADMIN" && analysis ? (
          <details className="dashboardFeatureBlock productionFeature" open>
            <summary>
              <span className="featureNumber">02</span>
              <span><small>Monthly performance</small><strong>Production trend</strong><em>Completed assignments during the last six months</em></span>
              <span className={`featureKpi ${productionDifference < 0 ? "isDown" : ""}`}><strong>{latest?.completedAssignments ?? 0}</strong><small>{productionDifference >= 0 ? "+" : ""}{productionDifference} vs previous month</small></span>
              <b aria-hidden="true">⌄</b>
            </summary>
            <div className="featureContent productionChartLayout">
              <div className="productionChart" role="img" aria-label="Completed assignments by month">
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
                <p>Selected month</p>
                <h3>{selectedMonth ? monthLabel(selectedMonth.month, true) : "No data"}</h3>
                <dl>
                  <div><dt>Completed work</dt><dd>{selectedMonth?.completedAssignments ?? 0}</dd></div>
                  <div><dt>Route distance</dt><dd>{selectedMonth?.routeKilometers.toFixed(1) ?? "0.0"} km</dd></div>
                  <div><dt>Labor cost</dt><dd>{euro(selectedMonth?.laborCost ?? 0)}</dd></div>
                  <div><dt>Client revenue</dt><dd>{euro(selectedMonth?.revenue ?? 0)}</dd></div>
                  <div><dt>Gross margin</dt><dd>{euro(selectedMonth?.grossMargin ?? 0)}</dd></div>
                </dl>
              </aside>
            </div>
          </details>
        ) : null}

        <details className="dashboardFeatureBlock scheduleFeature" open>
          <summary>
            <span className="featureNumber">01</span>
            <span><small>Calendar</small><strong>Scheduling overview</strong><em>Today’s operations and the next planned visits</em></span>
            <span className="featureKpi"><strong>{dashboard.todayAssignments.length}</strong><small>today</small></span>
            <b aria-hidden="true">⌄</b>
          </summary>
          <div className="featureContent scheduleFeatureGrid">
            <article><header><span>Today</span><strong>Current assignments</strong></header>{dashboard.todayAssignments.length ? <div className="dashboardAssignments">{dashboard.todayAssignments.map((assignment) => <div key={assignment.id}><time>{assignmentTime(assignment.startAt)}</time><span><strong>{assignment.title}</strong><small>{assignment.site.name} · {assignment.site.client.companyName}</small></span></div>)}</div> : <p className="compactEmpty">No assignments scheduled today.</p>}</article>
            <article><header><span>Next</span><strong>Upcoming work</strong></header>{upcoming.length ? <div className="dashboardAssignments">{upcoming.slice(0, 5).map((assignment) => <div key={assignment.id}><time>{new Date(assignment.startAt).toLocaleDateString()}</time><span><strong>{assignment.title}</strong><small>{assignment.site.name}</small></span></div>)}</div> : <p className="compactEmpty">No upcoming assignments.</p>}</article>
          </div>
        </details>

        {dashboard.role === "ADMIN" && analysis ? (
          <div className="analysisFeatureGrid">
            <details className="dashboardFeatureBlock distanceFeature">
              <summary>
                <span className="featureNumber">03</span>
                <span><small>Travel</small><strong>Distance analysis</strong><em>Monthly calculated kilometres</em></span>
                <span className="featureKpi"><strong>{selectedMonth?.routeKilometers.toFixed(1) ?? "0.0"}<i> km</i></strong><small>{monthLabel(analysisMonth, true)}</small></span>
                <b aria-hidden="true">⌄</b>
              </summary>
              <div className="featureContent compactMonthList">
                {months.map((item) => <button type="button" className={item.month === analysisMonth ? "isSelected" : ""} key={item.month} onClick={() => setAnalysisMonth(item.month)}><time>{monthLabel(item.month, true)}</time><span><strong>{item.routeKilometers.toFixed(1)} km</strong><small>{item.assignmentsWithCalculatedRoute} route{item.assignmentsWithCalculatedRoute === 1 ? "" : "s"} calculated</small></span><em>{item.completedAssignments} completed</em></button>)}
              </div>
            </details>

            <details className="dashboardFeatureBlock employeeFeature">
              <summary>
                <span className="featureNumber">04</span>
                <span><small>Team</small><strong>Employee analysis</strong><em>Hours, carryover and labor amount</em></span>
                <span className="featureKpi"><strong>{employees.length}</strong><small>employees</small></span>
                <b aria-hidden="true">⌄</b>
              </summary>
              <div className="featureContent">
                <div className="employeeAnalysisToolbar"><p>{monthLabel(analysisMonth, true)}</p><label>Month<select value={analysisMonth} onChange={(event) => setAnalysisMonth(event.target.value)}>{months.map((item) => <option key={item.month} value={item.month}>{monthLabel(item.month, true)}</option>)}</select></label></div>
                <div className="employeeAnalysisTable"><div className="tableHeader"><span>Employee</span><span>Completed</span><span>Worked</span><span>Credited</span><span>Carry next</span><span>Amount</span></div>{employees.map((row) => <div key={row.employee.id}><span><strong>{row.employee.firstName} {row.employee.lastName}</strong><small>{row.employee.isStudent ? "Student · 80h cap" : "Employee"}</small></span><strong>{row.completedAssignments}</strong><span>{(row.completedMinutes / 60).toFixed(1)}h</span><span>{(row.creditedMinutes / 60).toFixed(1)}h</span><span className={row.carryOutMinutes > 0 ? "hasCarry" : ""}>{(row.carryOutMinutes / 60).toFixed(1)}h</span><strong>{euro(row.amount)}</strong></div>)}{employees.length === 0 ? <p className="compactEmpty">No completed employee work in this month.</p> : null}</div>
                <p className="analysisFootnote">Student employees are credited up to 80 hours monthly. Excess hours move to the next month; labor cost stays in the month when work was completed.</p>
              </div>
            </details>
          </div>
        ) : null}

        {dashboard.role === "ADMIN" ? (
          <details className="dashboardFeatureBlock dangerFeature">
            <summary>
              <span className="featureNumber">!</span>
              <span><small>Maintenance</small><strong>Reset operational data</strong><em>Clear assignments and every analysis calculated from them</em></span>
              <span className="featureKpi"><strong>Reset</strong><small>protected action</small></span>
              <b aria-hidden="true">⌄</b>
            </summary>
            <div className="featureContent dangerZoneContent">
              <div><h3>What will be deleted</h3><ul><li>All one-time and recurring assignments</li><li>Assignment notifications</li><li>Derived employee hours, revenue, distance and production analysis</li></ul></div>
              <div><h3>What will remain</h3><ul><li>Administrator and employee accounts</li><li>Clients and cleaning sites</li><li>Employee profiles and invitation history</li><li>Audit history of the reset</li></ul></div>
              <div className="resetConfirmationPanel">
                {resetResult ? (
                  <div className="resetSuccessPanel" role="status">
                    <span aria-hidden="true">✓</span>
                    <div>
                      <strong>Operational workspace reset completed</strong>
                      <p>
                        {resetResult.deletedAssignments} assignments, {resetResult.deletedRecurringSchedules} recurring schedules, and {resetResult.deletedNotifications} related notifications were removed.
                      </p>
                    </div>
                    <button type="button" onClick={() => window.location.reload()}>
                      Reload clean dashboard
                    </button>
                  </div>
                ) : resetPreview ? (
                  <>
                    <div className="resetScenarioIntro">
                      <span>Step 2 of 2</span>
                      <strong>Review the exact impact before confirming</strong>
                      <p>No data has been deleted yet. This action cannot be undone.</p>
                    </div>
                    <div className="resetPreviewGrid">
                      <span><strong>{resetPreview.assignments}</strong>assignments</span>
                      <span><strong>{resetPreview.recurringSchedules}</strong>recurring schedules</span>
                      <span><strong>{resetPreview.notifications}</strong>related notifications</span>
                    </div>
                    <label>
                      Type <strong>RESET OPERATIONS</strong> to authorize the deletion
                      <input value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value)} autoComplete="off" />
                    </label>
                    <div className="resetScenarioActions">
                      <button className="resetCancelButton" type="button" disabled={resetting} onClick={() => { setResetPreview(null); setResetConfirmation(""); setResetError(""); }}>
                        Cancel
                      </button>
                      <button type="button" disabled={resetting || resetConfirmation !== "RESET OPERATIONS"} onClick={() => void resetOperationalData()}>
                        {resetting ? "Resetting…" : "Permanently reset operations"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="resetScenarioIntro">
                    <span>Step 1 of 2</span>
                    <strong>Load a safe impact preview</strong>
                    <p>We will count the affected records before asking you to type the confirmation phrase.</p>
                    <button type="button" disabled={resetting} onClick={() => void reviewOperationalReset()}>
                      {resetting ? "Loading preview…" : "Review reset"}
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
