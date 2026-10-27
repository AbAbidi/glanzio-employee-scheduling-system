import type { AccountRole } from "./access-policy";

export type SessionUser = {
  id: string;
  email: string | null;
  role: AccountRole;
  status: string;
  employee: {
    id: string;
    loginCode?: string;
    firstName: string;
    lastName: string;
    isStudent: boolean;
    active: boolean;
  } | null;
};

export type AuthenticationResult = {
  accessToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresAt: string;
  user: SessionUser;
};

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1";

export const OPERATIONS_CHANGED_EVENT = "glanzio-operations-changed";

function notifyOperationsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPERATIONS_CHANGED_EVENT));
  try {
    // No employee or assignment data is stored; this only notifies other tabs.
    window.localStorage.setItem(OPERATIONS_CHANGED_EVENT, `${Date.now()}:${Math.random()}`);
  } catch { /* Same-tab updates still work when storage is disabled. */ }
}

let currentSession: AuthenticationResult | null | undefined;
let accessTokenExpiresAt = 0;
let sessionRequest: Promise<AuthenticationResult | null> | null = null;
let sessionGeneration = 0;
const expiryMarginMs = 30_000;
const sessionEndedMessage = "Your session has ended. Please sign in again to continue.";

function tokenExpiry(session: AuthenticationResult): number {
  // JWT decoding only schedules renewal; the server still verifies the signature.
  try {
    const payload = session.accessToken.split(".")[1];
    const { exp } = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof exp === "number" && Number.isFinite(exp)) return exp * 1000;
  } catch {
    // Test tokens or opaque tokens can use the server's lifetime instead.
  }
  const duration = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/.exec(session.accessTokenExpiresIn);
  const units: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return duration ? Date.now() + Number(duration[1]) * units[duration[2] ?? "ms"] : 0;
}

function storeSession(session: AuthenticationResult | null) {
  currentSession = session;
  accessTokenExpiresAt = session ? tokenExpiry(session) : 0;
}

async function withSessionLock<T>(action: () => Promise<T>): Promise<T> {
  // Cookies are shared across tabs. Serialize rotation there too when supported.
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(`glanzio-session:${API_BASE_URL}`, action);
  }
  return action();
}

function refreshSession(): Promise<AuthenticationResult | null> {
  if (sessionRequest) return sessionRequest;
  const generation = sessionGeneration;
  const pending = withSessionLock(async () => {
    if (generation !== sessionGeneration) return currentSession ?? null;
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (generation !== sessionGeneration) return currentSession ?? null;
    if (response.status === 401 || response.status === 403) {
      storeSession(null);
      return null;
    }
    // A temporary outage must not turn a valid refresh session into a logout.
    if (!response.ok) throw new Error("Unable to renew your session. Please try again.");
    const session = (await response.json()) as AuthenticationResult;
    if (generation !== sessionGeneration) return currentSession ?? null;
    storeSession(session);
    return session;
  });
  sessionRequest = pending;
  void pending.finally(() => {
    if (sessionRequest === pending) sessionRequest = null;
  }).catch(() => { /* The caller receives the original rejection. */ });
  return pending;
}

export function restoreSession(): Promise<AuthenticationResult | null> {
  if (currentSession === null || (currentSession && Date.now() < accessTokenExpiresAt - expiryMarginMs)) {
    return Promise.resolve(currentSession);
  }
  return refreshSession();
}

export function cacheSession(session: AuthenticationResult | null) {
  sessionGeneration += 1;
  sessionRequest = null;
  storeSession(session);
}

export function clearSessionCache() {
  sessionGeneration += 1;
  sessionRequest = null;
  currentSession = undefined;
  accessTokenExpiresAt = 0;
}

function sessionEndedResponse(): Response {
  return new Response(JSON.stringify({ message: sessionEndedMessage }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

/** Internal API requests only. Never retries a network failure or a non-401 response. */
export async function authenticatedFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const url = new URL(input);
  const api = new URL(API_BASE_URL);
  if (url.origin !== api.origin || !url.pathname.startsWith(`${api.pathname.replace(/\/$/, "")}/`)) {
    throw new Error("Authenticated requests must target the application API.");
  }
  init.signal?.throwIfAborted();
  const session = await restoreSession();
  init.signal?.throwIfAborted();
  if (!session) return sessionEndedResponse();

  const send = (accessToken: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(input, { ...init, headers });
  };
  const finish = (response: Response) => {
    const path = url.pathname.slice(api.pathname.replace(/\/$/, "").length);
    if (response.ok && !["GET", "HEAD"].includes((init.method ?? "GET").toUpperCase()) && /^\/(assignments|recurring-assignments|employees|clients|sites)(\/|$)/.test(path)) {
      notifyOperationsChanged();
    }
    return response;
  };
  const response = await send(session.accessToken);
  if (response.status !== 401) return finish(response);
  init.signal?.throwIfAborted();

  // Another request may have already replaced the rejected token.
  const renewed = currentSession === null ? null
    : currentSession && currentSession.accessToken !== session.accessToken
      ? await restoreSession() : await refreshSession();
  init.signal?.throwIfAborted();
  if (!renewed || renewed.user.id !== session.user.id) return sessionEndedResponse();
  // A 401 is rejected by authentication before assignment creation runs. One
  // retry is safe; network errors (unknown write outcome) are never retried.
  return finish(await send(renewed.accessToken));
}

export async function signOut(): Promise<void> {
  cacheSession(null);
  try {
    await withSessionLock(() => fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    }));
  } finally {
    cacheSession(null);
  }
}

export async function responseMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as
    | { message?: string | string[] }
    | null;
  const message = body?.message;

  if (Array.isArray(message)) {
    return message.join(" ");
  }

  return message ?? "Something went wrong. Please try again.";
}
