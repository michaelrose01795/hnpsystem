-- Migration: Add pre_pick_location column to parts_requests
-- Description: Allows requests to store service rack assignments used by dashboards and UI.

BEGIN;

-- Add the new column with a NULL default so existing rows remain untouched.
ALTER TABLE public.parts_requests
  ADD COLUMN IF NOT EXISTS pre_pick_location text;

ALTER TABLE public.parts_requests
  ALTER COLUMN pre_pick_location DROP NOT NULL,
  ALTER COLUMN pre_pick_location SET DEFAULT NULL;

-- Constrain allowed values to the same pre-pick rack identifiers used elsewhere.
ALTER TABLE public.parts_requests
  DROP CONSTRAINT IF EXISTS parts_requests_pre_pick_location_check;

ALTER TABLE public.parts_requests
  ADD CONSTRAINT parts_requests_pre_pick_location_check
  CHECK (
    pre_pick_location IS NULL OR pre_pick_location = ANY (
      ARRAY[
        'service_rack_1',
        'service_rack_2',
        'service_rack_3',
        'service_rack_4',
        'sales_rack_1',
        'sales_rack_2',
        'sales_rack_3',
        'sales_rack_4',
        'stairs_pre_pick',
        'no_pick',
        'on_order'
      ]
    )
  );

-- Align the job item constraint so UI dropdown values remain valid everywhere.
ALTER TABLE public.parts_job_items
  DROP CONSTRAINT IF EXISTS parts_job_items_pre_pick_location_check;

ALTER TABLE public.parts_job_items
  ADD CONSTRAINT parts_job_items_pre_pick_location_check
  CHECK (
    pre_pick_location IS NULL OR pre_pick_location = ANY (
      ARRAY[
        'service_rack_1',
        'service_rack_2',
        'service_rack_3',
        'service_rack_4',
        'sales_rack_1',
        'sales_rack_2',
        'sales_rack_3',
        'sales_rack_4',
        'stairs_pre_pick',
        'no_pick',
        'on_order'
      ]
    )
  );

COMMENT ON COLUMN public.parts_requests.pre_pick_location IS
  'Optional pre-pick rack assignment (service_rack_1, sales_rack_1, stairs_pre_pick, no_pick, on_order, etc).';

COMMIT;
