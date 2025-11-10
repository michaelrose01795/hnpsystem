-- file location: src/lib/migrations/007_job_writeup_tasks.sql
BEGIN;

-- ✅ Ensure job_writeups has status and note tracking columns
ALTER TABLE public.job_writeups
  ADD COLUMN IF NOT EXISTS completion_status TEXT DEFAULT 'additional_work';
ALTER TABLE public.job_writeups
  ADD COLUMN IF NOT EXISTS rectification_notes TEXT;
ALTER TABLE public.job_writeups
  ADD COLUMN IF NOT EXISTS job_description_snapshot TEXT;
ALTER TABLE public.job_writeups
  ADD COLUMN IF NOT EXISTS vhc_authorization_reference INTEGER;
ALTER TABLE public.job_writeups
  ADD COLUMN IF NOT EXISTS task_checklist JSONB DEFAULT '[]'::jsonb;

-- ✅ Create task table to track checklist items with unique IDs
CREATE TABLE IF NOT EXISTS public.job_writeup_tasks (
  task_id BIGSERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_key TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'additional_work',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ✅ Helpful indexes and constraints for performant lookups
CREATE INDEX IF NOT EXISTS idx_job_writeup_tasks_job_id ON public.job_writeup_tasks(job_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_job_writeup_tasks_job_source_key ON public.job_writeup_tasks(job_id, source, source_key);

-- ✅ Trigger keeps updated_at fresh on edits
CREATE OR REPLACE FUNCTION public.set_job_writeup_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_writeup_tasks_updated_at ON public.job_writeup_tasks;
CREATE TRIGGER trg_job_writeup_tasks_updated_at
BEFORE UPDATE ON public.job_writeup_tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_job_writeup_tasks_updated_at();

COMMIT;
