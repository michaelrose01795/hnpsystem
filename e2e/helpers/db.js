// file location: e2e/helpers/db.js
// Database helpers for E2E tests.
// Uses the Supabase service client to read/write test data and verify linked state.

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

// Lazy-initialised so that importing this module does not throw when DB
// credentials are absent (e.g. smoke tests running in CI without a real DB).
let _client = null;

function getDb() {
  if (!_client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env. ' +
        'These are required for DB test helpers.'
      );
    }
    _client = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _client;
}

/** Service-role Supabase client — bypasses RLS for test assertions */
const db = new Proxy({}, {
  get(_target, prop) {
    return getDb()[prop];
  },
});

// ---------------------------------------------------------------------------
// Query helpers — use these in tests to assert DB state
// ---------------------------------------------------------------------------

/** Get a job by job_number */
async function getJob(jobNumber) {
  const { data, error } = await db
    .from('jobs')
    .select('*')
    .eq('job_number', jobNumber)
    .single();
  if (error) throw new Error(`getJob(${jobNumber}): ${error.message}`);
  return data;
}

/** Get all job requests for a job */
async function getJobRequests(jobId) {
  const { data, error } = await db
    .from('job_requests')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`getJobRequests(${jobId}): ${error.message}`);
  return data;
}

/** Get VHC checks for a job */
async function getVhcChecks(jobId) {
  const { data, error } = await db
    .from('vhc_checks')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`getVhcChecks(${jobId}): ${error.message}`);
  return data;
}

/** Get parts allocated to a job */
async function getJobParts(jobId) {
  const { data, error } = await db
    .from('parts_job_items')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`getJobParts(${jobId}): ${error.message}`);
  return data;
}

/** Get job status history */
async function getStatusHistory(jobId) {
  const { data, error } = await db
    .from('job_status_history')
    .select('*')
    .eq('job_id', jobId)
    .order('changed_at', { ascending: true });
  if (error) throw new Error(`getStatusHistory(${jobId}): ${error.message}`);
  return data;
}

/** Get invoices for a job */
async function getJobInvoices(jobNumber) {
  const { data, error } = await db
    .from('invoices')
    .select('*')
    .eq('job_id', jobNumber);
  if (error) throw new Error(`getJobInvoices(${jobNumber}): ${error.message}`);
  return data;
}

/** Get job write-ups */
async function getWriteUps(jobId) {
  const { data, error } = await db
    .from('job_writeups')
    .select('*')
    .eq('job_id', jobId);
  if (error) throw new Error(`getWriteUps(${jobId}): ${error.message}`);
  return data;
}

/** Get job clocking entries */
async function getJobClocking(jobId) {
  const { data, error } = await db
    .from('job_clocking')
    .select('*')
    .eq('job_id', jobId)
    .order('clock_in', { ascending: true });
  if (error) throw new Error(`getJobClocking(${jobId}): ${error.message}`);
  return data;
}

/** Get a user by user_id */
async function getUser(userId) {
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) throw new Error(`getUser(${userId}): ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

/** Delete a job and all linked records by job_number */
async function cleanupTestJob(jobNumber) {
  const { data: job } = await db
    .from('jobs')
    .select('id')
    .eq('job_number', jobNumber)
    .single();

  if (!job) return;

  const jobId = job.id;
  const tables = [
    'job_clocking', 'job_writeups', 'job_notes', 'job_files',
    'job_status_history', 'vhc_checks', 'vhc_workflow_status',
    'parts_job_items', 'job_requests',
  ];

  for (const table of tables) {
    await db.from(table).delete().eq('job_id', jobId);
  }
  await db.from('jobs').delete().eq('id', jobId);
}

/** Insert a test job with minimal required fields */
async function createTestJob(overrides = {}) {
  const jobNumber = overrides.job_number || `TEST-${Date.now()}`;
  const { data, error } = await db
    .from('jobs')
    .insert({
      job_number: jobNumber,
      status: 'New',
      description: 'Automated test job',
      type: 'Service',
      ...overrides,
    })
    .select()
    .single();
  if (error) throw new Error(`createTestJob: ${error.message}`);
  return data;
}

module.exports = {
  db,
  getJob,
  getJobRequests,
  getVhcChecks,
  getJobParts,
  getStatusHistory,
  getJobInvoices,
  getWriteUps,
  getJobClocking,
  getUser,
  cleanupTestJob,
  createTestJob,
};
