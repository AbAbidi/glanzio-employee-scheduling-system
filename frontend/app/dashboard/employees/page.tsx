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
import DashboardShellHeader from "../dashboard-shell-header";
import CreateEmployeeForm from "./create-employee-form";
import EmployeeAnalysisDialog from "./employee-analysis-dialog";
import EmployeeEditDialog from "./employee-edit-dialog";
import EmployeeAccessControl from "./employee-access-control";
import InvitationLinkPanel from "./invitation-link-panel";
import StudentCreditPanel from "./student-credit-panel";
import type {
  Employee,
  EmployeeListResponse,
  InvitationDelivery,
} from "./types";

type AccessState = "checking" | "signed-out" | "forbidden" | "allowed";

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function EmployeesPage() {
  const { t } = useDashboardLanguage();
  const [access, setAccess] = useState<AccessState>("checking");
  const [session, setSession] = useState<AuthenticationResult | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [resettingEmployeeId, setResettingEmployeeId] = useState("");
  const [directoryInvitations, setDirectoryInvitations] = useState<
    Record<string, InvitationDelivery>
  >({});
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [analysingEmployee, setAnalysingEmployee] = useState<Employee | null>(
    null,
  );
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [statementMonth, setStatementMonth] = useState(currentMonthValue);
  const [exportingStatement, setExportingStatement] = useState("");
  const [creditEmployee, setCreditEmployee] = useState<Employee | null>(null);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((employee) =>
      `${employee.firstName} ${employee.lastName} ${employee.loginCode ?? ""} ${employee.user.email ?? ""} ${employee.phone ?? ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [employees, search]);

  function handleEmployeeCreated(employee: Employee) {
    setEmployees((current) => [employee, ...current]);
    setTotal((current) => current + 1);
  }

  function handleEmployeeUpdated(employee: Employee) {
    setEmployees((current) =>
      current.map((item) => (item.id === employee.id ? employee : item)),
    );
    setEditingEmployee(null);
  }

  useEffect(() => {
    let active = true;

    async function loadPage() {
      setLoading(true);
      try {
        const currentSession = await restoreSession();
        if (!active) return;
        if (!currentSession) {
          setAccess("signed-out");
          return;
        }
        if (currentSession.user.role === "EMPLOYEE") {
          setAccess("forbidden");
          return;
        }

        setSession(currentSession);
        setAccess("allowed");
        const response = await authenticatedFetch(
          `${API_BASE_URL}/employees?active=true&page=1&pageSize=100`,
          {
            headers: { Authorization: `Bearer ${currentSession.accessToken}` },
          },
        );
        if (!response.ok) throw new Error(await responseMessage(response));
        const result = (await response.json()) as EmployeeListResponse;
        if (active) {
          setEmployees(result.items);
          setTotal(result.total);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "The employee workspace could not be loaded.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPage();
    return () => {
      active = false;
    };
  }, []);

  async function resetInvitation(employee: Employee) {
    if (!session || employee.user.status !== "INVITED") return;
    setResettingEmployeeId(employee.id);
    setError("");
    try {
      const response = await authenticatedFetch(
        `${API_BASE_URL}/employees/${employee.id}/invitation`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.accessToken}` },
        },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      const invitation = (await response.json()) as InvitationDelivery;
      setDirectoryInvitations((current) => ({
        ...current,
        [employee.id]: invitation,
      }));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "A new invitation could not be generated.",
      );
    } finally {
      setResettingEmployeeId("");
    }
  }

  async function archiveEmployee() {
    if (!session || !employeeToDelete) return;
    setDeleting(true);
    setError("");
    try {
      const response = await authenticatedFetch(
        `${API_BASE_URL}/employees/${employeeToDelete.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.accessToken}` },
        },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      setEmployees((current) =>
        current.filter((employee) => employee.id !== employeeToDelete.id),
      );
      setTotal((current) => Math.max(0, current - 1));
      setEmployeeToDelete(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The employee could not be archived.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function exportPaymentStatement(employee?: Employee) {
    if (!session) return;
    const exportKey = employee?.id ?? "all";
    setExportingStatement(exportKey);
    setError("");
    try {
      const parameters = new URLSearchParams({ month: statementMonth });
      if (employee) parameters.set("employeeId", employee.id);
      const response = await authenticatedFetch(
        `${API_BASE_URL}/reports/monthly-payment-statement?${parameters.toString()}`,
        { headers: { Authorization: `Bearer ${session.accessToken}` } },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename =
        disposition.match(/filename="?([^";]+)"?/i)?.[1] ??
        `glanzio-stundenzettel-${statementMonth}.pdf`;
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The PDF could not be generated.",
      );
    } finally {
      setExportingStatement("");
    }
  }

  if (access === "checking")
    return (
      <main className="managementGate">{t("Preparing employee operations...")}</main>
    );
  if (access === "signed-out")
    return (
      <main className="managementGate">
        <h1>{t("Sign in required")}</h1>
        <p>{t("You must sign in before opening employee management.")}</p>
        <Link href="/login">{t("Go to sign in")}</Link>
      </main>
    );
  if (access === "forbidden")
    return (
      <main className="managementGate">
        <h1>{t("Administrator access required")}</h1>
        <p>{t("Employee accounts cannot open this page.")}</p>
        <Link href="/dashboard">{t("Return to dashboard")}</Link>
      </main>
    );

  const invitedCount = employees.filter(
    (employee) => employee.user.status === "INVITED",
  ).length;
  const studentCount = employees.filter(
    (employee) => employee.isStudent,
  ).length;

  return (
    <main className="employeeOpsPage">
      <DashboardShellHeader email={session?.user.email ?? ""} role={session?.user.role ?? "EMPLOYEE"} />

      <section className="employeeOpsHero">
        <div>
          <h1>{t("Your team, clearly organised.")}</h1>
          <span>{t("Invite, manage and understand the real cost of completed work.")}</span>
        </div>
        <div className="employeeQuickMetrics">
          <article>
            <span>{t("Active team")}</span>
            <strong>{total}</strong>
          </article>
          <article>
            <span>{t("Awaiting invite")}</span>
            <strong>{invitedCount}</strong>
          </article>
          <article>
            <span>{t("Student employees")}</span>
            <strong>{studentCount}</strong>
          </article>
        </div>
        <div className="employeeStatementExport">
          <label>
          <span>{t("Internal settlement month")}</span>
            <input
              type="month"
              value={statementMonth}
              onChange={(event) => setStatementMonth(event.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={!statementMonth || exportingStatement === "all"}
            onClick={() => void exportPaymentStatement()}
          >
            {exportingStatement === "all"
              ? t("Preparing PDF...")
              : t("Export all internal statements")}
          </button>
        </div>
      </section>

      {error ? (
        <button
          className="employeeOpsError"
          type="button"
          onClick={() => setError("")}
        >
          {error}
          <span>×</span>
        </button>
      ) : null}

      <section className="employeeOpsLayout">
        <aside className="employeeInviteBlock">
          <div className="employeeBlockHeading">
            <span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M15 20H4v-2a5 5 0 0 1 10 0v2M18 8v6m-3-3h6" /><circle cx="9" cy="7" r="3" /></svg></span>
            <div>
              <p>{t("Invitation")}</p>
              <h2>{t("Add a team member")}</h2>
            </div>
          </div>
          {session ? (
            <CreateEmployeeForm
              canCreateManager={session.user.role === "ADMIN"}
              accessToken={session.accessToken}
              onEmployeeCreated={handleEmployeeCreated}
            />
          ) : null}
        </aside>

        <section className="employeeDirectoryBlock">
          <header className="employeeDirectoryHeader">
            <div className="employeeBlockHeading">
              <span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="M5 17v-1a4 4 0 0 1 8 0v1m2-9h3m-3 4h3m-3 4h3" /></svg></span>
              <div>
                <p>{t("Directory")}</p>
                <h2>{total}{t(" active employees")}</h2>
              </div>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("Search name, email or phone")}
              aria-label={t("Search employees")}
            />
          </header>

          {loading ? <p className="formNotice">{t("Loading employees...")}</p> : null}
          {!loading && filteredEmployees.length === 0 ? (
            <div className="employeeEmptyState">
              <strong>{t("No matching employees")}</strong>
              <span>{t("Invite a new employee or adjust your search.")}</span>
            </div>
          ) : null}
          <div className="employeeModernList">
            {filteredEmployees.map((employee) => {
              const invitation = directoryInvitations[employee.id];
              const invited = employee.user.status === "INVITED";
              return (
                <article className="employeeModernCard" key={employee.id}>
                  <div className="employeeModernIdentity">
                    <span>
                      {employee.firstName.charAt(0)}
                      {employee.lastName.charAt(0)}
                    </span>
                    <div>
                      <strong>
                        {employee.firstName} {employee.lastName}
                      </strong>
                      <small>{employee.loginCode ? `ID ${employee.loginCode}` : employee.user.email}</small>
                    </div>
                  </div>
                  <div className="employeeModernFacts">
                    <span>
                      <small>{t("Phone")}</small>
                      <strong>{employee.phone || "Not provided"}</strong>
                    </span>
                    <span>
                      <small>{t("Hourly rate")}</small>
                      <strong>
                        {employee.hourlyRate
                          ? `€${employee.hourlyRate}/h`
                          : t("Not set")}
                      </strong>
                    </span>
                    <span>
                      <small>{t("Profile")}</small>
                      <strong>
                        {employee.isStudent
                          ? t("Student · 10h/week · 40h/month")
                          : t("Standard employee")}
                      </strong>
                    </span>
                  </div>
                  <div className="employeeModernStatus">
                    <span
                      className={`employeeState employeeState${employee.user.status}`}
                    >
                      {t(employee.user.status.toLowerCase())}
                    </span>
                  </div>
                  <div className="employeeModernActions">
                    <button
                      type="button"
                      aria-pressed={analysingEmployee?.id === employee.id}
                      onClick={() => setAnalysingEmployee(employee)}
                    >{t("View analysis")}</button>
                    <button
                      type="button"
                      disabled={exportingStatement === employee.id}
                      aria-busy={exportingStatement === employee.id}
                      onClick={() => void exportPaymentStatement(employee)}
                    >
                      {exportingStatement === employee.id
                        ? t("Preparing PDF...")
                        : t("Export internal statement")}
                    </button>
                    {session?.user.role === "ADMIN" || !employee.user.role || employee.user.role === "EMPLOYEE" ? <button type="button" aria-pressed={editingEmployee?.id === employee.id} onClick={() => setEditingEmployee(employee)}>{t("Edit profile")}</button> : null}
                    {employee.isStudent ? <button type="button" aria-expanded={creditEmployee?.id === employee.id} aria-controls={`student-credit-${employee.id}`} onClick={() => setCreditEmployee((current) => current?.id === employee.id ? null : employee)}>{t("Credit preview / closure")}</button> : null}
                    {invited && session?.user.role === "ADMIN" ? (
                      <button
                        type="button"
                        disabled={resettingEmployeeId === employee.id}
                        onClick={() => void resetInvitation(employee)}
                      >
                        {resettingEmployeeId === employee.id
                          ? t("Generating...")
                          : t("Reset invitation")}
                      </button>
                    ) : null}
                    {session?.user.role === "ADMIN" ? <button
                      className="employeeDeleteButton"
                      type="button"
                      aria-pressed={employeeToDelete?.id === employee.id}
                      onClick={() => setEmployeeToDelete(employee)}
                    ><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7" /></svg>{t("Delete")}</button> : null}
                  </div>
                  {creditEmployee?.id === employee.id && session ? <StudentCreditPanel key={`${employee.id}-${statementMonth}`} employee={employee} month={statementMonth} accessToken={session.accessToken} onClose={() => setCreditEmployee(null)} /> : null}
                  {session?.user.role === "ADMIN" ? <EmployeeAccessControl employee={employee} onUpdated={handleEmployeeUpdated} /> : null}
                  {invited && (invitation?.invitationUrl || invitation?.developmentInvitationUrl) ? (
                    <div className="employeeCardInvitation">
                      <InvitationLinkPanel
                        compact
                        url={invitation.invitationUrl ?? invitation.developmentInvitationUrl!}
                        expiresAt={invitation.expiresAt}
                      />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </section>

      {editingEmployee && session ? (
        <div
          className="opsModalBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditingEmployee(null);
          }}
        >
          <EmployeeEditDialog
            canResetPassword={session.user.role === "ADMIN"}
            accessToken={session.accessToken}
            employee={editingEmployee}
            onClose={() => setEditingEmployee(null)}
            onUpdated={handleEmployeeUpdated}
          />
        </div>
      ) : null}
      {analysingEmployee && session ? (
        <div
          className="opsModalBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setAnalysingEmployee(null);
          }}
        >
          <EmployeeAnalysisDialog
            accessToken={session.accessToken}
            employee={analysingEmployee}
            onClose={() => setAnalysingEmployee(null)}
          />
        </div>
      ) : null}
      {employeeToDelete ? (
        <div className="opsModalBackdrop">
          <section
            className="employeeDeleteDialog"
            role="alertdialog"
            aria-modal="true"
          >
            <span>{t("Archive employee")}</span>
            <h2>{t("Remove ")}{employeeToDelete.firstName}{t(" from the active team?")}</h2>
            <p>{t("The account will lose access, but completed assignments and payroll history will remain available.")}</p>
            <p>{t("Future or ongoing assignments must be reassigned or cancelled first. Archived history is available to administrators in Archive.")}</p>
            <div>
              <button type="button" onClick={() => setEmployeeToDelete(null)}>{t("Keep employee")}</button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void archiveEmployee()}
              >
                {deleting ? t("Removing...") : t("Remove access")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
