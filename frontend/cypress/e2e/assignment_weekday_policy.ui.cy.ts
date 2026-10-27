function dateValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

describe("Assignment weekday scheduling policy", { scrollBehavior: "center" }, () => {
  beforeEach(() => {
    cy.mockAdminSession();

    cy.intercept("GET", "**/api/v1/calendar*", {
      body: { items: [], page: 1, pageSize: 100, total: 0, pageCount: 0 },
    }).as("loadCalendar");
    cy.intercept("GET", "**/api/v1/sites*", {
      body: { items: [], page: 1, pageSize: 100, total: 0, pageCount: 0 },
    }).as("loadSites");
    cy.intercept("GET", "**/api/v1/clients*", {
      body: {
        items: [
          {
            id: "00000000-0000-4000-8000-000000000030",
            companyName: "Example GmbH",
            contactName: null,
            email: null,
            phone: null,
            notes: null,
            active: true,
            createdAt: "2026-09-01T08:00:00.000Z",
            updatedAt: "2026-09-01T08:00:00.000Z",
            _count: { sites: 0 },
          },
        ],
        page: 1,
        pageSize: 100,
        total: 1,
        pageCount: 1,
      },
    }).as("loadClients");
    cy.intercept("GET", "**/api/v1/employees*", {
      body: {
        items: [
          {
            id: "00000000-0000-4000-8000-000000000040",
            firstName: "Mira",
            lastName: "Test",
            isStudent: false,
            hourlyRate: "18.50",
            active: true,
            user: { status: "ACTIVE" },
          },
        ],
        page: 1,
        pageSize: 100,
        total: 1,
        pageCount: 1,
      },
    }).as("loadEmployees");

    cy.visit("/dashboard/assignments");
    cy.wait(["@restoreAdminSession", "@loadCalendar"]);
  });

  it("keeps weekends read-only in the calendar", () => {
    cy.get(".dashboardShellHeader").should("have.css", "position", "fixed");
    cy.contains("button", "New assignment")
      .should("be.visible")
      .and("have.css", "background-image")
      .and("include", "linear-gradient");

    cy.get(".calendarDay.isWeekend .calendarDayNumber")
      .should("have.length.greaterThan", 0)
      .and("be.disabled");

    cy.get(".calendarDay.isWeekend .calendarWeekendLabel").should("not.exist");

    cy.get(".calendarDay:not(.isWeekend) .calendarDayNumber")
      .not(":disabled")
      .should("have.length.greaterThan", 0);
  });

  it("rejects a weekend date and offers only Monday to Friday for weekly work", () => {
    cy.get(".calendarDay:not(.isWeekend) .calendarDayNumber")
      .not(":disabled")
      .first()
      .click();
    cy.wait(["@loadClients", "@loadEmployees"]);
    cy.get('select[name="newClientId"]').select(
      "00000000-0000-4000-8000-000000000030",
    );
    cy.wait("@loadSites");
    cy.contains("button", "New site").should("have.class", "isSelected");
    cy.get(".dashboardShellHeader").should("not.exist");
    cy.get(".schedulerBackdrop").should("be.visible");
    cy.get(".locationMap").scrollIntoView()
      .should("be.visible")
      .and(($map) => {
        expect($map[0].getBoundingClientRect().height).to.be.greaterThan(250);
      });
    cy.get(".leaflet-control-attribution").should("not.exist");
    cy.get(".leaflet-control-zoom").should("not.exist");
    cy.get(".mapProviderCredit")
      .should("contain.text", "OpenStreetMap contributors");
    cy.get(".schedulerEmployeeList").contains("Mira Test").should("exist");
    cy.get('.schedulerEmployeeList input[type="checkbox"]').check();
    cy.get(".schedulerEmployeeList article").should("have.class", "isSelected");
    cy.get(".schedulerEmployeeList .specialRate input").type("21.50");
    cy.get(".schedulerEmployeeList .specialRate input").should("have.value", "21.50");

    const saturday = new Date();
    while (saturday.getDay() !== 6) {
      saturday.setDate(saturday.getDate() + 1);
    }

    cy.get('input[name="assignmentDate"]')
      .clear({ force: true })
      .type(dateValue(saturday), { force: true });

    cy.contains(
      "Assignments cannot be scheduled on Saturday or Sunday.",
    ).should("be.visible");
    cy.contains("button", "Create assignment").should("be.disabled");

    cy.contains("label", "Repetition")
      .find("select")
      .select("WEEKLY");
    cy.get(".weekdayPicker button").should("have.length", 5);
    cy.get('.weekdayPicker button[aria-label="Saturday"]').should("not.exist");
    cy.get('.weekdayPicker button[aria-label="Sunday"]').should("not.exist");
  });

  it("creates a client in a separate dialog and selects it", () => {
    cy.viewport(390, 844);
    cy.intercept("POST", "**/api/v1/clients", (request) => {
      expect(request.body.companyName).to.equal("Neue Firma GmbH");
      request.reply({
        statusCode: 201,
        body: {
          id: "00000000-0000-4000-8000-000000000099",
          companyName: "Neue Firma GmbH",
          contactName: null,
          email: null,
          phone: null,
          notes: null,
          active: true,
          createdAt: "2026-10-20T08:00:00.000Z",
          updatedAt: "2026-10-20T08:00:00.000Z",
        },
      });
    }).as("createClient");

    cy.get(".calendarDay:not(.isWeekend) .calendarDayNumber")
      .not(":disabled")
      .first()
      .click();
    cy.wait(["@loadClients", "@loadEmployees", "@loadSites"]);

    cy.contains("button", "+ Create a new client").click();
    cy.get(".clientCreatorDialog").should("be.visible");
    cy.get(".clientCreatorDialog").then(($dialog) => {
      expect($dialog[0].getBoundingClientRect().width).to.be.at.most(390);
    });
    cy.get('.clientCreatorDialog input[name="clientCompanyName"]')
      .type("Neue Firma GmbH");
    cy.get(".clientCreatorDialog").contains("button", "Create client").click();
    cy.wait("@createClient");

    cy.get(".clientCreatorDialog").should("not.exist");
    cy.get('select[name="newClientId"]')
      .should("have.value", "00000000-0000-4000-8000-000000000099");
  });

  it("highlights BW holidays and warns about single and recurring assignments", () => {
    cy.clock(new Date(2026, 11, 1, 12).getTime(), ["Date"]);
    cy.visit("/dashboard/assignments");
    cy.wait("@loadCalendar");
    cy.contains(".calendarHolidayLabel", "1. Weihnachtsfeiertag").should("be.visible");
    cy.get(".calendarHolidayGuide").should("not.exist");
    cy.contains(".calendarHolidayLabel", "1. Weihnachtsfeiertag").should("have.css", "color", "rgb(37, 99, 235)").parent().should("have.class", "calendarDayTop");
    cy.contains(".calendarDay.isHoliday", "1. Weihnachtsfeiertag").should("have.css", "background-color", "rgb(255, 255, 255)");
    cy.get(".calendarDay:not(.isToday) .calendarDayNumber").each(($date) => {
      expect($date).not.to.have.css("background-color", "rgb(37, 99, 235)");
    });
    cy.get(".calendarDay.isToday .calendarDayNumber").should("have.css", "background-color", "rgb(37, 99, 235)");
    cy.contains(".calendarHolidayLabel", "1. Weihnachtsfeiertag").scrollIntoView({ offset: { top: -120, left: 0 } });
    cy.screenshot("compact-calendar-holidays", { capture: "viewport" });
    cy.contains(".calendarDay.isHoliday", "1. Weihnachtsfeiertag").find(".calendarDayNumber").click();
    cy.wait(["@loadClients", "@loadEmployees"]);
    cy.get(".assignmentHolidayWarning").should("contain.text", "25").and("contain.text", "1. Weihnachtsfeiertag");
    cy.get('input[name="assignmentDate"]').clear().type("2026-12-18");
    cy.get(".assignmentHolidayWarning").should("not.exist");
    cy.contains("label", "Repetition").find("select").select("WEEKLY");
    cy.get('input[name="repeatUntil"]').type("2027-01-08");
    cy.get(".assignmentHolidayWarning").should("contain.text", "1. Weihnachtsfeiertag").and("contain.text", "Neujahr");
    cy.get('input[name="repeatInterval"]').clear().type("2");
    cy.get(".assignmentHolidayWarning").should("not.contain.text", "1. Weihnachtsfeiertag").and("contain.text", "Neujahr");
    cy.viewport(390, 844);
    cy.get(".assignmentHolidayWarning").scrollIntoView({ offset: { top: -90, left: 0 } }).should("be.visible");
    cy.screenshot("bw-holiday-mobile", { capture: "viewport" });
    cy.document().then((document) => expect(document.documentElement.scrollWidth).to.equal(document.documentElement.clientWidth));
  });
});
