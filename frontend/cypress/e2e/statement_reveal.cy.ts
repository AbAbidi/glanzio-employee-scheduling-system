describe("Glanzio statement block reveal", () => {
  beforeEach(() => {
    cy.on("window:before:load", (win) => win.localStorage.setItem("glanzio-cookie-choice-v1", JSON.stringify({ version: 1, choice: "necessary", savedAt: Date.now() })));
  });
  it("uncovers measured text lines in a staggered sweep", () => {
    cy.viewport(1280, 800);
    cy.visit("/");
    cy.document().trigger("keydown", { key: "Escape" });
    cy.get(".statementBlockReveal").first().should("have.attr", "data-reveal-ready", "true");
    cy.get(".statementBlockReveal").first().scrollIntoView();
    cy.get(".statementBlockReveal").first().should("have.class", "isRevealed");
    cy.get(".statementBlockReveal").first().within(() => {
      cy.get(".blockRevealMask").should(($masks) => {
        expect($masks.length).to.be.greaterThan(1);
        const delays = Array.from($masks, (mask) => (mask as HTMLElement).style.getPropertyValue("--reveal-delay"));
        expect(new Set(delays).size).to.equal($masks.length);
      });
      cy.get(".blockRevealMask").first().should("have.css", "animation-name", "statementLineWipe");
    });
    cy.get(".connectedStandardsStatement").then(($statement) => {
      for (const animation of $statement[0].getAnimations({ subtree: true })) {
        animation.pause();
        animation.currentTime = 350;
      }
    });
    cy.get(".siteHeader, .floatingWhatsApp").invoke("css", "visibility", "hidden");
    cy.get("#about").screenshot("statement-block-reveal-desktop", { disableTimersAndAnimations: false });
    cy.get(".connectedStandardsStatement").then(($statement) => {
      for (const animation of $statement[0].getAnimations({ subtree: true })) animation.play();
    });
    cy.get(".statementBlockReveal").first().should("have.class", "isComplete");
    cy.get(".statementBlockReveal").first().find(".blockRevealWord").first().should("have.css", "opacity", "1");
    cy.get(".blockRevealMask").first().should("have.css", "display", "none");
  });

  it("fits the actual mobile lines without horizontal overflow", () => {
    cy.viewport(390, 844);
    cy.visit("/#about");
    cy.get(".statementBlockReveal").first().scrollIntoView();
    cy.get(".statementBlockReveal").first().should("have.class", "isComplete");
    cy.get(".statementBlockReveal").last().scrollIntoView();
    cy.get(".statementBlockReveal").last().should("have.class", "isComplete");
    cy.get(".statementBlockReveal").each(($paragraph) => {
      const paragraph = $paragraph[0];
      expect(paragraph.scrollWidth).to.be.at.most(paragraph.clientWidth + 1);
    });
    cy.document().then((doc) => {
      expect(doc.documentElement.scrollWidth).to.equal(doc.documentElement.clientWidth);
    });
    cy.get(".siteHeader, .floatingWhatsApp").invoke("css", "visibility", "hidden");
    cy.get("#about").screenshot("statement-block-reveal-mobile");
  });

  it("keeps the words visible without animation for reduced motion", () => {
    cy.visit("/#about", {
      onBeforeLoad(win) {
        const matchMedia = win.matchMedia.bind(win);
        cy.stub(win, "matchMedia").callsFake((query: string) => {
          const result = matchMedia(query);
          if (query === "(prefers-reduced-motion: reduce)") {
            Object.defineProperty(result, "matches", { value: true });
          }
          return result;
        });
      },
    });
    cy.get(".statementBlockReveal .blockRevealMask").should("not.exist");
    cy.get(".blockRevealWord").first().should("have.css", "opacity", "1");
    cy.get(".connectedStandardsStatement").should("contain.text", "Wohlfühlatmosphären zu schaffen.");
    cy.get(".qualityJourney").should("not.have.attr", "data-scroll-enhanced");
  });
});
