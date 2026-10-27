function scrollJourney(progress: number) {
  cy.get(".qualityJourney").should("have.attr", "data-scroll-enhanced", "true").then(($section) => {
    const section = $section[0];
    const stage = section.querySelector<HTMLElement>(".qualityJourneyStage")!;
    cy.window().then((win) => {
      const top = win.scrollY + section.getBoundingClientRect().top;
      win.scrollTo({ top: top + (section.offsetHeight - stage.offsetHeight) * progress, behavior: "instant" });
    });
  });
  cy.get(".qualityJourney").should(($section) => {
    const value = Number($section[0].style.getPropertyValue("--journey-progress"));
    expect(value).to.be.closeTo(progress, 0.015);
  });
}

function centerPlanningImage() {
  cy.get(".qualityJourney").then(($section) => {
    const section = $section[0];
    const stage = section.querySelector<HTMLElement>(".qualityJourneyStage")!;
    const track = section.querySelector<HTMLElement>(".qualityGalleryTrack")!;
    const item = section.querySelector<HTMLElement>('.qualityMoment[data-quality-index="0"]')!;
    const progress = (item.offsetLeft + item.offsetWidth / 2 - stage.clientWidth / 2) / (track.scrollWidth - stage.clientWidth);
    scrollJourney(progress);
  });
}

function assertGalleryTextColors() {
  cy.get(".qualityMoment").each(($moment, index) => {
    const expected = index < 2 ? "rgb(255, 255, 255)" : "rgb(17, 17, 17)";
    for (const text of $moment[0].querySelectorAll("h3, figcaption p")) {
      expect(getComputedStyle(text).color, `fixed text color for image ${index + 1}`).to.equal(expected);
    }
  });
}

