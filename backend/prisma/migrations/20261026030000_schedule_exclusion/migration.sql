-- Enforce the invariant in PostgreSQL too: it must hold for every create,
-- employee replacement, time/status edit and recurring-series write.
-- Existing conflicting data makes this migration fail; it is NEVER deleted.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "AssignmentEmployee" ADD COLUMN "occupiedDuring" tstzrange;
UPDATE "AssignmentEmployee" AS link SET "occupiedDuring" =
  CASE WHEN visit."status" IN ('SCHEDULED', 'COMPLETED')
    THEN tstzrange(visit."startAt", visit."endAt", '[)') ELSE NULL END
  FROM "WorkAssignment" AS visit WHERE visit."id" = link."assignmentId";
ALTER TABLE "AssignmentEmployee" ADD CONSTRAINT schedule_employee_no_overlap
  EXCLUDE USING gist ("employeeId" WITH =, "occupiedDuring" WITH &&)
  DEFERRABLE INITIALLY IMMEDIATE;

CREATE FUNCTION sync_assignment_employee_occupancy() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE visit "WorkAssignment"%ROWTYPE;
BEGIN
  -- SHARE prevents an overlapping parent time/status change from missing a
  -- concurrently inserted link. The lock ends with the surrounding transaction.
  SELECT * INTO STRICT visit FROM "WorkAssignment"
    WHERE "id" = NEW."assignmentId" FOR SHARE;
  NEW."occupiedDuring" := CASE WHEN visit."status" IN ('SCHEDULED', 'COMPLETED')
    THEN tstzrange(visit."startAt", visit."endAt", '[)') ELSE NULL END;
  RETURN NEW;
END;
$$;
CREATE TRIGGER assignment_employee_occupancy
  BEFORE INSERT OR UPDATE ON "AssignmentEmployee"
  FOR EACH ROW EXECUTE FUNCTION sync_assignment_employee_occupancy();

CREATE FUNCTION sync_assignment_occupancies() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "AssignmentEmployee" SET "occupiedDuring" =
    CASE WHEN NEW."status" IN ('SCHEDULED', 'COMPLETED')
      THEN tstzrange(NEW."startAt", NEW."endAt", '[)') ELSE NULL END
    WHERE "assignmentId" = NEW."id";
  RETURN NEW;
END;
$$;
CREATE TRIGGER assignment_occupancies
  AFTER UPDATE OF "startAt", "endAt", "status" ON "WorkAssignment"
  FOR EACH ROW EXECUTE FUNCTION sync_assignment_occupancies();
