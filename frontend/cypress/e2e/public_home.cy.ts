describe("Clarity Clean public homepage", () => {
  beforeEach(() => {
    cy.visit("/"); // visist the home page  the base url already configure in cypress.config.ts file
    cy.contains("a", "Anmelden").should("be.visible");

  });

   

  it("displays the German homepage by default", () => {
    cy.contains("Sauberere Räume.").should("be.visible"); // search hthe page containging the text "Sauberere Räume." and assert that it is visible if its hidden the test fails 
    cy.contains("Hellere Tage.").should("be.visible");
  });

  it("switches the website from German to English", () => {
    cy.get(".languageSwitch")//Finds the language-switch container using its CSS class.
      .contains("button", "EN")
      .should("be.visible")
      .and("not.have.class", "isActive")
      .click()
      .should("have.class", "isActive");

      
      // the best thing in cypress  that hes waiting the elemen,t to appear no need to cy.await(5000) because fixed waiting times make tests slower and unreliable.not like selenium 

    cy.contains("Cleaner spaces.").should("be.visible");
    cy.contains("Brighter days.").should("be.visible");
  });

  it("remembers the selected language after reloading", () => {
  cy.get(".languageSwitch")
    .contains("button", "EN")
    .click();

  cy.window().then((window) => {
    expect(
      window.localStorage.getItem("clarity-public-language"),
    ).to.equal("en");
  });

  cy.reload();

  cy.contains("Cleaner spaces.").should("be.visible");

  cy.document()
    .its("documentElement.lang")
    .should("equal", "en");
});

  it("navigates to the standards section and returns home", () => { // create a test case with it 
  cy.get(".publicNav") //search 
    .contains("a", "Standards")
    .should("be.visible")
    .click();

    cy.location("hash").should("equal", "#standards"); //reads the browser’s current URL.
    //"hash" asks only for the part beginning with #


    cy.get("#standards").within(() => {
    cy.contains(
      "Professionelle Pflege ist mehr als ein sauberes Ergebnis.",
    ).should("be.visible");
    //.within() this tells cypress to look and search inside the standars section ,This prevents Cypress from accidentally finding the same text somewhere else on the page
  });

  cy.get(".publicNav")
    .contains("a", "Startseite")
    .click();

  cy.location("hash").should("equal", "#top");

  cy.get("#top").should("be.visible");
    });
});