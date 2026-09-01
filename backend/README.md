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
contains `developmentInvitationUrl`; production must deliver the invitation by
email. The employee opens that URL and `POST /api/v1/auth/accept-invitation`
sets their private password, consumes the token, activates the account, and
starts an authenticated session. `POST /api/v1/employees/:id/invitation`
revokes earlier unused invitations and issues a replacement.

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
npm.cmd run test:e2e -- --runInBand
```

The e2e suite creates uniquely named fixtures, verifies the complete protected workflow, and deletes only those fixture records afterward.

## Production notes

- Set `NODE_ENV=production` so refresh cookies use `Secure`.
- Serve only through HTTPS.
- Use a strong production-only JWT secret.
- Restrict database networking to the backend.
- Run `npm run db:deploy`, not `db:migrate`, during deployment.
- Configure managed backups and regularly test restoration.
- Connect an email provider before sending employee invitations or exposing password reset in production.
