# ESMS Backend

NestJS 11 REST API for the Employee Scheduling Management System. The API uses PostgreSQL, Prisma 7, Argon2id password hashing, short-lived JWT access tokens, and rotated refresh sessions stored in HttpOnly cookies.

## Requirements

- Node.js and npm
- PostgreSQL 18 (or another Prisma-supported PostgreSQL release)
- A local database and least-privilege development user

## Environment

Copy `.env.example` to `.env` and replace every placeholder. Important values:

- `DATABASE_URL`: PostgreSQL connection string.
- `JWT_ACCESS_SECRET`: random secret of at least 32 characters.
- `CORS_ORIGIN`: comma-separated frontend origins.
- `SYSTEM_TIME_ZONE`: IANA timezone used for calendar/month boundaries.
- `STUDENT_MONTHLY_LIMIT_MINUTES`: warning threshold; `4800` equals 80 hours.
- `INVITATION_EXPIRES_IN_HOURS`: employee invitation lifetime; default `72`.
- `ALLOW_TEST_WORKSPACE_RESET`: keep `false` in production; set to `true` only for a deliberate, administrator-confirmed cleanup of test workspace data.
- `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`: initial local administrator.

Never commit `.env`.

## Setup

```powershell
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run start:dev
```

The API prefix is:

```text
http://localhost:3000/api/v1
```

Health checks:

```text
GET /api/v1/health
GET /api/v1/health/ready
```

If Windows Application Control blocks Prisma's native schema engine, do not disable the security policy. Run migrations from an approved development/CI environment or ask an administrator to approve the exact official Prisma engine.

## Main API areas

- `/auth`: login, invitation acceptance, refresh, logout, current user, password change/reset.
- `/employees`: admin employee invitation/lifecycle plus employee self-profile.
- `/clients`: client CRUD-style administration with archive/restore.
- `/sites`: cleaning-site administration, location, duration, equipment.
- `/assignments`: one-time assignments, conflict checks, history, cancellation.
- `/recurring-assignments`: bounded daily, weekly, or monthly generation.
- `/calendar`: role-filtered calendar assignment feed.
- `/reports/monthly`: planned-hour totals and student warnings.
- `/dashboard`: role-specific dashboard data.
- `/notifications`: personal in-app notification inbox.
- `/audit-logs`: administrator-only critical action history.

Employees cannot modify assignments and cannot request another employee's assignment/report data.

## Employee invitation workflow

`POST /api/v1/employees` is administrator-only. It creates the employee and an
`INVITED` user without a password, then issues a hashed, single-use invitation
that expires after the configured lifetime. In development, the response
contains `invitationUrl` for the administrator in every environment. The admin
shares it manually; employee invitation email is not required. Set
`PUBLIC_FRONTEND_URL` to the public HTTPS origin in production. The employee opens that URL and `POST /api/v1/auth/accept-invitation`
sets their private password, consumes the token, activates the account, and
starts an authenticated session. `POST /api/v1/employees/:id/invitation`
revokes earlier unused invitations and issues a replacement.

Employees have a database-generated unique six-character `loginCode`, formatted
as three uppercase letters plus three digits (for example `AMT359`). `/auth/login`
accepts `{ identifier, password }`; lowercase code entry is normalized. Employee
email login is rejected, including the legacy `{ email, password }` contract.
Only ADMIN accounts use email login; both request contracts remain supported for
them. New employees can be created without email; any retained employee email is
contact information only. Codes are identifiers, not secrets; passwords and login
throttling remain mandatory. Migration `20261026040000_alphanumeric_employee_codes`
converts old numeric codes; those old login codes stop working. Existing UUID
relations, passwords and permissions are preserved.

## Quote requests

`POST /api/v1/quotes` validates the public quote form and sends a plain-text email
to the fixed `info@glanzio-reinigung.de` recipient. Configure private `SMTP_*`
environment settings and set `SMTP_ENABLED=true` only after verifying the real
OVH Email Pro host and sender. TLS is required; no credentials go to the browser.
The customer email is Reply-To, never the SMTP sender. With SMTP disabled the API
returns 503 and does not pretend the request was sent.

Requests use a UUID submission key, input hash and persisted delivery state.
Identical confirmed requests are not resent; changed payloads on the same key
return 409. `UNKNOWN` / `SENDING` deliveries need reconciliation with SMTP logs
before any manual replay; SMTP cannot guarantee exactly-once delivery. Quote
requests are preserved by operational test resets just like real feedback.

