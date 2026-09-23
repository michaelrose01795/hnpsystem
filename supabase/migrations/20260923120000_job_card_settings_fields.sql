-- Job Card Settings control centre (/job-cards/[jobNumber] → settings popup).
--
-- The popup edits everything it can through columns that already exist
-- (status, type, job_source, job_division, waiting_status, assigned_to,
-- vhc_required, next_update_due, vehicle_id, milage …). This migration adds
-- ONLY the four facts that had nowhere to live on public.jobs:
--
--   * priority                     how urgently the job should be handled
--   * service_advisor_id           the advisor who owns the job day to day
--                                  (booked_by stays the historic "who booked
--                                  it" fact and is never rewritten)
--   * next_update_owner_id         who is responsible for the next customer
--                                  update (next_update_due already exists)
--   * next_update_reminder_enabled whether that update is flagged as a reminder
--
-- Every column is nullable or defaulted, so existing rows and every existing
-- insert keep working unchanged. Until this runs, the settings API reports
-- `migrationPending` and the popup explains why those four controls are
-- unavailable; nothing else on the job card depends on these columns.
--
-- Rollback: supabase/rollbacks/20260923120000_job_card_settings_fields_down.sql

BEGIN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS service_advisor_id integer,
  ADD COLUMN IF NOT EXISTS next_update_owner_id integer,
  ADD COLUMN IF NOT EXISTS next_update_reminder_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_priority_check;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_priority_check CHECK (
    priority = ANY (ARRAY[
      'normal'::text,
      'priority'::text,
      'urgent'::text,
      'vehicle_waiting'::text,
      'comeback'::text
    ])
  );

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_service_advisor_id_fkey;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_service_advisor_id_fkey
  FOREIGN KEY (service_advisor_id) REFERENCES public.users(user_id) ON DELETE SET NULL;

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_next_update_owner_id_fkey;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_next_update_owner_id_fkey
  FOREIGN KEY (next_update_owner_id) REFERENCES public.users(user_id) ON DELETE SET NULL;

-- Workshop boards sort and filter the open queue by priority.
CREATE INDEX IF NOT EXISTS jobs_priority_idx
  ON public.jobs (priority)
  WHERE priority <> 'normal';

COMMIT;
