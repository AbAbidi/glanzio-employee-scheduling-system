CREATE TABLE "QuoteRequest" (
  "id" UUID NOT NULL,
  "submissionKey" UUID NOT NULL,
  "inputHash" VARCHAR(64) NOT NULL,
  "fullName" VARCHAR(120) NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "service" VARCHAR(100) NOT NULL,
  "location" VARCHAR(200) NOT NULL,
  "message" VARCHAR(4000) NOT NULL,
  "status" VARCHAR(12) NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMPTZ(3),
  "acceptedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuoteRequest_status_check" CHECK ("status" IN ('PENDING','SENDING','SENT','FAILED','UNKNOWN'))
);
CREATE UNIQUE INDEX "QuoteRequest_submissionKey_key" ON "QuoteRequest"("submissionKey");
CREATE INDEX "QuoteRequest_status_createdAt_idx" ON "QuoteRequest"("status", "createdAt");