See `../docs/ovh-handover-and-release-2026-10-26.md` for migration safety,
calendar/exclusion behavior, local verification and the pending OVH checklist.

## Scheduling terminology

Version 1 reports planned or scheduled hours. It does not claim that an employee attended or that the time is legally payable. Cancelled and draft assignments are excluded from monthly planned-hour totals.

Student assignments remain allowed above the configured monthly threshold. The API returns a warning with `assignmentBlocked: false`.

## Verification

```powershell
npm.cmd run check
```

Or run the gates individually:

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd test -- --runInBand
npm.cmd run test:e2e:isolated
```

The isolated e2e runner requires a local PostgreSQL role with permission to create a database. It creates a uniquely named disposable database, applies all migrations, runs the tests, and drops only that database in a finally block. It never runs the application against the development database. Direct `test:e2e` runs require an explicit `E2E_DATABASE_URL` pointing to a disposable `_test` / `_ci` database; do not use an application or production database. Test runs start background jobs and must remain isolated.

`lint` is read-only; use `lint:fix` intentionally when formatting changes are wanted. The production entry point is `npm run start:prod` after Prisma generation and build.

## Production notes

### Per-occurrence completion and live reporting

- Each `WorkAssignment` is a separate visit, including visits linked to a recurring template. The existing calendar rule (scheduled end reached) is now persisted as `COMPLETED` for that visit only. Future visits remain `SCHEDULED`; `CANCELLED` and `DRAFT` visits are excluded. This is automatic schedule-based completion, not independent verification of attendance.
- A background check runs at startup and every minute. Calendar, dashboard and student/PDF reads also synchronize elapsed visits before calculating figures. The transition and a per-visit `ASSIGNMENT_AUTO_COMPLETED` audit record are committed together; repeated/concurrent checks do not duplicate the transition.
- Series regeneration/cancellation preserves completed occurrences. Both monthly and weekly worked-hour analysis use completed visits, independent of whether their template is still active. Actual worked totals remain live; closing a student statement freezes its credit allocation, not the original assignment history.
- Visible dashboard/calendar/student-preview views revalidate every 15 seconds, on focus, and after assignment/employee mutations (including other tabs). Filters and form state are retained.
- Each student/month has one current draft record and PDF cache. Changed inputs replace that draft's data/cache, rather than creating additional revisions. Closure prepares and stores the final PDF immediately; later downloads reuse its exact bytes. Individual filenames distinguish `-draft.pdf` from `-final.pdf`. Downloading still never closes a month.

### Student credit simulation (effective October 2026)

- The versioned policy in `src/reports/student-accounting.ts` caps allocation at 600 minutes per ISO week and 2400 minutes per calendar month. Policy v5 reserves original dates/times for COMPLETED assignments first. Deferred credit uses non-overlapping weekday gaps between 08:00 and 18:00, in weeks strictly after its source week, with at most five allocated hours on a day when adding credit. Credit must leave 30 minutes before and after each SCHEDULED/COMPLETED calendar interval for the same employee. This is a fixed credit-only buffer, not a distance estimate: actual assignment validation and original WORK portions do not acquire this buffer. There is no fixed two-hour slot. Pre-October student reports retain their former 80-hour calculation; the opening credit on 2026-10-01 is zero. The legacy `STUDENT_MONTHLY_LIMIT_MINUTES` environment setting does not override this versioned policy.
- Original database assignments are never moved or shortened. Student worked time and the weekly actual-work table now require COMPLETED status and a past end time. SCHEDULED assignments are excluded as work but still reserve their calendar interval against simulated credit. The PDF shows capped work portions and clearly labelled credit regularizations; full original intervals remain available in the source trace. Current weekly excess and monthly credited allocations are separate metrics.
- From Employees, choose the month, then **Credit preview / closure**. November can be previewed in October; it is a draft projection based on October work already counted, not a future attendance record. Weekly excess can be redistributed into later weeks of the same month with capacity, never into an earlier week or another day of the same week. If none remain, it carries to the next month. Example: 4h + 4h + 4h in the last October week gives 10h work portions in October and 2h regularization in the first available November week.
- `GET /reports/student-statement?employeeId=<uuid>&month=2026-11` refreshes persisted draft snapshots for administrators. Manual closure is no longer exposed as an API route or UI action. The server checks at startup, every minute, and before preview/export: it closes only finished student months, in order, using `SYSTEM_TIME_ZONE`, then stores the final PDF. A missed rollover is caught up after restart, and a missing final PDF is retried without closing or allocating twice. System closures are audited with a null actor and `closureMode: AUTOMATIC`. Historical corrections/reopening still require a separate audited revision workflow.
- PostgreSQL transactions serialize on the employee row, with bounded serialization retries. Unique snapshot/movement keys, stable source ordering and SHA-256 input fingerprints prevent repeat allocation. Oldest credit is consumed first and keeps its source assignment and hourly rate. Snapshots contain incoming/outgoing lots and per-day allocations; movement records distinguish draft projections from closed postings through their parent status. Never sum movements across draft and closed snapshots as though they were cash payments.
- Individual and combined PDF exports use the same monthly statement for every employee. Completed work is included up to the current date; a future month's student projection includes earned carryover but not future scheduled work. The PDF adds no remarks entries, simulation banner, summary footer, or replacement lines. These allocations remain simulations, not attendance evidence; provenance and balances stay in the database/admin preview. Current draft data/cache is replaced on changes to inputs or `pdf-layout-version.ts`. A closed snapshot/PDF is immutable and returned without replaying history. Open periods replay only from the last closed snapshot.
- The credit preview is inline under the selected employee. It has only a close control, a five-row scrollable allocation table, and automatically updated balances/status. The directory's individual export and combined export actions remain available.
- The admin Archive workspace lists inactive employees and clients separately from operational directories. Monthly/weekly employee analysis defaults to active profiles; `GET /dashboard/archive-analysis?month=YYYY-MM` provides retained inactive-profile analysis to administrators only. Directory queries default to `active=true`; administrators can explicitly query `active=false`. Combined exports exclude inactive employees, and explicit operational PDF exports for them are refused; cached closed PDFs and credit records are not deleted or rewritten. Client archiving hides its service sites, but does not remove earned work from active employees' accounting. Future/ongoing DRAFT or SCHEDULED assignments must be resolved before an employee/client can be archived. Archiving disables employee access and revokes sessions/invitations without cancelling or deleting assignments.
- The existing Reset preview now counts snapshots (draft and closed), credit movements and stored PDFs. Both operational and full test-workspace resets remove this accounting data inside their deletion transaction. Full reset continues to preserve administrators, administrator sessions and audit history. Downloaded copies on a user's computer cannot be deleted by a server reset. The application does not store generated student PDFs on disk.
- `npx tsx tools/verify-student-preview.ts` performs local October/November draft QA, verifies carry consistency and repeat-download bytes, and writes visual QA files under `../tmp/pdfs/student-accounting`. It never closes a period or executes Reset.

- Set `NODE_ENV=production` so refresh cookies use `Secure`.
- Serve only through HTTPS.
- Use a strong production-only JWT secret.
- Restrict database networking to the backend.
- Run `npm run db:deploy`, not `db:migrate`, during deployment.
- Configure managed backups and regularly test restoration.
- Employee invitations use manually shared admin-only links. Configure SMTP before using quote delivery. Password-reset email delivery remains a separate pending workflow; employee accounts without email use the existing authorized admin reset process.
- Test-data resets and their previews are always rejected when `NODE_ENV=production`, even if an old environment file enables the test flag. The production dashboard hides these controls. Keep `ALLOW_TEST_WORKSPACE_RESET=false`; full test reset is only available in an explicitly enabled non-production workspace.
- Set `TRUST_PROXY=loopback` only when a reverse proxy on the same host is the sole public ingress and the backend port is private. Otherwise leave it `false` and configure the actual trusted proxy topology before enabling IP-based rate limits. Never trust every forwarded header.
- Production startup validates explicit public HTTPS CORS origins and rejects development JWT placeholders. This does not replace an infrastructure security review.

## Public customer feedback

- Deploy the additive `20261023010000_public_feedback` migration before using the feedback feature. No customer reviews are seeded.
- `POST /feedback` accepts a UUID submission key, a 10–2000 character message, an optional pseudonym/rating and explicit `allowPublic`. Submission keys prevent duplicate retries; reusing one with changed content returns 409. The endpoint is limited to three attempts per minute per client IP and rejects the honeypot field when filled.
- Private feedback remains `PRIVATE`. Publicly permitted submissions start `PENDING`; only an administrator can publish or unpublish them in Dashboard → Feedback. Permission is enforced by service validation and a database constraint. Moderation is audited without copying the message into the audit log.
- `GET /feedback/published` returns only consented, approved submissions and excludes private metadata. Public names/pseudonyms are self-reported, not independently verified. There is no fabricated score or testimonial fallback.
- Keep real customer feedback out of operational test-data resets. Integration tests create uniquely keyed fixtures and delete only those fixtures and their own moderation audit records afterwards.
