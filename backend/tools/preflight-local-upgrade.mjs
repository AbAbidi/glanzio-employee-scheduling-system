import 'dotenv/config';
import { Client } from 'pg';

const target = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || process.env.NODE_ENV === 'production') {
  throw new Error('This read-only preflight is restricted to the local non-production database.');
}
const client = new Client({ connectionString: target.toString() });
try {
  await client.connect();
  const result = await client.query(`SELECT count(*)::int AS conflicts FROM "AssignmentEmployee" a
    JOIN "AssignmentEmployee" b ON a."employeeId" = b."employeeId" AND a."assignmentId" < b."assignmentId"
    JOIN "WorkAssignment" x ON x.id = a."assignmentId" JOIN "WorkAssignment" y ON y.id = b."assignmentId"
    WHERE x.status IN ('SCHEDULED','COMPLETED') AND y.status IN ('SCHEDULED','COMPLETED')
      AND x."startAt" < y."endAt" AND y."startAt" < x."endAt"`);
  const count = result.rows[0].conflicts;
  const totals = await client.query('SELECT (SELECT count(*) FROM "User")::int AS users, (SELECT count(*) FROM "Employee")::int AS employees, (SELECT count(*) FROM "WorkAssignment")::int AS assignments');
  console.log(JSON.stringify({ existingCounts: totals.rows[0], overlappingEmployeePairs: count }));
  const column = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Employee' AND column_name='loginCode'`);
  if (column.rowCount) {
    const codes = await client.query(`SELECT count(*)::int AS total, count(DISTINCT "loginCode")::int AS unique_codes, count(*) FILTER (WHERE "loginCode" ~ '^[A-Z]{3}[0-9]{3}$')::int AS alphanumeric_codes FROM "Employee"`);
    console.log(JSON.stringify({ employeeCodeVerification: codes.rows[0] }));
  }
  if (count) process.exitCode = 2;
} finally { await client.end(); }
