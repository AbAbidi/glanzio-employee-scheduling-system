-- Store a route snapshot on each assignment so historical travel information
-- remains stable even when an address is edited later.
ALTER TABLE "WorkAssignment"
ADD COLUMN "departureAddress" VARCHAR(500),
ADD COLUMN "departureLatitude" DECIMAL(9,6),
ADD COLUMN "departureLongitude" DECIMAL(9,6),
ADD COLUMN "travelDistanceMeters" INTEGER,
ADD COLUMN "estimatedTravelMinutes" INTEGER,
ADD COLUMN "routeCalculatedAt" TIMESTAMPTZ(3);

-- Freeze the agreed pay rate for each employee on each assignment.
ALTER TABLE "AssignmentEmployee"
ADD COLUMN "agreedHourlyRate" DECIMAL(10,2),
ADD COLUMN "rateOverridden" BOOLEAN NOT NULL DEFAULT false;

-- Recurring templates keep the same route and rate agreement used to create
-- their generated assignments.
ALTER TABLE "RecurringTemplate"
ADD COLUMN "departureAddress" VARCHAR(500),
ADD COLUMN "departureLatitude" DECIMAL(9,6),
ADD COLUMN "departureLongitude" DECIMAL(9,6),
ADD COLUMN "travelDistanceMeters" INTEGER,
ADD COLUMN "estimatedTravelMinutes" INTEGER,
ADD COLUMN "routeCalculatedAt" TIMESTAMPTZ(3);

ALTER TABLE "RecurringTemplateEmployee"
ADD COLUMN "agreedHourlyRate" DECIMAL(10,2),
ADD COLUMN "rateOverridden" BOOLEAN NOT NULL DEFAULT false;
