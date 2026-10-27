"use client";

import { useState } from "react";
import { API_BASE_URL, authenticatedFetch, responseMessage } from "../../lib/auth-client";
import type { Employee } from "./types";

/** This owner-only control changes access, not the employee's work history. */
export default function EmployeeAccessControl({ employee, onUpdated }: { employee: Employee; onUpdated: (employee: Employee) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (employee.user.role === "ADMIN" || employee.isStudent) return null;
  const next = employee.user.role === "MANAGER" ? "EMPLOYEE" : "MANAGER";
  async function changeRole() {
    setBusy(true); setError("");
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/employees/${employee.id}/access-role`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: next }) });
      if (!response.ok) throw new Error(await responseMessage(response));
      onUpdated(await response.json() as Employee);
      setConfirming(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Access could not be updated."); }
    finally { setBusy(false); }
  }
  return <div className="employeeAccessControl">
    <button type="button" onClick={() => setConfirming(!confirming)} aria-expanded={confirming}>{employee.user.role === "MANAGER" ? "Gestionnaire → Mitarbeiter" : "Admin / Gestionnaire ernennen"}</button>
    {confirming ? <div role="group" aria-label="Zugriffsrechte bestätigen"><p>{next === "MANAGER" ? "Verwaltungszugriff ohne Protokolle, Feedback, Archiv oder Kontosicherheit erteilen?" : "Verwaltungszugriff entziehen?"} Bestehende Sitzungen werden beendet.</p><button type="button" disabled={busy} onClick={() => void changeRole()}>{busy ? "Speichern…" : "Bestätigen"}</button><button type="button" disabled={busy} onClick={() => setConfirming(false)}>Abbrechen</button></div> : null}
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}
