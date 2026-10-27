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
  assert.match(
    html,
    /<title>Glanzio Reinigung \| Gebäudereinigung am Bodensee<\/title>/i,
  );
  assert.match(html, /Sauberkeit\./);
  assert.match(html, /class="homeBrandIntro"[^>]*hidden=""[^>]*aria-hidden="true"/);
  assert.ok(
    html.indexOf("if (window.__glanzioBrandIntro)") < html.indexOf('<main class="landingPage"'),
    "the synchronous splash bootstrap must precede page content",
  );
  assert.match(html, /Vertrauen\. Qualität\./);
  for (const service of [
    "Gebäudereinigung",
    "Treppenhausreinigung",
    "Unterhaltsreinigung",
    "Glas- und Fensterreinigung",
    "Hausmeisterservice",
    "Winterdienst",
  ]) {
    assert.match(html, new RegExp(service));
  }
  assert.equal((html.match(/class="serviceCard hasMedia"/g) ?? []).length, 12);
  for (const image of [
    "service-building-2026.png",
    "service-stairwell-2026.png",
    "service-maintenance-2026.png",
    "service-windows-2026.png",
    "service-caretaker-2026.png",
    "service-winter-2026.png",
  ]) {
    assert.match(html, new RegExp(`src="/${image}"`));
  }
  assert.doesNotMatch(html, /Mehr erfahren/);
  assert.doesNotMatch(
    html,
    /Animation pausieren|Animation fortsetzen|Vorherige Leistung|Nächste Leistung/,
  );
  assert.match(html, /Details anzeigen/);
  assert.match(html, /class="serviceDetailsButton"/);
  assert.doesNotMatch(html, /class="serviceCardHint"/);
  assert.doesNotMatch(html, /class="serviceCardDetails"/);
  assert.match(html, /Wir definieren/);
  assert.match(html, /Sauberkeit neu\./);
  assert.match(html, /class="qualityJourney"/);
  assert.equal((html.match(/class="qualityMoment"/g) ?? []).length, 4);
  assert.doesNotMatch(html, /qualityJourneyFooter|qualityJourneyProgress|qualityJourneyLead/);
  assert.doesNotMatch(html, /Vier Grundsätze\. Ein Anspruch:/);
  assert.doesNotMatch(html, /data-scroll-enhanced/);
  for (const image of ["planning", "equipment", "teamwork", "privacy"]) {
    assert.ok(html.includes(`src="/quality-${image}-v2.webp"`));
  }
  assert.match(html, /class="qualityIntro"/);
  for (const image of ["window", "detail", "tools"]) {
    assert.ok(html.includes(`src="/quality-mono-${image}-v2.webp"`));
  }
  for (const benefit of [
    "Individuelle Reinigungskonzepte",
    "Umweltschonende Premium-Produkte",
    "Geschultes &amp; zuverlässiges Fachpersonal",
    "Höchste Diskretion und Sicherheit",
  ]) {
    assert.ok(html.includes(benefit), `missing company benefit: ${benefit}`);
  }
  assert.match(html, /Präzision, die man fühlt\./);
  assert.match(html, /id="about"/);
  assert.match(html, /href="#about"/);
  assert.match(html, /Über uns/);
  assert.doesNotMatch(html, /class="storyBridge"/);
  assert.match(html, /<ol class="processJourney"/);
  assert.doesNotMatch(html, /class="trustCriteriaGrid"/);
  assert.match(html, /src="\/glanzio-reinigung-logo\.png"/);
  assert.match(html, /href="https:\/\/wa\.me\/4917683446967"/);
  assert.match(html, /\+49 176 83446967/);
  assert.match(html, /info@glanzio-reinigung\.de/);
  assert.match(html, /Bruckfelder Straße 6, 88662 Überlingen/);
  assert.match(html, /Mo–Fr: 08:00–18:00/);
  assert.match(html, /Mehr Klarheit\. Mehr Licht\./);
  assert.match(html, /glass-clean-windowsill-v4\.webp/);
  assert.match(html, /class="glassStoryFoamBackground"[^>]*src="\/glass-foam-windowsill-v4\.webp"/);
  assert.match(html, /class="glassStorySqueegee"/);
  assert.match(html, /window-squeegee-foam-v6\.webp/);
  assert.doesNotMatch(html, /glassStoryFluid|glassStoryFoamMaterial|glass-soap-alpha-v7/);
  assert.doesNotMatch(html, /glassStoryRunoffStream|glassStoryBladeFoam/);
  assert.doesNotMatch(html, /glassStoryFoamBead/);
  assert.doesNotMatch(html, /glass-dirty-|glassStorySweep/);
  assert.match(html, /Feedback senden/);
  assert.doesNotMatch(html, /clientReviewsCarousel|sofa-clean-v3|sofa-dirty-v3|\+50 Zufriedene Kunden/);
  assert.doesNotMatch(html, /So sollte Ihr Sofa nicht bleiben\./);
  assert.doesNotMatch(html, /Sauber\. Frisch\. Wie neu\./);
  assert.doesNotMatch(html, /sofa-story-(woman|cleaner)/);
  assert.doesNotMatch(html, /Ziehen Sie, um den Unterschied zu sehen\./);
  assert.doesNotMatch(html, /languageSwitch/);
  assert.doesNotMatch(html, />EN<\/button>/);
  assert.match(html, /href="\/login"/);
  assert.match(html, /id="contact"/);
  assert.match(html, /© 2026 Glanzio Reinigung\. All rights reserved\./);
  assert.match(html, />Impressum<\/button>/);
  assert.match(html, />Datenschutz<\/button>/);
  assert.doesNotMatch(html, /glanzio-reinigung\.de\/(impressum|datenschutz)/);
  assert.doesNotMatch(html, /Your site is taking shape/);
});

test("keeps the authentication and dashboard routes available", async () => {
  const [loginResponse, dashboardResponse, archiveResponse] = await Promise.all([
    render("/login"),
    render("/dashboard"),
    render("/dashboard/archive"),
  ]);

  assert.equal(loginResponse.status, 200);
  assert.equal(dashboardResponse.status, 200);
  assert.equal(archiveResponse.status, 200);

  const [loginHtml, dashboardHtml] = await Promise.all([
    loginResponse.text(),
    dashboardResponse.text(),
  ]);

  assert.match(loginHtml, /Ihr Arbeitstag\. Klar organisiert\./);
  assert.match(loginHtml, /Checking your session/);
  assert.match(dashboardHtml, /Preparing your workspace/);
});
