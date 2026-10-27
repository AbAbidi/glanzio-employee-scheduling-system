# Pre-deployment audit — 25 October 2026

## Decision

Update: see [26 October implementation and OVH handover](ovh-handover-and-release-2026-10-26.md) for the employee-ID/manual-link workflow, quote delivery and DB/calendar conflict fixes. The findings below record the 25 October baseline, not the current implementation of those resolved items. Production dependencies, real SMTP and OVH release verification still remain open.

**Not approved for public production deployment yet.** This is a local, risk-based audit of the current working tree, not a penetration test or a guarantee against every failure. OVH infrastructure has not been accessed. No Git push, deployment, application-data reset or PDF-content change was performed during this audit.

The working tree already contains substantial uncommitted application work. The changes below are audit hardening; existing feature changes were preserved.

## Fixes made in this audit

- Corrected backend production startup to the actual compiled entry, `dist/src/main.js`, with source maps.
- Made backend lint read-only; intentional formatting is available through `lint:fix`.
- Corrected frontend TypeScript errors rather than excluding failing files: Cypress command declaration discovery, a nonexistent service key, an interceptor return type, stale component auth access, and missing Cloudflare starter types. Added a `typecheck` gate to the existing GitLab configuration.
- Separated invalid JWT failures (401) from authentication-database outages (503). Tokens with malformed subjects are rejected before database lookup; database details are not returned to clients.
- Made password-reset consumption conditional and atomic inside the transaction. A concurrent request that loses the single-use-token claim cannot change the password. Other reset tokens and refresh sessions are invalidated in the same transaction.
- Added production configuration checks for explicit public HTTPS CORS origins, obvious JWT-secret placeholders, access-token duration format, and disabled test-reset configuration.
- Added an explicit, limited `TRUST_PROXY=loopback` option for a local reverse proxy. This is not a trust-all switch; dependency remediation and correct ingress firewalling remain mandatory.
- Blocked all test-reset preview/mutation paths in production, including when an old flag is enabled; production dashboard responses hide the reset interface.
- Added an isolated PostgreSQL integration runner and a mandatory explicit test-database guard. The runner creates a disposable local database, deploys migrations, runs tests, and removes only that database. Existing application records are not test fixtures.
- Added a disposable PostgreSQL CI service and migration/e2e steps to the existing GitLab job. The remote pipeline itself has not been run.
- Fixed calendar loading beyond the first 100 assignments: all pages in the visible range are now fetched, duplicate IDs are collapsed, cancelled loads stop, and later-page failures do not publish a misleading partial result. Added stable ID tie-breaking to backend page ordering.
- Updated stale setup/safety documentation.

## Verification evidence

| Check | Result and limitations |
| --- | --- |
| Backend unit tests | 20 suites / 121 tests passed |
| Backend coverage | 45.41% lines, 45.27% branches; baseline line coverage was 42.13%. This is not comprehensive coverage. |
| Backend lint / build | Passed, including the final build after the scheduling-order edit |
| PostgreSQL integration | 2 suites / 4 tests passed against a new disposable database; all 7 migrations deployed successfully, then the database was removed |
| Frontend unit/rendered-output tests | 44 passed, including 6 new pagination cases; production build passed |
| Frontend TypeScript / lint | Passed |
| Browser suite | 23 Cypress specs / 80 tests passed in headless Electron; application mutations mocked, backend foundation checks read-only |
| Local production smoke | `/`, `/login`, `/dashboard` returned HTML 200 and the logo returned PNG 200 on a temporary local production server; this does not prove authenticated workflows or OVH readiness |
| Secret hygiene | Environment files are ignored; only example environment files are tracked. A narrow private-key/common-provider-token pattern scan found no match in searched non-environment source files. Git history, binary content, all token formats and untracked environment files were not certified. |
| Git whitespace | `git diff --check` passed; Windows LF/CRLF normalization warnings remain |

The authentication additions cover missing/invalid tokens, inactive accounts, database failures, database-authoritative roles, password-change invalidation, reset-token expiry/reuse/concurrent claim, and production reset/configuration safeguards. Existing tests cover credit accounting, immutable closed PDF caches, recurrence/occurrence completion, archive/export filtering and feedback moderation. Browser API writes are mocked; passing them is not equivalent to complete real-network end-to-end coverage.

## Remaining release blockers

### 1. Dependency security remediation

Read-only npm audit results for the installed lockfiles:

- Backend production dependency tree (`--omit=dev`): **10 affected package entries — 1 critical, 8 high, 1 moderate**.
- Frontend complete dependency tree, including build tools: **27 affected entries — 1 critical, 18 high, 7 moderate, 1 low**.

These are affected package entries, not a count of independently exploitable application vulnerabilities. Reachability must be assessed against the deployed Vinext/React/Nest execution paths. The critical `proxy-addr` advisory matters particularly when forwarded client IPs are trusted. The frontend tree includes Next/React server-component and build-tool advisories; an installed Next advisory alone does not establish that its vulnerable Next runtime is used by Vinext.

