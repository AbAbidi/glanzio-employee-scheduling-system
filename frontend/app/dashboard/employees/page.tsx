"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  API_BASE_URL,
  responseMessage,
  restoreSession,
  type AuthenticationResult,
} from "../../lib/auth-client";
import DashboardShellHeader from "../dashboard-shell-header";
import CreateEmployeeForm from "./create-employee-form";
import EmployeeAnalysisDialog from "./employee-analysis-dialog";
import EmployeeEditDialog from "./employee-edit-dialog";
import InvitationLinkPanel from "./invitation-link-panel";
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

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((employee) =>
      `${employee.firstName} ${employee.lastName} ${employee.user.email} ${employee.phone ?? ""}`
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
        if (currentSession.user.role !== "ADMIN") {
          setAccess("forbidden");
          return;
        }

        setSession(currentSession);
        setAccess("allowed");
        const response = await fetch(
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
      const response = await fetch(
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
      const response = await fetch(
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
      const response = await fetch(
        `${API_BASE_URL}/reports/monthly-payment-statement?${parameters.toString()}`,
        { headers: { Authorization: `Bearer ${session.accessToken}` } },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename =
        disposition.match(/filename="?([^";]+)"?/i)?.[1] ??
        `clarity-clean-payment-statements-${statementMonth}.pdf`;
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
      <main className="managementGate">Preparing employee operations...</main>
    );
  if (access === "signed-out")
    return (
      <main className="managementGate">
        <h1>Sign in required</h1>
        <p>You must sign in before opening employee management.</p>
        <Link href="/login">Go to sign in</Link>
      </main>
    );
  if (access === "forbidden")
    return (
      <main className="managementGate">
        <h1>Administrator access required</h1>
        <p>Employee accounts cannot open this page.</p>
        <Link href="/dashboard">Return to dashboard</Link>
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
      <DashboardShellHeader email={session?.user.email ?? ""} role="ADMIN" />

      <section className="employeeOpsHero">
        <div>
          <p>People intelligence</p>
          <h1>Your team, clearly organised.</h1>
          <span>
            Invite, manage and understand the real cost of completed work.
          </span>
        </div>
        <div className="employeeQuickMetrics">
          <article>
            <span>Active team</span>
            <strong>{total}</strong>
          </article>
          <article>
            <span>Awaiting invite</span>
            <strong>{invitedCount}</strong>
          </article>
          <article>
            <span>Student employees</span>
            <strong>{studentCount}</strong>
          </article>
        </div>
        <div className="employeeStatementExport">
          <label>
            <span>Payment statement month</span>
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
              ? "Preparing PDF..."
              : "Export all employee statements"}
          </button>
          <small>
            One secure PDF, with a separate signed-and-stamped statement for
            each employee.
          </small>
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
            <span>01</span>
            <div>
              <p>Invitation</p>
              <h2>Add a team member</h2>
            </div>
          </div>
          {session ? (
            <CreateEmployeeForm
              accessToken={session.accessToken}
              onEmployeeCreated={handleEmployeeCreated}
            />
          ) : null}
        </aside>

        <section className="employeeDirectoryBlock">
          <header className="employeeDirectoryHeader">
            <div className="employeeBlockHeading">
              <span>02</span>
              <div>
                <p>Directory</p>
                <h2>{total} active employees</h2>
              </div>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email or phone"
              aria-label="Search employees"
            />
          </header>

          {loading ? <p className="formNotice">Loading employees...</p> : null}
          {!loading && filteredEmployees.length === 0 ? (
            <div className="employeeEmptyState">
              <strong>No matching employees</strong>
              <span>Invite a new employee or adjust your search.</span>
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
                      <small>{employee.user.email}</small>
                    </div>
                  </div>
                  <div className="employeeModernFacts">
                    <span>
                      <small>Phone</small>
                      <strong>{employee.phone || "Not provided"}</strong>
                    </span>
                    <span>
                      <small>Hourly rate</small>
                      <strong>
                        {employee.hourlyRate
                          ? `€${employee.hourlyRate}/h`
                          : "Not set"}
                      </strong>
                    </span>
                    <span>
                      <small>Profile</small>
                      <strong>
                        {employee.isStudent
                          ? "Student · 80h insight"
                          : "Standard employee"}
                      </strong>
                    </span>
                  </div>
                  <div className="employeeModernStatus">
                    <span
                      className={`employeeState employeeState${employee.user.status}`}
                    >
                      {employee.user.status.toLowerCase()}
                    </span>
                  </div>
                  <div className="employeeModernActions">
                    <button
                      type="button"
                      onClick={() => setAnalysingEmployee(employee)}
                    >
                      View analysis
                    </button>
                    <button
                      type="button"
                      disabled={exportingStatement === employee.id}
                      onClick={() => void exportPaymentStatement(employee)}
                    >
                      {exportingStatement === employee.id
                        ? "Preparing PDF..."
                        : "Export statement"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingEmployee(employee)}
                    >
                      Edit profile
                    </button>
                    {invited ? (
                      <button
                        type="button"
                        disabled={resettingEmployeeId === employee.id}
                        onClick={() => void resetInvitation(employee)}
                      >
                        {resettingEmployeeId === employee.id
                          ? "Generating..."
                          : "Reset invitation"}
                      </button>
                    ) : null}
                    <button
                      className="employeeDeleteButton"
                      type="button"
                      onClick={() => setEmployeeToDelete(employee)}
                    >
                      Delete
                    </button>
                  </div>
                  {invited && invitation?.developmentInvitationUrl ? (
                    <div className="employeeCardInvitation">
                      <InvitationLinkPanel
                        compact
                        url={invitation.developmentInvitationUrl}
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
            <span>Archive employee</span>
            <h2>Remove {employeeToDelete.firstName} from the active team?</h2>
            <p>
              The account will lose access, but completed assignments and
              payroll history will remain available.
            </p>
            <div>
              <button type="button" onClick={() => setEmployeeToDelete(null)}>
                Keep employee
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void archiveEmployee()}
              >
                {deleting ? "Removing..." : "Remove access"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
