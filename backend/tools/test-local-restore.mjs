import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

// A restore drill may create/drop only its own random database, never the source.
const root = fileURLToPath(new URL('../', import.meta.url));
const source = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(source.hostname) || process.env.NODE_ENV === 'production') throw new Error('Local non-production database required.');
const backup = realpathSync(resolve(process.argv[2] ?? ''));
const allowed = realpathSync(fileURLToPath(new URL('../../tmp/db-backups/', import.meta.url)));
if (dirname(backup).toLowerCase() !== allowed.toLowerCase() || !backup.endsWith('.dump')) throw new Error('Use an explicit private local backup under tmp/db-backups.');
const name = `esms_restore_${randomBytes(12).toString('hex')}`;
if (!/^esms_restore_[a-f0-9]{24}$/.test(name) || source.pathname === `/${name}`) throw new Error('Invalid restore database target.');
const target = new URL(source); target.pathname = `/${name}`;
const env = { ...process.env, PGHOST: source.hostname, PGPORT: source.port || '5432', PGUSER: decodeURIComponent(source.username), PGPASSWORD: decodeURIComponent(source.password), PGDATABASE: name, DATABASE_URL: target.toString() };
const admin = new Client({ connectionString: source.toString() });
let created = false;
let restored;
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`); created = true;
  const binary = `${process.env.POSTGRES_BIN || 'C:/Program Files/PostgreSQL/18/bin'}/pg_restore.exe`;
  const result = spawnSync(binary, ['--no-owner', '--no-acl', '--exit-on-error', '--dbname', name, backup], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) throw new Error('Restore failed; private diagnostic output was not printed.');
  const migrate = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  if (migrate.status !== 0) throw new Error('Restored-data migration failed; no application database was modified.');
  restored = new Client({ connectionString: target.toString() }); await restored.connect();
  const counts = await restored.query('SELECT (SELECT count(*) FROM "User")::int AS users, (SELECT count(*) FROM "Employee")::int AS employees, (SELECT count(*) FROM "WorkAssignment")::int AS assignments');
  const schema = await restored.query(`SELECT count(*)::int AS auth_version_columns FROM information_schema.columns WHERE table_name='User' AND column_name='authVersion'`);
  if (schema.rows[0].auth_version_columns !== 1) throw new Error('Upgraded schema verification failed.');
  console.log(JSON.stringify({ restoredAndMigrated: true, restoredCounts: counts.rows[0], sourceDatabaseChanged: false }));
} finally {
  if (restored) await restored.end();
  if (created) { await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`); console.log('Removed only the disposable restore-drill database.'); }
  await admin.end();
}
