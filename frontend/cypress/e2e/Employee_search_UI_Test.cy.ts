describe("Employee search UI Test", () => {
  beforeEach(() => {
    cy.intercept("POST", "**/api/v1/auth/refresh", {
      statusCode: 200,

      body: {
        accessToken: "ui-test-access-token",
        accessTokenExpiresIn: "15m",
        refreshTokenExpiresAt: "2099-12-31T23:59:59.000Z",

        user: {
          id: "00000000-0000-4000-8000-000000000001",
          email: "ui.admin@example.com",
          role: "ADMIN",
          status: "ACTIVE",
          employee: null,
        },
      },
    }).as("restoreAdminSession");

    cy.intercept("GET", "**/api/v1/employees*", {
      statusCode: 200,

      body: {
        items: [
          {
            id: "00000000-0000-4000-8000-000000000010",
            firstName: "Sofia",
            lastName: "Schmidt",
            phone: "+49 30 1111111",
            hourlyRate: "18.50",
            isStudent: true,
            active: true,

            user: {
              email: "sofia@example.com",
              status: "INVITED",
              lastLoginAt: null,
            },
          },
          {
            id: "00000000-0000-4000-8000-000000000020",
            firstName: "Martin",
            lastName: "Keller",
            phone: "+49 30 2222222",
            hourlyRate: "22.00",
            isStudent: false,
            active: true,

            user: {
              email: "martin@example.com",
              status: "ACTIVE",
              lastLoginAt: "2026-08-20T10:00:00.000Z",
            },
          },
        ],

        page: 1,
        pageSize: 100,
        total: 2,
        pageCount: 1,
      },
    }).as("loadEmployees");

    cy.visit("/dashboard/employees");

    cy.wait([
      "@restoreAdminSession",
      "@loadEmployees",
    ]);

    cy.contains("h1", "Your team, clearly organised.")
      .should("be.visible");

    cy.get(".employeeModernCard")
      .should("have.length", 2);
  });

  it("searches employees by name, phone and email", () => {
    // Search by name
    cy.get('[aria-label="Search employees"]')
      .type("Sofia")
      .should("have.value", "Sofia");

    cy.get(".employeeModernCard")
      .should("have.length", 1);

    cy.contains("Sofia Schmidt")
      .should("be.visible");

    cy.contains("Martin Keller")
      .should("not.exist");

    // Clear the name and search by phone
    cy.get('[aria-label="Search employees"]')
      .clear()
      .type("+49 30 1111111")
      .should("have.value", "+49 30 1111111");

    cy.get(".employeeModernCard")
      .should("have.length", 1);

    cy.contains("Sofia Schmidt")
      .should("be.visible");

    cy.contains("Martin Keller")
      .should("not.exist");

    // Clear the phone and search by email
    cy.get('[aria-label="Search employees"]')
      .clear()
      .type("martin@example.com")
      .should("have.value", "martin@example.com");

    cy.get(".employeeModernCard")
      .should("have.length", 1);

    cy.contains("Martin Keller")
      .should("be.visible");

    cy.contains("Sofia Schmidt")
      .should("not.exist");

    // Clear the search and confirm both return
    cy.get('[aria-label="Search employees"]')
      .clear()
      .should("have.value", "");

    cy.get(".employeeModernCard")
      .should("have.length", 2);

    cy.contains("Sofia Schmidt")
      .should("be.visible");

    cy.contains("Martin Keller")
      .should("be.visible");
  });

  it("displays an empty state when no employee matches", () => {
    cy.get('[aria-label="Search employees"]')
      .type("InvalidRandomQueryXYZ123");

    cy.get(".employeeModernCard")
      .should("have.length", 0);

    cy.contains("No matching employees")
      .should("be.visible");

    cy.contains("Sofia Schmidt")
      .should("not.exist");

    cy.contains("Martin Keller")
      .should("not.exist");
  });
});