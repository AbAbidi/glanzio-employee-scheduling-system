"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  API_BASE_URL,
  responseMessage,
  restoreSession,
  type AuthenticationResult,
} from "../../lib/auth-client";
import DashboardShellHeader from "../dashboard-shell-header";
import CreateAssignmentForm from "./create-assignment-form";
import EditAssignmentForm from "./edit-assignment-form";
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

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function fullDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

function assignmentDuration(startAt: string, endAt: string) {
  const minutes = Math.max(
    0,
    Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000),
  );
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes} minutes`;
  if (remainingMinutes === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours}h ${remainingMinutes}min`;
}

type VisualStatus = "completed" | "pending" | "cancelled" | "active";

function visualStatus(assignment: WorkAssignment): VisualStatus {
  if (assignment.status === "CANCELLED") return "cancelled";
  const now = Date.now();
  if (new Date(assignment.endAt).getTime() <= now) return "completed";
  if (new Date(assignment.startAt).getTime() <= now) return "active";
  return "pending";
}

function statusLabel(status: VisualStatus) {
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "active") return "In progress";
  return "Pending";
}

function assignmentAccent(id: string) {
  const colors = ["#6366f1", "#0ea5e9", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
  const total = Array.from(id).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return colors[total % colors.length];
}

export default function AssignmentsPage() {
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
        const response = await fetch(`${API_BASE_URL}/calendar?${query}`, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        });

        if (!response.ok) throw new Error(await responseMessage(response));
        const result = (await response.json()) as AssignmentListResponse;
        if (active) setAssignments(result.items);
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
  }, [session, month, refreshVersion]);

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
          ? `Assignment created with ${warnings.length} student-hour warning${warnings.length === 1 ? "" : "s"}.`
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
      const response = await fetch(endpoint, {
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
    return <main className="managementGate">Preparing the calendar...</main>;
  }

  if (access === "signed-out" || !session) {
    return (
      <main className="managementGate">
        <h1>Sign in required</h1>
        <p>You must sign in to view assignments.</p>
        <Link href="/login">Go to sign in</Link>
      </main>
    );
  }

  const isAdmin = session.user.role === "ADMIN";

  return (
    <main className="calendarWorkspace">
      <DashboardShellHeader email={session.user.email} role={session.user.role} />

      <section className="calendarIntro">
        <div>
          <p>Operations calendar</p>
          <h1>Plan every clean with confidence.</h1>
          <span>Choose a day, build the route and align the right team.</span>
        </div>
        {isAdmin ? (
          <button type="button" onClick={() => setCreateDate(dateKey(new Date()))}>
            <span aria-hidden="true">＋</span> New assignment
          </button>
        ) : null}
      </section>

      <section className="calendarStatusStrip" aria-label="Assignment status guide">
        <div><i className="statusDot statusDotCompleted" /><span>Completed</span><strong>{assignments.filter((assignment) => visualStatus(assignment) === "completed").length}</strong></div>
        <div><i className="statusDot statusDotPending" /><span>Pending</span><strong>{assignments.filter((assignment) => visualStatus(assignment) === "pending").length}</strong></div>
        <div><i className="statusDot statusDotActive" /><span>In progress</span><strong>{assignments.filter((assignment) => visualStatus(assignment) === "active").length}</strong></div>
        <div><i className="statusDot statusDotCancelled" /><span>Cancelled</span><strong>{assignments.filter((assignment) => visualStatus(assignment) === "cancelled").length}</strong></div>
      </section>

      {notice ? (
        <button className="calendarNotice" type="button" onClick={() => setNotice("")}>
          {notice}<span aria-hidden="true">×</span>
        </button>
      ) : null}

      <section className="calendarCard">
        <header className="calendarToolbar">
          <div>
            <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>←</button>
            <button type="button" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</button>
            <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>→</button>
          </div>
          <h2>{new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(month)}</h2>
          <span>{loading ? "Updating..." : `${assignments.length} scheduled`}</span>
        </header>

        {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}

        <div className="calendarWeekdays" aria-hidden="true">
          {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
        </div>

        <div className="monthCalendar" aria-label="Assignment calendar">
          {days.map((day) => {
            const key = dateKey(day);
            const dayEvents = eventsByDay.get(key) ?? [];
            const isCurrentMonth = day.getMonth() === month.getMonth();
            const isToday = key === dateKey(new Date());

            return (
              <div
                className={`calendarDay${isCurrentMonth ? "" : " isOutside"}${isToday ? " isToday" : ""}`}
                key={key}
              >
                <button
                  className="calendarDayNumber"
                  type="button"
                  disabled={!isAdmin}
                  aria-label={isAdmin ? `Create assignment on ${day.toDateString()}` : day.toDateString()}
                  onClick={() => setCreateDate(key)}
                >
                  {day.getDate()}
                </button>

                <div className="calendarDayEvents">
                  {dayEvents.slice(0, 3).map((assignment) => (
                    <button
                      className={`calendarEvent calendarEvent${visualStatus(assignment)}`}
                      key={assignment.id}
                      type="button"
                      style={{ "--event-accent": assignmentAccent(assignment.id) } as CSSProperties}
                      onClick={() => { setSelectedAssignment(assignment); setShowCancelForm(false); setCancelReason(""); }}
                    >
                      <i aria-hidden="true" />
                      <time>{timeLabel(assignment.startAt)}</time>
                      <span><strong>{assignment.title}</strong><small>{statusLabel(visualStatus(assignment))}</small></span>
                    </button>
                  ))}
                  {dayEvents.length > 3 ? <small>+{dayEvents.length - 3} more</small> : null}
                </div>
              </div>
            );
          })}
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
                <span className={`assignmentVisualStatus assignmentVisualStatus${visualStatus(selectedAssignment)}`}>{statusLabel(visualStatus(selectedAssignment))}</span>
                <h2 id="assignment-details-title">{selectedAssignment.title}</h2>
                <p>{selectedAssignment.site.client.companyName}</p>
              </div>
              <button type="button" aria-label="Close assignment details" onClick={() => { setSelectedAssignment(null); setShowCancelForm(false); }}>×</button>
            </header>

            <div className="assignmentDetailsGrid">
              <article><span>Schedule</span><strong>{fullDateTime(selectedAssignment.startAt)}</strong><small>Until {timeLabel(selectedAssignment.endAt)}</small></article>
              <article><span>Cleaning site</span><strong>{selectedAssignment.site.name}</strong><small>{[selectedAssignment.site.addressLine1, selectedAssignment.site.postalCode, selectedAssignment.site.city].filter(Boolean).join(", ")}</small></article>
              <article><span>Departure</span><strong>{selectedAssignment.departureAddress ?? "Not recorded"}</strong><small>{selectedAssignment.travelDistanceMeters ? `${(selectedAssignment.travelDistanceMeters / 1000).toFixed(1)} km route` : "Distance not calculated"}</small></article>
              <article><span>Estimated travel</span><strong>{selectedAssignment.estimatedTravelMinutes ? `${selectedAssignment.estimatedTravelMinutes} minutes` : "Not calculated"}</strong><small>Driving estimate captured when scheduled</small></article>
              <article><span>Cleaning duration</span><strong>{assignmentDuration(selectedAssignment.startAt, selectedAssignment.endAt)}</strong><small>Based on the scheduled start and end</small></article>
            </div>

            <section className="assignmentDetailsSection">
              <h3>Assigned employees</h3>
              {selectedAssignment.employees.length > 0 ? (
                <div className="assignmentRateList">
                  {selectedAssignment.employees.map(({ employee, agreedHourlyRate, rateOverridden }) => (
                    <div key={employee.id}>
                      <span className="employeeAvatar" aria-hidden="true">{employee.firstName.charAt(0)}{employee.lastName.charAt(0)}</span>
                      <span><strong>{employee.firstName} {employee.lastName}</strong><small>{employee.isStudent ? "Student employee" : "Employee"}</small></span>
                      <span><strong>{agreedHourlyRate ? `€${agreedHourlyRate}/h` : "Rate not set"}</strong><small>{rateOverridden ? "Special event rate" : "Default rate snapshot"}</small></span>
                    </div>
                  ))}
                </div>
              ) : <p>No employees are assigned yet.</p>}
            </section>

            <section className="assignmentDetailsSection">
              <h3>Operational details</h3>
              <p><strong>Instructions:</strong> {selectedAssignment.notes ?? "No additional instructions"}</p>
              <p><strong>Repetition:</strong> {selectedAssignment.recurringTemplateId ? "Part of a recurring schedule" : "One-time assignment"}</p>
              <p><strong>Client price:</strong> {selectedAssignment.clientCharge ? `€${Number(selectedAssignment.clientCharge).toFixed(2)}` : "Not recorded"}</p>
            </section>

            {showCancelForm ? (
              <section className="assignmentCancelPanel">
                <h3>Choose what should happen</h3>
                <div className="cancellationChoices">
                  <label className={cancelMode === "single" ? "isSelected" : ""}><input type="radio" name="cancelMode" checked={cancelMode === "single"} onChange={() => setCancelMode("single")} /><span><strong>Cancel this event only</strong><small>Keep it in history with a cancelled status.</small></span></label>
                  <label className={cancelMode === "series" ? "isSelected" : ""}><input type="radio" name="cancelMode" checked={cancelMode === "series"} disabled={!selectedAssignment.recurringTemplateId} onChange={() => setCancelMode("series")} /><span><strong>Cancel this and the remaining series</strong><small>{selectedAssignment.recurringTemplateId ? "Past occurrences remain unchanged." : "Available only for recurring assignments."}</small></span></label>
                  <label className={cancelMode === "delete" ? "isSelected isDanger" : "isDanger"}><input type="radio" name="cancelMode" checked={cancelMode === "delete"} onChange={() => setCancelMode("delete")} /><span><strong>Delete this event</strong><small>Permanently removes this occurrence and its reporting data.</small></span></label>
                </div>
                {cancelMode !== "delete" ? <label>Cancellation reason<textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} maxLength={1000} placeholder="Explain why this assignment is cancelled" /></label> : <p className="destructiveWarning">This action cannot be undone.</p>}
                <div>
                  <button type="button" onClick={() => { setShowCancelForm(false); setCancelReason(""); setCancelMode("single"); }}>Keep assignment</button>
                  <button type="button" disabled={cancelling || (cancelMode !== "delete" && !cancelReason.trim())} onClick={() => void cancelAssignment()}>{cancelling ? "Working..." : cancelMode === "delete" ? "Delete permanently" : "Confirm cancellation"}</button>
                </div>
              </section>
            ) : null}

            <footer>
              {isAdmin && selectedAssignment.status !== "CANCELLED" ? (
                <>
                  <button className="assignmentEditAction" type="button" onClick={() => { setEditingAssignment(selectedAssignment); setSelectedAssignment(null); }}>Edit assignment</button>
                  <button className="assignmentCancelAction" type="button" onClick={() => setShowCancelForm(true)}>Cancel assignment</button>
                </>
              ) : null}
              <button type="button" onClick={() => { setSelectedAssignment(null); setShowCancelForm(false); }}>Close details</button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
