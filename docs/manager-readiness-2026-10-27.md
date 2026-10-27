# Manager access and local release verification — 27 October 2026

This report supersedes older manager-proposal, dependency and local-backup findings. It is a local verification report, not a production certification.

## Outcome and scope

`ADMIN` remains the existing owner role. `MANAGER` is a separate named account with a linked standard, non-student employee profile. The header reads **Admin / Gestionnaire**, including on mobile. No existing account was promoted, no administrator email/password was changed, and no backdoor was added.

| Capability | Owner (`ADMIN`) | `MANAGER` | `EMPLOYEE` |
| --- | --- | --- | --- |
| Business overview, employee/client/site management, scheduling and recurrence | Yes | Yes, active records | Own authorized records only |
| Employee analysis and internal PDF exports | Yes | Yes, active employees | Own permitted report data only |
| Work assigned to own linked employee profile | If linked | Yes, normal employee accounting | Receives assignments |
| Audit logs, feedback moderation, archive and restore | Yes | No | No |
| Archive/status/delete employee/client/site; maintenance resets | Yes | No | No |
| Grant roles, reset another account's password, replace invitation links | Yes | No | No |
| Own profile and password | Normal account settings | Normal self-service | Normal self-service |

Managers can create ordinary employee invitations, but cannot create another manager. They cannot modify privileged employee profiles through the team editor. Owner-only restrictions are enforced by backend roles and active-resource checks, not only by hiding navigation. Publicly published feedback remains public to everyone; the restricted capability is moderation/private feedback access.

Role changes preserve employee ID/code/history, increment an authentication version, revoke refresh sessions and record the old/new role and actor in one DB transaction. Stale JWTs fail immediately, even in the same second. Repeating the same role is a no-op.

## How to test the manager yourself

1. Sign in to the existing owner account and open **Employees**.
2. Create a new employee, choose **Admin / Gestionnaire** under **Account access**, and leave student status off. An email is optional contact data, not the manager's login.
3. Copy the generated invitation link. Open it in a private browser session, set a password and activate the account. Use a separate browser/profile so you keep the owner's session available.
4. The manager sees the business dashboard and the title **Admin / Gestionnaire**. Sign-in uses the generated six-character ID plus password.
5. Verify employees/clients/calendar/analysis/exports, including assigning this manager to work. Archive/feedback navigation, archive buttons, account resets and role grants must be absent. Direct owner-only API requests return 403; direct archived object access returns 404.
6. For an existing standard employee, the owner can use **Admin / Gestionnaire ernennen**, then **Bestätigen**. Demotion uses **Gestionnaire → Mitarbeiter**. Changing roles ends old sessions; sign in again. No shared accounts or test credentials are shipped.

## Verification evidence

- Backend: **139 unit tests / 25 suites**, **27 real PostgreSQL integration tests / 4 suites**, build and lint passed. The owner-only non-production reset was verified in the disposable test DB to remove employee/manager profiles and accounts together, while retaining owners. No reset was executed against the real local application DB.
- Frontend: **47 unit/rendered-output tests**, production build, lint and TypeScript checks passed after security updates.
- New manager desktop/tablet/mobile browser tests: **6 passed**. Full local browser regression: **93 passed / 25 specs**, no failures, pending or skipped tests, in approximately 6 minutes 13 seconds. See the addendum below.
- Measured backend unit-only line coverage: **45.90%**, branches **45.79%**, statements **46.30%**, functions **41.61%**, excluding generated Prisma source. Integration coverage is not merged into this metric. Passing tests do **not** mean nearly 100% coverage.
- Integration cases include manager invite/activation/ID login, own work assignment, ordinary CRUD/report access, employee restrictions, owner-only endpoint denial, archived-ID substitution, privilege escalation rejection, standard/non-student policy, immediate token revocation and audited/idempotent role changes. Existing tests cover recurring occurrences, overlapping employee-time writes, student credit/allocation/PDF cache behavior, quotes and feedback.
- All 12 migrations were exercised on empty disposable databases. A real private pre-upgrade local backup was restored into a separate disposable database and migrated successfully. Restored and real local counts: **8 users, 7 employees, 24 assignments**. All 7 employee codes remain unique and valid; no overlapping employee-time pairs were found. No application records were deleted. Only temporary test databases created for these checks were removed.
- Final `npm audit --json`: **0 reported vulnerabilities in each full dependency tree** (including tooling), at the time of checking. Compatible fixes were applied without `--force`; Next/React/RSC, Prisma and build tooling were tested together. Explicit patched overrides are retained for Multer, image-size, Undici and the legacy development loader's esbuild. The Drizzle CLI starts successfully after its override. Recheck advisories regularly; zero known advisories is not proof of zero vulnerabilities. [Multer advisory](https://github.com/advisories/GHSA-q7qp-rjg7-q26m).
- Push hygiene scan: no matches for common private-key/token patterns, exact current local environment secrets or the local database password in eligible working-tree text or reachable historical text blobs. The scan examined at least **294 current text files and 357 historical blobs**; later report/helper additions may change the current-file count. Files over 2 MB and binary formats are not inspected; this is not a general entropy or personal-data certification.
- Actual built-runtime HTTP smoke testing found a Windows-specific Vinext 0.0.50 static-cache bug: native backslashes were used as URL keys, so existing CSS/JS files returned 404. `frontend/tools/fix-vinext-windows-cache.mjs` applies one version-checked, idempotent URL-key normalization after Windows installation; Linux is unchanged. It does not alter filesystem traversal or internal-file restrictions. Local production pages and three compiled assets returned 200 after correction; `/.env`, `/.vite/manifest.json` and its encoded-slash variant stayed 404. `tools/smoke-local-frontend.mjs` reproduces these read-only checks against a separately started local production server. Reassess/remove this narrowly scoped compatibility patch when upgrading Vinext.
- `.env*`, dependencies, generated Prisma, build/test output, private backups and credential/key files are ignored. The unrelated personal CV-generation helper is now ignored, not deleted. Public company contact/legal details remain intentionally public.
- Build succeeds with upstream Vinext/RSC source-map and future-Vite-config warnings. These are not test failures but remain tooling follow-ups. Browser testing uses Electron, not a real Safari/iOS/Android device matrix.

