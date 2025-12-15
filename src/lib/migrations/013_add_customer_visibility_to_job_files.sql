-- Migration: Add customer visibility control to job_files
-- Created: 2025-12-15
-- Purpose: Allow granular control over which VHC media files are visible to customers

-- Add visible_to_customer column with default true (maintain backward compatibility)
ALTER TABLE public.job_files
ADD COLUMN IF NOT EXISTS visible_to_customer BOOLEAN DEFAULT true;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.job_files.visible_to_customer IS
'Controls whether file appears in customer portal VHC view. Default true for backward compatibility.';

-- Create index for efficient customer portal queries
-- Partial index only on customer-visible files for better performance
CREATE INDEX IF NOT EXISTS idx_job_files_customer_visible
ON public.job_files(job_id, folder, visible_to_customer)
WHERE visible_to_customer = true;

-- Update existing files to be visible by default
-- This ensures backward compatibility with existing VHC files
UPDATE public.job_files
SET visible_to_customer = true
WHERE visible_to_customer IS NULL;

-- Verify changes
DO $$
BEGIN
  RAISE NOTICE 'Migration 013 completed: Added visible_to_customer column to job_files table';
END $$;