describe("Scroll-driven company values gallery", () => {
  beforeEach(() => {
    cy.viewport(1280, 900);
    cy.on("window:before:load", (win) => win.localStorage.setItem("glanzio-cookie-choice-v1", JSON.stringify({ version: 1, choice: "necessary", savedAt: Date.now() })));
  });

  for (const [width, height] of [[1280, 900], [390, 844]]) {
    it(`shows four uncropped, unboxed photographs with a moving background at ${width}px`, () => {
      cy.viewport(width, height);
      cy.visit("/");
      cy.document().trigger("keydown", { key: "Escape" });
      cy.get(".qualityJourney").should("have.attr", "data-scroll-enhanced", "true");
      cy.get(".qualityMoment").should("have.length", 4);
      cy.get(".qualityCard, .qualityJourneyFooter, .qualityJourneyProgress, .qualityJourneyLead").should("not.exist");
      cy.get(".qualityJourney").should("not.contain.text", "Vier Grundsätze. Ein Anspruch:")
        .and("not.contain.text", "Weiter scrollen & entdecken");
      cy.get(".qualityMoment figure").each(($figure) => {
        expect(getComputedStyle($figure[0]).backgroundColor).to.equal("rgba(0, 0, 0, 0)");
        expect(getComputedStyle($figure[0]).boxShadow).to.equal("none");
      });
      cy.get(".companyBenefits").should("not.exist");
      cy.get(".qualityJourney").should("contain.text", "Individuelle Reinigungskonzepte")
        .and("contain.text", "Umweltschonende Premium-Produkte")
        .and("contain.text", "Geschultes & zuverlässiges Fachpersonal")
        .and("contain.text", "Höchste Diskretion und Sicherheit");
      cy.get(".qualityMoment figcaption p").each(($description) => {
        expect($description.text().length).to.be.greaterThan(60);
      });
      cy.get(".siteHeader, .floatingWhatsApp").invoke("css", "visibility", "hidden");
      scrollJourney(0);
      cy.get(".qualityJourney").should("have.attr", "data-flow-active", "true");
      cy.get(".qualityFlowOrbits").should("have.css", "animation-name", "qualityLineOrbit")
        .and("have.css", "animation-duration", "6s");
      cy.get(".qualityFlowBase circle, .qualityFlowBase ellipse").should("have.length", 5);
      cy.get(".qualityFlowHighlights").should("have.css", "animation-play-state", "running")
        .and("have.css", "animation-duration", "3s");
      assertGalleryTextColors();
      cy.get(".qualityMoment").then(($moments) => {
        const titleSize = (index: number) => parseFloat(getComputedStyle($moments[index].querySelector("h3")!).fontSize);
        const copySize = (index: number) => parseFloat(getComputedStyle($moments[index].querySelector("figcaption p")!).fontSize);
        expect(titleSize(0)).to.be.greaterThan(titleSize(1));
        expect(copySize(0)).to.be.greaterThan(copySize(1));
        expect(titleSize(3)).to.be.greaterThan(titleSize(1));
      });
      cy.get(".qualityJourneyHeader").should("have.css", "opacity", "1");
      cy.get(".qualityIntro").should(($intro) => {
        const bounds = $intro[0].getBoundingClientRect();
        const stage = $intro[0].closest(".qualityJourneyStage")!.getBoundingClientRect();
        expect(bounds.left + bounds.width / 2).to.be.closeTo(stage.left + stage.width / 2, 2);
      });
      cy.get(".qualityMiniLayer[aria-hidden=true] img").should("have.length", 3).each(($image) => {
        expect(getComputedStyle($image[0]).filter).to.equal("grayscale(1)");
        expect(getComputedStyle($image[0]).transform).to.equal("none");
        expect($image.attr("alt")).to.equal("");
      });
      cy.get(".qualityMiniOne").should(($image) => {
        const stage = $image[0].closest(".qualityJourneyStage")!.getBoundingClientRect();
        expect($image[0].getBoundingClientRect().left, "window thumbnail is outside the opening scene").to.be.at.least(stage.right);
      });
      cy.get(".qualityJourneyStage").should("have.css", "background-color", "rgb(13, 60, 46)");
      cy.get(".qualityMoment img").first().should(($image) => {
        expect(($image[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0);
      });
      cy.get(".qualityMoment img").first().then(($image) => ($image[0] as HTMLImageElement).decode());
      cy.get(".qualityJourneyStage").screenshot(`quality-green-${width}`);
      scrollJourney(0.12);
      cy.get(".qualityJourneyHeader").should(($heading) => {
        expect(Number(getComputedStyle($heading[0]).opacity)).to.equal(1);
        expect($heading[0].getBoundingClientRect().left).to.be.lessThan(0);
      });
      centerPlanningImage();
      cy.get('.qualityMoment[data-quality-index="0"] img').should(($image) => {
        const bounds = $image[0].getBoundingClientRect();
        const stage = $image[0].closest(".qualityJourneyStage")!.getBoundingClientRect();
        expect(bounds.left + bounds.width / 2).to.be.closeTo(stage.left + stage.width / 2, 3);
      });
      cy.get(".qualityJourneyStage").screenshot(`quality-planning-centered-${width}`);
      cy.get('.qualityMoment[data-quality-index="0"] figcaption').then(($caption) => {
          const copy = $caption[0].getBoundingClientRect();
          cy.get(".qualityMini").each(($mini) => {
            const image = $mini[0].getBoundingClientRect();
            const overlaps = image.left < copy.right && image.right > copy.left && image.top < copy.bottom && image.bottom > copy.top;
            expect(overlaps, "decorative photo must not cover the planning text").to.equal(false);
          });
      });
      scrollJourney(0.5);
      assertGalleryTextColors();
      cy.get(".qualityJourneyHeader").should(($heading) => {
        expect($heading[0].getBoundingClientRect().right).to.be.lessThan(0);
        expect(getComputedStyle($heading[0]).opacity).to.equal("1");
      });
      cy.get(".qualityJourneyStage").should(($stage) => {
        expect(Math.abs($stage[0].getBoundingClientRect().top)).to.be.lessThan(2);
      });
      cy.get(".qualityJourney").then(($section) => {
        const middleColor = $section[0].style.getPropertyValue("--journey-bg");
        const middleX = $section[0].style.getPropertyValue("--gallery-x");
        const middleFlow = $section[0].style.getPropertyValue("--flow-x");
        expect(parseFloat(middleX)).to.be.lessThan(-100);
        scrollJourney(1);
        assertGalleryTextColors();
        cy.get(".qualityJourneyStage").should("have.css", "background-color", "rgb(243, 234, 216)");
        cy.get(".qualityMoment").last().should(($card) => {
          const bounds = $card[0].getBoundingClientRect();
          expect(bounds.left).to.be.greaterThan(-2);
          expect(bounds.right).to.be.at.most(width + 2);
        });
        cy.get(".qualityMoment img").last().should(($image) => {
          expect(($image[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0);
          const bounds = $image[0].getBoundingClientRect();
          expect(bounds.width, "last photograph width").to.be.greaterThan(100);
          expect(bounds.height, "last photograph height").to.be.greaterThan(100);
          expect(bounds.left, "last photograph left edge").to.be.at.least(0);
          expect(bounds.right, "last photograph right edge").to.be.at.most(width);
          expect(bounds.top, "last photograph top edge").to.be.at.least(0);
          expect(bounds.bottom, "last photograph bottom edge").to.be.at.most(height);
        });
        cy.get(".qualityMoment img").last().then(($image) => ($image[0] as HTMLImageElement).decode());
        cy.get(".qualityJourneyStage").screenshot(`quality-beige-${width}`);
        scrollJourney(0.5);
        cy.get(".qualityJourney").should(($current) => {
          expect($current[0].style.getPropertyValue("--journey-bg")).to.equal(middleColor);
          expect($current[0].style.getPropertyValue("--flow-x")).to.equal(middleFlow);
          expect(parseFloat($current[0].style.getPropertyValue("--gallery-x"))).to.be.closeTo(parseFloat(middleX), 2);
        });
        cy.get(".qualityJourneyStage").screenshot(`quality-midpoint-${width}`);
      });
      cy.get(".qualityMoment img").each(($image) => {
        cy.wrap($image).should(($loaded) => {
          expect(($loaded[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0);
          expect(getComputedStyle($loaded[0]).objectFit).to.equal("contain");
          expect(getComputedStyle($loaded[0]).transform).to.equal("none");
        });
      });
      cy.document().then((doc) => {
        expect(doc.documentElement.scrollWidth).to.equal(doc.documentElement.clientWidth);
      });
      cy.get("#about").scrollIntoView().should("be.visible");
    });
  }

  it("supports keyboard traversal without wheel interception", () => {
    cy.visit("/");
    cy.document().trigger("keydown", { key: "Escape" });
    scrollJourney(0);
    cy.window().then((win) => { cy.spy(win, "scrollTo").as("keyboardScroll"); });
    cy.get(".qualityGalleryViewport").focus().trigger("keydown", { key: "End", eventConstructor: "KeyboardEvent" });
    cy.get("@keyboardScroll").should("have.been.called");
    cy.get(".qualityJourney").should(($section) => {
      expect(Number($section[0].style.getPropertyValue("--journey-progress"))).to.be.greaterThan(0.99);
    });
    cy.get(".qualityGalleryViewport").trigger("keydown", { key: "Home" });
    cy.get(".qualityJourney").should(($section) => {
      expect(Number($section[0].style.getPropertyValue("--journey-progress"))).to.be.lessThan(0.01);
    });
    cy.get(".qualityJourneyHeader").should("have.css", "opacity", "1");
    cy.get(".qualityGalleryViewport").trigger("keydown", { key: "ArrowRight" });
    cy.get('.qualityMoment[data-quality-index="0"]').should(($item) => {
      const bounds = $item[0].getBoundingClientRect();
      const stage = $item[0].closest(".qualityJourneyStage")!.getBoundingClientRect();
      expect(bounds.left + bounds.width / 2).to.be.closeTo(stage.left + stage.width / 2, 3);
    });
  });

  it("keeps the animated circles visible throughout the green-to-beige transition", () => {
    cy.viewport(1280, 720);
    cy.visit("/");
    cy.document().trigger("keydown", { key: "Escape" });
    const luminance = (rgb: number[]) => rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const channels = (color: string) => color.match(/[\d.]+/g)!.map(Number);
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      scrollJourney(progress);
      cy.get(".qualityJourney").should("have.attr", "data-flow-active", "true");
      cy.get(".qualityFlowOrbits").should("have.css", "animation-play-state", "running");
      cy.get(".qualityFlowLines").should(($svg) => {
        const svg = $svg[0];
        const bg = channels(getComputedStyle(svg.closest('.qualityJourneyStage')!).backgroundColor);
        const background = luminance(bg);
        const contrasts = ['.qualityFlowBase', '.qualityFlowOutline'].map((selector) => {
          const [r, g, b, alpha = 1] = channels(getComputedStyle(svg.querySelector(selector)!).stroke);
          const foreground = luminance([r, g, b].map((channel, index) => channel * alpha + bg[index] * (1 - alpha)));
          return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
        });
        expect(Math.max(...contrasts), `line/outline remains visible at ${progress}`).to.be.greaterThan(1.6);
      });
    }
    scrollJourney(0.5);
    cy.get(".qualityFlowOrbits").then(($orbits) => {
      const before = getComputedStyle($orbits[0]).transform;
      cy.wait(200);
      cy.get(".qualityFlowOrbits").should(($moving) => expect(getComputedStyle($moving[0]).transform).not.to.equal(before));
    });
    cy.screenshot("quality-visible-circles-midpoint", { capture: "viewport" });
  });

  it("provides a static readable gallery for reduced motion", () => {
    cy.viewport(390, 844);
    cy.visit("/", {
      onBeforeLoad(win) {
        const matchMedia = win.matchMedia.bind(win);
        cy.stub(win, "matchMedia").callsFake((query: string) => {
          const result = matchMedia(query);
          if (query === "(prefers-reduced-motion: reduce)") Object.defineProperty(result, "matches", { value: true });
          return result;
        });
      },
    });
    cy.get(".qualityJourney").should("not.have.attr", "data-scroll-enhanced");
    cy.get(".qualityJourney").should("have.attr", "data-flow-active", "false");
    cy.get(".glassStory").should("have.attr", "data-clean-state", "clean");
    cy.get(".glassStoryCleanLayer").should("have.css", "clip-path", "none");
    cy.get(".glassStoryFoamLayer, .glassStorySqueegee").should("have.css", "display", "none");
    cy.get(".qualityJourneyStage").should("have.css", "position", "relative");
    cy.get(".qualityJourneyHeader").should("have.css", "opacity", "1");
    cy.get(".qualityGalleryTrack").should("have.css", "display", "grid").and("have.css", "transform", "none");
    cy.get(".qualityMoment").each(($card) => {
      cy.wrap($card).scrollIntoView().should("be.visible");
    });
  });

  it("keeps all photographs readable in a short landscape viewport", () => {
    cy.viewport(844, 390);
    cy.visit("/");
    cy.document().trigger("keydown", { key: "Escape" });
    cy.get(".qualityJourney").should("not.have.attr", "data-scroll-enhanced");
    cy.get(".qualityMoment img").each(($image) => {
      cy.wrap($image).scrollIntoView().should("be.visible").and("have.css", "object-fit", "contain");
    });
  });
});
