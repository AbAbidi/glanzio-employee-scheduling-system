import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
const files = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
const secrets = [];
for (const file of ['backend/.env', 'frontend/.env', 'frontend/.env.local']) {
  let data;
  try { data = readFileSync(resolve(root, file), 'utf8'); } catch { continue; }
  for (const line of data.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_0-9]*(?:SECRET|PASSWORD|TOKEN|DATABASE_URL)[A-Z_0-9]*)\s*=\s*(.+)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    if (value.length >= 12) secrets.push(value);
    if (match[1].includes('DATABASE_URL')) {
      try { const password = decodeURIComponent(new URL(value).password); if (password.length >= 8) secrets.push(password); } catch { /* Invalid local URLs are checked by application configuration validation. */ }
    }
  }
}
const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ['aws-access-key', /\bAKIA[A-Z0-9]{16}\b/],
];
const findings = [];
let scannedHistoryBlobs = 0;
let scanned = 0;
for (const file of files) {
  const path = resolve(root, file);
  let bytes;
  try { if (statSync(path).size > 2_000_000) continue; bytes = readFileSync(path); } catch { continue; }
  if (bytes.includes(0)) continue;
  scanned++;
  const data = bytes.toString('utf8');
  for (const [index, line] of data.split(/\r?\n/).entries()) {
    for (const [rule, pattern] of patterns) if (pattern.test(line)) findings.push({ file, line: index + 1, rule });
    if (secrets.some(secret => line.includes(secret))) findings.push({ file, line: index + 1, rule: 'local-environment-secret' });
  }
  if (/(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.env.example')) findings.push({ file, rule: 'environment-file-in-push' });
  if (/\.(pem|key|p12|pfx|dump|backup|bak)$/i.test(file)) findings.push({ file, rule: 'private-file-in-push' });
}
if (process.argv.includes('--history')) {
  const objects = git(['rev-list', '--objects', '--all']).split('\n').map(line => {
    const separator = line.indexOf(' ');
    return separator < 0 ? null : { hash: line.slice(0, separator), path: line.slice(separator + 1) };
  }).filter(item => item && !/\.(png|jpe?g|webp|avif|gif|ico|pdf|mp4|woff2?|ttf|zip|dump)$/i.test(item.path));
  if (objects.length) {
    const batch = execFileSync('git', ['cat-file', '--batch'], { cwd: root, input: objects.map(item => item.hash).join('\n') + '\n', maxBuffer: 128 * 1024 * 1024 });
    let offset = 0;
    for (const object of objects) {
      const end = batch.indexOf(10, offset);
      const [, type, length] = batch.subarray(offset, end).toString('utf8').split(' ');
      const size = Number(length);
      if (!Number.isSafeInteger(size) || size < 0) throw new Error('Unexpected git object response.');
      const body = batch.subarray(end + 1, end + 1 + size); offset = end + 2 + size;
      if (type !== 'blob' || size > 2_000_000 || body.includes(0)) continue;
      scannedHistoryBlobs++;
      for (const [index, line] of body.toString('utf8').split(/\r?\n/).entries()) {
        for (const [rule, pattern] of patterns) if (pattern.test(line)) findings.push({ file: object.path, object: object.hash, line: index + 1, rule: `history-${rule}` });
        if (secrets.some(secret => line.includes(secret))) findings.push({ file: object.path, object: object.hash, line: index + 1, rule: 'history-local-environment-secret' });
      }
      if (/(^|\/)\.env(?:\.|$)/.test(object.path) && !object.path.endsWith('.env.example')) findings.push({ file: object.path, object: object.hash, rule: 'historical-environment-file' });
    }
  }
}
const remotes = git(['remote', '-v']).split('\n').filter(Boolean).map(line => {
  const [name, address, operation] = line.split(/\s+/);
  let safe = address;
  try { const parsed = new URL(address); parsed.username = ''; parsed.password = ''; parsed.search = ''; safe = parsed.toString(); } catch { /* SSH remote */ }
  return { name, address: safe, operation };
});
console.log(JSON.stringify({ scannedTextFiles: scanned, scannedHistoryBlobs, findings, remotes, scope: 'Common token patterns and exact local environment secret matches in eligible current text and (with --history) reachable historical text blobs under 2 MB. Not an entropy scan or proof that no sensitive data exists.' }, null, 2));
if (findings.length) process.exitCode = 1;
