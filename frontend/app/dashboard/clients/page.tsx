"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  API_BASE_URL,
  responseMessage,
  restoreSession,
  type AuthenticationResult,
} from "../../lib/auth-client";
import DashboardShellHeader from "../dashboard-shell-header";
import type { Client, ClientListItem, ClientListResponse, ClientOverview } from "./types";

type AccessState = "checking" | "signed-out" | "forbidden" | "allowed";

function visualAssignmentStatus(assignment: ClientOverview["assignments"][number]) {
  if (assignment.status === "CANCELLED") return "Cancelled";
  if (new Date(assignment.endAt) <= new Date()) return "Completed";
  return "Scheduled";
}

export default function ClientsPage() {
  const [access, setAccess] = useState<AccessState>("checking");
  const [session, setSession] = useState<AuthenticationResult | null>(null);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [selected, setSelected] = useState<ClientOverview | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [siteClient, setSiteClient] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadClients(currentSession: AuthenticationResult) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/clients?page=1&pageSize=100`, {
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
        if (current.user.role !== "ADMIN") return setAccess("forbidden");
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
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/overview`, {
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
      const response = await fetch(`${API_BASE_URL}/clients/${editing.id}`, {
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

  async function addSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !siteClient) return;
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/sites`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: siteClient.id,
          name: String(data.get("name") ?? "").trim(),
          addressLine1: String(data.get("addressLine1") ?? "").trim(),
          city: String(data.get("city") ?? "").trim(),
          countryCode: String(data.get("countryCode") ?? "DE").trim().toUpperCase(),
          requiredEquipment: [],
        }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      await response.json();
      setClients((current) => current.map((client) => client.id === siteClient.id ? { ...client, _count: { sites: client._count.sites + 1 } } : client));
      setSiteClient(null);
      setNotice("New cleaning site assigned to the client.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The site could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveClient(client: ClientListItem) {
    if (!session || !window.confirm(`Archive ${client.companyName} and its active sites? Previous assignments will be preserved.`)) return;
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/clients/${client.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setClients((current) => current.map((item) => item.id === client.id ? { ...item, active: false } : item));
      setNotice("Client archived. Historical assignments were preserved.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The client could not be archived.");
    }
  }

  if (access === "checking") return <main className="managementGate">Checking administrator access…</main>;
  if (access === "signed-out") return <main className="managementGate"><h1>Sign in required</h1><Link href="/login">Go to sign in</Link></main>;
  if (access === "forbidden") return <main className="managementGate"><h1>Administrator access required</h1><Link href="/dashboard">Return to dashboard</Link></main>;

  return (
    <main className="managementPage clientWorkspace">
      <DashboardShellHeader email={session?.user.email ?? ""} role="ADMIN" />
      <section className="clientPageHero">
        <div><p>Customer operations</p><h1>Clients & service locations</h1><span>Manage profiles, sites and assignment history from one workspace.</span></div>
        <strong>{clients.filter((client) => client.active).length}<small> active clients</small></strong>
      </section>
      {notice ? <p className="managementNotice">{notice}</p> : null}
      {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}

      <section className="clientDirectoryPanel">
        <header><div><p>Directory</p><h2>All clients</h2></div><label>Search clients<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email or phone" /></label></header>
        {loading ? <p>Loading clients…</p> : null}
        {!loading && visibleClients.length === 0 ? <p>No matching clients found.</p> : null}
        <div className="clientCardGrid">
          {visibleClients.map((client) => (
            <article className={!client.active ? "isArchived" : ""} key={client.id}>
              <div className="clientCardTop"><span>{client.companyName.slice(0, 2).toUpperCase()}</span><i>{client.active ? "Active" : "Archived"}</i></div>
              <h3>{client.companyName}</h3>
              <p>{client.contactName ?? "No contact person"}</p>
              <dl><div><dt>Email</dt><dd>{client.email ?? "Not provided"}</dd></div><div><dt>Phone</dt><dd>{client.phone ?? "Not provided"}</dd></div><div><dt>Locations</dt><dd>{client._count.sites}</dd></div></dl>
              <footer>
                <button type="button" onClick={() => void openDetails(client.id)}>View details</button>
                {client.active ? <button type="button" onClick={() => setEditing(client)}>Edit</button> : null}
                {client.active ? <button type="button" onClick={() => setSiteClient(client)}>+ Site</button> : null}
                {client.active ? <button className="dangerLink" type="button" onClick={() => void archiveClient(client)}>Archive</button> : null}
              </footer>
            </article>
          ))}
        </div>
      </section>

      {selected ? (
        <div className="schedulerBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="clientDetailDialog" role="dialog" aria-modal="true">
            <header><div><p>Client profile</p><h2>{selected.client.companyName}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Close">×</button></header>
            <div className="clientDetailStats"><span><strong>{selected.client.sites.length}</strong> sites</span><span><strong>{selected.assignments.length}</strong> assignments</span><span><strong>{selected.assignments.filter((item) => visualAssignmentStatus(item) === "Completed").length}</strong> completed</span></div>
            <section><h3>Service locations</h3><div className="clientSiteList">{selected.client.sites.map((site) => <article key={site.id}><strong>{site.name}</strong><span>{site.addressLine1}, {site.city}</span><small>{site._count.assignments} assignment{site._count.assignments === 1 ? "" : "s"}</small></article>)}</div></section>
            <section><h3>Related assignments</h3><div className="clientAssignmentTable clientRevenueTable"><div className="tableHeader"><span>Date</span><span>Assignment</span><span>Site</span><span>Team</span><span>Client price</span><span>Status</span></div>{selected.assignments.map((assignment) => <div key={assignment.id}><time>{new Date(assignment.startAt).toLocaleDateString()}</time><strong>{assignment.title}</strong><span>{assignment.site.name}</span><span>{assignment.employees.map((link) => `${link.employee.firstName} ${link.employee.lastName}`).join(", ") || "Unassigned"}</span><strong>{assignment.clientCharge ? `€${Number(assignment.clientCharge).toFixed(2)}` : "—"}</strong><i className={`clientAssignment${visualAssignmentStatus(assignment)}`}>{visualAssignmentStatus(assignment)}</i></div>)}</div></section>
          </section>
        </div>
      ) : null}

      {editing ? <div className="schedulerBackdrop"><section className="compactManagementDialog"><header><h2>Edit client profile</h2><button type="button" onClick={() => setEditing(null)}>×</button></header><form onSubmit={updateClient}><label>Company name<input name="companyName" defaultValue={editing.companyName} required /></label><label>Contact name<input name="contactName" defaultValue={editing.contactName ?? ""} /></label><label>Email<input name="email" type="email" defaultValue={editing.email ?? ""} /></label><label>Phone<input name="phone" defaultValue={editing.phone ?? ""} /></label><label>Notes<textarea name="notes" defaultValue={editing.notes ?? ""} rows={4} /></label><footer><button type="button" onClick={() => setEditing(null)}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button></footer></form></section></div> : null}

      {siteClient ? <div className="schedulerBackdrop"><section className="compactManagementDialog"><header><div><small>New service location for</small><h2>{siteClient.companyName}</h2></div><button type="button" onClick={() => setSiteClient(null)}>×</button></header><form onSubmit={addSite}><label>Location name<input name="name" placeholder="Berlin office" required /></label><label>Street address<input name="addressLine1" required /></label><div className="twoFieldGrid"><label>City<input name="city" defaultValue="Berlin" required /></label><label>Country code<input name="countryCode" defaultValue="DE" minLength={2} maxLength={2} required /></label></div><p className="dialogHint">This location becomes available immediately when creating an assignment.</p><footer><button type="button" onClick={() => setSiteClient(null)}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Creating…" : "Assign site"}</button></footer></form></section></div> : null}
    </main>
  );
}
