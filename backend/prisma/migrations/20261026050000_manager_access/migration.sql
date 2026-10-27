-- ADMIN remains the existing owner role. No account is promoted automatically.
ALTER TYPE "UserRole" ADD VALUE 'MANAGER';
ALTER TABLE "User" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;
