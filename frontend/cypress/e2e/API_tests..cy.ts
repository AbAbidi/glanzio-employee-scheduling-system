type HealthResponse = {
  status: "ok";
  service: "esms-backend";
};

type ReadinessResponse = {
  status: "ready";
  service: "esms-backend";
  database: "reachable";
};

type ApiErrorResponse = {
  statusCode: number;
  message: string | string[];
  error?: string;
};

const API_BASE_URL = "http://localhost:3000/api/v1";

describe("Backend API foundation", () => {
  it("GET /health reports that the backend is running", () => {
    cy.request<HealthResponse>({
      method: "GET",
      url: `${API_BASE_URL}/health`,
    }).then((response) => {
      expect(response.status).to.equal(200);

      expect(response.headers["content-type"]).to.include(
        "application/json",
      );

      expect(response.body).to.deep.equal({
        status: "ok",
        service: "esms-backend",
      });
    });
  });

  it("GET /health/ready reports that PostgreSQL is reachable", () => {
    cy.request<ReadinessResponse>({
      method: "GET",
      url: `${API_BASE_URL}/health/ready`,
    }).then((response) => {
      expect(response.status).to.equal(200);

      expect(response.body).to.deep.equal({
        status: "ready",
        service: "esms-backend",
        database: "reachable",
      });
    });
  });

  it("GET /auth/me rejects a request without an access token", () => {
    cy.request<ApiErrorResponse>({
      method: "GET",
      url: `${API_BASE_URL}/auth/me`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.equal(401);
      expect(response.body.statusCode).to.equal(401);
      expect(response.body).to.have.property("message");
    });
  });

  it("returns 404 for an endpoint that does not exist", () => {
    cy.request<ApiErrorResponse>({
      method: "GET",
      url: `${API_BASE_URL}/endpoint-that-does-not-exist`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.equal(404);
      expect(response.body.statusCode).to.equal(404);
      expect(response.body).to.have.property("message");
    });
  });
});