Do not run `npm audit fix --force` as a release strategy. The suggested Vinext upgrade crosses a major boundary and React/server-component package versions must stay compatible. Update on a reviewed branch, regenerate the lockfile, rerun both builds, types, all regression tests, isolated DB tests and production smoke tests, then retain a fresh audit with reachability decisions. Runtime dependencies were **not** upgraded in this audit; only a types-only Cloudflare dev dependency was added.

Primary advisories: [proxy-addr](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h), [Next.js](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr).

### 2. Invitation and password-reset email delivery

The application creates tokens but has no connected production email delivery path. Development links/raw tokens are deliberately not exposed in production. Real employees therefore need a configured delivery provider before invitations/reset can be considered usable. Choose SMTP/provider, sender/domain, public frontend URL and secret storage; test expiry, one-time use, invalid links, resend, deliverability, provider failure and rate limiting. Never put tokens in application logs.

The homepage quote form also does not send or persist an enquiry: `handleEnquiry` only sets local React state and asks the visitor to contact the company directly. It does not falsely report a sent email, but a visitor expecting form delivery will not reach the business. Either implement and test server-side delivery/retention with anti-abuse controls, or replace the form with explicit direct contact actions before launch.

### 3. Concurrent assignment writes and ambiguous failure recovery

`AssignmentsService` checks overlap before a separate assignment write. Two simultaneous creates/updates can both see an available employee and then commit conflicting work. Post-write notification/audit steps can also fail after an assignment has persisted, leaving the caller uncertain whether retrying will duplicate it.

Before release, serialize all relevant create/update/recurrence paths consistently (for example, deterministically ordered employee-row locks in a transaction, with conflict recheck and bounded retry). Keep the assignment and required audit/outbox records atomic. Introduce stable operation keys for safe client retries. Add real PostgreSQL tests for simultaneous overlapping/disjoint requests, partial recurrence failures and commit-success/response-failure cases. A one-path-only patch would not solve this invariant.

### 4. OVH staging and recovery proof

The domain, OS, server sizing, firewall rules, proxy topology, TLS, backups and restore procedure have not been verified. A successful localhost build is insufficient for public release. Complete the checklist below in staging with non-production data and credentials.

## Follow-up risks and test gaps

- Calendar days currently render three event buttons and a non-interactive `+N more` label; additional loaded events need an accessible day-details view. The pagination fix prevents truncation at 100 but does not solve this existing day-view limitation.
- Offset pagination is not a database snapshot. Concurrent calendar edits can shift items between pages; duplicate suppression prevents duplicate rendering, not every possible omission. Large-scale schedules should use a stable snapshot/cursor contract.
- Employee assignment responses strip financial rates and user email, but still spread other employee fields such as phone/user ID/profile metadata. Define an explicit minimum-data DTO and review what teammates are allowed to see; do not assume every database field is appropriate for this role.
- Unit coverage remains under 50%; route estimation, several CRUD service paths and controller/configuration integration need more negative and concurrency tests. The new reset race tests use mocked transactions; add a two-connection database race test as well.
- Automatic `COMPLETED` means the scheduled end has elapsed, not independently verified attendance. Student allocations are simulations whose provenance stays in the DB/admin UI. No PDF labels/content were changed. Decide the intended business use and approval/audit policy before real payroll/attendance use.
- Public feedback, cookies and the contact workflow need a separate policy/data-retention review. A self-declared human checkbox is not bot verification; add server-verified anti-abuse protection if the abuse risk requires it.
- Mapping/geocoding/routing depend on public third parties. Backend requests have a 10-second timeout, but availability, service usage terms, rate limits and production capacity still need review. Do not promise a route will always be available.
- Several public images exceed 2 MB. Test cold mobile loads, slow networks, sticky animations, reduced motion, keyboard navigation, contrast and real iOS/Safari/Android behavior. The current browser run is not a cross-browser/load/accessibility certification.
- Review seed/bootstrap-admin behavior before release, disable development tooling and ensure no fixture/customer information or generated test reports are published. Do not run development seed/reset commands on production.

## OVH release checklist and developer reasoning

