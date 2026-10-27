import assert from "node:assert/strict";
import { test } from "node:test";

let moduleId = 0;
async function client() {
  // An isolated in-memory session for each test; Node strips the TS types.
  return import(`../app/lib/auth-client.ts?test=${++moduleId}`);
}
function session(accessToken = "initial-token", extra = {}) {
  return {
    accessToken, accessTokenExpiresIn: "15m",
    refreshTokenExpiresAt: "2099-01-01T00:00:00Z",
    user: { id: "admin-1", role: "ADMIN" }, ...extra,
  };
}
const json = (body, status = 200) => Response.json(body, { status });
const expired = () => json({ message: "The access token is invalid or expired." }, 401);
const token = (init) => new Headers(init?.headers).get("Authorization");
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test("valid cached session replaces stale component headers, preserving POST content", async (t) => {
  const auth = await client();
  auth.cacheSession(session("fresh"));
  const body = JSON.stringify({ title: "Keep these form values" });
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, `${auth.API_BASE_URL}/assignments`);
    assert.equal(token(init), "Bearer fresh");
    assert.equal(init.method, "POST");
    assert.equal(init.body, body);
    assert.equal(new Headers(init.headers).get("Content-Type"), "application/json");
    return json({ id: "created-once" }, 201);
  });
  assert.equal((await auth.authenticatedFetch(`${auth.API_BASE_URL}/assignments`, {
    method: "POST", headers: { Authorization: "Bearer stale", "Content-Type": "application/json" }, body,
  })).status, 201);
  assert.equal(fetch.mock.callCount(), 1);
});

test("near-expiry JWT refreshes before route calculation, using the cookie", async (t) => {
  const auth = await client();
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 10 })).toString("base64url");
  auth.cacheSession(session(`header.${payload}.signature`));
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push(url);
    if (url.endsWith("/auth/refresh")) {
      assert.equal(init.credentials, "include");
      assert.equal(init.method, "POST");
      return json(session("renewed"));
    }
    assert.equal(token(init), "Bearer renewed");
    return json({ travelDistanceMeters: 500 });
  });
  await auth.authenticatedFetch(`${auth.API_BASE_URL}/calendar/route-preview`, { method: "POST", body: "{}" });
  assert.deepEqual(calls, [`${auth.API_BASE_URL}/auth/refresh`, `${auth.API_BASE_URL}/calendar/route-preview`]);
});

test("opaque token lifetime triggers renewal after idle time", async (t) => {
  const auth = await client();
  let now = 1_000_000;
  t.mock.method(Date, "now", () => now);
  auth.cacheSession(session("initial"));
  now += 16 * 60_000;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (url.endsWith("/auth/refresh")) return json(session("renewed"));
    assert.equal(token(init), "Bearer renewed");
    return json({});
  });
  await auth.authenticatedFetch(`${auth.API_BASE_URL}/assignments`);
  assert.equal(fetch.mock.callCount(), 2);
});

test("401 retries a write once with the same body after a shared refresh", async (t) => {
  const auth = await client();
  auth.cacheSession(session("old"));
  const sentBodies = [];
  let refreshes = 0;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (url.endsWith("/auth/refresh")) { refreshes++; return json(session("new")); }
    sentBodies.push(init.body);
    return token(init) === "Bearer old" ? expired() : json({ id: "one-assignment" }, 201);
  });
  assert.equal((await auth.authenticatedFetch(`${auth.API_BASE_URL}/assignments`, { method: "POST", body: '{"title":"Test"}' })).status, 201);
  assert.equal(refreshes, 1);
  assert.deepEqual(sentBodies, ['{"title":"Test"}', '{"title":"Test"}']);
});

test("parallel 401 responses rotate the refresh cookie only once", async (t) => {
  const auth = await client();
  auth.cacheSession(session("old"));
  const gate = deferred();
  let refreshes = 0;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (url.endsWith("/auth/refresh")) { refreshes++; await gate.promise; return json(session("new")); }
    return token(init) === "Bearer old" ? expired() : json({});
  });
  const requests = ["employees", "clients", "sites"].map((path) => auth.authenticatedFetch(`${auth.API_BASE_URL}/${path}`));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(refreshes, 1);
  gate.resolve();
  assert.deepEqual((await Promise.all(requests)).map((r) => r.status), [200, 200, 200]);
  assert.equal(refreshes, 1);
});

test("a late 401 uses the token already renewed by another request", async (t) => {
  const auth = await client();
  auth.cacheSession(session("old"));
  const lateResponse = deferred();
  let refreshes = 0;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (url.endsWith("/auth/refresh")) { refreshes++; return json(session("new")); }
    if (token(init) === "Bearer new") return json({});
    return url.endsWith("/slow") ? lateResponse.promise : expired();
  });
  const slow = auth.authenticatedFetch(`${auth.API_BASE_URL}/slow`);
  assert.equal((await auth.authenticatedFetch(`${auth.API_BASE_URL}/fast`)).status, 200);
  lateResponse.resolve(expired());
  assert.equal((await slow).status, 200);
  assert.equal(refreshes, 1);
});

test("rejected renewed token cannot cause an infinite retry loop", async (t) => {
  const auth = await client();
  auth.cacheSession(session("old"));
  t.mock.method(globalThis, "fetch", async (url) => url.endsWith("/auth/refresh") ? json(session("new")) : expired());
  assert.equal((await auth.authenticatedFetch(`${auth.API_BASE_URL}/assignments`)).status, 401);
  assert.equal(fetch.mock.callCount(), 3);
});

