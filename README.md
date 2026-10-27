# Employee Scheduling Management System

ESMS is a responsive scheduling system for a cleaning company. Administrators manage employees, clients, cleaning sites, one-time/recurring assignments, calendars, reports, and warnings. Employees receive read-only access to their own schedules, history, planned hours, dashboards, and notifications.

Access roles: `ADMIN` is the owner; `MANAGER` (Admin / Gestionnaire) has operational access and a standard employee profile, without audit logs, feedback moderation, archives or account-security administration. Every person uses a separate account.

Current repository status:

- `backend/`: complete Version 1 NestJS API foundation and business workflow.
- `docs/ESMS_Blueprint_Revised_v1.1.docx`: revised product blueprint.
- `frontend/`: German public website and responsive administrator/employee portal (React, Vinext/Vite).

See `backend/README.md` and `frontend/README.md` for local setup and verification commands.

Before pushing or publishing, read [the current manager/readiness report and release steps](docs/manager-readiness-2026-10-27.md), which supersedes the older [pre-deployment audit](docs/predeployment-audit-2026-10-25.md). Local dependency remediation and a local restore/migration drill are complete. Passing local tests is not production approval: real email delivery, OVH infrastructure/restore and staging checks remain required.
