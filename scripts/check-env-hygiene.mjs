import { execFileSync } from 'node:child_process';

const trackedEnvFiles = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((file) => /(^|\/)\.env(\.|$)|(^|\/)\.docker\.env(\.|$)/.test(file))
  .filter((file) => !file.endsWith('.example'));

if (trackedEnvFiles.length > 0) {
  console.error('Sensitive environment files are tracked by git:');
  for (const file of trackedEnvFiles) console.error(`- ${file}`);
  process.exit(1);
}

console.log('Environment-file hygiene check passed.');
