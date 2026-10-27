const archivedPerson = {
  id: "archived-person", firstName: "Former", lastName: "Colleague", active: false,
  phone: null, hourlyRate: "20", isStudent: true,
  user: { email: "former@example.invalid", status: "INACTIVE", lastLoginAt: null },
};

describe("Admin archive", () => {
  it("keeps retained profiles and red analysis in the archive on desktop and mobile", () => {
    cy.mockAdminSession();
    cy.intercept("GET", "**/api/v1/employees?*", (request) => {
      expect(new URL(request.url).searchParams.get("active")).to.equal("false");
      request.reply({ body: { items: [archivedPerson], total: 1, page: 1, pageCount: 1, pageSize: 20 } });
    }).as("archiveEmployees");
    cy.intercept("GET", "**/api/v1/dashboard/archive-analysis*", { body: {
      employees: [{ month: "2026-10", employee: archivedPerson, completedAssignments: 2, completedMinutes: 1080, creditedMinutes: 1080, carryOutMinutes: 0, amount: 360 }],
      weeklyStudents: { start: "2026-10-19", end: "2026-10-25", items: [{ employee: archivedPerson, workedMinutes: 1080, exceededByMinutes: 480 }] },
    } }).as("archiveAnalysis");
    cy.intercept("GET", "**/api/v1/clients?*", (request) => {
      expect(new URL(request.url).searchParams.get("active")).to.equal("false");
      request.reply({ body: { items: [{ id: "old-client", companyName: "Former Client", active: false, _count: { sites: 2 } }], total: 1, pageCount: 1, page: 1, pageSize: 20 } });
    }).as("archiveClients");
    cy.viewport(1440, 900);
    cy.visit("/dashboard/archive");
    cy.wait(["@archiveEmployees", "@archiveAnalysis"]);
    cy.get('input[type="month"]').clear().type("2026-10");
    cy.get(".archiveRecord").should("contain.text", "Former Colleague").and("contain.text", "Archived");
    cy.get(".archivedAnalysis summary").click();
    cy.get(".archivedAnalysis").should("contain.text", "18.0h").and("contain.text", "8.0h");
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.equal(doc.documentElement.clientWidth));
    cy.get(".archivePanel").contains("button", /export|download/i).should("not.exist");
    cy.screenshot("archive-desktop", { capture: "viewport" });
    cy.viewport(390, 844);
    cy.get(".archiveRecord").scrollIntoView().should("be.visible");
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.equal(doc.documentElement.clientWidth));
    cy.screenshot("archive-mobile", { capture: "viewport" });
    cy.get('.archiveTools button').contains("Clients").click();
    cy.wait("@archiveClients");
    cy.get(".archiveRecord").should("contain.text", "Former Client");
    cy.get(".archivedAnalysis").should("not.exist");
  });

  it("does not load archive data for an employee account", () => {
    cy.mockEmployeeSession();
    let reads = 0;
    cy.intercept("GET", "**/api/v1/dashboard/archive-analysis*", () => { reads++; });
    cy.visit("/dashboard/archive");
    cy.contains("Administrator access required").should("be.visible");
    cy.get(".archivePanel").should("not.exist");
    cy.then(() => expect(reads).to.equal(0));
  });
});
