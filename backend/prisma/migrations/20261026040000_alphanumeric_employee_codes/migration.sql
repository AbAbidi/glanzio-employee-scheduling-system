-- Requested ID format change only; UUIDs, passwords and historical links remain.
-- Code space: AAA001 ... ZZZ999. The sequence is never cycled/reused.
CREATE FUNCTION employee_code_from_number(value bigint) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT chr((65 + (value / 676000) % 26)::integer)
      || chr((65 + (value / 26000) % 26)::integer)
      || chr((65 + (value / 1000) % 26)::integer)
      || lpad((value % 1000)::text, 3, '0');
$$;
ALTER SEQUENCE employee_login_code_seq MAXVALUE 17575999;
CREATE OR REPLACE FUNCTION next_employee_login_code() RETURNS text
LANGUAGE sql VOLATILE AS $$
  SELECT employee_code_from_number(nextval('employee_login_code_seq'));
$$;
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_loginCode_format";
UPDATE "Employee" SET "loginCode" = employee_code_from_number("loginCode"::bigint)
  WHERE "loginCode" ~ '^[0-9]{6}$';
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_loginCode_format"
  CHECK ("loginCode" ~ '^[A-Z]{3}[0-9]{3}$');
