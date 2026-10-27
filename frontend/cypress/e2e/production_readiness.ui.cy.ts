export {};

describe('Employee codes, real quote flow and concurrent calendar layout', () => {
  function home() {
    cy.intercept('POST', '**/api/v1/auth/refresh', { statusCode: 401 });
    cy.intercept('GET', '**/api/v1/feedback/published', { body: [] });
    cy.visit('/', { onBeforeLoad(win) {
      win.localStorage.setItem('glanzio-cookie-choice-v1', JSON.stringify({ version: 1, choice: 'necessary', savedAt: Date.now() }));
    } });
    cy.get('.enquiryForm').scrollIntoView();
    cy.get('.enquiryForm input[name="fullName"]').type('Test Customer');
    cy.get('.enquiryForm input[name="email"]').type('customer@example.test');
    cy.get('.enquiryForm input[name="location"]').type('Konstanz');
    cy.get('.enquiryForm textarea').type('Please send a quote.');
  }
  it('preserves the quote and idempotency key on failure, then reports confirmed SMTP acceptance', () => {
    let key: string;
    let attempts = 0;
    cy.intercept('POST', '**/api/v1/quotes', req => {
      expect(req.body.email).to.equal('customer@example.test');
      expect(req.body).not.to.have.property('to');
      if (!attempts++) {
        key = req.body.submissionKey as string;
        req.reply({ statusCode: 503, body: { message: 'SMTP temporarily unavailable' } });
      } else {
        expect(req.body.submissionKey).to.equal(key);
        req.reply({ body: { id: 'request-1', status: 'sent' } });
      }
    }).as('quote');
    home();
    cy.get('.enquiryForm button[type="submit"]').click(); cy.wait('@quote');
    cy.get('.enquiryForm [role="alert"]').should('contain.text', 'SMTP temporarily unavailable');
    cy.get('.enquiryForm input[name="fullName"]').should('have.value', 'Test Customer');
    cy.get('.enquiryForm button[type="submit"]').click(); cy.wait('@quote');
    cy.get('.enquiryForm [role="status"]').should('contain.text', 'E-Mail-Server');
    cy.get('.enquiryForm button[type="submit"]').should('be.disabled');
  });
  for (const width of [1280, 390]) {
    it(`shows every assignment and puts simultaneous work side by side at ${width}px`, () => {
      cy.viewport(width, 844);
      cy.mockAdminSession();
      cy.clock(Date.parse('2026-10-26T07:00:00Z'), ['Date']);
      const items = Array.from({ length: 5 }, (_, i) => ({
        id: `visit-${i}`, title: `Office ${i}`, status: 'SCHEDULED',
        startAt: i < 2 ? '2026-10-26T09:00:00Z' : `2026-10-26T${10 + i}:00:00Z`,
        endAt: i < 2 ? '2026-10-26T11:00:00Z' : `2026-10-26T${11 + i}:00:00Z`,
        site: { id: 'site', name: 'Office', client: { companyName: 'Test' } }, employees: [], recurringTemplate: null,
      }));
      cy.intercept('GET', '**/api/v1/calendar*', { body: { items, page: 1, pageSize: 100, pageCount: 1, total: 5 } }).as('calendar');
      cy.visit('/dashboard/assignments'); cy.wait('@calendar');
      cy.get('.calendarEvent').should('have.length', 5);
      cy.get('.calendarEventGroup[data-concurrent="true"]').should('have.length', 1).within(() => {
        cy.get('button').should('have.length', 2).then($buttons => {
          const a = $buttons[0].getBoundingClientRect(), b = $buttons[1].getBoundingClientRect();
          expect(Math.abs(a.top - b.top)).to.be.lessThan(2);
          expect(a.right).to.be.at.most(b.left);
        });
      });
      cy.contains('.calendarEvent', 'Office 4').click();
      cy.get('.assignmentDetailsDialog').should('contain.text', 'Office 4');
      cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.equal(doc.documentElement.clientWidth));
    });
  }
  it('accepts a six-character employee identifier without email formatting', () => {
    cy.intercept('POST', '**/api/v1/auth/refresh', { statusCode: 401 });
    cy.intercept('POST', '**/api/v1/auth/login', req => {
      expect(req.body).to.deep.equal({ identifier: 'AMT359', password: 'Secure-Password-2026' });
      req.reply({ statusCode: 401, body: { message: 'Test response' } });
    }).as('login');
    cy.visit('/login');
    cy.contains('label', 'Identifikationsnummer oder E-Mail-Adresse').should('be.visible');
    cy.get('#email').should('have.attr', 'type', 'text').type('AMT359');
    cy.get('#password').type('Secure-Password-2026');
    cy.get('.loginForm button[type="submit"]').click(); cy.wait('@login');
  });

  for (const width of [1280, 390]) {
    it(`shows the employee login ID prominently in bright green at ${width}px`, () => {
      cy.viewport(width, 844);
      cy.mockEmployeeSession();
      cy.intercept('GET', '**/api/v1/dashboard', { body: {
        role: 'EMPLOYEE', date: '2026-10-26', timeZone: 'Europe/Berlin',
        todayAssignments: [], nextAssignment: null, monthlyPlannedHours: { plannedHours: 0 },
      } }).as('employeeDashboard');
      cy.visit('/dashboard'); cy.wait('@employeeDashboard');
      cy.get('.employeeLoginIdCard.isProminent').should('be.visible').and('contain.text', 'AMT359');
      cy.get('.employeeLoginIdCard strong').should('have.css', 'background-color', 'rgb(163, 255, 91)')
        .and($code => expect(parseFloat(getComputedStyle($code[0]).fontSize)).to.be.at.least(34));
      cy.get('.dashboardUserDetails').should('contain.text', 'ID AMT359').and('not.contain.text', 'lena.worker@example.com');
      cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.equal(doc.documentElement.clientWidth));
      cy.screenshot(`employee-login-id-${width}`, { capture: 'viewport', overwrite: true });
    });
  }

  it('uses distinct bright green, yellow, blue and red assignment colors', () => {
    cy.mockAdminSession();
    cy.clock(Date.parse('2026-10-26T10:00:00Z'), ['Date']);
    const items = [
      { id: 'done', status: 'COMPLETED', startAt: '2026-10-26T07:00:00Z', endAt: '2026-10-26T08:00:00Z' },
      { id: 'working', status: 'SCHEDULED', startAt: '2026-10-26T09:00:00Z', endAt: '2026-10-26T11:00:00Z' },
      { id: 'pending', status: 'SCHEDULED', startAt: '2026-10-26T13:00:00Z', endAt: '2026-10-26T14:00:00Z' },
      { id: 'cancelled', status: 'CANCELLED', startAt: '2026-10-26T15:00:00Z', endAt: '2026-10-26T16:00:00Z' },
    ].map(item => ({ ...item, title: item.id, employees: [], site: { name: 'Office', client: { companyName: 'Test' } }, recurringTemplate: null }));
    cy.intercept('GET', '**/api/v1/calendar*', { body: { items, page: 1, pageCount: 1, pageSize: 100, total: 4 } }).as('calendarColors');
    cy.visit('/dashboard/assignments'); cy.wait('@calendarColors');
    for (const [status, rgb] of [['completed', '74, 222, 128'], ['pending', '253, 224, 71'], ['active', '96, 165, 250'], ['cancelled', '248, 113, 113']]) {
      cy.get(`.calendarEvent${status}`).should('have.css', 'background-color', `rgb(${rgb})`);
    }
  });
});
