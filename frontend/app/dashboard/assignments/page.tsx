"use client";

import { useDashboardLanguage } from "../dashboard-language";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  API_BASE_URL, authenticatedFetch,
  responseMessage,
  restoreSession,
  type AuthenticationResult,
} from "../../lib/auth-client";
import { useLiveDataVersion } from "../../lib/use-live-data-version";
import { loadPaginatedItems } from "../../lib/paginated-items";
import { groupCalendarEvents } from "./calendar-layout";
import DashboardShellHeader from "../dashboard-shell-header";
import CreateAssignmentForm from "./create-assignment-form";
import EditAssignmentForm from "./edit-assignment-form";
import { isWeekendDate, nextWorkingDate } from "./schedule-policy";
import { badenWuerttembergHoliday } from "./public-holidays";
import type {
  AssignmentListResponse,
  StudentHourWarning,
  WorkAssignment,
} from "./types";

type AccessState = "checking" | "signed-out" | "allowed";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function formatTimeLabel(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatFullDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

function assignmentDuration(startAt: string, endAt: string, locale: string) {
  const minutes = Math.max(
    0,
    Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000),
  );
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return new Intl.NumberFormat(locale, { style: "unit", unit: "minute", unitDisplay: "long" }).format(remainingMinutes);
  if (remainingMinutes === 0) return new Intl.NumberFormat(locale, { style: "unit", unit: "hour", unitDisplay: "long" }).format(hours);
  return `${hours}h ${remainingMinutes}min`;
}

type VisualStatus = "completed" | "pending" | "cancelled" | "active";

function visualStatus(assignment: WorkAssignment): VisualStatus {
  if (assignment.status === "CANCELLED") return "cancelled";
  if (assignment.status === "COMPLETED") return "completed";
  const now = Date.now();
  if (assignment.status === "SCHEDULED" && new Date(assignment.startAt).getTime() <= now && new Date(assignment.endAt).getTime() > now) return "active";
  return "pending";
}

function statusLabel(status: VisualStatus) {
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "active") return "In progress";
  return "Pending";
}

