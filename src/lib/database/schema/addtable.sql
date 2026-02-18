-- =============================================================================
-- Clear VHC summary tab contents for job 00055
-- =============================================================================

-- Step 1: Remove foreign key references to vhc_checks from child tables
DELETE FROM public.writeup_rectification_items
WHERE job_id = (SELECT id FROM public.jobs WHERE job_number = '00055')
  AND vhc_item_id IS NOT NULL;

DELETE FROM public.job_requests
WHERE job_id = (SELECT id FROM public.jobs WHERE job_number = '00055')
  AND vhc_item_id IS NOT NULL;

UPDATE public.parts_job_items
SET vhc_item_id = NULL, updated_at = now()
WHERE job_id = (SELECT id FROM public.jobs WHERE job_number = '00055')
  AND vhc_item_id IS NOT NULL;

-- Step 2: Delete all vhc_checks rows for that job (clears the entire summary tab)
DELETE FROM public.vhc_checks
WHERE job_id = (SELECT id FROM public.jobs WHERE job_number = '00055');

-- Step 3: Clear VHC-related fields on the job record
UPDATE public.jobs
SET
  vhc_completed_at = NULL,
  vhc_sent_at = NULL,
  vhc_authorization_reference = NULL
WHERE job_number = '00055';

-- Step 4: Clear related event logs for this job
DELETE FROM public.vhc_authorizations
WHERE job_id = (SELECT id FROM public.jobs WHERE job_number = '00055');

DELETE FROM public.vhc_declinations
WHERE job_id = (SELECT id FROM public.jobs WHERE job_number = '00055');

DELETE FROM public.vhc_send_history
WHERE job_id = (SELECT id FROM public.jobs WHERE job_number = '00055');
