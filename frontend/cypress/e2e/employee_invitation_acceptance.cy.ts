describe("Employee invitation acceptance", () => {
  const invitationToken = "a".repeat(64);
  const securePassword = "Glanzio-Team-2026!";

  beforeEach(() => {
    cy.on("window:before:load", (win) => win.localStorage.setItem("glanzio-cookie-choice-v1", JSON.stringify({ version: 1, choice: "necessary", savedAt: Date.now() })));
    cy.visit(`/login?invitation=${invitationToken}`);
  });

  it("shows the professional invitation flow without the schedule preview", () => {
    cy.contains("h1", "Ihr persönlicher Zugang. Sicher eingerichtet.").should(
      "be.visible",
    );
    cy.contains("h2", "Konto aktivieren").should("be.visible");
    cy.contains("Today").should("not.exist");
    cy.contains("3 assignments").should("not.exist");
    cy.get(".schedulePreview").should("not.exist");
    cy.get(".invitationSteps article")
      .should("have.length", 3)
      .first()
      .should("have.css", "animation-name", "invitationSceneReveal");
    cy.get(".agreementOption").should("not.exist");
    cy.get(".humanCheck").should("not.exist");
    cy.get("#human-confirmation").should("be.visible").and("not.be.checked");
    cy.get('section[aria-label="Datenschutz & Rechtliches"]').should("be.visible");
    cy.contains("button", "Datenschutzerklärung").click();
    cy.contains("[role='dialog']", "Datenverarbeitung im Mitarbeiterportal").should(
      "be.visible",
    );
    cy.contains("button", "Schließen").click();
    cy.contains("button", "Impressum").click();
    cy.contains("[role='dialog']", "Angaben gemäß § 5 DDG").should("be.visible");
    cy.contains("[role='dialog']", "Glanzio Reinigung GbR").should("be.visible");
    cy.contains("button", "Schließen").click();
  });

  it("explains invalid passwords before enabling account activation", () => {
    cy.get("#new-password").type("short");
    cy.get(".passwordAlert")
      .should("be.visible")
      .and("contain.text", "noch nicht alle Anforderungen");
    cy.get(".passwordRequirements .isInvalid").should("exist");
    cy.contains("button", "Konto aktivieren").should("be.disabled");

    cy.get("#new-password").clear().type(securePassword);
    cy.get("#confirm-password").type(securePassword);
    cy.get(".passwordRequirements .isInvalid").should("not.exist");
    cy.get(".passwordRequirements .isValid").should("have.length", 4);

    cy.get("#human-confirmation").check();
    cy.contains("Bestätigt").should("be.visible");
    cy.contains("button", "Konto aktivieren").should("be.enabled");
  });

  it("accepts the invitation and redirects directly to the dashboard", () => {
    cy.intercept("POST", "**/api/v1/auth/accept-invitation", (request) => {
      expect(request.body).to.deep.equal({
        token: invitationToken,
        newPassword: securePassword,
      });

      request.reply({
        statusCode: 200,
        body: {
          accessToken: "employee-access-token",
          accessTokenExpiresIn: "15m",
          refreshTokenExpiresAt: "2026-10-21T12:00:00.000Z",
          user: {
            id: "employee-user-id",
            email: "employee@glanzio.test",
            role: "EMPLOYEE",
            status: "ACTIVE",
            employee: {
              id: "employee-id",
              firstName: "Test",
              lastName: "Employee",
              isStudent: false,
              active: true,
            },
          },
        },
      });
    }).as("acceptInvitation");

    cy.intercept("GET", "**/api/v1/dashboard", {
      statusCode: 200,
      body: {
        role: "EMPLOYEE",
        employee: {
          firstName: "Test",
          lastName: "Employee",
        },
        todayAssignments: [],
        nextAssignment: null,
        monthlyWorkedMinutes: 0,
        monthlyCreditedMinutes: 0,
        monthlyPaidMinutes: 0,
      },
    });

    cy.get("#new-password").type(securePassword);
    cy.get("#confirm-password").type(securePassword);
    cy.get("#human-confirmation").check();
    cy.contains("button", "Konto aktivieren").click();

    cy.wait("@acceptInvitation");
    cy.location("pathname").should("eq", "/dashboard");
    cy.contains("Secure access confirmed").should("not.exist");
  });

  it("keeps the activation form usable on a mobile viewport", () => {
    cy.viewport(390, 844);

    cy.get(".invitationAccessCard").should("be.visible");
    cy.get("#new-password").should("be.visible");
    cy.get("#human-confirmation").should("be.visible");
    cy.contains("button", "Datenschutzerklärung").should("be.visible");
    cy.document().then((document) => {
      expect(document.documentElement.scrollWidth).to.equal(
        document.documentElement.clientWidth,
      );
    });
  });
});
