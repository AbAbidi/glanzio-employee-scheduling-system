describe("Centered homepage footer links", () => {
  for (const width of [1280, 390]) {
    it(`keeps cookie settings aligned with the other links at ${width}px`, () => {
      cy.viewport(width, 720);
      cy.intercept("POST", "**/api/v1/auth/refresh", { statusCode: 401, body: {} });
      cy.intercept("GET", "**/api/v1/feedback/published", { body: [] });
      cy.visit("/", { onBeforeLoad(win) {
        win.localStorage.setItem("glanzio-cookie-choice-v1", JSON.stringify({ version: 1, choice: "necessary", savedAt: Date.now() }));
      } });
      cy.document().trigger("keydown", { key: "Escape" });
      cy.get(".serviceCarouselViewport").should("have.attr", "data-motion-ready", "true");
      cy.document().then((doc) => doc.fonts.ready);
      cy.get(".siteFooter").scrollIntoView();
      cy.get(".floatingWhatsApp").should("have.class", "isSuppressed").and("have.css", "opacity", "0");
      cy.get(".siteFooter > nav").should(($nav) => {
        const nav = $nav[0];
        const bounds = nav.getBoundingClientRect();
        const footer = nav.parentElement!.getBoundingClientRect();
        expect(bounds.left + bounds.width / 2).to.be.closeTo(footer.left + footer.width / 2, 1);
        expect(getComputedStyle(nav).justifyContent).to.equal("center");
        for (const link of nav.children) {
          const box = link.getBoundingClientRect();
          expect(box.left).to.be.at.least(bounds.left);
          expect(box.right).to.be.at.most(bounds.right + 1);
        }
      });
      if (width === 1280) {
        cy.get(".siteFooter > nav").then(($nav) => {
          const tops = [...$nav[0].children].map((link) => link.getBoundingClientRect().top);
          expect(Math.max(...tops) - Math.min(...tops)).to.be.lessThan(1);
        });
      }
      cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.equal(doc.documentElement.clientWidth));
      cy.get(".siteFooter").screenshot(`footer-centered-${width}`);
      cy.get(".siteFooter").contains("button", "Cookie-Einstellungen").click();
      cy.get(".cookiePreferences").should("be.visible");
    });
  }
});
