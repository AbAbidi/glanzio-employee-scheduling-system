-- Extend user lifecycle for administrator-issued employee invitations.
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'INVITED' BEFORE 'ACTIVE';

-- Invited employees do not receive a password chosen by the administrator.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Store only a SHA-256 hash of each one-time invitation token.
CREATE TABLE "AccountInvitation" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountInvitation_tokenHash_key" ON "AccountInvitation"("tokenHash");
CREATE INDEX "AccountInvitation_userId_createdAt_idx" ON "AccountInvitation"("userId", "createdAt");
CREATE INDEX "AccountInvitation_expiresAt_idx" ON "AccountInvitation"("expiresAt");

ALTER TABLE "AccountInvitation"
ADD CONSTRAINT "AccountInvitation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountInvitation"
ADD CONSTRAINT "AccountInvitation_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
