import { diagonalGlassStroke } from '../../app/lib/glass-cleaning';

function scrubGlass(progress: number) {
  cy.get('.glassStory').should('have.attr', 'data-glass-ready', 'true').then(($story) => {
    cy.window().then((win) => {
      const story = $story[0];
      win.scrollTo({ top: win.scrollY + story.getBoundingClientRect().top + (story.offsetHeight - win.innerHeight) * progress, behavior: 'instant' });
    });
  });
  cy.get('.glassStory').should(($story) => expect(Number($story[0].style.getPropertyValue('--clean-progress'))).to.be.closeTo(progress, .003));
}

describe('Foaming window and scroll-driven squeegee', () => {
  for (const [width, height] of [[1280, 720], [390, 844]]) {
    it(`drips cleaner only on the soapy side and wipes in register at ${width}px`, () => {
      cy.viewport(width, height);
      cy.intercept('POST', '**/api/v1/auth/refresh', { statusCode: 401, body: {} });
      cy.intercept('GET', '**/api/v1/feedback/published', { body: [] });
      cy.visit('/', { onBeforeLoad(win) {
        win.localStorage.setItem('glanzio-cookie-choice-v1', JSON.stringify({ version: 1, choice: 'necessary', savedAt: Date.now() }));
      } });
      cy.document().trigger('keydown', { key: 'Escape' });
      cy.get('.qualityJourney').should('have.attr', 'data-scroll-enhanced', 'true');
      cy.document().then((doc) => doc.fonts.ready);
      scrubGlass(0);
      cy.get('.glassStoryBackground, .glassStoryFoamBackground').each(($image) => cy.wrap($image).should(($loaded) => expect(($loaded[0] as HTMLImageElement).naturalWidth).to.equal(1672)));
      cy.get('.glassStoryFoamBackground').should('have.attr', 'src', '/glass-foam-windowsill-v4.webp');
      cy.get('.glassStoryFoamMaterial, .glassStoryFluid, img[src="/glass-soap-alpha-v7.webp"]').should('not.exist');
      cy.get('.glassStory').should('have.attr', 'data-clean-state', 'soapy').and('have.attr', 'data-foam-active', 'true');
      cy.get('.glassStorySqueegee').should('have.attr', 'data-side', 'exterior').and('have.css', 'opacity', '1');
      cy.get('.glassStorySqueegee img').should(($image) => {
        expect($image.attr('src')).to.equal('/window-squeegee-foam-v6.webp');
        expect(getComputedStyle($image[0]).transform, 'handle recedes away from the glass in perspective').to.contain('matrix3d');
        expect(getComputedStyle($image[0]).clipPath, 'exterior handle is no longer cropped away').to.equal('none');
        const mask = getComputedStyle($image[0]).maskImage;
        expect(mask, 'handle is partially veiled by the existing foam').to.contain('0.65');
        expect(mask).to.contain('0.48');
      });
      cy.get('.glassStoryRunoffStream, .glassStoryBladeFoam').should('not.exist');
      cy.get('.glassStoryPane').should(($pane) => {
        const tool = Number(getComputedStyle($pane.find('.glassStorySqueegee')[0]).zIndex);
        const soap = Number(getComputedStyle($pane.find('.glassStoryFoamLayer')[0]).zIndex);
        expect(tool, 'blade and partially veiled exterior handle remain visible').to.be.greaterThan(soap);
      });
      cy.get('.glassStoryDirtyBackground, .glassStorySweep, .glassStoryFoamBead, .glassStorySqueegee svg').should('not.exist');
      cy.get('.glassStoryDrip').should('have.length', 9).first().should('have.css', 'animation-play-state', 'running').then(($drop) => {
        const before = getComputedStyle($drop[0]).transform;
        cy.wait(200);
        cy.get('.glassStoryDrip').first().should(($moving) => expect(getComputedStyle($moving[0]).transform).not.to.equal(before));
      });
      cy.screenshot(`window-soapy-${width}`, { capture: 'viewport' });
      scrubGlass(.02);
      cy.get('.glassStorySqueegee').should(($tool) => {
        const paneHeight = parseFloat($tool[0].closest<HTMLElement>('.glassStory')!.style.getPropertyValue('--pane-height'));
        const paneWidth = parseFloat($tool[0].closest<HTMLElement>('.glassStory')!.style.getPropertyValue('--pane-width'));
        expect(parseFloat(getComputedStyle($tool[0]).top)).to.be.greaterThan(diagonalGlassStroke(paneWidth, paneHeight, 0).y);
      });
      for (const progress of [.45, .2]) {
        scrubGlass(progress);
        cy.get('.glassStoryPane').should(($pane) => {
          const section = $pane[0].closest<HTMLElement>('.glassStory')!;
          const paneWidth = parseFloat(section.style.getPropertyValue('--pane-width'));
          const paneHeight = parseFloat(section.style.getPropertyValue('--pane-height'));
          const renderedProgress = Number(section.style.getPropertyValue('--clean-progress'));
          const expected = diagonalGlassStroke(paneWidth, paneHeight, renderedProgress);
          const tool = getComputedStyle($pane.find('.glassStorySqueegee')[0]);
          expect(parseFloat(tool.left)).to.be.closeTo(expected.x, .3);
          expect(parseFloat(tool.top)).to.be.closeTo(expected.y, .3);
          expect(parseFloat(tool.width)).to.be.closeTo(expected.spriteSize, .3);
          expect(parseFloat(tool.height)).to.be.closeTo(expected.spriteSize, .3);
          const values = tool.transform.match(/[-\d.]+/g)!.map(Number);
          expect(Math.atan2(values[1], values[0]) * 180 / Math.PI).to.be.closeTo(-24, .1);
          const clip = getComputedStyle($pane.find('.glassStoryFoamLayer')[0]).clipPath;
          expect(clip).to.contain('evenodd');
          const corners = clip.match(/[-\d.]+/g)!.map(Number).slice(-10);
          [...expected.corners, expected.corners[0]].flatMap((point) => [point.x, point.y]).forEach((value, index) => expect(corners[index]).to.be.closeTo(value, .3));
        });
        cy.get('.glassStorySqueegee img').should(($image) => expect(($image[0] as HTMLImageElement).naturalWidth).to.equal(1254));
        cy.get('.glassStorySqueegee').should('have.css', 'opacity', '1');
        if (progress === .45) cy.screenshot(`window-squeegee-${width}`, { capture: 'viewport' });
      }
      scrubGlass(1);
      cy.get('.glassStory').should('have.attr', 'data-clean-state', 'partial').and('have.attr', 'data-foam-active', 'true');
      cy.get('.glassStorySqueegee').should('have.css', 'opacity', '0');
      cy.get('.glassStoryDrip').first().should('have.css', 'animation-play-state', 'running');
      cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.equal(doc.documentElement.clientWidth));
      cy.screenshot(`window-cleared-${width}`, { capture: 'viewport' });
    });
  }

  it('keeps the scroll-driven wipe usable without WebGL', () => {
    cy.intercept('GET', '**/api/v1/feedback/published', { body: [] });
    cy.visit('/', { onBeforeLoad(win) {
      const getContext = win.HTMLCanvasElement.prototype.getContext;
      cy.stub(win.HTMLCanvasElement.prototype, 'getContext').callsFake(function (this: HTMLCanvasElement, ...args: unknown[]) {
        if (args[0] === 'webgl') return null;
        return Reflect.apply(getContext, this, args);
      });
      win.localStorage.setItem('glanzio-cookie-choice-v1', JSON.stringify({ version: 1, choice: 'necessary', savedAt: Date.now() }));
    } });
    cy.document().trigger('keydown', { key: 'Escape' });
    cy.get('.qualityJourney').should('have.attr', 'data-scroll-enhanced', 'true');
    cy.document().then((doc) => doc.fonts.ready);
    scrubGlass(.5);
    cy.get('.glassStoryFluid').should('not.exist');
    cy.get('.glassStory').should('have.attr', 'data-clean-state', 'transition');
  });
});

