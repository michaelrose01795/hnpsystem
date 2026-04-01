#!/usr/bin/env node
// file location: scripts/verify.js
// One-command verification script for HNP System.
// Usage: npm run verify
//
// Runs: lint → smoke tests → workflow tests → visual tests → report

import { execSync } from 'child_process';

const steps = [
  { name: 'Lint', cmd: 'npm run lint', required: false },
  { name: 'Smoke tests', cmd: 'npx playwright test --project=auth-setup --project=smoke', required: true },
  { name: 'Workflow tests', cmd: 'npx playwright test --project=auth-setup --project=workflows', required: true },
  { name: 'Visual tests', cmd: 'npx playwright test --project=auth-setup --project=visual', required: false },
];

console.log('='.repeat(60));
console.log('  HNP System — Verification');
console.log('='.repeat(60));
console.log();

const results = [];

for (const step of steps) {
  console.log(`▸ ${step.name}...`);
  try {
    execSync(step.cmd, { stdio: 'inherit', env: { ...process.env, FORCE_COLOR: '1' } });
    results.push({ name: step.name, status: 'PASS' });
    console.log(`  ✓ ${step.name} passed\n`);
  } catch (err) {
    results.push({ name: step.name, status: 'FAIL' });
    console.log(`  ✗ ${step.name} failed\n`);
    if (step.required) {
      console.log(`  ${step.name} is required — stopping verification.\n`);
      break;
    }
  }
}

console.log('='.repeat(60));
console.log('  Results');
console.log('='.repeat(60));
for (const r of results) {
  const icon = r.status === 'PASS' ? '✓' : '✗';
  console.log(`  ${icon} ${r.name}: ${r.status}`);
}

const allPassed = results.every(r => r.status === 'PASS');
console.log();
console.log(allPassed ? '  All checks passed.' : '  Some checks failed.');
console.log();
console.log('  HTML report: npx playwright show-report');
console.log('='.repeat(60));

process.exit(allPassed ? 0 : 1);
