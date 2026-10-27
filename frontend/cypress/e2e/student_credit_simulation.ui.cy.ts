const student = {
  id: "00000000-0000-4000-8000-000000000010", firstName: "Fictional", lastName: "Student",
  phone: null, hourlyRate: "20", isStudent: true, active: true,
  user: { email: "fictional@example.invalid", status: "ACTIVE", lastLoginAt: null },
};

function overview() {
  cy.intercept("GET", "**/api/v1/dashboard", { body: {
    role: "ADMIN", date: "2026-10-21", timeZone: "Europe/Berlin", activeEmployees: 1,
    unassignedWork: 0, todayAssignments: [], upcomingAssignments: [], studentHourWarnings: [],
    operationsAnalysis: {
      months: [{ month: "2026-10", completedAssignments: 6, assignmentsWithCalculatedRoute: 0, routeKilometers: 0, laborCost: 1200, revenue: 1800 }],
      employees: [{ month: "2026-10", employee: student, completedAssignments: 6, completedMinutes: 3600, creditedMinutes: 2400, carryInMinutes: 0, carryOutMinutes: 1200, amount: 1200 }],
      weeklyStudents: { start: "2026-10-19", end: "2026-10-25", items: [{ employee: student, workedMinutes: 900, exceededByMinutes: 300 }] },
    },
  } });
}

describe("Student credit simulation", () => {
  beforeEach(() => { cy.mockAdminSession(); });
  it("shows the weekly excess separately from monthly credit, on mobile too", () => {
    cy.viewport(390, 844); overview();
    cy.visit("/dashboard");
    cy.get(".employeeFeature > summary").click();
    cy.get(".employeeAnalysisTable").should("contain.text", "40.0h").and("contain.text", "20.0h");
    cy.get(".studentWeeklyPanel").should("contain.text", "2026-10-19").and("contain.text", "15.0h").and("contain.text", "5.0h");
    cy.get('.employeeAnalysisSearch input').type("no match");
    cy.get(".studentCreditTable tbody tr").should("have.length", 0);
    cy.get('.employeeAnalysisSearch input').clear().type("fictional");
    cy.get(".studentCreditTable tbody tr").should("have.length", 1);
    cy.document().then((document) => {
      expect(document.documentElement.scrollWidth).to.equal(document.documentElement.clientWidth);
    });
    cy.screenshot("student-weekly-mobile", { capture: "viewport" });
  });
  it("previews November carry without closing or exporting automatically", () => {
    cy.intercept("GET", "**/api/v1/employees*", { body: { items: [student], total: 1, page: 1, pageSize: 100, pageCount: 1 } });
    cy.intercept("GET", "**/api/v1/reports/student-statement?*", (request) => {
      const month = new URL(request.url).searchParams.get("month")!;
      const november = month === "2026-11";
      request.reply({ body: { id: "draft", status: "DRAFT", sourceHash: "stable-source-hash", data: {
        month, zone: "Europe/Paris", employeeName: "Fictional Student", workedMinutes: november ? 0 : 720,
        carryInMinutes: november ? 120 : 0, creditedMinutes: november ? 120 : 600,
        carryOutMinutes: november ? 0 : 120,
        carryOut: november ? [] : [{ key: "october", title: "October work", originMonth: "2026-10", minutes: 120 }],
        sources: november ? [] : [26, 27, 29].map((day) => ({ key: `oct-${day}`, title: "Original completed work", sourceStart: `2026-10-${day}T08:00:00Z`, sourceEnd: `2026-10-${day}T12:00:00Z`, minutes: 240 })),
        allocations: november ? [{ kind: "CREDIT", date: "2026-11-02", startAt: "2026-11-02T07:00:00Z", endAt: "2026-11-02T09:00:00Z", sourceKey: "october", originMonth: "2026-10", minutes: 120 }] : [26, 27, 29].map((day) => ({ kind: "WORK", date: `2026-10-${day}`, startAt: `2026-10-${day}T08:00:00Z`, endAt: `2026-10-${day}T${day === 29 ? "10" : "12"}:00:00Z`, sourceKey: `oct-${day}`, originMonth: "2026-10", minutes: day === 29 ? 120 : 240 })),
      } } });
    }).as("creditPreview");
    cy.visit("/dashboard/employees");
    cy.get(".employeeModernActions button").then(($buttons) => {
      expect([...$buttons].slice(0, 4).map((button) => button.textContent)).to.deep.equal([
        "View analysis", "Export internal statement", "Edit profile", "Credit preview / closure",
      ]);
    });
    cy.contains("Student PDFs from October 2026 are visibly marked simulations.").should("not.exist");
    cy.get('input[type="month"]').clear().type("2026-10");
    cy.contains("button", "Credit preview / closure").click();
    cy.wait("@creditPreview");
    cy.get(".studentCreditPanel").should("contain.text", "SIMULATION").and("contain.text", "12.00h").and("contain.text", "Draft / projection").and("contain.text", "Completed-work portion");
    cy.get(".studentCreditPanel").should("not.contain.text", "Original completed assignments").and("not.contain.text", "Remaining credit origins").and("not.contain.text", "Snapshot fingerprint");
    cy.get('input[type="month"]').clear().type("2026-11");
    cy.wait("@creditPreview");
    cy.get(".studentCreditPanel").should("contain.text", "2026-11-02").and("contain.text", "2026-10").and("contain.text", "2.00h").and("contain.text", "Credit regularization");
    cy.get(".studentCreditPanel button").should("have.length", 1).and("contain.text", "×");
    cy.get(".studentCreditPanel").should("contain.text", "Draft / projection");
    cy.viewport(390, 844);
    cy.get(".studentCreditPanel").scrollIntoView().should("be.visible");
    cy.document().then((document) => {
      expect(document.documentElement.scrollWidth).to.equal(document.documentElement.clientWidth);
    });
    cy.screenshot("student-credit-mobile", { capture: "viewport" });
  });
  it("lists stored PDFs, drafts and credit movements in Reset preview without deleting", () => {
    overview();
    cy.intercept("GET", "**/api/v1/dashboard/reset-test-workspace/preview", { body: {
      assignments: 6, recurringSchedules: 0, employees: 1, employeeAccounts: 1, clients: 1, cleaningSites: 1,
      notifications: 2, invitations: 1, studentStatements: 2, studentCreditMovements: 9, storedPdfs: 2,
      preserved: [], derivedAnalysis: [],
    } });
    cy.visit("/dashboard");
    cy.get(".dangerFeature > summary").click();
    cy.contains("button", "Review test-data cleanup").click();
    cy.get(".resetPreviewGrid").should("contain.text", "Student drafts and closures").and("contain.text", "Credit movements").and("contain.text", "Stored simulation PDFs");
    cy.contains("button", "Permanently delete test data").should("be.disabled");
    cy.contains("button", "Cancel").click();
    cy.contains("button", "Review test-data cleanup").should("be.visible");
  });
});
