import fs from 'node:fs';

const lockfile = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const allowed = new Set([
  'node_modules/@scarf/scarf',
  'node_modules/core-js',
  'node_modules/esbuild',
  'node_modules/fsevents',
]);

const unexpected = Object.entries(lockfile.packages)
  .filter(([path, meta]) => meta?.hasInstallScript && !allowed.has(path))
  .map(([path, meta]) => `${path} ${meta.version ?? ''}`.trim());

if (unexpected.length) {
  console.error('Unexpected install scripts found in dependency tree:');
  for (const entry of unexpected) console.error(`- ${entry}`);
  process.exit(1);
}

console.log('Install-script check passed.');
