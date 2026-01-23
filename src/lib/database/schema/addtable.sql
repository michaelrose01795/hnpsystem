-- file location: src/lib/database/schema/addtable.sql
-- description: defines supplemental tables added beyond reference schema

-- Unify customer requests + VHC authorised rows in job_requests
ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS request_source text NOT NULL DEFAULT 'customer_request',
  ADD COLUMN IF NOT EXISTS vhc_item_id integer,
  ADD COLUMN IF NOT EXISTS parts_job_item_id uuid,
  ADD COLUMN IF NOT EXISTS pre_pick_location text CHECK (
    pre_pick_location IS NULL OR (
      pre_pick_location = ANY (
        ARRAY[
          'service_rack_1'::text,
          'service_rack_2'::text,
          'service_rack_3'::text,
          'service_rack_4'::text,
          'sales_rack_1'::text,
          'sales_rack_2'::text,
          'sales_rack_3'::text,
          'sales_rack_4'::text,
          'stairs_pre_pick'::text,
          'no_pick'::text,
          'on_order'::text
        ]
      )
    )
  ),
  ADD COLUMN IF NOT EXISTS note_text text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_requests_vhc_item_id_fkey'
  ) THEN
    ALTER TABLE public.job_requests
      ADD CONSTRAINT job_requests_vhc_item_id_fkey
      FOREIGN KEY (vhc_item_id) REFERENCES public.vhc_checks(vhc_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_requests_parts_job_item_id_fkey'
  ) THEN
    ALTER TABLE public.job_requests
      ADD CONSTRAINT job_requests_parts_job_item_id_fkey
      FOREIGN KEY (parts_job_item_id) REFERENCES public.parts_job_items(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS job_requests_job_id_source_idx
  ON public.job_requests (job_id, request_source);

CREATE INDEX IF NOT EXISTS job_requests_job_id_vhc_item_idx
  ON public.job_requests (job_id, vhc_item_id);
