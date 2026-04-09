-- Migration: 002_job_files_storage_columns
-- Purpose: Add missing columns to job_files for unified file-storage strategy.
--
-- visible_to_customer — controls customer portal visibility (was referenced in
--   code but never existed in the schema; customer portal queries were silently
--   returning empty results).
-- file_size           — bytes; needed for UI display and quota enforcement.
-- storage_type        — 'supabase' | 'local'; allows mixed storage during migration.
-- storage_path        — Supabase Storage object path for deletion / signed-URL generation.

-- 1. Add new columns (safe, additive-only) -----------------------------------

ALTER TABLE public.job_files
  ADD COLUMN IF NOT EXISTS visible_to_customer boolean NOT NULL DEFAULT true;

ALTER TABLE public.job_files
  ADD COLUMN IF NOT EXISTS file_size bigint;

ALTER TABLE public.job_files
  ADD COLUMN IF NOT EXISTS storage_type text NOT NULL DEFAULT 'local';

ALTER TABLE public.job_files
  ADD COLUMN IF NOT EXISTS storage_path text;

-- 2. Back-fill storage_type for existing rows ---------------------------------
-- All rows written before this migration used local disk.
UPDATE public.job_files
  SET storage_type = 'local'
  WHERE storage_type IS NULL OR storage_type = '';

-- 3. Index for customer portal queries ---------------------------------------
CREATE INDEX IF NOT EXISTS idx_job_files_visible_customer
  ON public.job_files (job_id, visible_to_customer)
  WHERE visible_to_customer = true;

-- 4. Create the Supabase Storage bucket if it doesn't already exist -----------
-- (Run via the Supabase dashboard or CLI:
--   supabase storage create-bucket job-files --public
-- This SQL only documents the intent — storage buckets are managed outside SQL.)
