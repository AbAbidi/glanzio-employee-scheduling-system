"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  API_BASE_URL,
  clearSessionCache,
  responseMessage,
  restoreSession,
  type AuthenticationResult,
} from "../../lib/auth-client";
import type { Employee } from "../employees/types";

export default function EmployeeProfilePage() {
  const [session, setSession] = useState<AuthenticationResult | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const currentSession = await restoreSession();
        if (!currentSession || currentSession.user.role !== "EMPLOYEE") {
          if (active) setError("Employee sign-in is required.");
          return;
        }
        const response = await fetch(`${API_BASE_URL}/employees/me`, {
          headers: { Authorization: `Bearer ${currentSession.accessToken}` },
        });
        if (!response.ok) throw new Error(await responseMessage(response));
        const profile = (await response.json()) as Employee;
        if (active) { setSession(currentSession); setEmployee(profile); }
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "Your profile could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const formData = new FormData(event.currentTarget);
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${API_BASE_URL}/employees/me`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: String(formData.get("firstName") ?? "").trim(),
          lastName: String(formData.get("lastName") ?? "").trim(),
          email: String(formData.get("email") ?? "").trim(),
          phone: String(formData.get("phone") ?? "").trim(),
        }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setEmployee((await response.json()) as Employee);
      setNotice("Profile saved successfully.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Your profile could not be saved.");
    } finally { setSaving(false); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const formData = new FormData(event.currentTarget);
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: formData.get("currentPassword"), newPassword: formData.get("newPassword") }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      clearSessionCache();
      window.location.href = "/login";
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Your password could not be changed.");
      setSaving(false);
    }
  }

  if (loading) return <main className="managementGate">Loading your profile...</main>;
  if (!session || !employee) return <main className="managementGate"><h1>Profile unavailable</h1><p>{error}</p><Link href="/login">Go to sign in</Link></main>;

  return (
    <main className="employeeProfilePage">
      <header><Link href="/dashboard">← Dashboard</Link><span>Personal profile</span></header>
      <section className="employeeProfileHero"><p>Account and contact details</p><h1>{employee.firstName} {employee.lastName}</h1><span>You can update your own contact information and secure your password here.</span></section>
      {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}
      {notice ? <p className="formMessage formMessageSuccess" role="status">{notice}</p> : null}
      <div className="employeeProfileGrid">
        <form onSubmit={saveProfile}><p>Profile details</p><h2>Contact information</h2><div><label>First name<input name="firstName" defaultValue={employee.firstName} required /></label><label>Last name<input name="lastName" defaultValue={employee.lastName} required /></label><label>Email<input name="email" type="email" defaultValue={employee.user.email} required /></label><label>Phone<input name="phone" type="tel" defaultValue={employee.phone ?? ""} /></label></div><button type="submit" disabled={saving}>{saving ? "Saving..." : "Save profile"}</button></form>
        <form onSubmit={changePassword}><p>Security</p><h2>Change password</h2><label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required /></label><label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={12} required /></label><small>Use at least 12 characters. Changing it signs you out from every device.</small><button type="submit" disabled={saving}>Change password</button></form>
      </div>
    </main>
  );
}
