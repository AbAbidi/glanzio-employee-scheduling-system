const month = "2026-10";
const team = ["Mira", "Omar", "Lena", "Jonas"].map((firstName, index) => ({
  id: `employee-${index}`,
  firstName,
  lastName: "Test",
  phone: null,
  hourlyRate: "18.50",
  isStudent: index === 0,
  active: true,
  user: { email: `${firstName.toLowerCase()}@example.test`, status: "ACTIVE", lastLoginAt: null },
}));

function mockDirectory() {
  cy.intercept("GET", "**/api/v1/employees*", {
    body: { items: team, total: 4, page: 1, pageSize: 100, pageCount: 1 },
  }).as("employees");
}

describe("Dashboard search, language and assignment editor", () => {
  it("does not expose test reset controls in a production dashboard", () => {
    cy.mockAdminSession();
    cy.intercept("GET", "**/api/v1/dashboard", {
      body: {
        role: "ADMIN", maintenanceEnabled: false, date: "2026-10-25", timeZone: "Europe/Berlin",
        activeEmployees: 0, unassignedWork: 0, todayAssignments: [], upcomingAssignments: [],
        studentHourWarnings: [], operationsAnalysis: { months: [], employees: [] },
      },
    }).as("productionDashboard");
    cy.visit("/dashboard");
    cy.wait("@productionDashboard");
    cy.get(".dangerFeature").should("not.exist");
  });

  it("searches employee analysis, distinguishes visits and hours, and remembers German", () => {
    cy.mockAdminSession();
    mockDirectory();
    cy.intercept("GET", "**/api/v1/dashboard", {
      body: {
        role: "ADMIN", date: "2026-10-20", timeZone: "Europe/Berlin",
        activeEmployees: 4, unassignedWork: 0, todayAssignments: [],
        upcomingAssignments: [], studentHourWarnings: [],
        operationsAnalysis: {
          months: [{ month, completedAssignments: 5, assignmentsWithCalculatedRoute: 0, routeKilometers: 0, laborCost: 200, revenue: 400 }],
          employees: team.slice(0, 2).map((employee, index) => ({
            month, employee: { ...employee, createdAt: "2026-09-15T08:00:00.000Z" },
            completedAssignments: index === 0 ? 3 : 2,
            completedMinutes: index === 0 ? 360 : 240,
            creditedMinutes: index === 0 ? 360 : 240,
            carryInMinutes: 0, carryOutMinutes: 0, amount: 111,
          })),
        },
      },
    });
    cy.visit("/dashboard");
    cy.get(".employeeFeature > summary").click();
    cy.get('.employeeAnalysisSearch input').type("mIrA");
    cy.get(".employeeAnalysisTable > div:not(.tableHeader)").should("have.length", 1)
      .and("contain.text", "Mira Test").and("contain.text", "6.0h");
    cy.get('.employeeAnalysisTable time').should("have.attr", "datetime", "2026-09-15T08:00:00.000Z");
    cy.get(".employeeAnalysisTable .tableHeader").should("contain.text", "Completed assignments")
      .and("contain.text", "Worked hours");
    cy.get(".dashboardLanguageButton").click();
    cy.contains("Mitarbeiteranalyse").should("be.visible");
    cy.get(".employeeAnalysisTable").should("contain.text", "Arbeitsstunden");
    cy.reload();
    cy.contains("Einsatzübersicht").should("be.visible");
    cy.get(".dashboardLanguageButton").should("contain.text", "English");
    cy.get('.dashboardWorkspaceNav a[href="/dashboard/employees"]').click();
    cy.wait("@employees");
    cy.get("#firstName").should("have.attr", "placeholder", "Vorname");
    cy.get("#lastName").should("have.attr", "placeholder", "Nachname");
    cy.get(".employeeBlockHeading > span svg").should("have.length", 2);
    cy.contains("People intelligence").should("not.exist");
    cy.get(".dashboardLanguageButton").click();
    cy.get("#firstName").should("have.attr", "placeholder", "First name");
  });

  it("offers German on the employee dashboard at mobile width", () => {
    cy.viewport(390, 844);
    cy.mockEmployeeSession();
    cy.intercept("GET", "**/api/v1/dashboard", {
      body: { role: "EMPLOYEE", date: "2026-10-20", timeZone: "Europe/Berlin", todayAssignments: [], nextAssignment: null, monthlyPlannedHours: { plannedHours: 12 } },
    });
    cy.visit("/dashboard");
    cy.get(".dashboardLanguageButton").should("be.visible").click();
    cy.contains("Diesen Monat geplant").should("be.visible");
    cy.contains(".dashboardWorkspaceNav", "Mein Profil").should("be.visible");
    cy.document().then((document) => {
      expect(document.documentElement.scrollWidth).to.equal(document.documentElement.clientWidth);
    });
  });

  it("searches the compact edit-team list and preserves selections and rates", () => {
    cy.mockAdminSession();
    mockDirectory();
    const monday = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 9);
    while (monday.getDay() !== 1) monday.setDate(monday.getDate() + 1);
    const end = new Date(monday.getTime() + 2 * 60 * 60_000);
    const assignment = {
      id: "assignment-test", title: "Team editor test", startAt: monday.toISOString(), endAt: end.toISOString(),
      status: "SCHEDULED", notes: "", clientCharge: "200", recurringTemplate: null, recurringTemplateId: null,
      site: { id: "site-test", name: "Office", addressLine1: "Main street", city: "Berlin", client: { companyName: "Client" } },
      employees: [{ employeeId: team[0].id, employee: team[0], agreedHourlyRate: "18.50", rateOverridden: false }],
    };
    cy.intercept("GET", "**/api/v1/calendar*", { body: { items: [assignment], total: 1, page: 1, pageSize: 100, pageCount: 1 } });
    cy.intercept("PATCH", "**/api/v1/assignments/assignment-test", (request) => {
      expect(request.body.employees).to.deep.equal([
        { employeeId: team[0].id }, { employeeId: team[1].id, hourlyRate: 23 },
      ]);
      request.reply({ body: { assignment, studentWarnings: [] } });
    }).as("saveAssignment");
    cy.visit("/dashboard/assignments");
    cy.contains(".calendarEvent", "Team editor test").click();
    cy.contains("button", "Edit assignment").click();
    cy.wait("@employees");
    cy.get(".assignmentTeamList").should("have.css", "overflow-y", "auto")
      .and(($list) => { expect($list[0].getBoundingClientRect().height).to.be.at.most(230); });
    cy.get(".assignmentEmployeeSearch").type("Omar");
    cy.get(".assignmentTeamList article").should("have.length", 1).and("contain.text", "Omar Test");
    cy.get('.assignmentTeamList input[type="checkbox"]').check();
    cy.get('.assignmentTeamList input[type="number"]').type("23");
    cy.get(".assignmentEmployeeSearch").clear().type("Mira");
    cy.get('.assignmentTeamList input[type="checkbox"]').should("be.checked");
    cy.contains("button", "Save changes").click();
    cy.wait("@saveAssignment");
  });
});
