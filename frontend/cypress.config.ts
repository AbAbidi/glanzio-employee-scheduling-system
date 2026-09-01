import { defineConfig } from "cypress";

export default defineConfig({    // export the configuration so cypress can read it 
  allowCypressEnv: false,             // disabel the depricated cypress.env API 
  viewportWidth: 1440,    // the browser dimentions to use when running e2e test
  viewportHeight: 900,

  video: true, // enaable video recording for e2e tests

  e2e: {
  baseUrl: "http://localhost:5173",
  specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
  supportFile: "cypress/support/e2e.ts",

  setupNodeEvents(on) {
    on("task", {
      getE2EAdminCredentials() {
        const email = process.env.E2E_ADMIN_EMAIL?.trim();
        const password = process.env.E2E_ADMIN_PASSWORD;

        if (!email || !password) {
          throw new Error(
            "E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be defined.",
          );
        }

        return { email, password };  // task running under node.js , reads the real credential from terminal maghir matposti 3al git
      },
    });
  },
},
});
