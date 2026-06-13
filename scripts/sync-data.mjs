import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const envFlag = existsSync('.env') ? ' --env-file=.env' : '';

const tasks = [
  'scripts/generate-item-index.mjs',
  'scripts/generate-scroll-index.mjs',
  'scripts/generate-item-level-up-index.mjs',
];

let failed = false;

for (const task of tasks) {
  console.log(`\n=== ${task} ===`);
  try {
    execSync(`node${envFlag} ${task}`, { stdio: 'inherit' });
  } catch {
    failed = true;
    console.error(`✗ ${task} failed`);
  }
}

if (failed) {
  console.error('\n✗ sync:data failed — some tasks did not complete.');
  process.exit(1);
}

console.log('\n✓ sync:data complete');
