-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ASSIGNMENT_CREATED', 'ASSIGNMENT_UPDATED', 'ASSIGNMENT_CANCELLED', 'STUDENT_HOUR_WARNING');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lockedUntil" TIMESTAMPTZ(3),
ADD COLUMN "passwordChangedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Employee"
ADD COLUMN "hourlyRate" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "Client" (
    "id" UUID NOT NULL,
    "companyName" VARCHAR(200) NOT NULL,
    "contactName" VARCHAR(200),
    "email" VARCHAR(320),
    "phone" VARCHAR(30),
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleaningSite" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "addressLine1" VARCHAR(250) NOT NULL,
    "addressLine2" VARCHAR(250),
    "postalCode" VARCHAR(30),
    "city" VARCHAR(120) NOT NULL,
    "countryCode" CHAR(2) NOT NULL DEFAULT 'FR',
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "estimatedDurationMinutes" INTEGER,
    "requiredEquipment" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CleaningSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringTemplate" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "daysOfWeek" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "firstStartAt" TIMESTAMPTZ(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "untilAt" TIMESTAMPTZ(3),
    "occurrenceCount" INTEGER,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RecurringTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkAssignment" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "recurringTemplateId" UUID,
    "title" VARCHAR(200) NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "cancellationReason" TEXT,
    "createdById" UUID NOT NULL,
    "updatedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentEmployee" (
    "assignmentId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentEmployee_pkey" PRIMARY KEY ("assignmentId","employeeId")
);

-- CreateTable
CREATE TABLE "RecurringTemplateEmployee" (
    "recurringTemplateId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,

    CONSTRAINT "RecurringTemplateEmployee_pkey" PRIMARY KEY ("recurringTemplateId","employeeId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "assignmentId" UUID,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(100) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_lockedUntil_idx" ON "User"("lockedUntil");

-- CreateIndex
CREATE INDEX "Employee_isStudent_active_idx" ON "Employee"("isStudent", "active");

-- CreateIndex
CREATE INDEX "Client_active_idx" ON "Client"("active");

-- CreateIndex
CREATE INDEX "Client_companyName_idx" ON "Client"("companyName");

-- CreateIndex
CREATE INDEX "CleaningSite_clientId_active_idx" ON "CleaningSite"("clientId", "active");

-- CreateIndex
CREATE INDEX "CleaningSite_city_idx" ON "CleaningSite"("city");

-- CreateIndex
CREATE INDEX "CleaningSite_name_idx" ON "CleaningSite"("name");

-- CreateIndex
CREATE INDEX "RecurringTemplate_siteId_active_idx" ON "RecurringTemplate"("siteId", "active");

-- CreateIndex
CREATE INDEX "RecurringTemplate_active_firstStartAt_idx" ON "RecurringTemplate"("active", "firstStartAt");

-- CreateIndex
CREATE INDEX "WorkAssignment_siteId_startAt_idx" ON "WorkAssignment"("siteId", "startAt");

-- CreateIndex
CREATE INDEX "WorkAssignment_status_startAt_idx" ON "WorkAssignment"("status", "startAt");

-- CreateIndex
CREATE INDEX "WorkAssignment_startAt_endAt_idx" ON "WorkAssignment"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "WorkAssignment_recurringTemplateId_idx" ON "WorkAssignment"("recurringTemplateId");

-- CreateIndex
CREATE INDEX "AssignmentEmployee_employeeId_idx" ON "AssignmentEmployee"("employeeId");

-- CreateIndex
CREATE INDEX "RecurringTemplateEmployee_employeeId_idx" ON "RecurringTemplateEmployee"("employeeId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_assignmentId_idx" ON "Notification"("assignmentId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "CleaningSite" ADD CONSTRAINT "CleaningSite_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTemplate" ADD CONSTRAINT "RecurringTemplate_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "CleaningSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTemplate" ADD CONSTRAINT "RecurringTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "CleaningSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_recurringTemplateId_fkey" FOREIGN KEY ("recurringTemplateId") REFERENCES "RecurringTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentEmployee" ADD CONSTRAINT "AssignmentEmployee_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "WorkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentEmployee" ADD CONSTRAINT "AssignmentEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTemplateEmployee" ADD CONSTRAINT "RecurringTemplateEmployee_recurringTemplateId_fkey" FOREIGN KEY ("recurringTemplateId") REFERENCES "RecurringTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTemplateEmployee" ADD CONSTRAINT "RecurringTemplateEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "WorkAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
