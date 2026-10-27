import assert from "node:assert/strict";
import test from "node:test";

let counter = 0;
async function harness() {
  const values = new Map();
  globalThis.window = { localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }, dispatchEvent: () => true };
  return { values, api: await import(`../app/lib/cookie-preferences.ts?test=${counter++}`) };
}
test.afterEach(() => { delete globalThis.window; });

test("no choice is preselected; necessary-only and accept are stored without an identifier", async () => {
  const { values, api } = await harness();
  assert.equal(api.readCookieChoice(), null);
  api.saveCookieChoice("necessary");
  assert.equal(api.readCookieChoice().choice, "necessary");
  const saved = JSON.parse(values.get(api.COOKIE_PREFERENCES_KEY));
  assert.deepEqual(Object.keys(saved).sort(), ["choice", "savedAt", "version"]);
  api.saveCookieChoice("accept");
  assert.equal(api.readCookieChoice().choice, "accept");
});
test("invalid, expired and future choices are rejected", async () => {
  const { values, api } = await harness();
  for (const value of ["not json", { version: 0, choice: "accept", savedAt: Date.now() }, { version: 1, choice: "accept", savedAt: Date.now() - 181 * 86400_000 }, { version: 1, choice: "necessary", savedAt: Date.now() + 10000 }]) {
    values.set(api.COOKIE_PREFERENCES_KEY, typeof value === "string" ? value : JSON.stringify(value));
    assert.equal(api.readCookieChoice(), null);
  }
});
test("blocked browser storage still allows a session-only choice", async () => {
  const { api } = await harness();
  window.localStorage.getItem = () => { throw new Error("blocked"); };
  window.localStorage.setItem = () => { throw new Error("blocked"); };
  api.saveCookieChoice("necessary");
  assert.equal(api.readCookieChoice().choice, "necessary");
});
