-- file location: src/lib/database/schema/migrations/2026-04-15-job-files-storage-columns.sql
-- Idempotent repair for environments where the job_files table is missing
-- storage-related columns expected by modern upload flows.

ALTER TABLE public.job_files ADD COLUMN IF NOT EXISTS visible_to_customer boolean DEFAULT true;
ALTER TABLE public.job_files ADD COLUMN IF NOT EXISTS file_size bigint;
ALTER TABLE public.job_files ADD COLUMN IF NOT EXISTS storage_type text;
ALTER TABLE public.job_files ADD COLUMN IF NOT EXISTS storage_path text;

UPDATE public.job_files
SET visible_to_customer = true
WHERE visible_to_customer IS NULL;

NOTIFY pgrst, 'reload schema';
