describe('Homepage server/client hydration', () => {
  it('keeps the glass description identical on initial load and refresh', () => {
    cy.intercept('POST', '**/api/v1/auth/refresh', { statusCode: 401, body: {} });
    cy.intercept('GET', '**/api/v1/feedback/published', { body: [] });

    const hydrationErrors: string[] = [];
    cy.on('window:before:load', (win) => {
      const originalError = win.console.error.bind(win.console);
      win.console.error = (...args: unknown[]) => {
        const message = args.map(String).join(' ');
        if (/hydration|hydrating|server rendered|didn't match/i.test(message)) {
          hydrationErrors.push(message);
        }
        originalError(...args);
      };
      win.localStorage.setItem('glanzio-cookie-choice-v1', JSON.stringify({
        version: 1, choice: 'necessary', savedAt: Date.now(),
      }));
    });

    cy.request('/').then(({ body }) => {
      const serverDocument = new DOMParser().parseFromString(body, 'text/html');
      const description = serverDocument.querySelector('.glassStoryDescription')?.textContent;
      expect(description, 'server-rendered description').to.contain('eine breite diagonale Bahn');

      cy.visit('/');
      cy.get('.glassStory').should('have.attr', 'data-glass-ready', 'true');
      cy.get('.glassStoryDescription').should('have.text', description);
      cy.then(() => expect(hydrationErrors, 'hydration errors after initial load').to.deep.equal([]));

      cy.reload();
      cy.get('.glassStory').should('have.attr', 'data-glass-ready', 'true');
      cy.get('.glassStoryDescription').should('have.text', description);
      cy.then(() => expect(hydrationErrors, 'hydration errors after refresh').to.deep.equal([]));
    });
  });
});
