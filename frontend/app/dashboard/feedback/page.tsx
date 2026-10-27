"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE_URL, authenticatedFetch, responseMessage, restoreSession, type AuthenticationResult } from "../../lib/auth-client";
import DashboardShellHeader from "../dashboard-shell-header";
import { useDashboardLanguage } from "../dashboard-language";

type Feedback = { id: string; displayName: string; message: string; rating: number | null; allowPublic: boolean; status: string; createdAt: string };

export default function FeedbackPage() {
  const { t, locale } = useDashboardLanguage();
  const [access, setAccess] = useState("checking");
  const [session, setSession] = useState<AuthenticationResult | null>(null);
  const [items, setItems] = useState<Feedback[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    restoreSession().then((current) => { if (active) { setSession(current); setAccess(!current ? "signed-out" : current.user.role === "ADMIN" ? "allowed" : "forbidden"); } }).catch(() => { if (active) setAccess("signed-out"); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (access !== "allowed") return;
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (status) params.set("status", status);
    (async () => {
      setLoading(true);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/feedback?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error(await responseMessage(response));
        const result = await response.json() as { items: Feedback[]; pageCount: number };
        if (!controller.signal.aborted) { setItems(result.items); setPageCount(result.pageCount); }
      } catch (requestError) { if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "Feedback could not be loaded."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [access, page, status, version]);

  async function moderate(id: string, nextStatus: string) {
    setBusy(id); setError("");
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/feedback/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
      if (!response.ok) throw new Error(await responseMessage(response));
      setVersion((value) => value + 1);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Feedback could not be updated."); }
    finally { setBusy(""); }
  }
  if (access === "checking") return <main className="managementGate">{t("Checking administrator access…")}</main>;
  if (access !== "allowed") return <main className="managementGate"><h1>{t(access === "forbidden" ? "Administrator access required" : "Sign in required")}</h1><Link href="/dashboard">{t("Return to dashboard")}</Link></main>;
  return <main className="managementPage feedbackAdminWorkspace"><DashboardShellHeader role="ADMIN" email={session?.user.email ?? ""} /><section className="feedbackAdminPanel">
    <header><h1>{t("Customer feedback")}</h1><p>{t("Only publish feedback with the author's permission. Private feedback never appears on the homepage.")}</p><label>{t("Status")}<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">{t("All")}</option>{["PENDING", "PRIVATE", "PUBLISHED", "REJECTED"].map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label></header>
    {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}
    {loading ? <p role="status">{t("Loading…")}</p> : !items.length ? <p>{t("No feedback yet.")}</p> : items.map((item) => <article className="feedbackAdminCard" key={item.id}>
      <header><div><strong>{item.displayName}</strong><time>{new Date(item.createdAt).toLocaleString(locale)}</time></div><span>{t(item.status)}</span></header>
      {item.rating ? <p aria-label={`${item.rating}/5`}>{"★".repeat(item.rating)} ({item.rating}/5)</p> : null}<p>{item.message}</p><small>{t(item.allowPublic ? "Publication allowed by author" : "Private — publication not allowed")}</small>
      <footer><button type="button" disabled={!item.allowPublic || item.status === "PUBLISHED" || busy === item.id} onClick={() => void moderate(item.id, "PUBLISHED")}>{t("Publish")}</button><button type="button" disabled={item.status === "PRIVATE" || busy === item.id} onClick={() => void moderate(item.id, "PRIVATE")}>{t("Keep private")}</button><button type="button" disabled={item.status === "REJECTED" || busy === item.id} onClick={() => void moderate(item.id, "REJECTED")}>{t("Reject / unpublish")}</button></footer>
    </article>)}
    <footer className="archivePagination"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>{t("Previous")}</button><span>{page}/{Math.max(1, pageCount)}</span><button type="button" disabled={page >= pageCount || loading} onClick={() => setPage(page + 1)}>{t("Next")}</button></footer>
  </section></main>;
}