export default function AssignmentsPage() {
  const liveVersion = useLiveDataVersion();
  const { t, locale } = useDashboardLanguage();
  const timeLabel = (value: string) => formatTimeLabel(value, locale);
  const fullDateTime = (value: string) => formatFullDateTime(value, locale);
  const [access, setAccess] = useState<AccessState>("checking");
  const [session, setSession] =
    useState<AuthenticationResult | null>(null);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [assignments, setAssignments] = useState<WorkAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [selectedAssignment, setSelectedAssignment] =
    useState<WorkAssignment | null>(null);
  const [editingAssignment, setEditingAssignment] =
    useState<WorkAssignment | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelMode, setCancelMode] = useState<"single" | "series" | "delete">("single");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [notice, setNotice] = useState("");
  const [, setClockTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setClockTick((current) => current + 1),
      60_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const days = useMemo(() => monthDays(month), [month]);
  useEffect(() => {
    let active = true;

    async function authenticate() {
      try {
        const currentSession = await restoreSession();
        if (!active) return;
        if (!currentSession) {
          setAccess("signed-out");
          return;
        }
        setSession(currentSession);
        setAccess("allowed");
      } catch {
        if (active) setAccess("signed-out");
      }
    }

    void authenticate();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;

    async function loadCalendar() {
      setLoading(true);
      setError("");

      try {
        const visibleDays = monthDays(month);
        const rangeStart = new Date(visibleDays[0]);
        rangeStart.setHours(0, 0, 0, 0);
        const rangeEnd = new Date(visibleDays[visibleDays.length - 1]);
        rangeEnd.setDate(rangeEnd.getDate() + 1);
        rangeEnd.setHours(0, 0, 0, 0);
        const query = new URLSearchParams({
          from: rangeStart.toISOString(),
          to: rangeEnd.toISOString(),
          page: "1",
          pageSize: "100",
        });
        const items = await loadPaginatedItems(async (page) => {
          query.set("page", String(page));
          const response = await authenticatedFetch(`${API_BASE_URL}/calendar?${query}`);
          if (!response.ok) throw new Error(await responseMessage(response));
          return (await response.json()) as AssignmentListResponse;
        }, () => active);
        if (active) {
          setAssignments(items);
          setSelectedAssignment((current) => current ? items.find((item) => item.id === current.id) ?? current : null);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "The calendar could not be loaded.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCalendar();
    return () => {
      active = false;
    };
  }, [session, month, refreshVersion, liveVersion]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, WorkAssignment[]>();

    for (const assignment of assignments) {
      const key = dateKey(new Date(assignment.startAt));
      grouped.set(key, [...(grouped.get(key) ?? []), assignment]);
    }

    return grouped;
  }, [assignments]);

  function moveMonth(offset: number) {
    setMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  function handleCreated(
    assignment: WorkAssignment | null,
    warnings: StudentHourWarning[],
    recurringCount?: number,
  ) {
    setCreateDate(null);
    setRefreshVersion((current) => current + 1);

    if (assignment) {
      setSelectedAssignment(assignment);
      setNotice(
        warnings.length > 0
          ? `Assignment created. Warning only: ${warnings
              .map(
                (warning) =>
                  `${warning.employeeName}: ${(warning.plannedMinutes / 60).toFixed(1)}h planned in ${warning.period ?? warning.month}; ${(warning.limitMinutes / 60).toFixed(0)}h limit exceeded by ${(warning.exceededByMinutes / 60).toFixed(1)}h`,
              )
              .join("; ")}. The assignment was not blocked.`
          : "Assignment created successfully.",
      );
    } else {
      setNotice(`${recurringCount ?? 0} recurring assignments were created.`);
    }
  }

  function handleUpdated(assignment: WorkAssignment) {
    setAssignments((current) =>
      current.map((item) => (item.id === assignment.id ? assignment : item)),
    );
    setEditingAssignment(null);
    setSelectedAssignment(assignment);
    setNotice("Assignment updated successfully.");
  }

  async function cancelAssignment() {
    if (!session || !selectedAssignment) return;
    if (cancelMode !== "delete" && !cancelReason.trim()) return;
    setCancelling(true);
    setError("");

    try {
      const endpoint = cancelMode === "series"
        ? `${API_BASE_URL}/assignments/${selectedAssignment.id}/cancel-series`
        : `${API_BASE_URL}/assignments/${selectedAssignment.id}${cancelMode === "single" ? "/cancel" : ""}`;
      const response = await authenticatedFetch(endpoint, {
        method: cancelMode === "delete" ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          ...(cancelMode === "delete" ? {} : { "Content-Type": "application/json" }),
        },
        ...(cancelMode === "delete"
          ? {}
          : { body: JSON.stringify({ reason: cancelReason.trim() }) }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));

      if (cancelMode === "single") {
        const cancelled = (await response.json()) as WorkAssignment;
        setAssignments((current) =>
          current.map((item) => (item.id === cancelled.id ? cancelled : item)),
        );
        setSelectedAssignment(cancelled);
        setNotice("This occurrence was cancelled. Its history has been preserved.");
      } else if (cancelMode === "series") {
        const result = (await response.json()) as { cancelledCount: number };
        setSelectedAssignment(null);
        setRefreshVersion((current) => current + 1);
        setNotice(`${result.cancelledCount} occurrence${result.cancelledCount === 1 ? "" : "s"} in the series were cancelled.`);
      } else {
        await response.json();
        setAssignments((current) =>
          current.filter((item) => item.id !== selectedAssignment.id),
        );
        setSelectedAssignment(null);
        setNotice("The selected calendar event was permanently deleted.");
      }
      setShowCancelForm(false);
      setCancelReason("");
      setCancelMode("single");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The assignment could not be cancelled.",
      );
    } finally {
      setCancelling(false);
    }
  }

  if (access === "checking") {
    return <main className="managementGate">{t("Preparing the calendar...")}</main>;
  }

  if (access === "signed-out" || !session) {
    return (
      <main className="managementGate">
        <h1>{t("Sign in required")}</h1>
        <p>{t("You must sign in to view assignments.")}</p>
        <Link href="/login">{t("Go to sign in")}</Link>
      </main>
    );
  }

  const isAdmin = session.user.role !== "EMPLOYEE";

  return (
    <main className="calendarWorkspace">
      {!createDate && !editingAssignment && !selectedAssignment ? (
        <DashboardShellHeader email={session.user.email} loginCode={session.user.employee?.loginCode} role={session.user.role} />
      ) : null}

      <section className="calendarIntro">
        <div>
          <p>{t("Operations calendar")}</p>
          <h1>{t("Plan every clean with confidence.")}</h1>
          <span>{t("Choose a day, build the route and align the right team.")}</span>
        </div>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => setCreateDate(dateKey(nextWorkingDate(new Date())))}
          >
            <span aria-hidden="true">＋</span>{t("New assignment")}</button>
        ) : null}
      </section>

      <section className="calendarStatusStrip" aria-label={t("Assignment status guide")}>
        <div><i className="statusDot statusDotCompleted" /><span>{t("Completed")}</span><strong>{assignments.filter((assignment) => visualStatus(assignment) === "completed").length}</strong></div>
        <div><i className="statusDot statusDotPending" /><span>{t("Pending")}</span><strong>{assignments.filter((assignment) => visualStatus(assignment) === "pending").length}</strong></div>
        <div><i className="statusDot statusDotActive" /><span>{t("In progress")}</span><strong>{assignments.filter((assignment) => visualStatus(assignment) === "active").length}</strong></div>
        <div><i className="statusDot statusDotCancelled" /><span>{t("Cancelled")}</span><strong>{assignments.filter((assignment) => visualStatus(assignment) === "cancelled").length}</strong></div>
      </section>

      {notice ? (
        <button className="calendarNotice" type="button" onClick={() => setNotice("")}>
          {notice}<span aria-hidden="true">×</span>
        </button>
      ) : null}

      <section className="calendarCard">
        <header className="calendarToolbar">
          <div>
            <button type="button" aria-label={t("Previous month")} onClick={() => moveMonth(-1)}>←</button>
            <button type="button" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>{t("Today")}</button>
            <button type="button" aria-label={t("Next month")} onClick={() => moveMonth(1)}>→</button>
          </div>
          <h2>{new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month)}</h2>
          <span>{loading ? t("Updating...") : `${assignments.length} ${t("scheduled")}`}</span>
        </header>

        {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}

        <div className="calendarGridScroll" tabIndex={0} role="region" aria-label={t("Assignment calendar")}>
        <div className="calendarWeekdays" aria-hidden="true">
          {WEEKDAY_LABELS.map((label) => <span key={label}>{t(label)}</span>)}
        </div>

        <div className="monthCalendar" aria-label={t("Assignment calendar")}>
          {days.map((day) => {
            const key = dateKey(day);
            const dayEvents = eventsByDay.get(key) ?? [];
            const isCurrentMonth = day.getMonth() === month.getMonth();
            const isToday = key === dateKey(new Date());
            const isWeekend = isWeekendDate(day);
            const holiday = badenWuerttembergHoliday(key);

            return (
              <div
                className={`calendarDay${isCurrentMonth ? "" : " isOutside"}${isToday ? " isToday" : ""}${isWeekend ? " isWeekend" : ""}${holiday ? " isHoliday" : ""}`}
                key={key}
              >
                <div className="calendarDayTop">
                  {holiday ? <span className="calendarHolidayLabel" title={`${holiday} · Baden-Württemberg`}>{holiday}</span> : null}
                  <button
                    className="calendarDayNumber"
                    type="button"
                    disabled={!isAdmin || isWeekend}
                    aria-label={
                      isWeekend
                        ? `${day.toDateString()}: weekend scheduling is unavailable`
                        : isAdmin
                          ? `Create assignment on ${day.toDateString()}`
                          : day.toDateString()
                    }
                    onClick={() => setCreateDate(key)}
                  >
                    {day.getDate()}
                  </button>
                </div>

                <div className="calendarDayEvents">
                  {groupCalendarEvents(dayEvents).map((group) => (
                    <div className="calendarEventGroup" key={group[0].id} data-concurrent={group.length > 1}>
                    {group.map((assignment) => (
                    <button
                      className={`calendarEvent calendarEvent${visualStatus(assignment)}`}
                      key={assignment.id}
                      type="button"
                      title={`${assignment.title} · ${timeLabel(assignment.startAt)}–${timeLabel(assignment.endAt)}`}
                      aria-label={`${assignment.title} · ${timeLabel(assignment.startAt)}–${timeLabel(assignment.endAt)} · ${t(statusLabel(visualStatus(assignment)))}`}
                      onClick={() => { setSelectedAssignment(assignment); setShowCancelForm(false); setCancelReason(""); }}
                    >
                      <time>{timeLabel(assignment.startAt)}</time>
                      <span><strong>{assignment.title}</strong><small>{t(statusLabel(visualStatus(assignment)))}</small></span>
                    </button>
                    ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </section>

      {createDate ? (
        <div className="schedulerBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateDate(null); }}>
          <CreateAssignmentForm
            accessToken={session.accessToken}
            initialDate={createDate}
            onClose={() => setCreateDate(null)}
            onCreated={handleCreated}
          />
        </div>
      ) : null}

      {editingAssignment ? (
        <div className="schedulerBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingAssignment(null); }}>
          <EditAssignmentForm
            accessToken={session.accessToken}
            assignment={editingAssignment}
            onClose={() => setEditingAssignment(null)}
            onUpdated={handleUpdated}
          />
        </div>
      ) : null}

      {selectedAssignment ? (
        <div className="schedulerBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedAssignment(null); }}>
          <section className="assignmentDetailsDialog" role="dialog" aria-modal="true" aria-labelledby="assignment-details-title">
            <header>
              <div>
                <span className={`assignmentVisualStatus assignmentVisualStatus${visualStatus(selectedAssignment)}`}>{t(statusLabel(visualStatus(selectedAssignment)))}</span>
                <h2 id="assignment-details-title">{selectedAssignment.title}</h2>
                <p>{selectedAssignment.site.client.companyName}</p>
              </div>
              <button type="button" aria-label={t("Close assignment details")} onClick={() => { setSelectedAssignment(null); setShowCancelForm(false); }}>×</button>
            </header>

            <div className="assignmentDetailsGrid">
              <article><span>{t("Schedule")}</span><strong>{fullDateTime(selectedAssignment.startAt)}</strong><small>{t("Until ")}{timeLabel(selectedAssignment.endAt)}</small></article>
              <article><span>{t("Cleaning site")}</span><strong>{selectedAssignment.site.name}</strong><small>{[selectedAssignment.site.addressLine1, selectedAssignment.site.postalCode, selectedAssignment.site.city].filter(Boolean).join(", ")}</small></article>
              <article><span>{t("Departure")}</span><strong>{selectedAssignment.departureAddress ?? t("Not recorded")}</strong><small>{selectedAssignment.travelDistanceMeters ? `${(selectedAssignment.travelDistanceMeters / 1000).toFixed(1)} km route` : t("Distance not calculated")}</small></article>
              <article><span>{t("Estimated travel")}</span><strong>{selectedAssignment.estimatedTravelMinutes ? `${selectedAssignment.estimatedTravelMinutes} minutes` : t("Not calculated")}</strong><small>{t("Driving estimate captured when scheduled")}</small></article>
              <article><span>{t("Cleaning duration")}</span><strong>{assignmentDuration(selectedAssignment.startAt, selectedAssignment.endAt, locale)}</strong><small>{t("Based on the scheduled start and end")}</small></article>
            </div>

            <section className="assignmentDetailsSection">
              <h3>{t("Assigned employees")}</h3>
              {selectedAssignment.employees.length > 0 ? (
                <div className={`assignmentRateList${isAdmin ? "" : " isEmployeeView"}`}>
                  {selectedAssignment.employees.map(({ employee, agreedHourlyRate, rateOverridden }) => (
                    <div key={employee.id}>
                      <span className="employeeAvatar" aria-hidden="true">{employee.firstName.charAt(0)}{employee.lastName.charAt(0)}</span>
                      <span><strong>{employee.firstName} {employee.lastName}</strong><small>{employee.isStudent ? t("Student employee") : t("Employee")}</small></span>
                      {isAdmin ? <span><strong>{agreedHourlyRate ? `€${agreedHourlyRate}/h` : t("Rate not set")}</strong><small>{rateOverridden ? t("Special event rate") : t("Default rate snapshot")}</small></span> : null}
                    </div>
                  ))}
                </div>
              ) : <p>{t("No employees are assigned yet.")}</p>}
            </section>

            <section className="assignmentDetailsSection">
              <h3>{t("Operational details")}</h3>
              <p><strong>{t("Instructions:")}</strong> {selectedAssignment.notes ?? t("No additional instructions")}</p>
              <p><strong>{t("Repetition:")}</strong> {selectedAssignment.recurringTemplateId ? t("Part of a recurring schedule") : t("One-time assignment")}</p>
              {isAdmin ? <p><strong>{t("Client price:")}</strong> {selectedAssignment.clientCharge ? `€${Number(selectedAssignment.clientCharge).toFixed(2)}` : t("Not recorded")}</p> : null}
            </section>

            {showCancelForm ? (
              <section className="assignmentCancelPanel">
                <h3>{t("Choose what should happen")}</h3>
                <div className="cancellationChoices">
                  <label className={cancelMode === "single" ? "isSelected" : ""}><input type="radio" name="cancelMode" checked={cancelMode === "single"} onChange={() => setCancelMode("single")} /><span><strong>{t("Cancel this event only")}</strong><small>{t("Keep it in history with a cancelled status.")}</small></span></label>
                  <label className={cancelMode === "series" ? "isSelected" : ""}><input type="radio" name="cancelMode" checked={cancelMode === "series"} disabled={!selectedAssignment.recurringTemplateId} onChange={() => setCancelMode("series")} /><span><strong>{t("Cancel this and the remaining series")}</strong><small>{selectedAssignment.recurringTemplateId ? t("Past occurrences remain unchanged.") : t("Available only for recurring assignments.")}</small></span></label>
                  <label className={cancelMode === "delete" ? "isSelected isDanger" : "isDanger"}><input type="radio" name="cancelMode" checked={cancelMode === "delete"} onChange={() => setCancelMode("delete")} /><span><strong>{t("Delete this event")}</strong><small>{t("Permanently removes this occurrence and its reporting data.")}</small></span></label>
                </div>
                {cancelMode !== "delete" ? <label>{t("Cancellation reason")}<textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} maxLength={1000} placeholder={t("Explain why this assignment is cancelled")} /></label> : <p className="destructiveWarning">{t("This action cannot be undone.")}</p>}
                <div>
                  <button type="button" onClick={() => { setShowCancelForm(false); setCancelReason(""); setCancelMode("single"); }}>{t("Keep assignment")}</button>
                  <button type="button" disabled={cancelling || (cancelMode !== "delete" && !cancelReason.trim())} onClick={() => void cancelAssignment()}>{cancelling ? t("Working...") : cancelMode === "delete" ? t("Delete permanently") : t("Confirm cancellation")}</button>
                </div>
              </section>
            ) : null}

            <footer>
              {isAdmin && selectedAssignment.status !== "CANCELLED" ? (
                <>
                  <button className="assignmentEditAction" type="button" onClick={() => { setEditingAssignment(selectedAssignment); setSelectedAssignment(null); }}>{t("Edit assignment")}</button>
                  <button className="assignmentCancelAction" type="button" onClick={() => setShowCancelForm(true)}>{t("Cancel assignment")}</button>
                </>
              ) : null}
              <button type="button" onClick={() => { setSelectedAssignment(null); setShowCancelForm(false); }}>{t("Close details")}</button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
