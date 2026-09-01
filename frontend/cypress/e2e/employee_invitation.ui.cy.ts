describe("Employee invitation form UI", () => {   // 
  beforeEach(() => {
    cy.mockAdminSession();

    cy.intercept("GET", "**/api/v1/employees*", { 
      body: {
        items: [],
        page: 1,
        pageSize: 100,
        total: 0,
        pageCount: 0,
      },
    }).as("loadEmployees");     //Do not start testing the form until the page has finished loading its employee data.

    cy.visit("/dashboard/employees");

    cy.wait([
      "@restoreAdminSession",//Do not start testing the form until the page has finished loading its employee data.

      "@loadEmployees",
    ]);

    cy.contains("h1", "Your team, clearly organised.")
      .should("be.visible");
  });

  it("shows the form and accepts employee information", () => {
    cy.get("#firstName")
      .should("be.visible")
      .and("have.attr", "required")

      cy.get("#firstName")
      .type("Sofia")
      .should("have.value", "Sofia");

    cy.get("#lastName")
      .should("be.visible")
      .and("have.attr", "required")

    cy.get("#lastName")
      .type("Schmidt")
      .should("have.value", "Schmidt");

    cy.get("#email")
      .should("be.visible")
      .and("have.attr", "required")

      cy.get("#email")
      .type("sofia.ui@example.com")
      .should("have.value", "sofia.ui@example.com");

    cy.get("#phone")
      .should("be.visible")
      .type("+49 30 1234567")
      .should("have.value", "+49 30 1234567");

    cy.get("#hourlyRate")
      .should("be.visible")
      .type("18.50")
      .should("have.value", "18.50");

    cy.contains("label", "Student employee")
      .click();

    cy.get('input[name="isStudent"]')
      .should("be.checked");

    cy.contains("button", "Invite employee")
      .should("be.visible")
      .and("be.enabled");

    cy.screenshot("employee-invitation-form-completed", {
      capture: "viewport",
      overwrite: true,
    });
  });
});