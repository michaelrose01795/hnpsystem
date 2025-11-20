-- // file location: src/lib/database/schema/addtable.sql
-- // description: defines supplemental tables added beyond reference schema

-- Add description column for free-text technician part requests
ALTER TABLE IF EXISTS public.parts_requests
  ADD COLUMN IF NOT EXISTS description text;

-- Capture request-specific causes inside the job write-up
ALTER TABLE IF EXISTS public.job_writeups
  ADD COLUMN IF NOT EXISTS cause_entries jsonb DEFAULT '[]'::jsonb;
