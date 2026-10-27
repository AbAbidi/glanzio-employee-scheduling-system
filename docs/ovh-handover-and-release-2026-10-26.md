# Local hardening and OVH handover — 26 October 2026

Update 27 October: the [current readiness report](manager-readiness-2026-10-27.md) supersedes older pending manager, dependency and local restore-drill findings. `ADMIN` remains owner; `MANAGER` is now implemented. OVH/staging/real SMTP are still unverified.

## Changes implemented locally

Later update: [employee access and permissions plan](employee-access-and-permissions-plan.md) supersedes the numeric-ID/email-login compatibility described below. Employee login is now alphanumeric ID only; ADMIN email login remains. Owner/manager permissions remain a proposal awaiting approval.

- Employee login: a database-generated unique **six-digit** identifier, including leading zeros; password remains mandatory. Existing UUIDs, passwords, email-based logins and business records stay intact. Codes are sequential identifiers, not secrets. They are never recycled by test-data resets. The directory and own profile show the code; employee email is now optional.
- Existing employees receive codes through an additive migration. `User.email` is nullable for employees; a DB constraint still requires an admin email. The UI sends the legacy email login contract for email addresses and the new identifier contract for codes, allowing a gradual rollout.
- Manual invitation links are available to administrator endpoints in production as `invitationUrl`. They use `PUBLIC_FRONTEND_URL` (or the configured frontend CORS origin), retain single-use/expiry/revocation checks, and are not sent by email. The old `developmentInvitationUrl` remains only outside production for older local clients. Do not log invitation query strings at the reverse proxy.
- Quote form: server validation, honeypot, IP throttling, bounded input, fixed business recipient `info@glanzio-reinigung.de`, customer email only in Reply-To, plain-text body and TLS SMTP. The frontend shows loading, preserves failed inputs and reuses the same submission key for identical retries.
- Quote requests are stored before delivery with a content fingerprint and atomic delivery claim. Confirmed SMTP acceptance becomes `SENT`; explicit SMTP rejection permits a bounded retry; ambiguous network failure becomes `UNKNOWN` and is not replayed automatically. A process crash after SMTP acceptance can leave `SENDING`; reconcile it against mail logs using the stable Message-ID before changing its state. SMTP is not an exactly-once-delivery protocol. `SENT` means accepted by SMTP, not proof of arrival in the inbox.
- SMTP is disabled by default. No real email was sent in testing. The actual OVH Email Pro host, credentials and sender authorization must be verified before enabling it. Owning an OVH server does not automatically configure the application's SMTP connection.
- Scheduling: PostgreSQL exclusion constraints now enforce non-overlapping occupied intervals per employee across nested creation, edits, employee changes and recurring writes. Different employees can work at the same time. Intervals are half-open: 08:00–10:00 and 10:00–12:00 are allowed. `DRAFT`/`CANCELLED` do not reserve time; `SCHEDULED`/`COMPLETED` do. This does not add a travel buffer to real assignments.
- Concurrent DB conflicts return HTTP 409 without SQL details. Employee replacements are transactional and remove previous links before changing time, avoiding false intermediate conflicts. The migration requires the trusted PostgreSQL `btree_gist` extension and fails instead of deleting pre-existing conflicting records.
- The calendar displays simultaneous work side by side in compact groups, wraps larger groups and keeps all events accessible (not only the first three). Mobile uses an internal horizontal scroll area with readable event blocks and no page-width overflow.
- Employee-facing assignment responses now allowlist teammate identity fields rather than exposing phone, login code, account ID or profile metadata. Financial data remains omitted.

## Local application and data safety

The user explicitly approved the local migrations. Before applying them:

1. A read-only preflight counted 7 users, 6 employees, 24 assignments and zero employee-overlap pairs.
2. A PostgreSQL custom-format backup was created under the Git-ignored `tmp/db-backups/` directory. Its archive format was checked with `pg_restore --list`. It contains private application data: do not upload or commit it. This is not an off-site encrypted backup or a tested restore drill.
3. All ten migrations passed on a fresh disposable database before the three new migrations were applied to the local application DB.
4. After migration, counts remained 7 / 6 / 24, with zero overlap pairs; all six codes are valid and distinct.
5. Only the verified local backend watcher was restarted; database readiness returned `ready`.

No existing account password/email/role was changed. No assignments were deleted or rescheduled. No PDF layout or business accounting policy was changed. No Git push, OVH login or deployment occurred.

## Verification

- Isolated PostgreSQL integration: three suites / nine tests passed, including code-based activation/login, different employees at the same time, two concurrent writes that both passed their prechecks (one succeeds, one gets 409), adjacent intervals, rollback of a conflicting time edit, and quote retry deduplication. The SMTP provider was mocked; the database/transactions/constraint were real. Disposable databases were removed after each run.
- Backend unit tests, lint/build, frontend types/lint/build and unit/browser results are recorded in the final verification addendum below.
- Backend production dependency audit remains 10 affected package entries (1 critical, 8 high, 1 moderate). Nodemailer 10.2.1 adds no reported production advisory in this scan. Previous dependency remediation blockers remain open; no forced upgrades were made.
- The exclusion constraint fixes schedule conflicts at the database boundary, but does not make every post-write notification/audit failure idempotent. Operation-key/outbox improvements and broader concurrency tests remain follow-up work from the original audit.

## Administrator ownership and access — proposal, not implemented

Do not share a single login between people. The database enforces unique email addresses; two people using one email/password are one account, making the audit actor indistinguishable.

