export {};

declare global {
  namespace Cypress {
    interface Chainable {
      mockAdminSession(): Chainable<void>;
      mockEmployeeSession(): Chainable<void>;
      loginAsAdmin(): Chainable<void>;
    }
  }
}
