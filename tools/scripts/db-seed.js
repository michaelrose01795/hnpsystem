#!/usr/bin/env node
// file location: tools/scripts/db-seed.js
// Seeds the database with test data for E2E tests.
// Usage: npm run db:seed

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

dotenv.config({ path: resolve(root, '.env') });
dotenv.config({ path: resolve(root, '.env.local'), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sqlFile = resolve(root, 'supabase/seed/test-seed.sql');
const sql = readFileSync(sqlFile, 'utf-8');

// Split by semicolons and run each statement
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`Running ${statements.length} seed statements...`);

let success = 0;
let failed = 0;

for (const stmt of statements) {
  const { error } = await db.rpc('', {}).then(() => ({ error: null })).catch(() => ({ error: 'rpc not available' }));
  // Use the Supabase REST API to execute raw SQL via the postgrest rpc
  // Since Supabase JS client does not support raw SQL, we use fetch directly
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ query: stmt }),
  });

  // Fallback: use the SQL endpoint if available
  if (!res.ok) {
    // Try the management API SQL endpoint
    const sqlRes = await fetch(`${supabaseUrl}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ query: stmt + ';' }),
    });

    if (sqlRes.ok) {
      success++;
    } else {
      // Last resort: just log and continue
      const firstLine = stmt.split('\n').find(l => l.trim()) || stmt.slice(0, 60);
      console.warn(`  Warning: Could not execute: ${firstLine}...`);
      failed++;
    }
  } else {
    success++;
  }
}

console.log(`Seed complete: ${success} succeeded, ${failed} warnings`);
if (failed > 0) {
  console.log('\nNote: If statements failed, run the SQL manually:');
  console.log('  1. Open Supabase Dashboard → SQL Editor');
  console.log('  2. Paste the contents of supabase/seed/test-seed.sql');
  console.log('  3. Run the query');
}
