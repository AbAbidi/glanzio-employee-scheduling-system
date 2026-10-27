import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

// Vinext 0.0.50 caches native Windows paths as URL keys. Normalize only the
// relative cache key; file paths, traversal checks and access controls stay intact.
// This narrowly scoped install-time compatibility patch is unnecessary on Linux.
if (process.platform === 'win32') {
  const dist = dirname(fileURLToPath(import.meta.resolve('vinext')));
  const packageInfo = JSON.parse(readFileSync(resolve(dist, '../package.json'), 'utf8'));
  const target = resolve(dist, 'server/static-file-cache.js');
  const original = 'relativePath: path.relative(base, batch[j]),';
  const corrected = 'relativePath: path.relative(base, batch[j]).split(path.sep).join("/"),';
  const source = readFileSync(target, 'utf8');
  if (source.includes(corrected)) console.log('Vinext Windows static cache compatibility patch already applied.');
  else {
    if (packageInfo.version !== '0.0.50' || source.split(original).length !== 2) throw new Error('Review the Vinext Windows cache patch for this installed version before continuing.');
    writeFileSync(target, source.replace(original, corrected));
    console.log('Applied Vinext 0.0.50 Windows URL cache-key normalization.');
  }
}
