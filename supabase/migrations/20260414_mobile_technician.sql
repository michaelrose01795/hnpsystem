-- file location: supabase/migrations/20260414_mobile_technician.sql
-- Migration: mobile technician feature
-- Adds service_mode + on-site visit metadata to jobs, extends parts pipeline with 'loaded'/'unavailable' statuses,
-- and introduces mobile redirect audit columns. All columns have safe defaults so existing rows remain 'workshop'.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- 1. jobs — service mode + on-site visit fields + redirect audit
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS service_mode text NOT NULL DEFAULT 'workshop',
  ADD COLUMN IF NOT EXISTS service_address text,
  ADD COLUMN IF NOT EXISTS service_postcode text,
  ADD COLUMN IF NOT EXISTS service_contact_name text,
  ADD COLUMN IF NOT EXISTS service_contact_phone text,
  ADD COLUMN IF NOT EXISTS appointment_window_start timestamptz,
  ADD COLUMN IF NOT EXISTS appointment_window_end timestamptz,
  ADD COLUMN IF NOT EXISTS access_notes text,
  ADD COLUMN IF NOT EXISTS mobile_outcome text,
  ADD COLUMN IF NOT EXISTS mobile_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS redirected_from_mobile_at timestamptz,
  ADD COLUMN IF NOT EXISTS redirected_from_mobile_by integer REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS redirect_reason text;

-- Constrain service_mode values (drop existing to stay idempotent).
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_service_mode_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_service_mode_check
  CHECK (service_mode IN ('workshop', 'mobile'));

-- Constrain mobile_outcome values when set.
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_mobile_outcome_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_mobile_outcome_check
  CHECK (mobile_outcome IS NULL OR mobile_outcome IN (
    'completed_onsite',
    'follow_up_required',
    'redirected_to_workshop',
    'unable_to_complete'
  ));

-- Indexes to keep mobile-tech dashboards fast without impacting workshop queries.
CREATE INDEX IF NOT EXISTS idx_jobs_service_mode ON jobs(service_mode);
CREATE INDEX IF NOT EXISTS idx_jobs_mobile_assigned
  ON jobs(assigned_to, service_mode)
  WHERE service_mode = 'mobile';
CREATE INDEX IF NOT EXISTS idx_jobs_mobile_window_start
  ON jobs(appointment_window_start)
  WHERE service_mode = 'mobile';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. parts_job_items — add 'loaded' (on van) and 'unavailable' statuses
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE parts_job_items DROP CONSTRAINT IF EXISTS parts_job_items_status_check;
ALTER TABLE parts_job_items ADD CONSTRAINT parts_job_items_status_check
  CHECK (status IN (
    'pending',
    'waiting_authorisation',
    'awaiting_stock',
    'on_order',
    'booked',
    'allocated',
    'pre_picked',
    'picked',
    'loaded',
    'stock',
    'fitted',
    'cancelled',
    'removed',
    'unavailable'
  ));

COMMIT;
