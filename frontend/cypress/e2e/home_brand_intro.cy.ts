describe("Homepage brand introduction", () => {
  beforeEach(() => {
    cy.on("window:before:load", (win) => win.localStorage.setItem("glanzio-cookie-choice-v1", JSON.stringify({ version: 1, choice: "necessary", savedAt: Date.now() })));
  });
  const sessionKey = "glanzio.home-intro.seen.v1";

  function pauseExitAnimation(win: Window) {
    const style = win.document.createElement("style");
    style.textContent = ".homeBrandIntro { animation-play-state: paused !important; }";
    const attach = () => {
      if (!style.isConnected) win.document.head?.appendChild(style);
    };
    attach();
    win.document.addEventListener("DOMContentLoaded", attach);
  }

  it("shows the two-second intro on entry and refresh, not on section navigation", () => {
    cy.clock(0, ["setTimeout", "clearTimeout"]);
    cy.on("window:before:load", pauseExitAnimation);
    cy.visit("/", {
      onBeforeLoad(win) {
        win.sessionStorage.removeItem(sessionKey);
        pauseExitAnimation(win);
      },
    });
    // The decorative overlay deliberately ignores hit testing, which makes
    // Cypress's fixed-element visibility heuristic inspect the page underneath.
    cy.get(".homeBrandIntro").should(($intro) => {
      expect($intro).not.to.have.attr("hidden");
      expect($intro).to.have.css("visibility", "visible");
      expect($intro).to.have.css("animation-duration", "2s");
    });
    cy.get(".homeBrandIntroLogo img").should(($image) => {
      expect(($image[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0);
    });
    cy.screenshot("home-brand-intro-desktop", { capture: "viewport", disableTimersAndAnimations: false });
    cy.tick(1999);
    cy.get(".homeBrandIntro").should("not.have.attr", "hidden");
    cy.tick(1);
    cy.get(".homeBrandIntro").should("have.attr", "hidden");
    cy.window().then((win) => {
      expect(win.sessionStorage.getItem(sessionKey)).to.equal("1");
    });
    cy.reload();
    cy.get(".homeBrandIntro").should("not.have.attr", "hidden");
    cy.tick(2000);
    cy.get(".homeBrandIntro").should("have.attr", "hidden");
    cy.get(".publicNav").contains("a", "Kontakt").click();
    cy.get(".homeBrandIntro").should("have.attr", "hidden");
  });

  it("dismisses immediately when a visitor starts interacting on mobile", () => {
    cy.viewport(390, 844);
    cy.clock(0, ["setTimeout", "clearTimeout"]);
    cy.visit("/", {
      onBeforeLoad(win) {
        win.sessionStorage.removeItem(sessionKey);
        pauseExitAnimation(win);
      },
    });
    cy.get(".homeBrandIntro").should(($intro) => {
      expect($intro).not.to.have.attr("hidden");
      expect($intro).to.have.css("visibility", "visible");
    });
    cy.screenshot("home-brand-intro-mobile", { capture: "viewport", disableTimersAndAnimations: false });
    cy.document().trigger("keydown", { key: "Tab" });
    cy.get(".homeBrandIntro").should("have.attr", "hidden");
    cy.document().then((doc) => {
      expect(doc.documentElement.scrollWidth).to.equal(doc.documentElement.clientWidth);
      expect(doc.body.style.overflow).not.to.equal("hidden");
    });
  });

  it("skips the intro for reduced motion", () => {
    cy.visit("/", {
      onBeforeLoad(win) {
        win.sessionStorage.removeItem(sessionKey);
        const matchMedia = win.matchMedia.bind(win);
        cy.stub(win, "matchMedia").callsFake((query: string) => {
          const result = matchMedia(query);
          if (query === "(prefers-reduced-motion: reduce)") {
            Object.defineProperty(result, "matches", { value: true });
          }
          return result;
        });
      },
    });
    cy.get(".homeBrandIntro").should("have.attr", "hidden");
    cy.contains("Sauberkeit.").should("be.visible");
  });

  it("preserves direct links to the contact section", () => {
    cy.visit("/#contact", {
      onBeforeLoad(win) {
        win.sessionStorage.removeItem(sessionKey);
      },
    });
    cy.get(".homeBrandIntro").should("have.attr", "hidden");
    cy.get("#contact").should("be.visible");
  });

  it("starts before page markup and does not replay after delayed React startup", () => {
    const observation = { started: false, beforePageMarkup: false };
    cy.intercept("GET", "**/app/login/page.tsx*", (request) => {
      request.on("response", (response) => { response.setDelay(2500); });
    }).as("delayedAccessModule");
    cy.intercept("POST", "**/api/v1/auth/refresh", { statusCode: 401, body: {} });
    cy.visit("/login", {
      onBeforeLoad(win) {
        const observer = new win.MutationObserver(() => {
          const intro = win.document.getElementById("glanzio-brand-intro");
          if (intro && !intro.hidden && !observation.started) {
            observation.started = true;
            observation.beforePageMarkup = !win.document.querySelector("main");
          }
        });
        observer.observe(win.document, {
          childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"],
        });
        win.addEventListener("DOMContentLoaded", () => observer.disconnect());
      },
    });
    cy.wait("@delayedAccessModule");
    cy.then(() => {
      expect(observation.started, "splash starts without React").to.equal(true);
      expect(observation.beforePageMarkup, "no page content before the splash").to.equal(true);
    });
    cy.contains("h2", "Einloggen").should("be.visible");
    cy.get(".homeBrandIntro").should("have.attr", "hidden");
  });

  function mockAuthentication(role: "ADMIN" | "EMPLOYEE") {
    let signedIn = false;
    const session = {
      accessToken: "intro-test-access-token",
      accessTokenExpiresIn: "15m",
      refreshTokenExpiresAt: "2026-10-25T12:00:00.000Z",
      user: {
        id: "intro-test-user",
        email: "intro@glanzio.test",
        role,
        status: "ACTIVE",
        employee: role === "EMPLOYEE" ? {
          id: "intro-test-employee", firstName: "Test", lastName: "Employee",
          isStudent: false, active: true,
        } : null,
      },
    };
    cy.intercept("POST", "**/api/v1/auth/refresh", (request) => {
      request.reply(signedIn
        ? { statusCode: 200, body: session }
        : { statusCode: 401, body: { message: "No active session" } });
    });
    for (const endpoint of ["login", "accept-invitation"]) {
      cy.intercept("POST", `**/api/v1/auth/${endpoint}`, (request) => {
        signedIn = true;
        request.reply({ statusCode: 200, body: session });
      }).as(endpoint);
    }
    cy.intercept("GET", "**/api/v1/dashboard", {
      statusCode: 200,
      body: {
        role, date: "2026-10-20", timeZone: "Europe/Berlin",
        activeEmployees: 0, unassignedWork: 0, todayAssignments: [],
        upcomingAssignments: [], nextAssignment: null, studentHourWarnings: [],
        operationsAnalysis: { months: [], employees: [] },
      },
    });
  }

  function expectActiveIntro(trigger: "access" | "dashboard") {
    cy.get(`.homeBrandIntro[data-intro-trigger="${trigger}"]`).should(($intro) => {
      expect($intro).not.to.have.attr("hidden");
      expect($intro).to.have.css("visibility", "visible");
      expect($intro).to.have.css("animation-duration", "2s");
    });
  }

  it("shows the access intro after clicking Anmelden on the homepage", () => {
    cy.clock(Date.now(), ["setTimeout", "clearTimeout"]);
    cy.on("window:before:load", pauseExitAnimation);
    cy.intercept("POST", "**/api/v1/auth/refresh", { statusCode: 401, body: {} });
    cy.visit("/");
    cy.contains("a", "Anmelden").click();
    cy.location("pathname").should("equal", "/login");
    expectActiveIntro("access");
    cy.tick(2000);
    cy.get(".homeBrandIntro").should("have.attr", "hidden");
  });

  for (const role of ["ADMIN", "EMPLOYEE"] as const) {
    it(`shows the dashboard intro after a successful ${role} login and on refresh`, () => {
      mockAuthentication(role);
      cy.clock(Date.now(), ["setTimeout", "clearTimeout"]);
      cy.on("window:before:load", pauseExitAnimation);
      cy.visit("/login");
      expectActiveIntro("access");
      cy.document().trigger("keydown", { key: "Tab" });
      cy.contains("h2", "Einloggen").should("be.visible");
      cy.get("#email").type("intro@glanzio.test").should("have.value", "intro@glanzio.test");
      cy.get("#password").type("Intro-Test-2026!").should("have.value", "Intro-Test-2026!");
      cy.contains("button", "Anmelden").should("be.enabled").click();
      cy.wait("@login");
      cy.location("pathname").should("equal", "/dashboard");
      expectActiveIntro("dashboard");
      cy.screenshot(`brand-intro-dashboard-${role.toLowerCase()}`, { capture: "viewport", disableTimersAndAnimations: false });
      cy.tick(2000);
      cy.get(".homeBrandIntro").should("have.attr", "hidden");
      cy.reload();
      expectActiveIntro("dashboard");
      cy.tick(2000);
      cy.get('.homeBrandIntro[data-intro-trigger="dashboard"]').should("have.attr", "hidden");
    });
  }

  it("shows the intro for an invitation link and again after activation", () => {
    mockAuthentication("EMPLOYEE");
    cy.clock(Date.now(), ["setTimeout", "clearTimeout"]);
    cy.on("window:before:load", pauseExitAnimation);
    cy.visit(`/login?invitation=${"c".repeat(64)}`);
    expectActiveIntro("access");
    cy.document().trigger("keydown", { key: "Tab" });
    cy.get("#new-password").type("Intro-Test-2026!");
    cy.get("#confirm-password").type("Intro-Test-2026!");
    cy.get("#human-confirmation").check();
    cy.contains("button", "Konto aktivieren").click();
    cy.wait("@accept-invitation");
    cy.location("pathname").should("equal", "/dashboard");
    expectActiveIntro("dashboard");
  });

  it("does not queue a dashboard intro for rejected credentials", () => {
    cy.intercept("POST", "**/api/v1/auth/refresh", { statusCode: 401, body: {} });
    cy.intercept("POST", "**/api/v1/auth/login", {
      statusCode: 401, body: { message: "Invalid credentials" },
    }).as("rejectedLogin");
    cy.visit("/login");
    cy.get("#email").type("intro@glanzio.test");
    cy.get("#password").type("Incorrect-Password!");
    cy.contains("button", "Anmelden").click();
    cy.wait("@rejectedLogin");
    cy.get('[role="alert"]').should("contain.text", "Invalid credentials");
    cy.window().then((win) => {
      expect(win.sessionStorage.getItem("glanzio.dashboard-intro.pending.v1")).to.equal(null);
    });
    cy.location("pathname").should("equal", "/login");
  });
});
