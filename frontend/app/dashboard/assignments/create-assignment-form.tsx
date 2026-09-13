"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  API_BASE_URL,
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
type SavedSiteSelection = {
  site: CleaningSite | null;
  lookupKey: string;
  coordinates: MapLocation | null;
};
type SavedSiteLookup = {
  key: string;
  location: MapLocation | null;
  error: string;
};

const WEEKDAYS = [
  { value: 1, label: "M" },
  { value: 2, label: "T" },
  { value: 3, label: "W" },
  { value: 4, label: "T" },
  { value: 5, label: "F" },
  { value: 6, label: "S" },
  { value: 7, label: "S" },
];

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
  const [sites, setSites] = useState<CleaningSite[]>([]);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [specialRates, setSpecialRates] = useState<Record<string, string>>({});
  const [siteMode, setSiteMode] = useState<SiteMode>("existing");
  const [createNewClient, setCreateNewClient] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("NONE");
  const [weekdays, setWeekdays] = useState<number[]>(() => {
    const weekday = new Date(`${initialDate}T12:00:00`).getDay();
    return [weekday === 0 ? 7 : weekday];
  });
  const [newSiteLocation, setNewSiteLocation] =
    useState<MapLocation | null>(null);
  const [departureLocation, setDepartureLocation] =
    useState<MapLocation | null>(null);
  const [savedSiteLookup, setSavedSiteLookup] =
    useState<SavedSiteLookup | null>(null);
  const [mapRoute, setMapRoute] = useState<RoutePreview | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadOptions() {
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };
        const [sitesResponse, clientsResponse, employeesResponse] =
          await Promise.all([
            fetch(`${API_BASE_URL}/sites?active=true&page=1&pageSize=100`, { headers }),
            fetch(`${API_BASE_URL}/clients?active=true&page=1&pageSize=100`, { headers }),
            fetch(`${API_BASE_URL}/employees?active=true&page=1&pageSize=100`, { headers }),
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

  const savedSiteSelection = useMemo<SavedSiteSelection>(() => {
    if (siteMode !== "existing") {
      return { site: null, lookupKey: "", coordinates: null };
    }

    const site =
      sites.find((candidate) => candidate.id === selectedSiteId) ?? null;
    if (!site) return { site: null, lookupKey: "", coordinates: null };

    const address = siteAddress(site);
    const latitude = Number(site.latitude);
    const longitude = Number(site.longitude);
    const coordinates =
      site.latitude !== null &&
      site.longitude !== null &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
        ? {
            latitude,
            longitude,
            displayName: address,
            siteName: site.name,
            addressLine1: site.addressLine1,
            city: site.city,
            countryCode: site.countryCode,
          }
        : null;

    return {
      site,
      lookupKey: `${site.id}:${address}`,
      coordinates,
    };
  }, [selectedSiteId, siteMode, sites]);

  const savedSiteLocation =
    savedSiteSelection.coordinates ??
    (savedSiteLookup?.key === savedSiteSelection.lookupKey
      ? savedSiteLookup.location
      : null);
  const savedSiteLocationError =
    !savedSiteSelection.coordinates &&
    savedSiteLookup?.key === savedSiteSelection.lookupKey
      ? savedSiteLookup.error
      : "";

  useEffect(() => {
    const { site, lookupKey, coordinates } = savedSiteSelection;
    if (!site || coordinates) return;
    const savedSite = site;

    let active = true;

    async function locateSavedSite() {
      try {
        const response = await fetch(`${API_BASE_URL}/calendar/location-search`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: siteAddress(savedSite) }),
        });

        if (!response.ok) throw new Error(await responseMessage(response));
        const coordinate = (await response.json()) as Pick<
          MapLocation,
          "latitude" | "longitude" | "displayName"
        >;
        if (!active) return;
        setSavedSiteLookup({
          key: lookupKey,
          location: {
            ...coordinate,
            siteName: savedSite.name,
            addressLine1: savedSite.addressLine1,
            city: savedSite.city,
            countryCode: savedSite.countryCode,
          },
          error: "",
        });
      } catch (requestError) {
        if (!active) return;
        setSavedSiteLookup({
          key: lookupKey,
          location: null,
          error:
            requestError instanceof Error
              ? requestError.message
              : "The saved destination could not be placed on the map.",
        });
      }
    }

    void locateSavedSite();
    return () => {
      active = false;
    };
  }, [accessToken, savedSiteSelection]);

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
    const response = await fetch(`${API_BASE_URL}/calendar/route-preview`, {
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

    let clientId = inputText(formData, "newClientId");
    let companyName = clients.find((candidate) => candidate.id === clientId)?.companyName;

    if (createNewClient) {
      const newCompanyName = inputText(formData, "newClientCompanyName");
      if (!newCompanyName) throw new Error("Enter the new client's company name.");
      const response = await fetch(`${API_BASE_URL}/clients`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: newCompanyName,
          contactName: inputText(formData, "newClientContactName") || undefined,
          email: inputText(formData, "newClientEmail") || undefined,
          phone: inputText(formData, "newClientPhone") || undefined,
        }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const client = (await response.json()) as Client;
      clientId = client.id;
      companyName = client.companyName;
    }

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

    const response = await fetch(`${API_BASE_URL}/sites`, {
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
        const response = await fetch(`${API_BASE_URL}/assignments`, {
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
        const response = await fetch(`${API_BASE_URL}/recurring-assignments`, {
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
          <p>New calendar event</p>
          <h2 id="scheduler-title">Create assignment</h2>
        </div>
        <button type="button" aria-label="Close assignment form" onClick={onClose}>×</button>
      </header>

      {optionsLoading ? <p className="formNotice">Preparing the scheduler...</p> : null}
      {optionsError ? <p className="formMessage formMessageError" role="alert">{optionsError}</p> : null}

      <form className="schedulerForm" onSubmit={handleSubmit}>
        <div className="schedulerField schedulerFieldTitle">
          <span aria-hidden="true">✎</span>
          <input name="title" placeholder="Add a title" maxLength={200} required autoFocus />
        </div>

        <div className="schedulerRow">
          <span className="schedulerRowIcon" aria-hidden="true">◷</span>
          <div className="schedulerTimeGrid">
            <label>Date<input name="assignmentDate" type="date" defaultValue={initialDate} required /></label>
            <label>Starts<input name="startTime" type="time" defaultValue="09:00" required /></label>
            <label>Ends<input name="endTime" type="time" defaultValue="10:00" required /></label>
          </div>
        </div>

        <div className="schedulerRow assignmentRevenueRow">
          <span className="schedulerRowIcon" aria-hidden="true">€</span>
          <div className="schedulerSection">
            <div className="schedulerSectionHeading"><div><strong>Client price</strong><small>The amount the client will pay for each completed occurrence.</small></div></div>
            <label className="schedulerInputLabel">Amount per assignment (€)<input name="clientCharge" type="number" min="0" step="0.01" placeholder="250.00" required /></label>
          </div>
        </div>

        <div className="schedulerRow">
          <span className="schedulerRowIcon" aria-hidden="true">↻</span>
          <div className="schedulerRepeat">
            <label>
              Repetition
              <select value={repeatMode} onChange={(event) => setRepeatMode(event.target.value as RepeatMode)}>
                <option value="NONE">Does not repeat</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </label>

            {repeatMode !== "NONE" ? (
              <div className="repeatOptions">
                <label>Every<input name="repeatInterval" type="number" min="1" max="52" defaultValue="1" /></label>
                <span>{repeatMode === "DAILY" ? "day(s)" : repeatMode === "WEEKLY" ? "week(s)" : "month(s)"}</span>

                {repeatMode === "WEEKLY" ? (
                  <div className="weekdayPicker">
                    {WEEKDAYS.map((day) => (
                      <button
                        className={weekdays.includes(day.value) ? "isSelected" : ""}
                        key={day.value}
                        type="button"
                        onClick={() => toggleWeekday(day.value)}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="repeatEnding">
                  <label className="repeatEndDate">
                    Ends on
                    <input name="repeatUntil" type="date" min={initialDate} required />
                  </label>
                  <small>The schedule stops after its final occurrence on this date.</small>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="schedulerRow">
          <span className="schedulerRowIcon" aria-hidden="true">⌖</span>
          <div className="schedulerSection">
            <div className="schedulerSectionHeading">
              <div><strong>Cleaning destination</strong><small>Choose a saved site or select a new position on the map.</small></div>
              <div className="segmentedControl">
                <button type="button" className={siteMode === "existing" ? "isSelected" : ""} onClick={() => { setSiteMode("existing"); setSavedSiteLookup(null); setMapRoute(null); }}>Saved site</button>
                <button type="button" className={siteMode === "new" ? "isSelected" : ""} onClick={() => { setSiteMode("new"); setSavedSiteLookup(null); setMapRoute(null); }}>New site</button>
              </div>
            </div>

            {siteMode === "existing" ? (
              <label className="schedulerInputLabel">
                Site
                <select value={selectedSiteId} onChange={(event) => { setSelectedSiteId(event.target.value); setSavedSiteLookup(null); setMapRoute(null); }} required>
                  <option value="">Select a cleaning site</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>{site.name} · {site.client.companyName} · {site.city}</option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="newSiteMapFields">
                <div className="newClientChoice">
                  <label className="schedulerInputLabel">Client<select name="newClientId" disabled={createNewClient} required={siteMode === "new" && !createNewClient}><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.companyName}</option>)}</select></label>
                  <button type="button" className={createNewClient ? "isSelected" : ""} onClick={() => setCreateNewClient((current) => !current)}>{createNewClient ? "Use an existing client" : "+ Create a new client"}</button>
                </div>
                {createNewClient ? (
                  <div className="inlineClientFields">
                    <label>Company name<input name="newClientCompanyName" maxLength={200} required /></label>
                    <label>Contact name<input name="newClientContactName" maxLength={200} /></label>
                    <label>Email<input name="newClientEmail" type="email" maxLength={320} /></label>
                    <label>Phone<input name="newClientPhone" type="tel" maxLength={30} /></label>
                    <p>The client is saved first, then this new cleaning site is linked automatically.</p>
                  </div>
                ) : null}
              </div>
            )}

            <div className="routeMapHeading">
              <strong>Route positions</strong>
              <small>Select the starting point first, then the cleaning destination.</small>
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
            <p className="automaticRouteHint">Distance and travel time are calculated automatically and shown in assignment details.</p>
          </div>
        </div>

        <div className="schedulerRow">
          <span className="schedulerRowIcon" aria-hidden="true">＋</span>
          <div className="schedulerSection">
            <div className="schedulerSectionHeading"><div><strong>Employees and agreed rates</strong><small>A blank special rate uses and freezes the employee&apos;s normal rate.</small></div></div>
            <div className="schedulerEmployeeGrid">
              {employees.map((employee) => {
                const selected = selectedEmployeeIds.includes(employee.id);
                return (
                  <article className={selected ? "isSelected" : ""} key={employee.id}>
                    <label>
                      <input type="checkbox" checked={selected} onChange={() => toggleEmployee(employee.id)} />
                      <span className="employeeAvatar" aria-hidden="true">{employee.firstName.charAt(0)}{employee.lastName.charAt(0)}</span>
                      <span><strong>{employee.firstName} {employee.lastName}</strong><small>{employee.isStudent ? "Student · 80h insight" : `Default ${employee.hourlyRate ? `€${employee.hourlyRate}/h` : "rate not set"}`}</small></span>
                    </label>
                    {selected ? (
                      <label className="specialRate">Special event rate<input type="number" min="0" step="0.01" value={specialRates[employee.id] ?? ""} onChange={(event) => setSpecialRates((current) => ({ ...current, [employee.id]: event.target.value }))} placeholder={employee.hourlyRate ? `Default €${employee.hourlyRate}` : "Optional"} /></label>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </div>

        <div className="schedulerRow">
          <span className="schedulerRowIcon" aria-hidden="true">≡</span>
          <label className="schedulerInputLabel">Instructions<textarea name="notes" rows={4} maxLength={5000} placeholder="Access instructions, priorities or equipment notes..." /></label>
        </div>

        {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}

        <footer className="schedulerActions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={submitting || optionsLoading || Boolean(optionsError)}>
            {submitting ? "Creating..." : repeatMode === "NONE" ? "Create assignment" : "Create recurring schedule"}
          </button>
        </footer>
      </form>
    </section>
  );
}