Separate **account permissions** from **employment profile**. A manager can have an ordinary non-student employee profile and be assigned work without receiving owner permissions.

| Proposed role | Intended scope |
| --- | --- |
| OWNER | Business administration, permission grants, audit history, archives and sensitive settings |
| MANAGER | Explicit employee/assignment management permissions, including assignment of their own linked employee profile; no audit/archive/role administration by default |
| EMPLOYEE | Own schedule/profile and explicitly permitted own reports |
| TECHNICAL MAINTAINER | Explicitly agreed deployment/configuration/diagnostic rights, preferably separated from routine business/financial access |

The current application still has only ADMIN and EMPLOYEE roles. Do not claim this proposal is already enforced. A dedicated permission matrix, migrations and API/UI authorization tests are needed before introducing OWNER/MANAGER.

Handover has two different cases:

- If the same person's existing account simply has a test email, verify the official address, change it in place under recent authentication, audit the change, revoke sessions and reauthenticate.
- If the developer and business owner are different people, create a **separate owner account** and grant the approved permissions. Verify the owner can sign in/recover access, then revoke/deactivate test access as agreed. Do not rename the developer identity into the owner identity: old audit actions should remain attributable to the original person.

SSH/OVH access and website roles are separate systems. A website OWNER role does not supersede infrastructure ownership; a server administrator with root access can alter the deployment/database. Agree on infrastructure/account ownership and maintenance rights explicitly.

No hidden backdoor, secret-click sequence, universal password or authentication bypass is implemented. For convenient username-less access, a future option is a properly registered passkey with server-verified WebAuthn and a strong recovery process. It is still tied to a named account and authorized role; a hidden URL is not authentication.

References: [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [OWASP passkeys](https://cheatsheetseries.owasp.org/cheatsheets/Passkey_Security_Cheat_Sheet.html).

## Replacing the current website on the same domain

1. **Inventory, read-only first:** identify OVH product, OS, current web server/control panel, existing application/CMS and DB, document root, domain/www DNS, certificates, running services and mail hosting. Do not overwrite files or publish credentials in chat.
2. **Back up the old site:** application files, DB and server/proxy configuration. Retain a tested restore path and the previous release.
3. **Stage separately:** deploy the new frontend/backend with a separate DB/secrets under a protected staging hostname or private test access. Do not expose real employee data or seed test administrators into production.
4. **Prepare production:** supported runtime, reviewed dependencies, correct public API/frontend URLs, HTTPS, private backend/PostgreSQL ports, restricted service account, supervision, log redaction, health checks and alerts.
5. **Verify Email Pro:** read the actual SMTP host in OVH; configure the backend secret environment, verify TLS/authentication, sender authorization and a controlled delivery to the business mailbox. Check Spam as well. Test wrong credentials, provider outage and retention of failed requests. Do not send real test messages without approval.
6. **Switch traffic:** on the same server, this may only require changing the domain's reverse-proxy/document-root target after a configuration test, not DNS changes. If using another server, prepare A/AAAA/www records and coordinate TTL/cutover. Preserve MX/SPF/DKIM/DMARC and nameservers unless a separately planned mail/DNS change is required.
7. **Verify externally:** domain/www/TLS, deep-link refresh, owner login, activation links, employee restrictions, a controlled assignment, quote delivery and exports, from desktop and phone. Monitor errors and latency.
8. **Rollback:** retain the previous site's routing/release; ensure reverting application code is compatible with the migrated schema. Do not improvise destructive down migrations or restore an old DB over newly received customer data.

Production backups must include PostgreSQL and relevant private configuration, be encrypted with an off-server copy and an agreed retention/recovery objective. Restore into a separate DB and verify accounts, assignments, balances and stored closed PDFs. Confirm the actual OVH backup option rather than assuming it is enabled or sufficient.

References: [OVH VPS security responsibilities](https://support.us.ovhcloud.com/hc/en-us/articles/4412351365139-How-to-secure-a-VPS), [OVH backup/restoration](https://support.us.ovhcloud.com/hc/en-us/articles/360012678619-How-to-use-automated-backups-on-a-VPS).

## Final verification addendum

- Backend: **24 unit suites / 133 tests passed**, build and lint passed. A new configuration regression also caught and fixed numeric `.env` strings not being converted for default-valued port/limit overrides.
- Isolated integration final repeat: **3 suites / 9 tests passed**, all ten migrations applied to an empty disposable database and only that database was removed afterwards. PostgreSQL/Prisma report a non-failing `pg` concurrent-client-query deprecation warning; do not ignore it when planning a future pg major upgrade.
- Frontend: **47 unit/rendered-output tests passed**, production build, TypeScript and lint passed.
- Full Cypress run: **83/84 passed** initially. The one failure was the old invitation-form assertion demanding a required email, contrary to the new requested optional-email workflow. After correcting that assertion, the affected invitation spec and all four new ID/quote/desktop/mobile tests were rerun together: **5/5 passed**. All 84 distinct scenarios have a passing result across these runs; the entire 24-spec campaign was not rerun a second time after the assertion-only change. Browser mutation requests were mocked.
- The upgraded local API's readiness endpoint returned `ready` / database `reachable`; counts and code uniqueness were checked read-only. Git whitespace check passed. No generated backup, browser screenshots, credentials or generated Prisma client were staged or committed.

SMTP delivery, the new OWNER/MANAGER authorization model and OVH cutover remain pending. The application is not approved for public release until the remaining dependency and infrastructure audit gates are addressed.
