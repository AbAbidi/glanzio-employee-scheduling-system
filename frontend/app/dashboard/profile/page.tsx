"use client";

import { useDashboardLanguage } from "../dashboard-language";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  API_BASE_URL, authenticatedFetch,
  clearSessionCache,
  responseMessage,
  restoreSession,
  type AuthenticationResult,
} from "../../lib/auth-client";
import type { Employee } from "../employees/types";
import DashboardShellHeader from "../dashboard-shell-header";
import EmployeeLoginId from "../employee-login-id";

export default function EmployeeProfilePage() {
  const { t } = useDashboardLanguage();
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
        if (!currentSession || currentSession.user.role === "ADMIN") {
          if (active) setError("Employee sign-in is required.");
          return;
        }
        const response = await authenticatedFetch(`${API_BASE_URL}/employees/me`, {
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
      const response = await authenticatedFetch(`${API_BASE_URL}/employees/me`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: String(formData.get("firstName") ?? "").trim(),
          lastName: String(formData.get("lastName") ?? "").trim(),
          ...(String(formData.get("email") ?? "").trim() ? { email: String(formData.get("email")).trim() } : {}),
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
      const response = await authenticatedFetch(`${API_BASE_URL}/auth/change-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: formData.get("currentPassword"), newPassword: formData.get("newPassword") }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      clearSessionCache();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Password changes require a fresh session and clear client memory.
      window.location.href = "/login";
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Your password could not be changed.");
      setSaving(false);
    }
  }

  if (loading) return <main className="managementGate">{t("Loading your profile...")}</main>;
  if (!session || !employee) return <main className="managementGate"><h1>{t("Profile unavailable")}</h1><p>{error}</p><Link href="/login">{t("Go to sign in")}</Link></main>;

  return (
    <main className="employeeProfilePage">
      <DashboardShellHeader email={session.user.email} loginCode={employee.loginCode} role={session.user.role} />
      <section className="employeeProfileHero"><p>{t("Account and contact details")}</p><h1>{employee.firstName} {employee.lastName}</h1><span>{t("You can update your own contact information and secure your password here.")}</span></section>
      {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}
      {notice ? <p className="formMessage formMessageSuccess" role="status">{notice}</p> : null}
      <div className="employeeProfileGrid">
        <form onSubmit={saveProfile}><p>{t("Profile details")}</p><h2>{t("Contact information")}</h2><EmployeeLoginId code={employee.loginCode} /><div><label>{t("First name")}<input name="firstName" defaultValue={employee.firstName} required /></label><label>{t("Last name")}<input name="lastName" defaultValue={employee.lastName} required /></label><label>{t("Email")} ({t("Optional")})<input name="email" type="email" defaultValue={employee.user.email ?? ""} /></label><label>{t("Phone")}<input name="phone" type="tel" defaultValue={employee.phone ?? ""} /></label></div><button type="submit" disabled={saving}>{saving ? t("Saving...") : t("Save profile")}</button></form>
        <form onSubmit={changePassword}><p>{t("Security")}</p><h2>{t("Change password")}</h2><label>{t("Current password")}<input name="currentPassword" type="password" autoComplete="current-password" required /></label><label>{t("New password")}<input name="newPassword" type="password" autoComplete="new-password" minLength={12} required /></label><small>{t("Use at least 12 characters. Changing it signs you out from every device.")}</small><button type="submit" disabled={saving}>{t("Change password")}</button></form>
      </div>
    </main>
  );
}
