"use client";

import { useDashboardLanguage } from "../dashboard-language";

import { useEffect, useState, type FormEvent } from "react";
import { API_BASE_URL, authenticatedFetch, responseMessage } from "../../lib/auth-client";
import type { Employee, EmployeeListResponse } from "../employees/types";
import {
  isWeekendDateValue,
  WEEKEND_SCHEDULING_MESSAGE,
  WORKING_WEEKDAYS,
} from "./schedule-policy";
import type { UpdateAssignmentResponse, WorkAssignment } from "./types";
import HolidayWarning from "./holiday-warning";

type RepeatMode = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";

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
  const { t } = useDashboardLanguage();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
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
    String(assignment.recurringTemplate?.interval ?? 1),
  );
  const [assignmentDate, setAssignmentDate] = useState(() =>
    localDate(assignment.startAt),
  );
  const [weekdays, setWeekdays] = useState<number[]>(() => {
    const recurringWeekdays =
      assignment.recurringTemplate?.daysOfWeek.filter(
        (weekday) => weekday >= 1 && weekday <= 5,
      ) ?? [];
    if (recurringWeekdays.length > 0) return recurringWeekdays;

    const weekday = new Date(assignment.startAt).getDay();
    return [weekday >= 1 && weekday <= 5 ? weekday : 1];
  });
  const [updateSeries, setUpdateSeries] = useState(false);
  const [repeatUntil, setRepeatUntil] = useState(defaultRepeatUntil);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const weekendSelected = isWeekendDateValue(assignmentDate);
  const filteredEmployees = employees.filter((employee) =>
    `${employee.firstName} ${employee.lastName}`
      .toLocaleLowerCase()
      .includes(employeeSearch.trim().toLocaleLowerCase()),
  );

  useEffect(() => {
    let active = true;
    async function loadEmployees() {
      try {
        const response = await authenticatedFetch(
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

    if (isWeekendDateValue(date)) {
      setError(WEEKEND_SCHEDULING_MESSAGE);
      return;
    }

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
      const response = await authenticatedFetch(`${API_BASE_URL}/assignments/${assignment.id}`, {
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
        const recurrenceResponse = await authenticatedFetch(
          `${API_BASE_URL}/assignments/${assignment.id}/recurrence`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              frequency: repeatMode,
              interval: Number(repeatInterval),
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
        <div><p>{t("Edit assignment")}</p><h2 id="edit-assignment-title">{t("Update scheduled work")}</h2></div>
        <button type="button" aria-label={t("Close editor")} onClick={onClose}>×</button>
      </header>

      <form onSubmit={handleSubmit}>
        <label>{t("Assignment title")}<input name="title" defaultValue={assignment.title} maxLength={200} required /></label>
        <div className="assignmentEditTimeGrid">
          <label>{t("Date")}<input
              name="date"
              type="date"
              value={assignmentDate}
              aria-describedby="edit-assignment-weekday-policy"
              onChange={(event) => {
                setAssignmentDate(event.target.value);
                setError(
                  isWeekendDateValue(event.target.value)
                    ? WEEKEND_SCHEDULING_MESSAGE
                    : "",
                );
              }}
              required
            />
          </label>
          <label>{t("Starts")}<input name="startTime" type="time" defaultValue={localTime(assignment.startAt)} required /></label>
          <label>{t("Ends")}<input name="endTime" type="time" defaultValue={localTime(assignment.endAt)} required /></label>
        </div>
        <small
          className={`weekdayPolicyHint${weekendSelected ? " isError" : ""}`}
          id="edit-assignment-weekday-policy"
        >
          {weekendSelected
            ? WEEKEND_SCHEDULING_MESSAGE
            : t("Scheduling is available Monday to Friday. Weekend dates cannot be saved.")}
        </small>
        <div className="assignmentEditContext">
          <span>{t("Client")}<strong>{assignment.site.client.companyName}</strong></span>
          <span>{t("Cleaning site")}<strong>{assignment.site.name}</strong></span>
        </div>
        <label className="assignmentClientCharge">{t("Client price per occurrence (€)")}<input name="clientCharge" type="number" min="0" step="0.01" defaultValue={assignment.clientCharge ?? ""} placeholder="0.00" required /></label>

        <fieldset className="recurrenceEditor">
          <legend>{t("Repetition")}</legend>
          {assignment.recurringTemplate ? (
            <label className="seriesScopeToggle">
              <input type="checkbox" checked={updateSeries} onChange={(event) => setUpdateSeries(event.target.checked)} />
              <span><strong>{t("Update the remaining recurring series")}</strong><small>{t("When off, only this calendar occurrence is changed.")}</small></span>
            </label>
          ) : null}
          <label>{t("Repeats")}<select value={repeatMode} disabled={Boolean(assignment.recurringTemplate) && !updateSeries} onChange={(event) => setRepeatMode(event.target.value as RepeatMode)}>
              {!assignment.recurringTemplate ? <option value="NONE">{t("Does not repeat")}</option> : null}
              <option value="DAILY">{t("Daily")}</option>
              <option value="WEEKLY">{t("Weekly")}</option>
              <option value="MONTHLY">{t("Monthly")}</option>
            </select>
          </label>
          {repeatMode !== "NONE" ? (
            <div className="recurrenceRuleGrid">
              <label>{t("Every")}<input type="number" min="1" max="52" value={repeatInterval} disabled={Boolean(assignment.recurringTemplate) && !updateSeries} onChange={(event) => setRepeatInterval(event.target.value)} required /></label>
              <span>{repeatMode === "DAILY" ? t("day(s)") : repeatMode === "WEEKLY" ? t("week(s)") : t("month(s)")}</span>
              <label>{t("Ends on")}<input name="repeatUntil" type="date" min={assignmentDate} value={repeatUntil} onChange={(event) => setRepeatUntil(event.target.value)} disabled={Boolean(assignment.recurringTemplate) && !updateSeries} required={!assignment.recurringTemplate || updateSeries} /></label>
            </div>
          ) : null}
          {repeatMode === "WEEKLY" ? (
            <div className="recurrenceWeekdays" aria-label={t("Repeat on weekdays")}>
              {WORKING_WEEKDAYS.map((day) => <button type="button" key={day.value} aria-label={t(day.name)} disabled={Boolean(assignment.recurringTemplate) && !updateSeries} className={weekdays.includes(day.value) ? "isSelected" : ""} onClick={() => toggleWeekday(day.value)}>{t(day.name).slice(0, 2)}</button>)}
            </div>
          ) : null}
          {repeatMode !== "NONE" ? (
            <small className="recurrenceWeekendHint">{t("Saturday and Sunday occurrences are skipped automatically.")}</small>
          ) : null}
        </fieldset>

        <HolidayWarning date={assignmentDate} frequency={assignment.recurringTemplate && !updateSeries ? "NONE" : repeatMode} interval={Number(repeatInterval)} until={repeatUntil} weekdays={weekdays} />

        <fieldset className="assignmentTeamEditor">
          <legend>{t("Assigned employees")}</legend>
          <p>{selectedIds.length}{t(" selected · Add or remove employees and adjust their rate.")}</p>
          <input className="assignmentEmployeeSearch" type="search" aria-label={t("Search employees")} placeholder={t("Search by employee name")} value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} />
          {loadingEmployees ? <small>{t("Loading employees…")}</small> : null}
          <div className="assignmentTeamList">
            {filteredEmployees.map((employee) => {
              const selected = selectedIds.includes(employee.id);
              return (
                <article className={selected ? "isSelected" : ""} key={employee.id}>
                  <label>
                    <input type="checkbox" checked={selected} onChange={() => toggleEmployee(employee.id)} />
                    <span><strong>{employee.firstName} {employee.lastName}</strong><small>{employee.isStudent ? t("Student · 10h/week · 40h/month") : employee.hourlyRate ? `€${employee.hourlyRate}/h ${t("default")}` : t("No default rate")}</small></span>
                  </label>
                  {selected ? (
                    <input aria-label={`Special hourly rate for ${employee.firstName} ${employee.lastName}`} type="number" min="0" step="0.01" value={rates[employee.id] ?? ""} onChange={(event) => setRates((current) => ({ ...current, [employee.id]: event.target.value }))} placeholder={t("Special rate (optional)")} />
                  ) : null}
                </article>
              );
            })}
            {!loadingEmployees && filteredEmployees.length === 0 ? <p>{t("No matching employees.")}</p> : null}
          </div>
        </fieldset>

        <label>{t("Instructions")}<textarea name="notes" rows={5} maxLength={5000} defaultValue={assignment.notes ?? ""} /></label>
        {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}
        <footer>
          <button type="button" onClick={onClose}>{t("Cancel")}</button>
          <button type="submit" disabled={submitting || loadingEmployees || weekendSelected}>{submitting ? t("Saving...") : t("Save changes")}</button>
        </footer>
      </form>
    </section>
  );
}
