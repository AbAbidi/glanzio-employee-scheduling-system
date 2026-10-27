const testUrl = process.env.E2E_DATABASE_URL;
if (!testUrl) {
  throw new Error('E2E_DATABASE_URL is required. Use npm run test:e2e:isolated for a disposable local test database.');
}
const parsed = new URL(testUrl);
const name = decodeURIComponent(parsed.pathname.slice(1));
if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !/^(?:[a-z0-9_]+_(?:test|ci)|esms_audit_\d{8}_[a-f0-9]{12})$/i.test(name) || process.env.NODE_ENV === 'production') {
  throw new Error('E2E refuses a production or non-test database name.');
}
process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'test';
