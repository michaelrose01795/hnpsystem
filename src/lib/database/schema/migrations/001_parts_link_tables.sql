-- Migration: Link parts_requests to parts_job_items
-- Purpose: Bridge the gap between technician part requests and actual part allocations
-- Safe to run multiple times (IF NOT EXISTS guards)
-- Date: 2026-04-09

-- 1. Add source_request_id to parts_job_items so we can trace which request spawned the allocation
ALTER TABLE public.parts_job_items
  ADD COLUMN IF NOT EXISTS source_request_id integer;

-- FK constraint linking back to the originating parts_requests row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parts_job_items_source_request_id_fkey'
  ) THEN
    ALTER TABLE public.parts_job_items
      ADD CONSTRAINT parts_job_items_source_request_id_fkey
      FOREIGN KEY (source_request_id) REFERENCES public.parts_requests(request_id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Index for fast lookup: "which allocations came from this request?"
CREATE INDEX IF NOT EXISTS idx_parts_job_items_source_request_id
  ON public.parts_job_items(source_request_id)
  WHERE source_request_id IS NOT NULL;

-- 2. Add vhc_item_id to parts_requests so technicians can link requests to VHC check items
ALTER TABLE public.parts_requests
  ADD COLUMN IF NOT EXISTS vhc_item_id integer;

-- FK constraint linking to the VHC check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parts_requests_vhc_item_id_fkey'
  ) THEN
    ALTER TABLE public.parts_requests
      ADD CONSTRAINT parts_requests_vhc_item_id_fkey
      FOREIGN KEY (vhc_item_id) REFERENCES public.vhc_checks(vhc_id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Add fulfilled_by to parts_requests to track which parts_job_items row fulfilled this request
ALTER TABLE public.parts_requests
  ADD COLUMN IF NOT EXISTS fulfilled_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parts_requests_fulfilled_by_fkey'
  ) THEN
    ALTER TABLE public.parts_requests
      ADD CONSTRAINT parts_requests_fulfilled_by_fkey
      FOREIGN KEY (fulfilled_by) REFERENCES public.parts_job_items(id)
      ON DELETE SET NULL;
  END IF;
END $$;
