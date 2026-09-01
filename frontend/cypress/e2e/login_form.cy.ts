describe("Login form", () => { //grouping the test cases related to login form
  beforeEach(() => {
    cy.intercept("POST", "**/api/v1/auth/refresh", {//controls a frontend HTTP request. 
      statusCode: 401,
      body: {
        message: "No active session",
      },
    }).as("refreshSession");

    cy.visit("/login");

    cy.wait("@refreshSession");

    cy.contains("h2", "Welcome back")
      .should("be.visible");
  });

  it("enables sign-in only after both fields are completed", () => {
    cy.contains("button", "Sign in securely")
      .should("be.disabled");

    cy.get("#email")
      .type("learner@example.com");

    cy.contains("button", "Sign in securely")
      .should("be.disabled");

    cy.get("#password")
      .type("LearningCypress123!");

    cy.contains("button", "Sign in securely")
      .should("be.enabled");

    cy.screenshot("login-form-ready" , {
    capture:"viewport",
    overwrite:true,
    });
  });
});