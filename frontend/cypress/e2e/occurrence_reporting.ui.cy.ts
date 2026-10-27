export {};

const person = { id: "student", firstName: "Karim", lastName: "monic", isStudent: true, active: true, hourlyRate: "20", user: { email: "student@example.test", status: "ACTIVE" } };
const site = { id: "site", name: "Doctor Cabinet", client: { id: "client", companyName: "Test GmbH" } };
const visit = (id: string, status: string, startAt: string, endAt: string) => ({
  id, status, title: id === "today" ? "Today's series visit" : "Next week's series visit", startAt, endAt, site, employees: [],
  recurringTemplateId: "series", recurringTemplate: { id: "series", frequency: "WEEKLY", interval: 1, daysOfWeek: [4], untilAt: "2026-11-12T22:59:59Z" },
});
const snapshot = (status: string, hours: number) => ({ id: "same-month-record", status, sourceHash: "stable-hash", data: {
  month: "2026-10", zone: "Europe/Paris", employeeName: "Karim monic", workedMinutes: hours * 60,
  carryInMinutes: 0, creditedMinutes: hours * 60, carryOutMinutes: 0, carryOut: [], sources: [], allocations: [],
} });

describe("Per-occurrence completion and live reporting", { scrollBehavior: "center" }, () => {
  beforeEach(() => { cy.mockAdminSession(); });

  it("uses each persisted occurrence status and refreshes without completing its future siblings", () => {
    cy.clock(Date.parse("2026-10-22T13:00:00Z"), ["Date", "setInterval", "clearInterval"]);
    let reads = 0;
    cy.intercept("GET", "**/api/v1/calendar*", (req) => {
      req.reply({ body: { items: [
        visit("today", reads++ ? "COMPLETED" : "SCHEDULED", "2026-10-22T07:00:00Z", "2026-10-22T10:00:00Z"),
        visit("next", "SCHEDULED", "2026-10-29T08:00:00Z", "2026-10-29T11:00:00Z"),
      ], page: 1, pageSize: 100, total: 2, pageCount: 1 } });
    }).as("calendar");
    cy.visit("/dashboard/assignments"); cy.wait("@calendar");
    cy.contains(".calendarEvent", "Today's series visit").should("contain.text", "Pending");
    cy.tick(15_100); cy.wait("@calendar");
    cy.contains(".calendarEvent", "Today's series visit").should("contain.text", "Completed");
    cy.contains(".calendarEvent", "Today's series visit").should("have.css", "background-color", "rgb(74, 222, 128)").find("i").should("not.exist");
    cy.contains(".calendarEvent", "Next week's series visit").should("contain.text", "Pending");
    cy.contains(".calendarEvent", "Next week's series visit").should("have.css", "border-color", "rgb(202, 138, 4)");
  });

  it("updates monthly and weekly hours together after an operations change, preserving the search", () => {
    let completed = false;
    cy.intercept("GET", "**/api/v1/dashboard", (req) => {
      const minutes = completed ? 180 : 0;
      req.reply({ body: { role: "ADMIN", date: "2026-10-22", timeZone: "Europe/Paris", todayAssignments: [], upcomingAssignments: [],
        operationsAnalysis: {
          months: [{ month: "2026-10", completedAssignments: completed ? 1 : 0, assignmentsWithCalculatedRoute: 0, routeKilometers: 0, laborCost: completed ? 60 : 0, revenue: 0 }],
          employees: [{ employee: person, month: "2026-10", completedAssignments: completed ? 1 : 0, completedMinutes: minutes, creditedMinutes: minutes, carryInMinutes: 0, carryOutMinutes: 0, amount: completed ? 60 : 0 }],
          weeklyStudents: { start: "2026-10-19", end: "2026-10-25", items: [{ employee: person, workedMinutes: minutes, exceededByMinutes: 0 }] },
        },
      } });
    }).as("dashboard");
    cy.visit("/dashboard"); cy.wait("@dashboard");
    cy.get(".employeeFeature > summary").click();
    cy.get(".employeeAnalysisSearch input").type("karim");
    cy.get(".employeeAnalysisTable").should("contain.text", "0.0h");
    cy.then(() => { completed = true; });
    cy.window().then((win) => win.dispatchEvent(new Event("glanzio-operations-changed")));
    cy.wait("@dashboard");
    cy.get(".employeeAnalysisSearch input").should("have.value", "karim");
    cy.get(".employeeAnalysisTable").should("contain.text", "3.0h").and("contain.text", "€60.00");
    cy.get(".studentWeeklyPanel").should("contain.text", "3.0h");
  });

  it("keeps the selected employee preview inline with five visible rows and no action buttons", () => {
    cy.viewport(390, 844);
    const other = { ...person, id: "student-two", firstName: "Youssef", lastName: "Test" };
    let closed = false;
    let manualClosures = 0;
    cy.intercept("GET", "**/api/v1/employees*", { body: { items: [person, other], total: 2, page: 1, pageSize: 100, pageCount: 1 } });
    cy.intercept("GET", "**/api/v1/reports/student-statement?*", (req) => {
      const selected = new URL(req.url).searchParams.get("employeeId") === person.id ? person : other;
      const body = snapshot(closed ? "CLOSED" : "DRAFT", 3);
      body.id = selected.id + ":2026-10";
      body.data.employeeName = selected.firstName + " " + selected.lastName;
      req.reply({ body: { ...body, data: { ...body.data, allocations: Array.from({ length: 8 }, (_, index) => ({
        kind: "CREDIT", date: "2026-10-" + String(index + 5).padStart(2, "0"), sourceKey: "source-" + index,
        originMonth: "2026-10", minutes: 60, startAt: "2026-10-05T08:00:00Z", endAt: "2026-10-05T09:00:00Z",
      })) } } });
    }).as("preview");
    cy.intercept("POST", "**/api/v1/reports/student-statement/close", (req) => { manualClosures++; req.reply({ statusCode: 404 }); });
    cy.visit("/dashboard/employees");
    cy.get('input[type="month"]').clear().type("2026-10");
    cy.contains(".employeeModernCard", "Karim monic").contains("button", "Credit preview / closure").click();
    cy.wait("@preview");
    cy.get(".studentCreditPanel").should("have.length", 1).parents(".employeeModernCard").should("contain.text", "Karim monic");
    cy.get(".studentCreditPanel button").should("have.length", 1).and("contain.text", "×");
    cy.get(".studentCreditPanel").should("not.contain.text", "Original completed assignments")
      .and("not.contain.text", "Remaining credit origins").and("not.contain.text", "Snapshot fingerprint");
    cy.get(".studentAllocationScroll").should(($scroll) => {
      expect($scroll[0].scrollHeight).to.be.greaterThan($scroll[0].clientHeight);
      expect($scroll[0].getBoundingClientRect().height).to.be.at.most(291);
    }).scrollTo("bottom");
    cy.get(".studentAllocationScroll").should(($scroll) => expect($scroll[0].scrollTop).to.be.greaterThan(0));
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.equal(doc.documentElement.clientWidth));
    cy.contains(".employeeModernCard", "Youssef Test").contains("button", "Credit preview / closure").click();
    cy.wait("@preview");
    cy.get(".studentCreditPanel").should("have.length", 1).find("h2").should("contain.text", "Youssef Test");
    cy.get(".studentCreditPanel").parents(".employeeModernCard").find('button[aria-expanded="true"]').should("exist");
    cy.then(() => { closed = true; });
    cy.window().then((win) => win.dispatchEvent(new Event("glanzio-operations-changed")));
    cy.wait("@preview");
    cy.get(".studentCreditPanel").should("contain.text", "Closed — frozen");
    cy.get(".studentCreditPanel button").click();
    cy.get(".studentCreditPanel").should("not.exist");
    cy.then(() => expect(manualClosures).to.equal(0));
  });
});
