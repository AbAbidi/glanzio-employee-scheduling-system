-- CreateTable
CREATE TABLE "StudentStatement" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(12) NOT NULL DEFAULT 'DRAFT',
    "sourceHash" VARCHAR(64) NOT NULL,
    "policyVersion" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "pdfBytes" BYTEA,
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StudentStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCreditMovement" (
    "id" UUID NOT NULL,
    "statementId" UUID NOT NULL,
    "kind" VARCHAR(12) NOT NULL,
    "sourceKey" VARCHAR(180) NOT NULL,
    "originMonth" VARCHAR(7) NOT NULL,
    "sourceAssignmentId" UUID NOT NULL,
    "minutes" INTEGER NOT NULL,
    "hourlyRate" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "StudentCreditMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentStatement_employeeId_status_month_idx" ON "StudentStatement"("employeeId", "status", "month");

-- CreateIndex
CREATE UNIQUE INDEX "StudentStatement_employeeId_month_revision_key" ON "StudentStatement"("employeeId", "month", "revision");

-- CreateIndex
CREATE INDEX "StudentCreditMovement_statementId_idx" ON "StudentCreditMovement"("statementId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCreditMovement_statementId_sourceKey_kind_key" ON "StudentCreditMovement"("statementId", "sourceKey", "kind");

-- AddForeignKey
ALTER TABLE "StudentStatement" ADD CONSTRAINT "StudentStatement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCreditMovement" ADD CONSTRAINT "StudentCreditMovement_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "StudentStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentStatement" ADD CONSTRAINT "StudentStatement_status_check" CHECK ("status" IN ('DRAFT', 'CLOSED'));
ALTER TABLE "StudentCreditMovement" ADD CONSTRAINT "StudentCreditMovement_minutes_check" CHECK ("minutes" > 0 AND "hourlyRate" >= 0 AND "kind" IN ('EARNED', 'ALLOCATED'));
CREATE UNIQUE INDEX "StudentStatement_one_closed_month" ON "StudentStatement" ("employeeId", "month") WHERE "status" = 'CLOSED';
