/// <reference types="cypress" />

import cypress from "cypress";

// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
// declare global {
//   namespace Cypress {
//     interface Chainable {
//       login(email: string, password: string): Chainable<void>
//       drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
//     }
//   }
// }
 
type E2EAdminCredentials = {
  email: string;
  password: string;
};

type AuthenticationResponse = {
  accessToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresAt: string;

  user: {
    id: string;
    email: string;
    role: "ADMIN" | "EMPLOYEE";
    status: string;

    employee: {
      id: string;
      firstName: string;
      lastName: string;
      isStudent: boolean;
      active: boolean;
    } | null;
  };
};

const API_BASE_URL = "http://localhost:3000/api/v1";

declare global {
  namespace Cypress {
    interface Chainable {
      mockAdminSession(): Chainable<void>;
      mockEmployeeSession(): Chainable<void>;
      loginAsAdmin(): Chainable<void>;
    }
  }
}

/*
 * Fake administrator authentication.
 * Use this only for isolated UI tests.
 */
Cypress.Commands.add("mockAdminSession", () => {
  cy.intercept("POST", "**/api/v1/auth/refresh", {
    statusCode: 200,

    body: {
      accessToken: "ui-test-admin-access-token",
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
});

/*
 * Fake employee authentication.
 * Use this only for isolated UI tests.
 */
Cypress.Commands.add("mockEmployeeSession", () => {
  cy.intercept("POST", "**/api/v1/auth/refresh", {
    statusCode: 200,

    body: {
      accessToken: "ui-test-employee-access-token",
      accessTokenExpiresIn: "15m",
      refreshTokenExpiresAt: "2099-12-31T23:59:59.000Z",

      user: {
        id: "00000000-0000-4000-8000-000000000101",
        email: "lena.worker@example.com",
        role: "EMPLOYEE",
        status: "ACTIVE",

        employee: {
          id: "00000000-0000-4000-8000-000000000102",
          firstName: "Lena",
          lastName: "Worker",
          isStudent: true,
          active: true,
        },
      },
    },
  }).as("restoreEmployeeSession");
});

/*
 * Real administrator authentication.
 * This calls the real backend and uses the real PostgreSQL user.
 */
Cypress.Commands.add("loginAsAdmin", () => {
  cy.task<E2EAdminCredentials>(
    "getE2EAdminCredentials",
    null,
    { log: false },
  ).then(({ email, password }) => {
    cy.session(
      ["real-admin", email],

      () => {
        cy.request<AuthenticationResponse>({
          method: "POST",
          url: `${API_BASE_URL}/auth/login`,
          body: { email, password },
          log: false,
        }).then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.user.role).to.equal("ADMIN");
          expect(response.body.user.status).to.equal("ACTIVE");
        });
      },

      {
        validate() {
          cy.request<AuthenticationResponse>({
            method: "POST",
            url: `${API_BASE_URL}/auth/refresh`,
            failOnStatusCode: false,
            log: false,
          }).then((response) => {
            expect(response.status).to.equal(200);
            expect(response.body.user.role).to.equal("ADMIN");
            expect(response.body.user.status).to.equal("ACTIVE");
          });
        },

        cacheAcrossSpecs: true,
      },
    );
  });
});

export {};