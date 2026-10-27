# Employee access, owner/manager permissions and future releases

## Implemented update — 27 October 2026 (supersedes the proposal below)

The approved model is implemented: existing `ADMIN` means owner; new `MANAGER` means **Admin / Gestionnaire**, linked to a standard non-student employee profile. Ordinary `EMPLOYEE` permissions stay restricted. No existing account was promoted automatically and no owner email was changed.

- Managers can use the operational overview, employee/client/site management, scheduling/recurrence, employee analysis and internal reports. They can be assigned work using their own employee profile and log in with their six-character ID/password, not contact email.
- Audit logs, feedback moderation, archives (including direct IDs and `active=false` queries), restore/archive/status actions, test resets, role grants, password resets and invitation replacement remain owner-only. Managers can create ordinary employee invitations but cannot create another manager or modify privileged profiles through the team editor. Their own profile/password uses normal self-service settings.
- Owners can choose `Admin / Gestionnaire` when creating a non-student employee, or use the explicit access control on an existing standard employee. Role changes preserve employee UUID/code/history, write an audit event, increment `authVersion` and revoke refresh sessions atomically. Old access JWTs are rejected immediately. Repeating the same role is a no-op, not another grant.
- The local additive migration was backed up and tested both on an empty disposable DB and on a restored copy of existing data. Application counts remain 8 users, 7 employees and 24 assignments. Backup files stay private in ignored `tmp/db-backups`; no OVH service was touched.

Current evidence and release instructions: [27 October readiness report](manager-readiness-2026-10-27.md). The older proposal and test counts below are historical, not the current implementation status.

## Implemented locally — 26 October 2026

- Employee login now accepts only the unique six-character ID (three letters + three digits) and password. Lowercase entry is normalized; employee email is rejected in both login request contracts. Admin email login remains supported. No role is inferred from an email address.
- Numeric IDs were converted through a new reviewed migration, not by changing previous applied migrations. The mapping is deterministic (for example `000007` → `AAA007`); the sequence is not reused or cycled. UUIDs and historical relationships remain unchanged. The example `AMT359` shows the required format, not a promised ID for a specific employee.
- The employee's ID is shown prominently in a bright-green panel on their own dashboard and profile. The header prefers the ID over contact email. Login label: `Identifikationsnummer oder E-Mail-Adresse`.
- Calendar events now use bright green (completed), yellow (pending), blue (in progress), red (cancelled), with dark contrasting text and the existing explicit status labels.
- Before the local conversion, a Git-ignored private backup was created and archive-format checked. The database retained 8 users, 7 employees and 24 assignments. Read-only verification afterwards found 7 distinct, valid alphanumeric IDs and no conflicting employee-time pairs. The running local API returned ready/reachable.
- No passwords, account roles, administrator email, PDFs, OVH settings or production records were changed. No hidden login, root user or authentication bypass was created.

Verification: backend unit suite (133 tests), real PostgreSQL integration (11 tests), frontend unit/rendered-output suite (47 tests), and new/affected browser spec (7 tests, including desktop/mobile checks) passed. Both builds, both lints and frontend TypeScript passed. The new migration was also applied to an empty disposable database. Other browser specs were not rerun in this turn.

## Historical owner / manager proposal (now implemented as described above)

Interpretation to confirm: “manager/employee” means a manager who also has a linked worker profile, not every ordinary employee receiving the company's full operational/financial dashboard.

| Capability | OWNER | MANAGER with employee profile | Ordinary EMPLOYEE |
| --- | --- | --- | --- |
| Company overview and business figures | Yes | Yes, as requested | Own permitted figures only |
| Employees, clients, sites, assignments and operational exports | Yes | Yes, subject to agreed field/action permissions | Own authorized information only |
| Assign work to own worker profile | If linked to a profile | Yes, normal non-student accounting | No scheduling administration |
| Archived data, restoration, feedback moderation | Yes | No | No |
| Role grants, security settings, audit logs | Yes | No (recommended; confirm) | No |

Implementation plan after approval:

