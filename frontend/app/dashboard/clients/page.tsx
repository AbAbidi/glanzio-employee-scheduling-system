"use client";

import { useDashboardLanguage } from "../dashboard-language";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  API_BASE_URL, authenticatedFetch,
  responseMessage,
  restoreSession,
  type AuthenticationResult,
} from "../../lib/auth-client";
import DashboardShellHeader from "../dashboard-shell-header";
import ClientArchiveDialog from "./client-archive-dialog";
import type { Client, ClientListItem, ClientListResponse, ClientOverview } from "./types";

type AccessState = "checking" | "signed-out" | "forbidden" | "allowed";

function visualAssignmentStatus(assignment: ClientOverview["assignments"][number]) {
  if (assignment.status === "CANCELLED") return "Cancelled";
  if (new Date(assignment.endAt) <= new Date()) return "Completed";
  return "Scheduled";
}

export default function ClientsPage() {
  const { t } = useDashboardLanguage();
  const [access, setAccess] = useState<AccessState>("checking");
  const [session, setSession] = useState<AuthenticationResult | null>(null);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [selected, setSelected] = useState<ClientOverview | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [clientToArchive, setClientToArchive] = useState<ClientListItem | null>(null);

  async function loadClients(currentSession: AuthenticationResult) {
    setLoading(true);
    setError("");
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/clients?active=true&page=1&pageSize=100`, {
        headers: { Authorization: `Bearer ${currentSession.accessToken}` },
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const result = (await response.json()) as ClientListResponse;
      setClients(result.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Clients could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const current = await restoreSession();
        if (!active) return;
        if (!current) return setAccess("signed-out");
        if (current.user.role === "EMPLOYEE") return setAccess("forbidden");
        setSession(current);
        setAccess("allowed");
        await loadClients(current);
      } catch {
        if (active) setAccess("signed-out");
      }
    }
    void initialize();
    return () => { active = false; };
  }, []);

  const visibleClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) =>
      [client.companyName, client.contactName, client.email, client.phone]
        .some((value) => value?.toLowerCase().includes(query)),
    );
  }, [clients, search]);

  async function openDetails(clientId: string) {
    if (!session) return;
    setError("");
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/clients/${clientId}/overview`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setSelected((await response.json()) as ClientOverview);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Client details could not be loaded.");
    }
  }

  async function updateClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !editing) return;
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/clients/${editing.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: String(data.get("companyName") ?? "").trim(),
          contactName: String(data.get("contactName") ?? "").trim() || undefined,
          email: String(data.get("email") ?? "").trim() || undefined,
          phone: String(data.get("phone") ?? "").trim() || undefined,
          notes: String(data.get("notes") ?? "").trim() || undefined,
        }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const updated = (await response.json()) as Client;
      setClients((current) => current.map((client) => client.id === updated.id ? { ...client, ...updated } : client));
      setEditing(null);
      setNotice("Client profile updated.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Client could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveClient(client: ClientListItem) {
    if (!session) throw new Error(t("Sign in required"));
    setError("");
    const response = await authenticatedFetch(`${API_BASE_URL}/clients/${client.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (!response.ok) throw new Error(await responseMessage(response));
    setClients((current) => current.filter((item) => item.id !== client.id));
    setClientToArchive(null);
    setNotice(t("Client archived. Historical assignments were preserved."));
  }

  if (access === "checking") return <main className="managementGate">{t("Checking administrator access…")}</main>;
  if (access === "signed-out") return <main className="managementGate"><h1>{t("Sign in required")}</h1><Link href="/login">{t("Go to sign in")}</Link></main>;
  if (access === "forbidden") return <main className="managementGate"><h1>{t("Administrator access required")}</h1><Link href="/dashboard">{t("Return to dashboard")}</Link></main>;

  return (
    <main className="managementPage clientWorkspace">
      <DashboardShellHeader email={session?.user.email ?? ""} role={session?.user.role ?? "EMPLOYEE"} />
      <section className="clientPageHero">
        <div><p>{t("Customer operations")}</p><h1>{t("Client directory")}</h1><span>{t("Manage client profiles and review their assignment history. New service locations are added while scheduling.")}</span></div>
        <strong>{clients.filter((client) => client.active).length}<small>{t(" active clients")}</small></strong>
      </section>
      {notice ? <p className="managementNotice">{notice}</p> : null}
      {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}

      <section className="clientDirectoryPanel">
        <header><div><p>{t("Directory")}</p><h2>{t("All clients")}</h2></div><label>{t("Search clients")}<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Name, email or phone")} /></label></header>
        {loading ? <p>{t("Loading clients…")}</p> : null}
        {!loading && visibleClients.length === 0 ? <p>{t("No matching clients found.")}</p> : null}
        <div className="clientCardGrid">
          {visibleClients.map((client) => (
            <article className={!client.active ? "isArchived" : ""} key={client.id}>
              <div className="clientCardTop"><span>{client.companyName.slice(0, 2).toUpperCase()}</span><i>{client.active ? t("Active") : t("Archived")}</i></div>
              <h3>{client.companyName}</h3>
              <p>{client.contactName ?? t("No contact person")}</p>
              <dl><div><dt>{t("Email")}</dt><dd>{client.email ?? t("Not provided")}</dd></div><div><dt>{t("Phone")}</dt><dd>{client.phone ?? t("Not provided")}</dd></div><div><dt>{t("Locations")}</dt><dd>{client._count.sites}</dd></div></dl>
              <footer>
                <button type="button" onClick={() => void openDetails(client.id)}>{t("View details")}</button>
                {client.active ? <button type="button" onClick={() => setEditing(client)}>{t("Edit")}</button> : null}
                {client.active && session?.user.role === "ADMIN" ? <button className="dangerLink" type="button" onClick={() => setClientToArchive(client)}>{t("Archive")}</button> : null}
              </footer>
            </article>
          ))}
        </div>
      </section>

      {clientToArchive ? <ClientArchiveDialog name={clientToArchive.companyName} onClose={() => setClientToArchive(null)} onConfirm={() => archiveClient(clientToArchive)} /> : null}

      {selected ? (
        <div className="schedulerBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="clientDetailDialog" role="dialog" aria-modal="true">
            <header><div><p>{t("Client profile")}</p><h2>{selected.client.companyName}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label={t("Close")}>×</button></header>
            <div className="clientDetailStats"><span><strong>{selected.client.sites.length}</strong>{t(" sites")}</span><span><strong>{selected.assignments.length}</strong>{t(" assignments")}</span><span><strong>{selected.assignments.filter((item) => visualAssignmentStatus(item) === "Completed").length}</strong>{t(" completed")}</span></div>
            <section><h3>{t("Service locations")}</h3><div className="clientSiteList">{selected.client.sites.map((site) => <article key={site.id}><strong>{site.name}</strong><span>{site.addressLine1}, {site.city}</span><small>{site._count.assignments}{t(" assignment")}{site._count.assignments === 1 ? "" : t("s")}</small></article>)}</div></section>
            <section><h3>{t("Related assignments")}</h3><div className="clientAssignmentTable clientRevenueTable"><div className="tableHeader"><span>{t("Date")}</span><span>{t("Assignment")}</span><span>{t("Site")}</span><span>{t("Team")}</span><span>{t("Client price")}</span><span>{t("Status")}</span></div>{selected.assignments.map((assignment) => <div key={assignment.id}><time>{new Date(assignment.startAt).toLocaleDateString()}</time><strong>{assignment.title}</strong><span>{assignment.site.name}</span><span>{assignment.employees.map((link) => `${link.employee.firstName} ${link.employee.lastName}`).join(", ") || "Unassigned"}</span><strong>{assignment.clientCharge ? `€${Number(assignment.clientCharge).toFixed(2)}` : "—"}</strong><i className={`clientAssignment${visualAssignmentStatus(assignment)}`}>{visualAssignmentStatus(assignment)}</i></div>)}</div></section>
          </section>
        </div>
      ) : null}

      {editing ? <div className="schedulerBackdrop"><section className="compactManagementDialog"><header><h2>{t("Edit client profile")}</h2><button type="button" onClick={() => setEditing(null)}>×</button></header><form onSubmit={updateClient}><label>{t("Company name")}<input name="companyName" defaultValue={editing.companyName} required /></label><label>{t("Contact name")}<input name="contactName" defaultValue={editing.contactName ?? ""} /></label><label>{t("Email")}<input name="email" type="email" defaultValue={editing.email ?? ""} /></label><label>{t("Phone")}<input name="phone" defaultValue={editing.phone ?? ""} /></label><label>{t("Notes")}<textarea name="notes" defaultValue={editing.notes ?? ""} rows={4} /></label><footer><button type="button" onClick={() => setEditing(null)}>{t("Cancel")}</button><button type="submit" disabled={saving}>{saving ? t("Saving…") : t("Save profile")}</button></footer></form></section></div> : null}
    </main>
  );
}
