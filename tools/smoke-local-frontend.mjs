// Read-only smoke checks for a separately started local production build.
const base = new URL(process.argv[2] || 'http://127.0.0.1:5174');
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('This helper is restricted to a local frontend.');
let home = '';
for (const path of ['/', '/login', '/dashboard', '/dashboard/employees', '/dashboard/profile']) {
  const response = await fetch(new URL(path, base));
  const body = await response.text();
  const html = (response.headers.get('content-type') || '').includes('text/html');
  console.log(JSON.stringify({ path, status: response.status, html }));
  if (response.status !== 200 || !html) process.exitCode = 1;
  if (path === '/') home = body;
}
const assets = [...new Set([...home.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]))]
  .map(path => new URL(path, base)).filter(url => url.origin === base.origin && url.pathname.startsWith('/assets/')).slice(0, 3);
if (!assets.length) throw new Error('No compiled local assets found in the homepage.');
for (const url of assets) {
  const response = await fetch(url);
  console.log(JSON.stringify({ asset: url.pathname, status: response.status }));
  if (!response.ok) process.exitCode = 1;
}
for (const path of ['/.env', '/.vite/manifest.json', '/.vite%2fmanifest.json']) {
  const response = await fetch(new URL(path, base));
  console.log(JSON.stringify({ privatePath: path, status: response.status }));
  if (![400, 404].includes(response.status)) process.exitCode = 1;
}
