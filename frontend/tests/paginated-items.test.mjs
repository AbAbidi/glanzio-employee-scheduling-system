import assert from "node:assert/strict";
import { test } from "node:test";
import { loadPaginatedItems } from "../app/lib/paginated-items.ts";

test("loads all calendar pages, including assignments after the first 100", async () => {
  const requested = [];
  const items = await loadPaginatedItems(async (page) => {
    requested.push(page);
    return { page, pageCount: 2, items: page === 1
      ? Array.from({ length: 100 }, (_, i) => ({ id: String(i) }))
      : [{ id: "100" }] };
  });
  assert.deepEqual(requested, [1, 2]);
  assert.equal(items.length, 101);
});

test("accepts an empty calendar", async () => {
  assert.deepEqual(await loadPaginatedItems(async () => ({ items: [], page: 1, pageCount: 0 })), []);
});

test("deduplicates records if data moves between pages", async () => {
  const items = await loadPaginatedItems(async (page) => ({
    page, pageCount: 2, items: [{ id: "same", value: page }],
  }));
  assert.deepEqual(items, [{ id: "same", value: 2 }]);
});

test("does not publish a partial result when a later page fails", async () => {
  await assert.rejects(loadPaginatedItems(async (page) => {
    if (page === 2) throw new Error("Service unavailable");
    return { page, pageCount: 2, items: [{ id: "1" }] };
  }), /Service unavailable/);
});

test("rejects invalid or stuck pagination", async () => {
  await assert.rejects(loadPaginatedItems(async () => ({ page: 1, pageCount: 2, items: [] })), /complete calendar/);
  await assert.rejects(loadPaginatedItems(async () => ({ page: 9, pageCount: 2, items: [{ id: "1" }] })), /invalid pagination/);
});

test("stops requesting pages after unmount or a range change", async () => {
  let active = true;
  let calls = 0;
  const result = await loadPaginatedItems(async (page) => {
    calls += 1;
    active = false;
    return { page, pageCount: 5, items: [{ id: "1" }] };
  }, () => active);
  assert.equal(calls, 1);
  assert.deepEqual(result, []);
});