## Git push: exact local sequence

The configured `origin` is **GitLab**, `https://gitlab.com/ababidi32/employee-scheduling-system.git`. Current branch at inspection: `codex/glanzio-public-content`. No commit, push, merge request or deployment was created by this work.

In PowerShell:

```powershell
Set-Location 'C:\Users\lenovo\Desktop\Development\employee-scheduling-system'
git status
node tools/check-push-hygiene.mjs --history
git switch -c codex/predeployment-manager
git add .
git diff --cached --stat
git diff --cached --name-only
git diff --cached --check
```

Review the staged files before committing. There must be no real environment file, private key, database backup, generated PDF, customer dump or invitation/reset URL. Do not paste the staged diff into a public chat if it contains private data. If the branch already exists, choose a new descriptive `codex/…` name instead of resetting it.

After that review:

```powershell
git commit -m "Add manager permissions and harden release checks"
git push -u origin codex/predeployment-manager
```

Open GitLab and create a merge request to `main` (the locally recorded `origin/HEAD` is `origin/main`; confirm the project still shows this default). The current CI workflow runs for merge requests/default-branch pushes, not every feature-branch push. Both verification jobs must be green before merging. New high/critical npm advisories fail these jobs. CI is configured but was **not run remotely in this session**. Local browser regression is not yet a dedicated CI job.

For a later fresh checkout, use `npm ci` separately in backend/frontend, private local environment values, Prisma generation and reviewed migrations. Test commands:

```powershell
Set-Location 'C:\Users\lenovo\Desktop\Development\employee-scheduling-system\backend'
npm run prisma:generate
npm run lint
npm run build
npm test -- --runInBand
npm run test:e2e:isolated
Set-Location '..\frontend'
npm run lint
npm run typecheck
npm test
npm run cy:run -- --browser electron --config video=false
```

The isolated integration helper requires a **local non-production** PostgreSQL account allowed to create temporary databases. Browser tests require the local frontend/backend running. Never redirect these commands to production to make them pass.

## OVH: what still blocks a production green light

**Git review/testing snapshot is not approval to replace the live website.** No OVH login, DNS, SMTP credential, live application or server setting was touched.

1. Inventory the OVH product (VPS/dedicated versus shared hosting), OS, access permissions, existing site/processes and database, DNS/reverse proxy and available resources. Do not guess server commands before this inventory.
2. Back up the current live site, configuration and DB off-server, with retention/encryption and a tested OVH restore procedure. The successful local restore drill does not prove OVH recovery works.
3. Deploy the reviewed commit to protected staging with its own DB, domain and secrets. Build using the public API URL, configure private backend/DB ports, TLS, secure cookies, CORS and correct proxy trust. Do not expose development servers.
4. Verify the real Email Pro host/TLS/authentication and delivery to `info@glanzio-reinigung.de` using an agreed safe test. SMTP is still disabled/unverified locally; no real quote email was sent by this work. Password-reset email delivery also needs its end-to-end operational workflow checked.
5. Test both roles and employee isolation under actual HTTPS, invitations/deep links/refresh/multi-tab behavior, completed/recurring work, monthly/weekly analysis, drafts/automatic closure/exports, archive behavior and third-party route outages. Verify legal/retention decisions and actual attendance/payroll use separately; no PDF layout/content was changed in this manager task.
6. Review remaining concurrency/performance/abuse risks: large datasets and offset pagination, accounting closure/restart races, archive-vs-assignment races, post-write notification/audit failures, reset race variants, real-browser accessibility, low-end mobile/slow networks and third-party map capacity. Unit coverage remains under 50%; there is no exhaustive scenario or penetration-test certification.
7. Prepare a versioned production artifact, reviewed `prisma migrate deploy`, monitoring/alerting, non-root service supervision and a compatible rollback. Do not run development seed/reset/migrate-dev on live data or automatically promote/rename the test admin into the business owner.
8. Validate staging, then plan the same-domain cutover and rollback with the owner. Only after the staging/infra/email gates are demonstrated should production receive a separate green light.

## Final browser regression addendum

**25 specs, 93 passed, 0 failed, 0 pending, 0 skipped**, headless Electron 138, localhost, approximately **6 minutes 13 seconds**. The earlier run exposed stale green/yellow colour expectations; these were aligned with the explicitly requested bright palette and the complete suite was rerun successfully. A tablet-width manager-title assertion was added alongside desktop/mobile checks.

Browser mutation APIs are mocked. Four foundation checks exercise the real local backend for health/readiness, unauthenticated rejection and 404 behavior. This is not a remote CI, real-browser-device, load, penetration or OVH test. All temporary integration/restore databases were removed; real local data and normal development services were retained.
