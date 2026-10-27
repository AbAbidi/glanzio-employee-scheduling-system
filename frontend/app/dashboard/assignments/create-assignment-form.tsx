"use client";

import { useDashboardLanguage } from "../dashboard-language";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  API_BASE_URL, authenticatedFetch,
  responseMessage,
} from "../../lib/auth-client";
import type {
  Client,
  ClientListItem,
  ClientListResponse,
} from "../clients/types";
import type {
  Employee,
  EmployeeListResponse,
} from "../employees/types";
import type {
  CleaningSite,
  CreateSiteInput,
  SiteListResponse,
} from "../sites/types";
import type {
  AssignmentEmployeeInput,
  CreateAssignmentInput,
  CreateAssignmentResponse,
  CreateRecurringAssignmentInput,
  MapLocation,
  RecurringAssignmentResponse,
  RoutePreview,
  StudentHourWarning,
  WorkAssignment,
} from "./types";
import LocationMap from "./location-map";
import HolidayWarning from "./holiday-warning";

type CreateAssignmentFormProps = {
  accessToken: string;
  initialDate: string;
  onClose: () => void;
  onCreated: (
    assignment: WorkAssignment | null,
    warnings: StudentHourWarning[],
    recurringCount?: number,
  ) => void;
};

type SiteMode = "existing" | "new";
type RepeatMode = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";

const WEEKDAYS = [
  { value: 1, label: "M", name: "Monday" },
  { value: 2, label: "T", name: "Tuesday" },
  { value: 3, label: "W", name: "Wednesday" },
  { value: 4, label: "T", name: "Thursday" },
  { value: 5, label: "F", name: "Friday" },
];

function isWeekendDate(value: string) {
  if (!value) return false;
  const day = new Date(`${value}T12:00:00`).getDay();
  return day === 0 || day === 6;
}

