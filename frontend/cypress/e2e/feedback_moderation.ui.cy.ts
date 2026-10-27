describe("Admin feedback moderation", () => {
  it("only enables publication when the author permitted it, including on mobile", () => {
    cy.mockAdminSession();
    let published = false;
    cy.intercept("GET", "**/api/v1/feedback?*", (req) => req.reply({ body: {
      page: 1, pageCount: 1, total: 2, items: [
        { id: "pending", displayName: "Consented feedback", message: "Fixture visible only in this UI test.", rating: 4, allowPublic: true, status: published ? "PUBLISHED" : "PENDING", createdAt: "2026-10-23T09:00:00Z" },
        { id: "private", displayName: "Private feedback", message: "Private feedback must never be published.", rating: null, allowPublic: false, status: "PRIVATE", createdAt: "2026-10-23T08:00:00Z" },
      ],
    } })).as("feedback");
    cy.intercept("PATCH", "**/api/v1/feedback/pending", (req) => {
      expect(req.body).to.deep.equal({ status: "PUBLISHED" });
      published = true; req.reply({ body: { status: "PUBLISHED" } });
    }).as("publish");
    cy.viewport(390, 844);
    cy.visit("/dashboard/feedback"); cy.wait("@feedback");
    cy.contains('.feedbackAdminCard', 'Private feedback').contains('button', 'Publish').should('be.disabled');
    cy.contains('.feedbackAdminCard', 'Consented feedback').contains('button', 'Publish').click();
    cy.wait(["@publish", "@feedback"]);
    cy.contains('.feedbackAdminCard', 'Consented feedback').should('contain.text', 'PUBLISHED');
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.equal(doc.documentElement.clientWidth));
  });

  it("does not expose moderation to employees", () => {
    cy.mockEmployeeSession();
    let reads = 0;
    cy.intercept("GET", "**/api/v1/feedback?*", () => { reads++; });
    cy.visit('/dashboard/feedback');
    cy.contains('Administrator access required').should('be.visible');
    cy.get('.feedbackAdminPanel').should('not.exist');
    cy.then(() => expect(reads).to.equal(0));
  });
});