test("expired refresh session stops the write and returns a sign-in message", async (t) => {
  const auth = await client();
  auth.cacheSession(session("old"));
  t.mock.method(globalThis, "fetch", async () => expired());
  const response = await auth.authenticatedFetch(`${auth.API_BASE_URL}/assignments`, { method: "POST", body: "{}" });
  assert.equal(response.status, 401);
  assert.match(await auth.responseMessage(response), /sign in again/i);
  assert.equal(fetch.mock.callCount(), 2);
  await auth.authenticatedFetch(`${auth.API_BASE_URL}/assignments`);
  assert.equal(fetch.mock.callCount(), 2);
});

for (const status of [400, 403, 409, 422, 500]) {
  test(`HTTP ${status} is returned without replaying the request`, async (t) => {
    const auth = await client();
    auth.cacheSession(session());
    t.mock.method(globalThis, "fetch", async () => json({}, status));
    assert.equal((await auth.authenticatedFetch(`${auth.API_BASE_URL}/assignments`, { method: "POST", body: "{}" })).status, status);
    assert.equal(fetch.mock.callCount(), 1);
  });
}

test("network failure on a write is never replayed", async (t) => {
  const auth = await client();
  auth.cacheSession(session());
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(auth.authenticatedFetch(`${auth.API_BASE_URL}/assignments`, { method: "POST", body: "{}" }), /Failed to fetch/);
  assert.equal(fetch.mock.callCount(), 1);
});

test("temporary refresh failures are retryable, not cached as a permanent logout", async (t) => {
  const auth = await client();
  let attempt = 0;
  t.mock.method(globalThis, "fetch", async () => ++attempt === 1 ? json({}, 503) : json(session("recovered")));
  await assert.rejects(auth.restoreSession(), /try again/);
  assert.equal((await auth.restoreSession()).accessToken, "recovered");
});

test("network failure during restoration does not poison the session cache", async (t) => {
  const auth = await client();
  let attempt = 0;
  t.mock.method(globalThis, "fetch", async () => {
    if (++attempt === 1) throw new TypeError("Offline");
    return json(session("recovered"));
  });
  await assert.rejects(auth.restoreSession(), /Offline/);
  assert.equal((await auth.restoreSession()).accessToken, "recovered");
});

test("logout cannot be undone by an in-flight refresh", async (t) => {
  const auth = await client();
  const gate = deferred();
  const started = deferred();
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url.endsWith("/auth/refresh")) { started.resolve(); await gate.promise; return json(session("late")); }
    return new Response(null, { status: 204 });
  });
  const restoring = auth.restoreSession();
  await started.promise;
  const signingOut = auth.signOut();
  gate.resolve();
  await signingOut;
  assert.equal(await restoring, null);
  assert.equal(await auth.restoreSession(), null);
});

test("independent tabs serialize refresh-cookie rotation with Web Locks", async (t) => {
  if (!globalThis.navigator?.locks) { t.skip("Web Locks unavailable in this runtime"); return; }
  const firstTab = await client();
  const secondTab = await client();
  const gate = deferred();
  const started = deferred();
  let active = 0;
  let peak = 0;
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    active++;
    peak = Math.max(peak, active);
    const call = ++calls;
    if (call === 1) { started.resolve(); await gate.promise; }
    active--;
    return json(session(`tab-token-${call}`));
  });
  const first = firstTab.restoreSession();
  await started.promise;
  const second = secondTab.restoreSession();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  gate.resolve();
  await Promise.all([first, second]);
  assert.equal(calls, 2);
  assert.equal(peak, 1);
});

test("aborted map requests do not retry or cancel another caller's refresh", async (t) => {
  const auth = await client();
  const gate = deferred();
  t.mock.method(globalThis, "fetch", async () => { await gate.promise; return json(session("new")); });
  const controller = new AbortController();
  const request = auth.authenticatedFetch(`${auth.API_BASE_URL}/calendar/route-preview`, { signal: controller.signal });
  const other = auth.restoreSession();
  controller.abort();
  gate.resolve();
  await assert.rejects(request, { name: "AbortError" });
  assert.equal((await other).accessToken, "new");
  assert.equal(fetch.mock.callCount(), 1);
});

test("tokens cannot be sent to another origin or outside the API", async (t) => {
  const auth = await client();
  auth.cacheSession(session());
  t.mock.method(globalThis, "fetch", async () => json({}));
  await assert.rejects(auth.authenticatedFetch("https://example.com/collect"), /application API/);
  await assert.rejects(auth.authenticatedFetch(`${new URL(auth.API_BASE_URL).origin}/other`), /application API/);
  assert.equal(fetch.mock.callCount(), 0);
});

test("a different account is never used to replay the first account's write", async (t) => {
  const auth = await client();
  auth.cacheSession(session("old"));
  t.mock.method(globalThis, "fetch", async (url) => url.endsWith("/auth/refresh")
    ? json(session("new", { user: { id: "other-user" } })) : expired());
  assert.equal((await auth.authenticatedFetch(`${auth.API_BASE_URL}/assignments`, { method: "POST", body: "{}" })).status, 401);
  assert.equal(fetch.mock.callCount(), 2);
});