1. **Reproducible release:** a reviewed Git commit, supported pinned runtime, `npm ci`, Prisma generation, both builds, types/lint/tests and dependency triage. Keep a release identifier and previous artifact. The repository currently has GitLab CI configuration; enable the actual hosting provider's pipeline rather than assuming a GitHub push runs it.
2. **Production-like staging:** separate database/secrets/email sandbox. Exercise admin invite → employee activation → login → assignment → completion → analysis/export, including recurring occurrences, archived accounts, reset links, expired sessions, network failures, empty states and role/ID isolation.
3. **Ingress:** HTTPS domain and reverse proxy; frontend/backend ports private. Prefer a same-site `/api/v1` proxy. Build the frontend with the actual public API URL; `localhost:3000` in a visitor's browser refers to their computer, not OVH. Never expose `vinext dev` publicly.
4. **Server protection:** supported OS, security updates, SSH keys, least-privilege application user, firewall and no public PostgreSQL port. Trust forwarded headers only from the actual proxy. OVH documents that [VPS security must be configured by the administrator](https://support.us.ovhcloud.com/hc/en-us/articles/4412351365139-How-to-secure-a-VPS).
5. **Secrets and sessions:** unique high-entropy production JWT secret, private DB credentials, restricted CORS, secure refresh cookies, correct proxy/IP throttling. Verify login/refresh/logout across tabs and unauthorized access using HTTPS, not just local HTTP. See [Nest rate-limit proxy guidance](https://docs.nestjs.com/security/rate-limiting).
6. **Database rollout:** backup first; apply reviewed additive/backward-compatible migrations with `prisma migrate deploy`, never `migrate dev`/reset. Migrations deployed successfully on an empty local test DB, but upgrade from a realistic prior version and restore still need testing. [Prisma deploy behavior](https://docs.prisma.io/docs/cli/migrate/deploy) does not replace backup or drift review.
7. **Supervision and availability:** systemd or equivalent with restricted permissions, automatic restart, readiness/liveness probes, graceful shutdown and startup ordering. Ensure background completion/month-closure jobs behave safely after restart and when multiple instances run. Test DB and email/map outages without leaking stack traces or losing form contents.
8. **Backups and rollback:** define acceptable data loss/recovery time, encrypted off-server backups, retention and a proven restore into a separate DB. Confirm what the actual OVH plan includes; do not assume snapshots/backups are enabled. Code rollback must remain compatible with the migrated schema; do not blindly reverse data migrations.
9. **Observability:** structured redacted logs, error/health/disk/CPU/DB alerts, request IDs and a runbook. Never log passwords, auth cookies, raw invitation/reset tokens or full sensitive customer payloads. Simulate an alert and verify someone receives it.
10. **Launch smoke and monitoring:** test public DNS/TLS, login, refresh, invitations/email, admin/employee permissions, browser refresh/deep links, a safe test assignment and exports on the deployed release. Load-test with representative volume, then monitor error rate and latency after launch. No test campaign can promise zero incidents; preparation means detecting, limiting and recovering from them.

## Risk-based scenario matrix

| Area | Evidence now | Still required before release |
| --- | --- | --- |
| Authentication | JWT/role/DB-failure unit tests, isolated login workflow, browser refresh and expired-session cases | HTTPS production cookies, real multi-tab/browser matrix, account/password-change races |
| Invitations/reset | Single-use claim logic; reset expiry/reuse unit tests; mocked activation UI | Real email receipt, resend/revocation races and real two-connection reset race |
| Authorization | Employee ownership checks and isolated protected workflow; role-hidden UI | Systematic route-by-route object-ID substitution and minimal response-field contracts |
| API validation | Global whitelist/forbid validation and existing negative tests | Boundary sizes, invalid decimals/dates/IDs, mass assignment, unexpected content types, authorization for every mutation |
| Scheduling | Weekday policy, bounded recurrence, per-occurrence completion and live UI regression | Concurrent create/edit/series writes; accessible more-than-three-events day view |
| Accounting | Strong unit coverage for weekly/monthly caps, carry, deterministic allocation, snapshot/cache lifecycle | Real parallel DB closure, crash/restart, month/year/DST boundaries and realistic historical upgrade fixtures |
| Archive | Retention/export filters and admin-only archive UI tests | Restore conflicts, archive-vs-assignment race and retention/purge decisions |
| Feedback | Isolated DB moderation workflow and private/public UI tests | Public abuse/load tests, moderation operations and retention process |
| Database | Seven migrations on empty isolated DB | Migration from production-like prior schema/data, pool exhaustion, backup restore and rollback compatibility |
| Failures | Auth 503 classification, form-preserving refresh/network tests, map timeout | OVH process/DB/disk/email outages and recovery exercises |
| Frontend | Typecheck, lint, build, rendered output; desktop/mobile Cypress | Real Safari/iOS/Android, slow connections, cold-load performance and full accessibility audit |
| Deployment | Correct compiled backend entry; local production HTTP smoke | Real Linux/OVH boot/restart, TLS/DNS, proxy/IP throttling, monitoring and restore drill |

## Browser verification addendum

The full local Cypress regression suite completed against localhost: **23 specs, 80 passed, 0 failed, 0 pending, 0 skipped**, in approximately 5 minutes 52 seconds. It includes desktop/mobile layouts, login/invitation transitions, session renewal, archive dialogs, employee search, German localization, holiday warnings, occurrence reporting, student previews, feedback moderation, cookies, hydration, service motion and glass animation. The production-response reset-control regression also passed.

These tests use headless Electron 138. Mutation APIs are mocked; four API foundation checks hit local backend health/readiness, unauthenticated rejection and 404 routes. They do not constitute a real production end-to-end suite, load test or all-browser certification. No OVH browser tests have been performed. The temporary local production smoke server was stopped after the checks; the existing development services were left running.
