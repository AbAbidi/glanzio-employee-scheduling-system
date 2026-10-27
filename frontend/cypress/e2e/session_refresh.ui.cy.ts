export {};

const api = "**/api/v1";
const admin = { id: "session-test-admin", email: "admin@example.test", role: "ADMIN", status: "ACTIVE", employee: null };
const session = (accessToken: string) => ({ accessToken, accessTokenExpiresIn: "15m", refreshTokenExpiresAt: "2099-01-01T00:00:00Z", user: admin });
const page = (items: unknown[]) => ({ items, page: 1, pageSize: 100, total: items.length, pageCount: items.length ? 1 : 0 });
const site = {
  id: "test-site", clientId: "test-client", name: "Test office", addressLine1: "Teststrasse 1",
  city: "Berlin", countryCode: "DE", latitude: "52.52", longitude: "13.405", active: true,
  requiredEquipment: [], client: { id: "test-client", companyName: "Test GmbH", active: true },
};
const expired = { statusCode: 401, body: { message: "The access token is invalid or expired." } };

function mockScheduler() {
  cy.intercept("GET", `${api}/calendar*`, { body: page([]) }).as("calendar");
  cy.intercept("GET", `${api}/sites*`, { body: page([site]) }).as("sites");
  cy.intercept("GET", `${api}/clients*`, { body: page([site.client]) }).as("clients");
  cy.intercept("GET", `${api}/employees*`, {
    body: page([{ id: "test-employee", firstName: "Mira", lastName: "Test", active: true, hourlyRate: "18.50", isStudent: false, user: { status: "ACTIVE" } }]),
  }).as("employees");
  cy.intercept("POST", `${api}/calendar/reverse-geocode`, {
    body: { latitude: 52.51, longitude: 13.40, displayName: "Departure, Berlin", siteName: "Departure", addressLine1: "Departure 1", city: "Berlin", countryCode: "DE" },
  }).as("reverse");
}

function openForm() {
  cy.visit("/dashboard/assignments");
  cy.wait(["@refresh", "@calendar"]);
  cy.get(".calendarDay:not(.isWeekend) .calendarDayNumber").not(":disabled").first().click();
  cy.wait(["@sites", "@clients", "@employees"]);
  cy.get('input[name="title"]').type("Preserved assignment title");
  cy.get('input[name="clientCharge"]').type("150");
  cy.get('.schedulerEmployeeList input[type="checkbox"]').check();
}

function routeBody(body: Record<string, unknown>) {
  return {
    ...body, travelDistanceMeters: 1200, estimatedTravelMinutes: 5,
    calculatedAt: "2026-10-22T09:00:00.000Z",
    routeGeometry: [{ latitude: 52.51, longitude: 13.40 }, { latitude: 52.52, longitude: 13.405 }],
  };
}

describe("Automatic access-token renewal", { scrollBehavior: "center" }, () => {
  it("renews route calculation and assignment save without losing the form or duplicating a creation", () => {
    let refreshes = 0;
    let saveAttempts = 0;
    let creations = 0;
    cy.intercept("POST", `${api}/auth/refresh`, (req) => {
      req.reply({ body: session(`token-${refreshes++}`) });
    }).as("refresh");
    mockScheduler();
    cy.intercept("POST", `${api}/calendar/route-preview`, (req) => {
      if (req.headers.authorization === "Bearer token-0") req.reply(expired);
      else req.reply({ body: routeBody(req.body) });
    }).as("route");
    cy.intercept("POST", `${api}/assignments`, (req) => {
      saveAttempts++;
      expect(req.body.title).to.equal("Preserved assignment title");
      expect(req.body.clientCharge).to.equal(150);
      if (saveAttempts === 1) { req.reply(expired); return; }
      expect(req.headers.authorization).to.equal("Bearer token-2");
      creations++;
      req.reply({ statusCode: 201, body: {
        assignment: { ...req.body, id: "created-once", site, employees: [], recurringTemplate: null }, studentWarnings: [],
      } });
    }).as("save");

    openForm();
    cy.get(".locationMap").click("center");
    cy.wait("@reverse");
    cy.get(".locationMap .leaflet-overlay-pane path", { timeout: 15000 }).should("exist");
    cy.get('input[name="title"]').should("have.value", "Preserved assignment title");
    cy.contains("The access token is invalid or expired.").should("not.exist");
    cy.contains("button", "Create assignment").click();
    cy.contains("Assignment created successfully.", { timeout: 15000 }).should("be.visible");
    cy.get(".schedulerDialog").should("not.exist");
    cy.then(() => {
      expect(refreshes).to.equal(3);
      expect(saveAttempts).to.equal(2);
      expect(creations).to.equal(1);
    });
  });

  it("keeps entered values and stops submission when the refresh session really expires", () => {
    cy.viewport(390, 844);
    let refreshes = 0;
    let creations = 0;
    cy.intercept("POST", `${api}/auth/refresh`, (req) => {
      if (refreshes++ === 0) req.reply({ body: session("original") });
      else req.reply({ statusCode: 401, body: { message: "The refresh session has expired." } });
    }).as("refresh");
    mockScheduler();
    cy.intercept("POST", `${api}/calendar/route-preview`, expired).as("route");
    cy.intercept("POST", `${api}/assignments`, (req) => { creations++; req.reply(expired); });
    openForm();
    cy.get(".locationMap").click("center");
    cy.wait("@reverse");
    cy.contains("Your session has ended. Please sign in again to continue.", { timeout: 15000 }).should("be.visible");
    cy.get('input[name="title"]').should("have.value", "Preserved assignment title");
    cy.get('input[name="clientCharge"]').should("have.value", "150");
    cy.get('.schedulerEmployeeList input[type="checkbox"]').should("be.checked");
    cy.contains("button", "Create assignment").click();
    cy.then(() => { expect(creations).to.equal(0); });
    cy.get(".schedulerDialog").should("be.visible");
  });
});
