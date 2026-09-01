describe("Employee profile UI", () => {
  beforeEach(() => {
    cy.mockEmployeeSession();

    cy.intercept("GET", "**/api/v1/employees/me", {
      statusCode: 200,

      body: {
        id: "00000000-0000-4000-8000-000000000102",
        firstName: "Lena",
        lastName: "Worker",
        phone: "+49 30 1234567",
        hourlyRate: "18.50",
        isStudent: true,
        active: true,

        user: {
          email: "lena.worker@example.com",
          status: "ACTIVE",
          lastLoginAt: null,
        },
      },
    }).as("loadEmployeeProfile");

    cy.visit("/dashboard/profile");

    cy.wait([
      "@restoreEmployeeSession",
      "@loadEmployeeProfile",
    ]);
  });

  it("displays the employee profile", () => {
    cy.contains("Lena Worker").should("be.visible");
    cy.get('input[name="email"]').should("have.value", "lena.worker@example.com");
  });
});