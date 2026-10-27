-- Additive identity migration: existing accounts, assignments and passwords stay intact.
CREATE SEQUENCE employee_login_code_seq MINVALUE 1 MAXVALUE 999999 NO CYCLE;
CREATE FUNCTION next_employee_login_code() RETURNS text
LANGUAGE sql VOLATILE AS $$
  SELECT lpad(nextval('employee_login_code_seq')::text, 6, '0');
$$;
ALTER TABLE "Employee" ADD COLUMN "loginCode" VARCHAR(6)
  NOT NULL DEFAULT next_employee_login_code();
CREATE UNIQUE INDEX "Employee_loginCode_key" ON "Employee"("loginCode");
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_loginCode_format"
  CHECK ("loginCode" ~ '^[0-9]{6}$');
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_admin_email_required"
  CHECK ("role" <> 'ADMIN' OR "email" IS NOT NULL);
