-- Migration: Add prime job/sub-job support
-- Run this SQL in Supabase SQL Editor to add linked job support

-- Add columns for prime/sub-job relationships
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS prime_job_number text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS prime_job_id integer;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS is_prime_job boolean DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS sub_job_sequence integer;

-- Add foreign key constraint for prime_job_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'jobs_prime_job_id_fkey'
    AND table_name = 'jobs'
  ) THEN
    ALTER TABLE public.jobs
    ADD CONSTRAINT jobs_prime_job_id_fkey
    FOREIGN KEY (prime_job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_jobs_prime_job_id ON public.jobs(prime_job_id) WHERE prime_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_prime_job_number ON public.jobs(prime_job_number) WHERE prime_job_number IS NOT NULL;