function siteAddress(site: CleaningSite) {
  return [
    site.addressLine1,
    site.addressLine2,
    site.postalCode,
    site.city,
    site.countryCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function inputText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export default function CreateAssignmentForm({
  accessToken,
  initialDate,
  onClose,
  onCreated,
}: CreateAssignmentFormProps) {
  const { t } = useDashboardLanguage();
  const [sites, setSites] = useState<CleaningSite[]>([]);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [specialRates, setSpecialRates] = useState<Record<string, string>>({});
  const [siteMode, setSiteMode] = useState<SiteMode>("existing");
  const [newClientId, setNewClientId] = useState("");
  const [showClientDialog, setShowClientDialog] = useState(false);
  const clientDialogRef = useRef<HTMLElement>(null);
  const [clientSubmitting, setClientSubmitting] = useState(false);
  const [clientError, setClientError] = useState("");
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("NONE");
  const [repeatInterval, setRepeatInterval] = useState("1");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [assignmentDate, setAssignmentDate] = useState(initialDate);
  const [weekdays, setWeekdays] = useState<number[]>(() => {
    const weekday = new Date(`${initialDate}T12:00:00`).getDay();
    return [weekday === 0 ? 7 : weekday];
  });
  const [newSiteLocation, setNewSiteLocation] =
    useState<MapLocation | null>(null);
  const [departureLocation, setDepartureLocation] =
    useState<MapLocation | null>(null);
  const [savedSiteLocation, setSavedSiteLocation] =
    useState<MapLocation | null>(null);
  const [mapRoute, setMapRoute] = useState<RoutePreview | null>(null);
  const [savedSiteLocationError, setSavedSiteLocationError] = useState("");
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const selectedDateIsWeekend = isWeekendDate(assignmentDate);

  useEffect(() => {
    if (!showClientDialog) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = clientDialogRef.current;
    const getControls = () => Array.from(
      dialog?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
      ) ?? [],
    );
    dialog?.querySelector<HTMLInputElement>('input[name="clientCompanyName"]')?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setShowClientDialog(false);
      }
      if (event.key !== "Tab") return;
      const controls = getControls();
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      previousFocus?.focus();
    };
  }, [showClientDialog]);

  useEffect(() => {
    let isActive = true;

    async function loadOptions() {
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };
        const [sitesResponse, clientsResponse, employeesResponse] =
          await Promise.all([
            authenticatedFetch(`${API_BASE_URL}/sites?active=true&page=1&pageSize=100`, { headers }),
            authenticatedFetch(`${API_BASE_URL}/clients?active=true&page=1&pageSize=100`, { headers }),
            authenticatedFetch(`${API_BASE_URL}/employees?active=true&page=1&pageSize=100`, { headers }),
          ]);

        for (const response of [sitesResponse, clientsResponse, employeesResponse]) {
          if (!response.ok) throw new Error(await responseMessage(response));
        }

        const [siteResult, clientResult, employeeResult] = await Promise.all([
          sitesResponse.json() as Promise<SiteListResponse>,
          clientsResponse.json() as Promise<ClientListResponse>,
          employeesResponse.json() as Promise<EmployeeListResponse>,
        ]);

        if (isActive) {
          setSites(siteResult.items);
          setClients(clientResult.items);
          setEmployees(
            employeeResult.items.filter(
              (employee) => employee.user.status === "ACTIVE",
            ),
          );
          setSelectedSiteId(siteResult.items[0]?.id ?? "");
          if (siteResult.items.length === 0) setSiteMode("new");
        }
      } catch (requestError) {
        if (isActive) {
          setOptionsError(
            requestError instanceof Error
              ? requestError.message
              : "The scheduling options could not be loaded.",
          );
        }
      } finally {
        if (isActive) setOptionsLoading(false);
      }
    }

    void loadOptions();
    return () => {
      isActive = false;
    };
  }, [accessToken]);

  useEffect(() => {
    let active = true;

    async function locateSavedSite() {
      if (siteMode !== "existing") return;

      const site = sites.find((candidate) => candidate.id === selectedSiteId);
      if (!site) {
        if (active) setSavedSiteLocation(null);
        return;
      }

      const latitude = Number(site.latitude);
      const longitude = Number(site.longitude);
      if (
        site.latitude !== null &&
        site.longitude !== null &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
      ) {
        if (!active) return;
        setSavedSiteLocation({
          latitude,
          longitude,
          displayName: siteAddress(site),
          siteName: site.name,
          addressLine1: site.addressLine1,
          city: site.city,
          countryCode: site.countryCode,
        });
        setSavedSiteLocationError("");
        return;
      }

      setSavedSiteLocation(null);
      setSavedSiteLocationError("");

      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/calendar/location-search`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: siteAddress(site) }),
        });

        if (!response.ok) throw new Error(await responseMessage(response));
        const coordinate = (await response.json()) as Pick<
          MapLocation,
          "latitude" | "longitude" | "displayName"
        >;
        if (!active) return;
        setSavedSiteLocation({
          ...coordinate,
          siteName: site.name,
          addressLine1: site.addressLine1,
          city: site.city,
          countryCode: site.countryCode,
        });
      } catch (requestError) {
        if (!active) return;
        setSavedSiteLocationError(
          requestError instanceof Error
            ? requestError.message
            : "The saved destination could not be placed on the map.",
        );
      }
    }

    void locateSavedSite();
    return () => {
      active = false;
    };
  }, [accessToken, selectedSiteId, siteMode, sites]);

  function toggleEmployee(employeeId: string) {
    setSelectedEmployeeIds((current) =>
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

  async function estimateRoute(
    origin: MapLocation,
    destination: MapLocation,
  ): Promise<RoutePreview> {
    const response = await authenticatedFetch(`${API_BASE_URL}/calendar/route-preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        originAddress: origin.displayName,
        originLatitude: origin.latitude,
        originLongitude: origin.longitude,
        destinationAddress: destination.displayName,
        destinationLatitude: destination.latitude,
        destinationLongitude: destination.longitude,
      }),
    });

    if (!response.ok) throw new Error(await responseMessage(response));
    return (await response.json()) as RoutePreview;
  }

  async function createSite(formData: FormData): Promise<CleaningSite> {
    if (!newSiteLocation) {
      throw new Error("Search for a location or select one directly on the map.");
    }

    const clientId = inputText(formData, "newClientId");
    const companyName = clients.find(
      (candidate) => candidate.id === clientId,
    )?.companyName;

    if (!clientId || !companyName) {
      throw new Error("Select the client for this cleaning site.");
    }

    const input: CreateSiteInput = {
      clientId,
      name: `${companyName} - ${newSiteLocation.siteName}`.slice(0, 200),
      addressLine1: newSiteLocation.addressLine1,
      city: newSiteLocation.city,
      countryCode: newSiteLocation.countryCode,
      latitude: newSiteLocation.latitude,
      longitude: newSiteLocation.longitude,
      requiredEquipment: [],
    };

    const response = await authenticatedFetch(`${API_BASE_URL}/sites`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) throw new Error(await responseMessage(response));
    return (await response.json()) as CleaningSite;
  }

  async function handleCreateClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const companyName = inputText(formData, "clientCompanyName");

    if (!companyName) {
      setClientError("Enter the new client's company name.");
      return;
    }

    setClientSubmitting(true);
    setClientError("");

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/clients`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName,
          contactName: inputText(formData, "clientContactName") || undefined,
          email: inputText(formData, "clientEmail") || undefined,
          phone: inputText(formData, "clientPhone") || undefined,
        }),
      });

      if (!response.ok) throw new Error(await responseMessage(response));
      const client = (await response.json()) as Client;
      setClients((current) => [{ ...client, _count: { sites: 0 } }, ...current]);
      setNewClientId(client.id);
      setShowClientDialog(false);
      form.reset();
    } catch (requestError) {
      setClientError(
        requestError instanceof Error
          ? requestError.message
          : "The client could not be created.",
      );
    } finally {
      setClientSubmitting(false);
    }
  }

  function employeeInputs(): AssignmentEmployeeInput[] {
    return selectedEmployeeIds.map((employeeId) => {
      const specialRate = specialRates[employeeId]?.trim();
      return {
        employeeId,
        ...(specialRate ? { hourlyRate: Number(specialRate) } : {}),
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const date = inputText(formData, "assignmentDate");
    const startTime = inputText(formData, "startTime");
    const endTime = inputText(formData, "endTime");
    const startAt = new Date(`${date}T${startTime}:00`);
    const endAt = new Date(`${date}T${endTime}:00`);

    if (endAt <= startAt) {
      setError("The end time must be later than the start time.");
      return;
    }

    if (isWeekendDate(date)) {
      setError("Assignments cannot be scheduled on Saturday or Sunday.");
      return;
    }

    if (repeatMode === "WEEKLY" && weekdays.length === 0) {
      setError("Select at least one weekday for weekly repetition.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const savedSite = sites.find(
        (candidate) => candidate.id === selectedSiteId,
      );
      if (siteMode === "existing" && !savedSite) {
        throw new Error("Select a saved cleaning site.");
      }
      if (siteMode === "new" && !newSiteLocation) {
        throw new Error("Search for a location or select one directly on the map.");
      }
      if (!departureLocation) {
        throw new Error("Select the starting point on the map.");
      }

      const destinationLocation =
        siteMode === "new" ? newSiteLocation : savedSiteLocation;
      if (!destinationLocation) {
        throw new Error("Wait for the saved destination to appear on the map.");
      }

      const route =
        mapRoute ??
        (await estimateRoute(departureLocation, destinationLocation));
      const site = siteMode === "new" ? await createSite(formData) : savedSite!;
      const travelInput = {
        departureAddress: route.originAddress,
        departureLatitude: route.originLatitude,
        departureLongitude: route.originLongitude,
        travelDistanceMeters: route.travelDistanceMeters,
        estimatedTravelMinutes: route.estimatedTravelMinutes,
      };
      const notes = inputText(formData, "notes");
      const common = {
        siteId: site.id,
        title: inputText(formData, "title"),
        clientCharge: Number(formData.get("clientCharge") ?? 0),
        notes: notes || undefined,
        employees: employeeInputs(),
        ...travelInput,
      };

      if (repeatMode === "NONE") {
        const input: CreateAssignmentInput = {
          ...common,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          status: "SCHEDULED",
        };
        const response = await authenticatedFetch(`${API_BASE_URL}/assignments`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        });

        if (!response.ok) throw new Error(await responseMessage(response));
        const result = (await response.json()) as CreateAssignmentResponse;
        onCreated(result.assignment, result.studentWarnings);
      } else {
        const durationMinutes = Math.round(
          (endAt.getTime() - startAt.getTime()) / 60000,
        );
        const input: CreateRecurringAssignmentInput = {
          ...common,
          frequency: repeatMode,
          interval: Number(formData.get("repeatInterval") ?? 1),
          daysOfWeek: repeatMode === "WEEKLY" ? weekdays : [],
          firstStartAt: startAt.toISOString(),
          durationMinutes,
          untilAt: new Date(
            `${inputText(formData, "repeatUntil")}T23:59:59`,
          ).toISOString(),
        };
        const response = await authenticatedFetch(`${API_BASE_URL}/recurring-assignments`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        });

        if (!response.ok) throw new Error(await responseMessage(response));
        const result = (await response.json()) as RecurringAssignmentResponse;
        onCreated(null, [], result.generatedAssignmentCount);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The assignment could not be created.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="schedulerDialog" role="dialog" aria-modal="true" aria-labelledby="scheduler-title">
      <header className="schedulerDialogHeader">
        <div>
          <h2 id="scheduler-title">{t("Create assignment")}</h2>
        </div>
        <button type="button" aria-label={t("Close assignment form")} onClick={onClose}>×</button>
      </header>

      {optionsLoading ? <p className="formNotice">{t("Preparing the scheduler...")}</p> : null}
      {optionsError ? <p className="formMessage formMessageError" role="alert">{optionsError}</p> : null}

      <form className="schedulerForm" onSubmit={handleSubmit}>
        <div className="schedulerField schedulerFieldTitle">
          <span aria-hidden="true">✎</span>
          <input name="title" placeholder={t("Add a title")} maxLength={200} required autoFocus />
        </div>

        <div className="schedulerRow">
          <span className="schedulerRowIcon" aria-hidden="true">◷</span>
          <div className="schedulerTimeGrid">
            <label>{t("Date")}<input name="assignmentDate" type="date" value={assignmentDate} onChange={(event) => { setAssignmentDate(event.target.value); setError(""); }} required /></label>
            <label>{t("Starts")}<input name="startTime" type="time" defaultValue="09:00" required /></label>
            <label>{t("Ends")}<input name="endTime" type="time" defaultValue="10:00" required /></label>
            {selectedDateIsWeekend ? <small className="weekdayPolicyHint isError">{t("Assignments cannot be scheduled on Saturday or Sunday.")}</small> : null}
          </div>
        </div>

        <div className="schedulerRow assignmentRevenueRow">
          <span className="schedulerRowIcon" aria-hidden="true">€</span>
          <div className="schedulerSection">
            <div className="schedulerSectionHeading"><div><strong>{t("Assignment price")}</strong><small>{t("The amount the client will pay for each completed occurrence.")}</small></div></div>
            <label className="schedulerInputLabel">{t("Amount per assignment (€)")}<input name="clientCharge" type="number" min="0" step="0.01" placeholder={t("Amount per assignment (€)")} required /></label>
          </div>
        </div>

        <div className="schedulerRow">
          <span className="schedulerRowIcon" aria-hidden="true">↻</span>
          <div className="schedulerRepeat">
            <label>{t("Repetition")}<select value={repeatMode} onChange={(event) => setRepeatMode(event.target.value as RepeatMode)}>
                <option value="NONE">{t("Does not repeat")}</option>
                <option value="DAILY">{t("Daily")}</option>
                <option value="WEEKLY">{t("Weekly")}</option>
                <option value="MONTHLY">{t("Monthly")}</option>
              </select>
            </label>

            {repeatMode !== "NONE" ? (
              <div className="repeatOptions">
                <label>{t("Every")}<input name="repeatInterval" type="number" min="1" max="52" value={repeatInterval} onChange={(event) => setRepeatInterval(event.target.value)} required /></label>
                <span>{repeatMode === "DAILY" ? t("day(s)") : repeatMode === "WEEKLY" ? t("week(s)") : t("month(s)")}</span>

                {repeatMode === "WEEKLY" ? (
                  <div className="weekdayPicker">
                    {WEEKDAYS.map((day) => (
                      <button
                        className={weekdays.includes(day.value) ? "isSelected" : ""}
                        aria-label={t(day.name)}
                        key={day.value}
                        type="button"
                        onClick={() => toggleWeekday(day.value)}
                      >
                        {t(day.name).slice(0, 2)}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="repeatEnding">
                  <label className="repeatEndDate">{t("Ends on")}<input name="repeatUntil" type="date" min={assignmentDate} value={repeatUntil} onChange={(event) => setRepeatUntil(event.target.value)} required />
                  </label>
                  <small>{t("The schedule stops after its final occurrence on this date.")}</small>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <HolidayWarning date={assignmentDate} frequency={repeatMode} interval={Number(repeatInterval)} until={repeatUntil} weekdays={weekdays} />

        <div className="schedulerRow">
          <span className="schedulerRowIcon" aria-hidden="true">⌖</span>
          <div className="schedulerSection">
            <div className="schedulerSectionHeading">
              <div><strong>{t("Cleaning destination")}</strong><small>{t("Choose a saved site or select a new position on the map.")}</small></div>
              <div className="segmentedControl">
                <button type="button" className={siteMode === "existing" ? "isSelected" : ""} onClick={() => { setSiteMode("existing"); setMapRoute(null); }}>{t("Saved site")}</button>
                <button type="button" className={siteMode === "new" ? "isSelected" : ""} onClick={() => { setSiteMode("new"); setSavedSiteLocation(null); setSavedSiteLocationError(""); setMapRoute(null); }}>{t("New site")}</button>
              </div>
            </div>

            {siteMode === "existing" ? (
              <label className="schedulerInputLabel">{t("Site")}<select value={selectedSiteId} onChange={(event) => { setSelectedSiteId(event.target.value); setMapRoute(null); }} required>
                  <option value="">{t("Select a cleaning site")}</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>{site.name} · {site.client.companyName} · {site.city}</option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="newSiteMapFields">
                <div className="newClientChoice">
                  <label className="schedulerInputLabel">{t("Client")}<select name="newClientId" value={newClientId} onChange={(event) => setNewClientId(event.target.value)} required={siteMode === "new"}><option value="">{t("Select client")}</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.companyName}</option>)}</select></label>
                  <button type="button" onClick={() => { setClientError(""); setShowClientDialog(true); }}>{t("+ Create a new client")}</button>
                </div>
              </div>
            )}

            <div className="routeMapHeading">
              <strong>{t("Route positions")}</strong>
              <small>{t("Select the starting point first, then the cleaning destination.")}</small>
            </div>
            {savedSiteLocationError ? <p className="inlineFormError" role="alert">{savedSiteLocationError}</p> : null}
            <LocationMap
              accessToken={accessToken}
              departure={departureLocation}
              destination={siteMode === "new" ? newSiteLocation : savedSiteLocation}
              allowDestinationSelection={siteMode === "new"}
              onDepartureChange={setDepartureLocation}
              onDestinationChange={setNewSiteLocation}
              onRouteChange={setMapRoute}
            />
            <p className="automaticRouteHint">{t("Distance and travel time are calculated automatically and shown in assignment details.")}</p>
          </div>
        </div>

        <div className="schedulerRow">
          <span className="schedulerRowIcon" aria-hidden="true">＋</span>
          <div className="schedulerSection">
            <div className="schedulerSectionHeading"><div><strong>{t("Employees and agreed rates")}</strong><small>{t("A blank special rate uses and freezes the employee's normal rate.")}</small></div></div>
            <div className="schedulerEmployeeList">
              {employees.map((employee) => {
                const selected = selectedEmployeeIds.includes(employee.id);
                return (
                  <article className={selected ? "isSelected" : ""} key={employee.id}>
                    <label>
                      <input type="checkbox" checked={selected} onChange={() => toggleEmployee(employee.id)} />
                      <span className="employeeAvatar" aria-hidden="true">{employee.firstName.charAt(0)}{employee.lastName.charAt(0)}</span>
                      <span><strong>{employee.firstName} {employee.lastName}</strong><small>{employee.isStudent ? t("Student · 10h/week · 40h/month") : `Default ${employee.hourlyRate ? `€${employee.hourlyRate}/h` : "rate not set"}`}</small></span>
                    </label>
                    {selected ? (
                      <label className="specialRate">{t("Special event rate")}<input type="number" min="0" step="0.01" value={specialRates[employee.id] ?? ""} onChange={(event) => setSpecialRates((current) => ({ ...current, [employee.id]: event.target.value }))} placeholder={employee.hourlyRate ? `Default €${employee.hourlyRate}` : t("Optional")} /></label>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </div>

        <div className="schedulerRow">
          <span className="schedulerRowIcon" aria-hidden="true">≡</span>
          <label className="schedulerInputLabel">{t("Instructions")}<textarea name="notes" rows={4} maxLength={5000} placeholder={t("Access instructions, priorities or equipment notes...")} /></label>
        </div>

        {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}

        <footer className="schedulerActions">
          <button type="button" onClick={onClose}>{t("Cancel")}</button>
          <button type="submit" disabled={submitting || optionsLoading || Boolean(optionsError) || selectedDateIsWeekend}>
            {submitting ? t("Creating...") : repeatMode === "NONE" ? t("Create assignment") : t("Create recurring schedule")}
          </button>
        </footer>
      </form>

      {showClientDialog ? (
        <div
          className="clientCreatorBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowClientDialog(false);
          }}
        >
          <section
            className="clientCreatorDialog"
            ref={clientDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-creator-title"
          >
            <header>
              <div>
                <p>{t("New client")}</p>
                <h3 id="client-creator-title">{t("Create client")}</h3>
              </div>
              <button
                type="button"
                aria-label={t("Close client form")}
                onClick={() => setShowClientDialog(false)}
              >
                ×
              </button>
            </header>
            <form onSubmit={handleCreateClient}>
              <label>{t("Company name")}<input name="clientCompanyName" maxLength={200} required autoFocus /></label>
              <label>{t("Contact name")}<input name="clientContactName" maxLength={200} /></label>
              <label>{t("Email")}<input name="clientEmail" type="email" maxLength={320} /></label>
              <label>{t("Phone")}<input name="clientPhone" type="tel" maxLength={30} /></label>
              <p>{t("The new client will be selected automatically after it is saved.")}</p>
              {clientError ? <p className="formMessage formMessageError" role="alert">{clientError}</p> : null}
              <footer>
                <button type="button" onClick={() => setShowClientDialog(false)}>{t("Cancel")}</button>
                <button type="submit" disabled={clientSubmitting}>{clientSubmitting ? t("Creating...") : t("Create client")}</button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
