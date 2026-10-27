const client = {
  id: "00000000-0000-4000-8000-000000000033", companyName: "Example Market",
  contactName: "Example Contact", email: "contact@example.invalid", phone: null,
  notes: null, active: true, _count: { sites: 2 },
};

describe("Client archive confirmation", () => {
  beforeEach(() => {
    cy.mockAdminSession();
    cy.intercept("GET", "**/api/v1/clients?*", { body: {
      items: [client], page: 1, pageSize: 100, pageCount: 1, total: 1,
    } }).as("clients");
    cy.visit("/dashboard/clients");
    cy.wait("@clients");
  });

  it("uses an in-page dialog, cancels safely, and restores keyboard focus", () => {
    let deletes = 0;
    cy.intercept("DELETE", "**/api/v1/clients/*", () => { deletes++; });
    cy.window().then((win) => cy.stub(win, "confirm").as("browserConfirm"));
    cy.contains(".clientCardGrid article", "Example Market").contains("button", "Archive").click();
    cy.get("dialog.clientArchiveDialog").should("be.visible").and("contain.text", "Example Market");
    cy.get("dialog.clientArchiveDialog").should("have.attr", "open");
    cy.get("@browserConfirm").should("not.have.been.called");
    cy.get(".clientArchiveDialog").contains("button", "Cancel").should("be.focused").click();
    cy.get(".clientArchiveDialog").should("not.exist");
    cy.contains(".clientCardGrid article", "Example Market").contains("button", "Archive").should("be.focused").click();
    cy.get(".clientArchiveDialog").trigger("cancel");
    cy.get(".clientArchiveDialog").should("not.exist");
    cy.then(() => expect(deletes).to.equal(0));
  });

  it("keeps failures inside the dialog and archives only after explicit confirmation, on mobile", () => {
    cy.viewport(390, 844);
    let attempts = 0;
    cy.intercept("DELETE", "**/api/v1/clients/*", (request) => {
      attempts++;
      request.reply(attempts === 1 ? {
        statusCode: 409, body: { message: "Resolve future assignments before archiving." },
      } : { statusCode: 200, delay: 700, body: { ...client, active: false } });
    }).as("archiveClient");
    cy.contains(".clientCardGrid article", "Example Market").contains("button", "Archive").click();
    cy.get(".clientArchiveDialog").should("be.visible");
    cy.then(() => expect(attempts).to.equal(0));
    cy.get(".clientArchiveConfirm").click();
    cy.wait("@archiveClient");
    cy.get('.clientArchiveDialog [role="alert"]').should("contain.text", "Resolve future assignments");
    cy.get(".clientArchiveDialog").should(($dialog) => {
      const bounds = $dialog[0].getBoundingClientRect();
      expect(bounds.top).to.be.at.least(0);
      expect(bounds.bottom).to.be.at.most(844);
      expect(bounds.width).to.be.at.most(390);
    });
    cy.get(".clientCardGrid").should("contain.text", "Example Market");
    cy.screenshot("client-archive-mobile", { capture: "viewport" });
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.equal(doc.documentElement.clientWidth));
    cy.get(".clientArchiveConfirm").click().should("be.disabled");
    cy.get('.clientArchiveDialog button[aria-label="Close"]').should("be.disabled");
    cy.wait("@archiveClient");
    cy.get(".clientArchiveDialog").should("not.exist");
    cy.get(".clientCardGrid").should("not.contain.text", "Example Market");
    cy.contains("Client archived. Historical assignments were preserved.").should("be.visible");
  });
});
