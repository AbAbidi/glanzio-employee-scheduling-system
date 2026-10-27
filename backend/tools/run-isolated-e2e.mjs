import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

// Never let AppModule's startup reconciliation/closure jobs run E2E against
// application data. Only this newly-created local database can be dropped.
const root = fileURLToPath(new URL('../', import.meta.url));
const source = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(source.hostname) || process.env.NODE_ENV === 'production') {
  throw new Error('Isolated E2E requires a non-production local PostgreSQL connection.');
}
const name = `esms_audit_${new Date().toISOString().slice(0,10).replaceAll('-','')}_${randomBytes(6).toString('hex')}`;
if (!/^esms_audit_\d{8}_[a-f0-9]{12}$/.test(name) || source.pathname === `/${name}`) {
  throw new Error('Invalid disposable test database target.');
}
const target = new URL(source);
target.pathname = `/${name}`;
const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: target.toString(),
  E2E_DATABASE_URL: target.toString(),
  JWT_ACCESS_SECRET: randomBytes(48).toString('hex'),
  JWT_ACCESS_EXPIRES_IN: '15m',
  REFRESH_TOKEN_EXPIRES_IN_DAYS: '30',
  CORS_ORIGIN: 'http://localhost:5173',
  ALLOW_TEST_WORKSPACE_RESET: 'false',
};
const admin = new Client({ connectionString: source.toString() });
let created = false;
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  console.log(`Created isolated E2E database ${name}. Application data is not used.`);
  const migrate = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { cwd: root, env, stdio: 'inherit' });
  if (migrate.status !== 0) process.exitCode = migrate.status ?? 1;
  else {
    const test = spawnSync(process.execPath, ['--require', './test/require-test-database.cjs', '--experimental-vm-modules', './node_modules/jest/bin/jest.js', '--config', './test/jest-e2e.json', '--runInBand'], { cwd: root, env, stdio: 'inherit' });
    process.exitCode = test.status ?? 1;
  }
} finally {
  if (created) {
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    console.log(`Removed only the disposable E2E database ${name}.`);
  }
  await admin.end();
}
