export {};

describe('Owner / manager workspace permissions', () => {
  const employee = { id: 'worker-ui', loginCode: 'AMT359', firstName: 'Test', lastName: 'Worker', active: true, isStudent: false, phone: null, hourlyRate: '15', user: { email: null, role: 'EMPLOYEE', status: 'ACTIVE', lastLoginAt: null } };
  function managerSession() {
    cy.intercept('POST', '**/api/v1/auth/refresh', { body: { accessToken: 'isolated-ui-manager', accessTokenExpiresIn: '15m', refreshTokenExpiresAt: '2099-01-01T00:00:00Z', user: { id: 'manager-ui', email: null, role: 'MANAGER', status: 'ACTIVE', employee: { id: 'manager-profile', loginCode: 'MGR123', firstName: 'Manager', lastName: 'Test', active: true, isStudent: false } } } });
    cy.intercept('GET', '**/api/v1/employees*', { body: { items: [employee], page: 1, pageCount: 1, total: 1, pageSize: 100 } }).as('employees');
  }
  for (const width of [1440, 960, 390]) {
    it(`manager has ordinary management and clear title, but no owner controls at ${width}px`, () => {
      cy.viewport(width, 900); managerSession(); cy.visit('/dashboard/employees'); cy.wait('@employees');
      cy.contains('Admin / Gestionnaire').should('exist');
      cy.get('.dashboardUnifiedIdentity').should('contain.text', 'Admin / Gestionnaire');
      cy.get(width <= 1120 ? '.managerAccessBadge' : '.dashboardUserDetails strong').should('be.visible').and('contain.text', 'Admin / Gestionnaire');
      cy.get('.dashboardWorkspaceNav a[href="/dashboard/clients"]').should('exist');
      cy.get('.dashboardWorkspaceNav a[href="/dashboard/archive"]').should('not.exist');
      cy.get('.dashboardWorkspaceNav a[href="/dashboard/feedback"]').should('not.exist');
      cy.get('.dashboardWorkspaceNav a[href="/dashboard/profile"]').should('exist');
      cy.contains('button', 'View analysis').should('be.visible');
      cy.contains('button', 'Export internal statement').should('be.visible');
      cy.get('.employeeDeleteButton, .employeeAccessControl, select[name="role"]').should('not.exist');
      cy.contains('button', 'Edit profile').click();
      cy.get('.employeeDialog').should('be.visible');
      cy.get('input[name="newPassword"]').should('not.exist');
      cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.equal(doc.documentElement.clientWidth));
    });
  }
  for (const page of ['archive', 'feedback']) {
    it(`manager cannot open owner-only ${page} by typing its URL`, () => {
      managerSession(); cy.visit(`/dashboard/${page}`);
      cy.contains('Administrator access required').should('be.visible');
    });
  }
  it('owner can invite a manager, without student status, and change existing access explicitly', () => {
    cy.mockAdminSession();
    cy.intercept('GET', '**/api/v1/employees*', { body: { items: [employee], page: 1, pageCount: 1, total: 1, pageSize: 100 } }).as('employees');
    cy.intercept('PATCH', '**/api/v1/employees/worker-ui/access-role', req => {
      expect(req.body).to.deep.equal({ role: 'MANAGER' });
      req.reply({ body: { ...employee, user: { ...employee.user, role: 'MANAGER' } } });
    }).as('promote');
    cy.visit('/dashboard/employees'); cy.wait('@employees');
    cy.get('select[name="role"]').select('MANAGER'); cy.get('input[name="isStudent"]').should('be.disabled');
    cy.get('.employeeAccessControl > button').click(); cy.get('.employeeAccessControl').contains('button', 'Bestätigen').click(); cy.wait('@promote');
    cy.get('.employeeAccessControl').should('contain.text', 'Gestionnaire → Mitarbeiter');
    cy.get('.dashboardWorkspaceNav a[href="/dashboard/archive"]').should('exist');
    cy.get('.dashboardWorkspaceNav a[href="/dashboard/feedback"]').should('exist');
  });
});
