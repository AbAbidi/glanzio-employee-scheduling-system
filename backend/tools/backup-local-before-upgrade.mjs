import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const target = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || process.env.NODE_ENV === 'production') {
  throw new Error('Backup helper is limited to the local non-production database.');
}
const directory = fileURLToPath(new URL('../../tmp/db-backups/', import.meta.url));
mkdirSync(directory, { recursive: true });
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const output = `${directory}before-readiness-${stamp}.dump`;
const env = { ...process.env, PGHOST: target.hostname, PGPORT: target.port || '5432', PGDATABASE: decodeURIComponent(target.pathname.slice(1)), PGUSER: decodeURIComponent(target.username), PGPASSWORD: decodeURIComponent(target.password) };
const binaryDirectory = process.env.POSTGRES_BIN || 'C:/Program Files/PostgreSQL/18/bin';
const dumped = spawnSync(`${binaryDirectory}/pg_dump.exe`, ['--format=custom', '--no-owner', '--no-acl', `--file=${output}`], { env, stdio: ['ignore', 'pipe', 'pipe'] });
if (dumped.status !== 0) throw new Error('Local pg_dump failed; no migration should run.');
const checked = spawnSync(`${binaryDirectory}/pg_restore.exe`, ['--list', output], { env, stdio: ['ignore', 'pipe', 'pipe'] });
if (checked.status !== 0 || statSync(output).size === 0) throw new Error('Backup format verification failed.');
console.log(JSON.stringify({ backup: output, bytes: statSync(output).size, verifiedArchiveFormat: true, note: 'Contains private local application data. Keep out of Git and shared artifacts. This is not a restore drill.' }));
