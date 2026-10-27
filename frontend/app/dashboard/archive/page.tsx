"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE_URL, authenticatedFetch, restoreSession, responseMessage, type AuthenticationResult } from "../../lib/auth-client";
import DashboardShellHeader from "../dashboard-shell-header";
import { useDashboardLanguage } from "../dashboard-language";
import EmployeeAnalysisDialog from "../employees/employee-analysis-dialog";
import StudentCreditPanel from "../employees/student-credit-panel";
import type { Employee, EmployeeListResponse } from "../employees/types";
import type { ClientListItem, ClientListResponse, ClientOverview } from "../clients/types";
import ArchivedAnalysis from "./archive-analysis";

export default function ArchivePage() {
  const { t, locale } = useDashboardLanguage();
  const [session, setSession] = useState<AuthenticationResult | null>(null);
  const [access, setAccess] = useState("checking");
  const [kind, setKind] = useState<"employees" | "clients">("employees");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<Employee | null>(null);
  const [credit, setCredit] = useState<Employee | null>(null);
  const [client, setClient] = useState<ClientOverview | null>(null);
  const [month, setMonth] = useState(() => new Date().toLocaleDateString("sv-SE").slice(0, 7));

  useEffect(() => {
    let active = true;
    restoreSession().then((current) => {
      if (!active) return;
      setSession(current);
      setAccess(!current ? "signed-out" : current.user.role === "ADMIN" ? "allowed" : "forbidden");
    }).catch(() => { if (active) setAccess("signed-out"); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (access !== "allowed" || !session) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ active: "false", search: search.trim(), page: String(page), pageSize: "20" });
        const response = await authenticatedFetch(`${API_BASE_URL}/${kind}?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error(await responseMessage(response));
        const result = await response.json() as EmployeeListResponse | ClientListResponse;
        if (controller.signal.aborted) return;
        setPageCount(result.pageCount);
        if (kind === "employees") setEmployees((result as EmployeeListResponse).items);
        else setClients((result as ClientListResponse).items);
      } catch (requestError) {
        if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "Archive could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [access, session, kind, search, page]);

  async function openClient(id: string) {
    setError("");
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/clients/${id}/overview`, {});
      if (!response.ok) throw new Error(await responseMessage(response));
      setClient(await response.json() as ClientOverview);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Archive could not be loaded.");
    }
  }

  if (access === "checking") return <main className="managementGate">{t("Checking administrator access…")}</main>;
  if (access !== "allowed") return <main className="managementGate"><h1>{t(access === "forbidden" ? "Administrator access required" : "Sign in required")}</h1><Link href={access === "forbidden" ? "/dashboard" : "/login"}>{t("Return to dashboard")}</Link></main>;

  return (
    <main className="managementPage archiveWorkspace">
      <DashboardShellHeader role="ADMIN" email={session?.user.email ?? ""} />
      <section className="archivePanel">
        <header><p>{t("Administrator access required")}</p><h1>{t("Archived records")}</h1><span>{t("Inactive profiles are kept here, outside normal directories, employee analysis and default exports. History, credit and frozen PDFs are preserved; nothing is deleted.")}</span></header>
        <div className="archiveTools">
          <div role="group" aria-label={t("Archive type")}>
            {(["employees", "clients"] as const).map((value) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => { setKind(value); setPage(1); setCredit(null); }}>{t(value === "employees" ? "Employees" : "Clients")}</button>)}
          </div>
          <label>{t("Search")}<input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
          {kind === "employees" ? <label>{t("Month")}<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label> : null}
        </div>
        {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}
        {kind === "employees" ? <ArchivedAnalysis month={month} search={search} /> : null}
        {loading ? <p role="status">{t("Loading archive…")}</p> : (
          <div className="archiveRecords">
            {kind === "employees" ? employees.map((employee) => <article className="archiveRecord" key={employee.id}>
              <div><span className="archiveBadge">{t("Archived")}</span><h2>{employee.firstName} {employee.lastName}</h2><p>{employee.user.email}</p><small>{t(employee.isStudent ? "Student employee" : "Standard employee")}</small></div>
              <div className="archiveRecordActions"><button type="button" onClick={() => setAnalysis(employee)}>{t("View analysis")}</button>{employee.isStudent ? <button type="button" aria-expanded={credit?.id === employee.id} onClick={() => setCredit(credit?.id === employee.id ? null : employee)}>{t("Credit preview / closure")}</button> : null}</div>
              {credit?.id === employee.id && session ? <StudentCreditPanel key={`${employee.id}-${month}`} employee={employee} month={month} accessToken={session.accessToken} onClose={() => setCredit(null)} /> : null}
            </article>) : clients.map((item) => <article className="archiveRecord" key={item.id}>
              <div><span className="archiveBadge">{t("Archived")}</span><h2>{item.companyName}</h2><p>{item.contactName || item.email || "—"}</p><small>{item._count.sites} {t("Locations")}</small></div>
              <button type="button" onClick={() => void openClient(item.id)}>{t("View details")}</button>
            </article>)}
            {!(kind === "employees" ? employees : clients).length ? <p>{t("No archived profiles found.")}</p> : null}
          </div>
        )}
        <footer className="archivePagination"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>{t("Previous")}</button><span>{page} / {Math.max(1, pageCount)}</span><button type="button" disabled={page >= pageCount || loading} onClick={() => setPage(page + 1)}>{t("Next")}</button></footer>
      </section>
      {analysis && session ? <div className="opsModalBackdrop archiveHistory" onMouseDown={(event) => { if (event.target === event.currentTarget) setAnalysis(null); }}><EmployeeAnalysisDialog employee={analysis} accessToken={session.accessToken} onClose={() => setAnalysis(null)} /></div> : null}
      {client ? <div className="opsModalBackdrop archiveHistory"><section className="clientDetailDialog" role="dialog" aria-modal="true" aria-labelledby="archive-client-title"><header><div><p>{t("Archived")}</p><h2 id="archive-client-title">{client.client.companyName}</h2></div><button type="button" aria-label={t("Close")} onClick={() => setClient(null)}>×</button></header><h3>{t("Service locations")}</h3><ul>{client.client.sites.map((site) => <li key={site.id}>{site.name} · {site.addressLine1}, {site.city}</li>)}</ul><h3>{t("Related assignments")}</h3><div className="archiveTableScroll"><table><thead><tr><th>{t("Date")}</th><th>{t("Assignment")}</th><th>{t("Site")}</th><th>{t("Status")}</th></tr></thead><tbody>{client.assignments.map((assignment) => <tr key={assignment.id}><td>{new Date(assignment.startAt).toLocaleDateString(locale)}</td><td>{assignment.title}</td><td>{assignment.site.name}</td><td>{t(assignment.status.toLowerCase())}</td></tr>)}</tbody></table></div></section></div> : null}
    </main>
  );
}
