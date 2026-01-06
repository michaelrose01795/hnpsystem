// Script to run database migration
// Usage: node scripts/run-migration.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase credentials');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Running migration: add-display-status-column');

  const sql = `
    -- Add display_status column to vhc_checks table
    ALTER TABLE public.vhc_checks
    ADD COLUMN IF NOT EXISTS display_status text
    CHECK (display_status IS NULL OR display_status IN ('red', 'amber', 'green', 'authorized', 'declined'));
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('Migration failed:', error.message);
      console.log('\nPlease run this SQL manually in Supabase Dashboard:');
      console.log('---');
      console.log(sql);
      console.log('---');
      process.exit(1);
    }

    console.log('✓ Migration completed successfully');
    console.log('✓ display_status column added to vhc_checks table');
  } catch (err) {
    console.error('Error running migration:', err.message);
    console.log('\nPlease run this SQL manually in Supabase Dashboard > SQL Editor:');
    console.log('---');
    console.log(sql);
    console.log('---');
    process.exit(1);
  }
}

runMigration();
