describe("Glanzio Reinigung public homepage", () => {
  function waitForStoryLayout() {
    cy.get(".qualityJourney").should("have.attr", "data-scroll-enhanced", "true");
    cy.document().then((doc) => doc.fonts.ready);
    cy.window().then((win) => new Cypress.Promise<void>((resolve) => win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve()))));
  }
  beforeEach(() => {
    cy.on("window:before:load", (win) => win.localStorage.setItem("glanzio-cookie-choice-v1", JSON.stringify({ version: 1, choice: "necessary", savedAt: Date.now() })));
    cy.visit("/");
    cy.document().trigger("keydown", { key: "Escape" });
    cy.get(".homeBrandIntro").should("have.attr", "hidden");
    cy.contains("a", "Anmelden").should("be.visible");
  });

  it("displays the German homepage by default", () => {
    cy.contains("Sauberkeit.").should("be.visible");
    cy.contains("Vertrauen. Qualität.").should("be.visible");
  });

  it("keeps the public website in German without a language switch", () => {
    cy.get(".languageSwitch").should("not.exist");
    cy.contains("Sauberkeit.").should("be.visible");
    cy.contains("Vertrauen. Qualität.").should("be.visible");
    cy.document().its("documentElement.lang").should("equal", "de");
  });

  it("reveals the clean glass while scrolling", () => {
    cy.viewport(1280, 720);
    waitForStoryLayout();
    cy.get(".glassStoryScene").should("have.length", 1);
    cy.get(".comparisonRange").should("not.exist");
    cy.contains("Mehr Klarheit. Mehr Licht.").should("exist");
    cy.contains("So sollte Ihr Sofa nicht bleiben.").should("not.exist");
    cy.contains("Sauber. Frisch. Wie neu.").should("not.exist");
    cy.get(".glassStoryPerson").should("not.exist");
    cy.get(".glassStoryFoamBackground").should("have.attr", "src", "/glass-foam-windowsill-v4.webp");
    cy.get(".glassStoryCleanLayer img").should("have.attr", "src", "/glass-clean-windowsill-v4.webp");

    cy.get(".glassStory").then(($story) => {
      const story = $story[0];
      cy.window().then((win) => {
        const storyTop = story.getBoundingClientRect().top + win.scrollY;
        const scrollDistance = story.offsetHeight - win.innerHeight;
        cy.scrollTo(0, storyTop + scrollDistance * 0.75, { duration: 450 });
      });
    });

    cy.get(".glassStory").should(($story) => {
      const cleanProgress = Number(
        $story[0].style.getPropertyValue("--clean-progress"),
      );
      expect(cleanProgress).to.be.greaterThan(0.65);
    });
    cy.get(".glassStory img").each(($image) => {
      cy.wrap($image).should(($loaded) => expect(($loaded[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0));
    });
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.equal(doc.documentElement.clientWidth));
    cy.get(".glassStoryCaption").should(($caption) => {
      const bounds = $caption[0].getBoundingClientRect();
      expect(bounds.left).to.be.at.least(0);
      expect(bounds.right).to.be.at.most($caption[0].ownerDocument.documentElement.clientWidth);
    });
    cy.screenshot("glass-cleaning-desktop", { capture: "viewport" });
  });

  it("keeps the glass transition usable on a mobile viewport", () => {
    cy.viewport(390, 844);
    cy.reload();
    waitForStoryLayout();

    cy.get(".glassStoryScene").should(($scene) => {
      expect($scene[0].getBoundingClientRect().height).to.equal(844);
    });

    cy.get(".glassStory").then(($story) => {
      const story = $story[0];
      cy.window().then((win) => {
        const storyTop = story.getBoundingClientRect().top + win.scrollY;
        const scrollDistance = story.offsetHeight - win.innerHeight;
        cy.scrollTo(0, storyTop + scrollDistance, { duration: 450 });
      });
    });

    cy.get(".glassStory")
      .should("have.attr", "data-clean-state", "partial")
      .and(($story) => {
        expect(
          Number($story[0].style.getPropertyValue("--clean-progress")),
        ).to.be.greaterThan(0.92);
      });

    cy.document().then((document) => {
      expect(document.documentElement.scrollWidth).to.equal(
        document.documentElement.clientWidth,
      );
    });
  });

  it("shows the official logo, six services and contact information", () => {
    cy.get(".publicBrandLogo")
      .first()
      .should("be.visible")
      .and(($logo) => {
        expect(($logo[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0);
      });

    cy.get(".serviceCard.hasMedia").should("have.length", 12);
    cy.get(".serviceCard.hasMedia:not([aria-hidden])").should("have.length", 6);
    cy.get(".serviceCardMedia > span").should("not.exist");

    cy.get(".serviceCard.hasMedia:not([data-service-copy])")
      .first()
      .trigger("pointerover", { eventConstructor: "PointerEvent", force: true });

    cy.document().then((doc) => doc.fonts.ready);
    cy.get(".serviceCarouselViewport").should("have.attr", "data-motion-ready", "true").then(($viewport) => {
      const initialScrollLeft = $viewport[0].scrollLeft;
      const original = $viewport[0].querySelector<HTMLElement>('.serviceCard:not([data-service-copy])')!;
      const copy = $viewport[0].querySelector<HTMLElement>('[data-service-copy="true"]')!;
      const cycle = original.offsetLeft - copy.offsetLeft;
      cy.wait(900);
      cy.wrap($viewport).should(($movingViewport) => {
        const drift = (initialScrollLeft - $movingViewport[0].scrollLeft + cycle) % cycle;
        expect(drift).to.be.greaterThan(2).and.lessThan(cycle / 4);
      });
    });

    cy.get(".serviceCarouselViewport").then(($viewport) => {
      const initialScrollLeft = $viewport[0].scrollLeft;
      cy.get(".serviceCard.hasMedia:not([data-service-copy])")
        .first()
        .trigger("wheel", { deltaY: 480, eventConstructor: "WheelEvent", force: true })
        .then(() => {
          expect(
            Math.abs($viewport[0].scrollLeft - initialScrollLeft),
          ).to.be.greaterThan(100);
        });
      });
    cy.get(".serviceCarouselControls").should("not.exist");

    for (const service of [
      "Gebäudereinigung",
      "Treppenhausreinigung",
      "Unterhaltsreinigung",
      "Glas- und Fensterreinigung",
      "Hausmeisterservice",
      "Winterdienst",
    ]) {
      cy.get(".serviceCard.hasMedia:not([aria-hidden])").should(
        "contain.text",
        service,
      );
    }

    cy.contains("Mehr erfahren").should("not.exist");
    cy.get(".serviceCard.hasMedia:not([aria-hidden])")
      .first()
      .find(".serviceCardMedia")
      .should("have.css", "position", "absolute");
    cy.get(".serviceCard.hasMedia:not([aria-hidden])")
      .first()
      .should("not.have.attr", "role", "button")
      .find(".serviceDetailsButton")
      .should("contain.text", "Details anzeigen")
      .trigger("click");
    cy.get(".serviceDialog")
      .should("be.visible")
      .and("contain.text", "Gebäudereinigung")
      .find('a[href="#contact"]')
      .should("contain.text", "Kontakt aufnehmen");
    cy.get(".serviceDialog").then(($dialog) => {
      const dialogBounds = $dialog[0].getBoundingClientRect();
      const titleBounds = $dialog.find("h2")[0].getBoundingClientRect();
      expect(titleBounds.left).to.be.at.least(dialogBounds.left);
      expect(titleBounds.right).to.be.at.most(dialogBounds.right);
    });
    cy.get(".serviceCardHint").should("not.exist");
    cy.get(".serviceDialogClose").click();
    cy.get(".serviceDialog").should("not.exist");

    cy.get(".whatsappContact").should("not.exist");
    cy.get(".floatingWhatsApp").should(
      "have.attr",
      "href",
      "https://wa.me/4917683446967",
    );

    cy.get(".publicNav").contains("a", "Kontakt").click();
    cy.get(".floatingWhatsApp")
      .should("have.class", "isDocked")
      .should(($floatingButton) => {
        const dockTarget = $floatingButton[0].ownerDocument.querySelector(
          ".whatsappDockTarget",
        );
        expect(dockTarget, "WhatsApp contact-card target").not.to.equal(null);

        const floatingBounds = $floatingButton[0].getBoundingClientRect();
        const targetBounds = dockTarget!.getBoundingClientRect();
        expect(Math.abs(floatingBounds.left - targetBounds.left)).to.be.lessThan(2);
        expect(Math.abs(floatingBounds.top - targetBounds.top)).to.be.lessThan(2);
      });

    cy.get("#contact").within(() => {
      cy.contains("+49 176 83446967").should("be.visible");
      cy.contains("info@glanzio-reinigung.de").should("be.visible");
      cy.contains("Bruckfelder Straße 6, 88662 Überlingen").should("be.visible");
      cy.contains("Mo–Fr: 08:00–18:00").should("be.visible");
    });
  });

  it("navigates to the process and About us sections, and returns home through the logo", () => {
    cy.get(".publicNav")
      .contains("a", "Ablauf")
      .should("be.visible")
      .click();

    cy.location("hash").should("equal", "#why-us");
    cy.get('.publicNav a[href="#why-us"]').should("have.class", "isActive");

    cy.get("#why-us").within(() => {
      cy.contains("Ihr Weg zum Glanz").should("be.visible");
    });

    cy.get(".publicNav").contains("a", "Über uns").click();

    cy.location("hash").should("equal", "#about");
    cy.get('.publicNav a[href="#about"]').should("have.class", "isActive");
    cy.get("#about").should("contain.text", "Was Glanzio auszeichnet");
    cy.get(".siteHeader .publicBrand").click();

    cy.location("hash").should("equal", "#top");
    cy.get("#top").should("be.visible");
  });

  it("shows the single company statement, luminous promise, and connected process steps", () => {
    cy.get(".storyBridge").should("not.exist");
    cy.get(".connectedStandardsStatement").should("have.length", 1);
    cy.get("#operations").within(() => {
      cy.get('a[href="#contact"]').should("not.exist");
      cy.get("figcaption").should("not.exist");
      cy.get(".companyValueCards article").should("have.length", 3);
      cy.get(".companyValueIcon").each(($icon) => {
        expect($icon.text().trim()).to.equal("");
        expect($icon.find("svg")).to.have.length(1);
      });
    });
    cy.get("#why-us").scrollIntoView();
    cy.get("#why-us").should("have.class", "isVisible");
    cy.get(".trustCriteriaGrid").should("not.exist");
    cy.get("ol.processJourney > li").should("have.length", 4);
    cy.get(".processJourneyIcon").should("have.length", 4);
    // Hide fixed controls only in section captures to avoid stitched duplicates.
    cy.get(".siteHeader, .floatingWhatsApp").invoke("css", "visibility", "hidden");
    cy.get("#operations").screenshot("promise-bright-desktop");
    cy.get("#why-us").screenshot("process-journey-desktop");
    cy.viewport(390, 844);
    cy.get("#why-us").scrollIntoView();
    cy.get(".processJourney").should("have.css", "display", "grid");
    cy.document().then((doc) => {
      expect(doc.documentElement.scrollWidth).to.equal(doc.documentElement.clientWidth);
    });
    // A viewport capture avoids stitching a section taller than the mobile screen.
    cy.screenshot("process-journey-mobile", { capture: "viewport" });
    cy.get(".siteHeader, .floatingWhatsApp").invoke("css", "visibility", "");
  });

  it("opens the in-site Impressum and Datenschutz information", () => {
    cy.get(".siteFooter").scrollIntoView();
    cy.get(".floatingWhatsApp").should("have.class", "isSuppressed");
    cy.get(".siteFooter").contains("button", "Impressum").click();

    cy.get('[role="dialog"]')
      .should("be.visible")
      .and("contain.text", "Angaben gemäß § 5 DDG")
      .and("contain.text", "Abdessalem Akrout")
      .and("contain.text", "Mohanned Goucha");

    cy.get('[role="dialog"]').contains("button", "Schließen").click();
    cy.get('[role="dialog"]').should("not.exist");

    cy.get(".siteFooter").contains("button", "Datenschutz").click();
    cy.get('[role="dialog"]')
      .should("be.visible")
      .and("contain.text", "Datenschutz auf einen Blick")
      .and("contain.text", "Kontaktformular")
      .and("contain.text", "Art. 6 Abs. 1 lit. b DSGVO");

    cy.get('[role="dialog"]').find(".legalModalClose").click();
    cy.get('[role="dialog"]').should("not.exist");
    cy.get(".siteFooter").should(
      "contain.text",
      "© 2026 Glanzio Reinigung. All rights reserved.",
    );
  });
});
