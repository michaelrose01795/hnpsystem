-- // file location: src/lib/database/schema/addtable.sql
-- // description: defines supplemental tables added beyond reference schema

-- Ensure parts_job_items can reference the originating VHC line item when applicable
ALTER TABLE public.parts_job_items
  ADD COLUMN IF NOT EXISTS vhc_item_id integer REFERENCES public.vhc_checks(vhc_id);

CREATE INDEX IF NOT EXISTS idx_parts_job_items_vhc_item_id
  ON public.parts_job_items (vhc_item_id);

-- Extend parts_job_items status enum to cover operational states used by the parts team
ALTER TABLE public.parts_job_items
  DROP CONSTRAINT IF EXISTS parts_job_items_status_check;

ALTER TABLE public.parts_job_items
  ADD CONSTRAINT parts_job_items_status_check CHECK (
    status = ANY (
      ARRAY[
        'pending',
        'waiting_authorisation',
        'awaiting_stock',
        'on_order',
        'allocated',
        'pre_picked',
        'picked',
        'stock',
        'fitted',
        'cancelled'
      ]
    )
  );

-- Track where a parts request originated (e.g. technician request vs manual entry)
ALTER TABLE public.parts_requests
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
