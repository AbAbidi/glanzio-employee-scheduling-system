function expectContinuousDrift() {
  cy.get(".serviceCarouselViewport").then(($viewport) => {
    const viewport = $viewport[0];
    const original = viewport.querySelector<HTMLElement>('.serviceCard:not([data-service-copy])')!;
    const copy = viewport.querySelector<HTMLElement>('[data-service-copy="true"]')!;
    const cycle = original.offsetLeft - copy.offsetLeft;
    const before = viewport.scrollLeft;
    // Observe the timed autoplay, not just an interaction's immediate movement.
    cy.wait(600);
    cy.get(".serviceCarouselViewport").should(($moving) => {
      const drift = (before - $moving[0].scrollLeft + cycle) % cycle;
      expect(drift, "slow left-to-right card motion resumes").to.be.greaterThan(2);
      expect(drift, "no wraparound jump").to.be.lessThan(cycle / 4);
    });
  });
}

describe("Service-card motion after mouse interaction", () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.intercept("POST", "**/api/v1/auth/refresh", { statusCode: 401, body: {} });
    cy.intercept("GET", "**/api/v1/feedback/published", { body: [] });
    cy.visit("/", { onBeforeLoad(win) {
      win.localStorage.setItem("glanzio-cookie-choice-v1", JSON.stringify({ version: 1, choice: "necessary", savedAt: Date.now() }));
    } });
    cy.document().trigger("keydown", { key: "Escape" });
    cy.get(".serviceCarouselViewport").should("have.attr", "data-motion-ready", "true").scrollIntoView();
  });

  it("does not stop autoplay after mouse focus or lift the card's hit target", () => {
    cy.get(".serviceCarouselViewport").click(180, 170);
    cy.get(".serviceDialog").should("not.exist");
    cy.get(".serviceCarouselViewport").should("not.have.class", "isInteracting");
    cy.get(".serviceCard.hasMedia").each(($card) => expect(getComputedStyle($card[0]).transform).to.equal("none"));
    expectContinuousDrift();
  });

  it("returns to slow continuous movement after scrolling a card", () => {
    cy.get(".serviceCarouselViewport").then(($viewport) => {
      const before = $viewport[0].scrollLeft;
      cy.get(".serviceCard.hasMedia").first().trigger("wheel", { deltaY: 480, eventConstructor: "WheelEvent", force: true });
      cy.get(".serviceCarouselViewport").should(($moved) => expect(Math.abs($moved[0].scrollLeft - before)).to.be.greaterThan(100));
    });
    cy.wait(1700);
    cy.get(".serviceCarouselViewport").should("not.have.class", "isInteracting");
    expectContinuousDrift();
  });

  it("returns to continuous movement after releasing a dragged card", () => {
    cy.get(".serviceCard.hasMedia").first().trigger("pointerdown", { pointerId: 7, pointerType: "mouse", button: 0, clientX: 300, eventConstructor: "PointerEvent", force: true });
    cy.get(".serviceCarouselViewport").should("have.class", "isDragging")
      .trigger("pointermove", { pointerId: 7, pointerType: "mouse", clientX: 160, eventConstructor: "PointerEvent" })
      .trigger("pointerup", { pointerId: 7, pointerType: "mouse", clientX: 160, eventConstructor: "PointerEvent" });
    cy.get(".serviceCarouselViewport").should("not.have.class", "isDragging");
    cy.wait(1700);
    expectContinuousDrift();
  });

  it("recovers from a cancelled touch gesture", () => {
    cy.get(".serviceCarouselViewport").trigger("touchstart", { eventConstructor: "Event" })
      .should("have.class", "isInteracting")
      .trigger("touchcancel", { eventConstructor: "Event" });
    cy.get(".serviceCarouselViewport").should("not.have.class", "isInteracting");
    expectContinuousDrift();
  });

  it("still pauses moving targets for keyboard navigation and resumes after focus leaves", () => {
    cy.get(".serviceCarouselViewport").trigger("keydown", { key: "Tab", eventConstructor: "KeyboardEvent" }).focus()
      .should("have.class", "isInteracting");
    cy.get(".serviceCarouselViewport").then(($viewport) => {
      const before = $viewport[0].scrollLeft;
      cy.wait(300);
      cy.get(".serviceCarouselViewport").should(($paused) => expect($paused[0].scrollLeft).to.equal(before));
    });
    cy.get(".serviceCarouselViewport").blur().should("not.have.class", "isInteracting");
    expectContinuousDrift();
  });
});
