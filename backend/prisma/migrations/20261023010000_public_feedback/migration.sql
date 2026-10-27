CREATE TYPE "FeedbackStatus" AS ENUM ('PENDING', 'PRIVATE', 'PUBLISHED', 'REJECTED');

CREATE TABLE "Feedback" (
  "id" UUID NOT NULL,
  "submissionKey" UUID NOT NULL,
  "displayName" VARCHAR(80) NOT NULL,
  "message" VARCHAR(2000) NOT NULL,
  "rating" INTEGER,
  "allowPublic" BOOLEAN NOT NULL DEFAULT false,
  "status" "FeedbackStatus" NOT NULL DEFAULT 'PENDING',
  "publishedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Feedback_rating_range" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5),
  CONSTRAINT "Feedback_public_consent" CHECK ("status" <> 'PUBLISHED' OR "allowPublic" = true)
);
CREATE UNIQUE INDEX "Feedback_submissionKey_key" ON "Feedback"("submissionKey");
CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt");
