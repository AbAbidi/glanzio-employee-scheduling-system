import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the public cleaning-company landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="de">/i);
  assert.match(html, /<title>Clarity Clean \| Intelligente Gebäudereinigung<\/title>/i);
  assert.match(html, /Sauberere Räume\./);
  assert.match(html, /Hellere Tage\./);
  assert.match(html, /Haushaltsreinigung/);
  assert.match(html, /Öffentliche Einrichtungen/);
  assert.match(html, /Pflege, die man sieht\./);
  assert.match(html, /Standards, denen Sie vertrauen können\./);
  assert.match(html, /Vertrauenswürdige Menschen/);
  assert.match(html, /Ziehen Sie, um den Unterschied zu sehen\./);
  assert.match(html, />EN<\/button>/);
  assert.match(html, /href="\/login"/);
  assert.match(html, /id="contact"/);
  assert.doesNotMatch(html, /Your site is taking shape/);
});

test("keeps the authentication and dashboard routes available", async () => {
  const [loginResponse, dashboardResponse] = await Promise.all([
    render("/login"),
    render("/dashboard"),
  ]);

  assert.equal(loginResponse.status, 200);
  assert.equal(dashboardResponse.status, 200);

  const [loginHtml, dashboardHtml] = await Promise.all([
    loginResponse.text(),
    dashboardResponse.text(),
  ]);

  assert.match(loginHtml, /Every shift, site, and team in one calm view\./);
  assert.match(loginHtml, /Checking your session/);
  assert.match(dashboardHtml, /Preparing your workspace/);
});