1. Introduce explicit OWNER/MANAGER permissions and link the manager's personal account to a normal employee profile. Keep employment type independent of access rights.
2. Owner account uses the verified official business email, not an email-based privilege shortcut. Manager uses their unique employee ID/password. Every human keeps a separate identity; no shared passwords or impersonated accounts.
3. Apply authorization to every relevant backend endpoint and field, including export/archive/feedback routes; hiding navigation is only the UI layer. Prevent managers from granting themselves owner rights or using status/delete endpoints to bypass archive restrictions.
4. Show the manager the authorized operational dashboard, hide forbidden actions and preserve ordinary employee scope. Agree whether the manager may archive at all, see financial rates, or edit their own agreed rates/completed work. Do not silently grant these as a side effect of “same dashboard”.
5. Add positive and negative tests for each role, direct URLs/API calls, object-ID substitution and self-escalation. Recheck roles from the DB; revoke/refresh sessions when permission changes require it. Preserve actor IDs in audit history.
6. Migrate only explicitly selected real accounts to new roles. Do not automatically promote every existing ADMIN or rename the developer account into the business owner's identity.

This was the earlier proposal. Current source has `ADMIN`, `MANAGER`, `EMPLOYEE`; `ADMIN` is retained as owner for compatibility.

Reference: [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## Technical access is not a backdoor

A technical administrator can receive documented, revocable application permissions and a personal server account with SSH keys and approved sudo rights. This avoids asking a human for each action already covered by that role. The login must still authenticate the named person; a username such as `root` confers no rights by itself. A hidden URL/click sequence may only be a shortcut to a protected login, never a bypass. Prefer MFA/passkeys for sensitive access. None are implemented by this change.

OVH control-panel identity, Linux/SSH identity, database role and application identity are separate. For a VPS/dedicated server, OVH provides the infrastructure; the customer administers the OS/application unless a managed service explicitly provides otherwise. Delegate the needed OVH actions through personal identities/IAM, not the owner's shared password. Create a separate personal SSH account and public key; keep the application process non-root. Do not grant a web application root privileges to make its dashboard “super admin”.

Whether OVH access gives database control depends on the product and granted actions. A limited OVH user may only view/reboot a service. Full infrastructure control can provide indirect access to a self-hosted DB through recovery/OS access, even though the website/database have separate logins. Managed databases have their own access controls. Verify the actual service and delegation before claiming “full access”. Rescue/reinstallation can interrupt service or destroy data and are not routine access-setup methods.

References: [OVH IAM delegation](https://docs.ovhcloud.com/en/guides/account-and-service-management/account-information/iam-policy-ui), [OVH server accounts/sudo](https://support.us.ovhcloud.com/hc/en-us/articles/43778050006419-How-to-configure-user-accounts-and-root-access-on-a-server), [OVH database recovery](https://docs.ovhcloud.com/en/guides/bare-metal-cloud/dedicated-servers/restore-bdd-rescue).

## Adding features after launch

Production = the live service used by real visitors. Development = the local working environment. Staging/preproduction = a protected production-like test deployment with separate DB, credentials and safe test data. Never reuse production SMTP or customer data casually in staging.

Workflow: dedicated Git branch → local automated tests → reviewed change/CI → staging → business/technical validation → versioned production release → health/monitoring checks.

- Each new feature begins locally/on its own branch; do not edit live server files as the normal workflow.
- Test schema/API/UI/role behavior in staging. With shared physical infrastructure, isolate processes/DB/secrets and avoid stress testing that affects production.
- Use backward-compatible database migrations; back up first. Avoid dropping/renaming columns still needed by the previous release. Do not seed/reset a live DB for testing.
- Deploy a built, identifiable release with the correct environment settings; retain a compatible previous release and rollback procedure. A DB restore must not overwrite legitimate new customer data without an explicit recovery decision.
- Monitor failures after launch. Urgent fixes follow the same pipeline with a smaller reviewed change; feature flags can separate deployment from user-visible activation.
- CI/CD environments can restrict deployment branches, secrets and approvals. The repository currently has GitLab CI configuration; select and test the actual pipeline provider before enabling automatic deployments.

Reference: [Deployment environment separation and protection](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments).

## Remaining release gates

Real Email Pro verification, infrastructure inventory, staging, an OVH backup/restore drill and production cutover remain pending. Local dependency remediation, manager authorization and a local backup restore/migration drill were completed on 27 October; see the current report for verification limits. No OVH action was executed by this local feature change.
