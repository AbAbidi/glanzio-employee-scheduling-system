function visitHomeWithSavedChoice() {
  cy.visit("/", { onBeforeLoad(win) {
    win.localStorage.setItem("glanzio-cookie-choice-v1", JSON.stringify({ version: 1, choice: "necessary", savedAt: Date.now() }));
  } });
}

describe("Real homepage feedback and cookie preferences", () => {
  beforeEach(() => {
    cy.intercept("POST", "**/api/v1/auth/refresh", { statusCode: 401, body: { message: "No session" } });
    cy.intercept("GET", "**/api/v1/feedback/published", { body: [] }).as("published");
  });

  it("replaces the old carousel with an honest empty state and private feedback submission", () => {
    cy.intercept("POST", "**/api/v1/feedback", (req) => {
      expect(req.body.allowPublic).to.equal(false);
      expect(req.body.rating).to.equal(5);
      expect(req.body.submissionKey).to.match(/^[\da-f-]{36}$/);
      req.reply({ statusCode: 202, body: { id: "submitted", status: "received" } });
    }).as("submitFeedback");
    visitHomeWithSavedChoice();
    cy.document().trigger("keydown", { key: "Escape" });
    cy.wait("@published");
    cy.get(".clientReviewsCarousel, .clientReviewCard, .sofaStory").should("not.exist");
    cy.get(".publishedFeedback").should("contain.text", "Noch keine veröffentlichten Rückmeldungen");
    cy.get('.feedbackForm input[name="displayName"]').type("Example Customer");
    cy.get('.feedbackStars label').last().click();
    cy.get('.feedbackForm textarea').type("Helpful service and clear communication, thank you.");
    cy.get('.feedbackPermission input').should("not.be.checked");
    cy.get('.feedbackSubmit').click();
    cy.wait("@submitFeedback");
    cy.get('.feedbackSuccess').should("contain.text", "wird nicht veröffentlicht");
    cy.get('.publishedFeedback article').should("not.exist");
    cy.get('.siteFooter').should("have.css", "background-image").and("contain", "linear-gradient");
    cy.get('.feedbackForm').scrollIntoView({ offset: { top: -120, left: 0 } });
    cy.screenshot("feedback-desktop", { capture: "viewport" });
  });

  it("keeps failed feedback and reuses the same submission key on retry, on mobile", () => {
    cy.viewport(390, 844);
    const keys: string[] = [];
    cy.intercept("POST", "**/api/v1/feedback", (req) => {
      keys.push(req.body.submissionKey as string);
      expect(req.body.allowPublic).to.equal(true);
      req.reply(keys.length === 1 ? { statusCode: 503, body: {} } : { statusCode: 202, body: { status: "received" } });
    }).as("submitFeedback");
    visitHomeWithSavedChoice(); cy.document().trigger("keydown", { key: "Escape" });
    cy.get('.feedbackForm textarea').type("A customer-submitted review for moderation, not a seeded quote.");
    cy.get('.feedbackPermission input').check();
    cy.get('.feedbackSubmit').click(); cy.wait("@submitFeedback");
    cy.get('.feedbackError').should("be.visible");
    cy.get('.feedbackForm textarea').should("contain.value", "customer-submitted");
    cy.get('.feedbackSubmit').click(); cy.wait("@submitFeedback");
    cy.then(() => expect(keys[0]).to.equal(keys[1]));
    cy.get('.feedbackSuccess').should("contain.text", "geprüft");
    cy.get('.feedbackForm').scrollIntoView({ offset: { top: -120, left: 0 } });
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.equal(doc.documentElement.clientWidth));
    cy.screenshot("feedback-mobile", { capture: "viewport" });
  });

  it("opens on the first homepage visit, remembers the choice and reopens manually on login", () => {
    cy.viewport(390, 844);
    cy.visit("/", { onBeforeLoad(win) { win.localStorage.removeItem("glanzio-cookie-choice-v1"); } });
    cy.get('.cookiePreferences').should("be.visible").and("contain.text", "keine Analyse- oder Marketing-Cookies");
    cy.get('.cookiePreferences a').should("have.length", 2);
    cy.get('.cookieDetailsToggle').click();
    cy.get('.cookieDetails').should("contain.text", "Immer aktiv").and("contain.text", "Nicht im Einsatz");
    cy.screenshot("cookie-preferences-mobile", { capture: "viewport" });
    cy.get('.cookieChoices').contains("button", "Nur notwendige").click();
    cy.get('.cookiePreferences').should("not.exist");
    cy.reload();
    cy.get('.cookiePreferences').should("not.exist");
    cy.visit("/login");
    cy.get('.cookiePreferences').should("not.exist");
    cy.get('#email').type("example@example.invalid");
    cy.get('#password').type("Example-Test-Password-2026!");
    cy.contains('button', 'Anmelden').should("be.enabled");
    cy.reload();
    cy.get('.cookiePreferences').should("not.exist");
    cy.get('.invitationLegalActions').contains('button', 'Cookie-Einstellungen').click();
    cy.get('.cookiePreferences').should("be.visible");
    cy.get('.cookieChoices').contains('button', 'Akzeptieren').click();
    cy.window().then((win) => expect(JSON.parse(win.localStorage.getItem('glanzio-cookie-choice-v1')!).choice).to.equal('accept'));
  });

  it("does not automatically gate login or invitations when no cookie choice exists", () => {
    for (const url of ["/login", `/login?invitation=${"c".repeat(64)}`]) {
      cy.visit(url, { onBeforeLoad(win) { win.localStorage.removeItem("glanzio-cookie-choice-v1"); } });
      cy.get('.accessPanel').should("be.visible");
      cy.get('.cookiePreferences').should("not.exist");
    }
  });

  it("keeps privacy and imprint documents accessible before a cookie choice", () => {
    for (const legal of ["privacy", "impressum"]) {
      cy.visit(`/?legal=${legal}`, { onBeforeLoad(win) { win.localStorage.removeItem("glanzio-cookie-choice-v1"); } });
      cy.get('.legalModal').should("be.visible");
      cy.get('.cookiePreferences').should("not.exist");
    }
  });

  it("shows only returned published feedback, with no fabricated verified badge", () => {
    cy.intercept("GET", "**/api/v1/feedback/published", { body: [{ id: "real", displayName: "Submitted pseudonym", message: "Example API response used only in this isolated UI test.", rating: 4, createdAt: "2026-10-23T09:00:00Z" }] });
    visitHomeWithSavedChoice();
    cy.get('.publishedFeedback article').should("have.length", 1).and("contain.text", "Submitted pseudonym");
    cy.get('.publishedFeedback').should("not.contain.text", "Verifiziert");
  });
});
