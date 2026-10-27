describe("Login form", () => { //grouping the test cases related to login form
  beforeEach(() => {
    cy.on("window:before:load", (win) => win.localStorage.setItem("glanzio-cookie-choice-v1", JSON.stringify({ version: 1, choice: "necessary", savedAt: Date.now() })));
    cy.intercept("POST", "**/api/v1/auth/refresh", {//controls a frontend HTTP request. 
      statusCode: 401,
      body: {
        message: "No active session",
      },
    }).as("refreshSession");

    cy.visit("/login");

    cy.wait("@refreshSession");

    cy.contains("h2", "Einloggen")
      .should("be.visible");
  });

  it("enables sign-in only after both fields are completed", () => {
    cy.viewport(1280, 800);
    cy.document().then((document) => {
      expect(document.documentElement.scrollWidth).to.equal(
        document.documentElement.clientWidth,
      );
    });
    cy.contains("button", "Anmelden")
      .should("be.disabled");

    cy.get("#email")
      .type("learner@example.com");

    cy.contains("button", "Anmelden")
      .should("be.disabled");

    cy.get("#password")
      .type("LearningCypress123!");

    cy.contains("button", "Anmelden")
      .should("be.enabled");

    cy.screenshot("login-form-ready" , {
    capture:"viewport",
    overwrite:true,
    });
  });

  it("redirects an administrator directly to the dashboard after sign-in", () => {
    cy.intercept("POST", "**/api/v1/auth/login", {
      statusCode: 200,
      body: {
        accessToken: "admin-access-token",
        accessTokenExpiresIn: "15m",
        refreshTokenExpiresAt: "2026-10-21T12:00:00.000Z",
        user: {
          id: "admin-user-id",
          email: "admin@glanzio.test",
          role: "ADMIN",
          status: "ACTIVE",
          employee: null,
        },
      },
    }).as("adminLogin");

    cy.intercept("GET", "**/api/v1/dashboard", {
      statusCode: 200,
      body: {
        role: "ADMIN",
        date: "2026-10-20",
        timeZone: "Europe/Berlin",
        activeEmployees: 0,
        unassignedWork: 0,
        todayAssignments: [],
        upcomingAssignments: [],
        studentHourWarnings: [],
        operationsAnalysis: { months: [], employees: [] },
      },
    });

    cy.get("#email").type("admin@glanzio.test");
    cy.get("#password").type("Admin-Password-2026!");
    cy.contains("button", "Anmelden").click();

    cy.wait("@adminLogin");
    cy.location("pathname").should("eq", "/dashboard");
    cy.contains("Secure access confirmed").should("not.exist");
  });
});
