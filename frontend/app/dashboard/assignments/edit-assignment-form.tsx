"use client";

import { useEffect, useState, type FormEvent } from "react";
import { API_BASE_URL, responseMessage } from "../../lib/auth-client";
import type { Employee, EmployeeListResponse } from "../employees/types";
import type { UpdateAssignmentResponse, WorkAssignment } from "./types";

type RepeatMode = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
const WEEKDAYS = [
  { value: 1, label: "M" },
  { value: 2, label: "T" },
  { value: 3, label: "W" },
  { value: 4, label: "T" },
  { value: 5, label: "F" },
  { value: 6, label: "S" },
  { value: 7, label: "S" },
];

type EditAssignmentFormProps = {
  accessToken: string;
  assignment: WorkAssignment;
  onClose: () => void;
  onUpdated: (assignment: WorkAssignment) => void;
};

function localDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localTime(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function EditAssignmentForm({
  accessToken,
  assignment,
  onClose,
  onUpdated,
}: EditAssignmentFormProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedIds, setSelectedIds] = useState(() =>
    assignment.employees.map((link) => link.employeeId),
  );
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      assignment.employees.map((link) => [
        link.employeeId,
        link.rateOverridden ? link.agreedHourlyRate ?? "" : "",
      ]),
    ),
  );
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(
    assignment.recurringTemplate?.frequency ?? "NONE",
  );
  const [repeatInterval, setRepeatInterval] = useState(
    assignment.recurringTemplate?.interval ?? 1,
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    assignment.recurringTemplate?.daysOfWeek.length
      ? assignment.recurringTemplate.daysOfWeek
      : [new Date(assignment.startAt).getDay() || 7],
  );
  const [updateSeries, setUpdateSeries] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadEmployees() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/employees?active=true&page=1&pageSize=100`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!response.ok) throw new Error(await responseMessage(response));
        const result = (await response.json()) as EmployeeListResponse;
        if (active) {
          setEmployees(
            result.items.filter((employee) => employee.user.status === "ACTIVE"),
          );
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Employees could not be loaded.",
          );
        }
      } finally {
        if (active) setLoadingEmployees(false);
      }
    }
    void loadEmployees();
    return () => {
      active = false;
    };
  }, [accessToken]);

  function toggleEmployee(employeeId: string) {
    setSelectedIds((current) =>
      current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId],
    );
  }

  function toggleWeekday(day: number) {
    setWeekdays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort(),
    );
  }

  function defaultRepeatUntil() {
    if (assignment.recurringTemplate?.untilAt) {
      return localDate(assignment.recurringTemplate.untilAt);
    }
    const date = new Date(assignment.startAt);
    date.setMonth(date.getMonth() + 1);
    return localDate(date.toISOString());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const date = String(formData.get("date") ?? "");
    const startTime = String(formData.get("startTime") ?? "");
    const endTime = String(formData.get("endTime") ?? "");
    const startAt = new Date(`${date}T${startTime}:00`);
    const endAt = new Date(`${date}T${endTime}:00`);

    if (endAt <= startAt) {
      setError("The end time must be later than the start time.");
      return;
    }
    if (
      repeatMode === "WEEKLY" &&
      (!assignment.recurringTemplate || updateSeries) &&
      weekdays.length === 0
    ) {
      setError("Select at least one weekday for weekly repetition.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/assignments/${assignment.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: String(formData.get("title") ?? "").trim(),
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          notes: String(formData.get("notes") ?? "").trim(),
          clientCharge: Number(formData.get("clientCharge") ?? 0),
          employees: selectedIds.map((employeeId) => ({
            employeeId,
            ...(rates[employeeId]?.trim()
              ? { hourlyRate: Number(rates[employeeId]) }
              : {}),
          })),
        }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const result = (await response.json()) as UpdateAssignmentResponse;
      let updatedAssignment = result.assignment;

      const shouldSaveRecurrence =
        repeatMode !== "NONE" &&
        (!assignment.recurringTemplate || updateSeries);
      if (shouldSaveRecurrence) {
        const repeatUntil = String(formData.get("repeatUntil") ?? "");
        const recurrenceResponse = await fetch(
          `${API_BASE_URL}/assignments/${assignment.id}/recurrence`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              frequency: repeatMode,
              interval: repeatInterval,
              daysOfWeek: repeatMode === "WEEKLY" ? weekdays : [],
              untilAt: new Date(`${repeatUntil}T23:59:59`).toISOString(),
            }),
          },
        );
        if (!recurrenceResponse.ok) {
          throw new Error(await responseMessage(recurrenceResponse));
        }
        const recurrenceResult = (await recurrenceResponse.json()) as {
          assignment: WorkAssignment;
          generatedAssignmentCount: number;
        };
        updatedAssignment = recurrenceResult.assignment;
      }

      onUpdated(updatedAssignment);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The assignment could not be updated.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="assignmentEditDialog" role="dialog" aria-modal="true" aria-labelledby="edit-assignment-title">
      <header>
        <div><p>Edit assignment</p><h2 id="edit-assignment-title">Update scheduled work</h2></div>
        <button type="button" aria-label="Close editor" onClick={onClose}>×</button>
      </header>

      <form onSubmit={handleSubmit}>
        <label>Assignment title<input name="title" defaultValue={assignment.title} maxLength={200} required /></label>
        <div className="assignmentEditTimeGrid">
          <label>Date<input name="date" type="date" defaultValue={localDate(assignment.startAt)} required /></label>
          <label>Starts<input name="startTime" type="time" defaultValue={localTime(assignment.startAt)} required /></label>
          <label>Ends<input name="endTime" type="time" defaultValue={localTime(assignment.endAt)} required /></label>
        </div>
        <div className="assignmentEditContext">
          <span>Client<strong>{assignment.site.client.companyName}</strong></span>
          <span>Cleaning site<strong>{assignment.site.name}</strong></span>
        </div>
        <label className="assignmentClientCharge">Client price per occurrence (€)<input name="clientCharge" type="number" min="0" step="0.01" defaultValue={assignment.clientCharge ?? ""} placeholder="0.00" required /></label>

        <fieldset className="recurrenceEditor">
          <legend>Repetition</legend>
          {assignment.recurringTemplate ? (
            <label className="seriesScopeToggle">
              <input type="checkbox" checked={updateSeries} onChange={(event) => setUpdateSeries(event.target.checked)} />
              <span><strong>Update the remaining recurring series</strong><small>When off, only this calendar occurrence is changed.</small></span>
            </label>
          ) : null}
          <label>
            Repeats
            <select value={repeatMode} disabled={Boolean(assignment.recurringTemplate) && !updateSeries} onChange={(event) => setRepeatMode(event.target.value as RepeatMode)}>
              {!assignment.recurringTemplate ? <option value="NONE">Does not repeat</option> : null}
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </label>
          {repeatMode !== "NONE" ? (
            <div className="recurrenceRuleGrid">
              <label>Every<input type="number" min="1" max="52" value={repeatInterval} disabled={Boolean(assignment.recurringTemplate) && !updateSeries} onChange={(event) => setRepeatInterval(Number(event.target.value))} /></label>
              <span>{repeatMode === "DAILY" ? "day(s)" : repeatMode === "WEEKLY" ? "week(s)" : "month(s)"}</span>
              <label>Ends on<input name="repeatUntil" type="date" min={localDate(assignment.startAt)} defaultValue={defaultRepeatUntil()} disabled={Boolean(assignment.recurringTemplate) && !updateSeries} required={!assignment.recurringTemplate || updateSeries} /></label>
            </div>
          ) : null}
          {repeatMode === "WEEKLY" ? (
            <div className="recurrenceWeekdays" aria-label="Repeat on weekdays">
              {WEEKDAYS.map((day) => <button type="button" key={day.value} disabled={Boolean(assignment.recurringTemplate) && !updateSeries} className={weekdays.includes(day.value) ? "isSelected" : ""} onClick={() => toggleWeekday(day.value)}>{day.label}</button>)}
            </div>
          ) : null}
        </fieldset>

        <fieldset className="assignmentTeamEditor">
          <legend>Assigned employees</legend>
          <p>Add or remove employees. A special rate applies only to this assignment.</p>
          {loadingEmployees ? <small>Loading employees…</small> : null}
          <div className="assignmentTeamGrid">
            {employees.map((employee) => {
              const selected = selectedIds.includes(employee.id);
              return (
                <article className={selected ? "isSelected" : ""} key={employee.id}>
                  <label>
                    <input type="checkbox" checked={selected} onChange={() => toggleEmployee(employee.id)} />
                    <span><strong>{employee.firstName} {employee.lastName}</strong><small>{employee.isStudent ? "Student · 80h/month" : employee.hourlyRate ? `€${employee.hourlyRate}/h default` : "No default rate"}</small></span>
                  </label>
                  {selected ? (
                    <input aria-label={`Special hourly rate for ${employee.firstName} ${employee.lastName}`} type="number" min="0" step="0.01" value={rates[employee.id] ?? ""} onChange={(event) => setRates((current) => ({ ...current, [employee.id]: event.target.value }))} placeholder="Special rate (optional)" />
                  ) : null}
                </article>
              );
            })}
          </div>
        </fieldset>

        <label>Instructions<textarea name="notes" rows={5} maxLength={5000} defaultValue={assignment.notes ?? ""} /></label>
        {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}
        <footer>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={submitting || loadingEmployees}>{submitting ? "Saving..." : "Save changes"}</button>
        </footer>
      </form>
    </section>
  );
}
