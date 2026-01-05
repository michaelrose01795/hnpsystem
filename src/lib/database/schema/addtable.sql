-- file location: src/lib/database/schema/addtable.sql
-- description: defines supplemental tables added beyond reference schema

CREATE TABLE IF NOT EXISTS public.parts_goods_in (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_in_number text NOT NULL UNIQUE,
  supplier_account_id text REFERENCES public.accounts(account_id),
  supplier_name text,
  supplier_address text,
  supplier_contact text,
  invoice_number text,
  delivery_note_number text,
  invoice_date date,
  price_level text,
  notes text,
  scan_payload jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'awaiting_assignment'::text, 'completed'::text, 'cancelled'::text])),
  created_by_user_id integer REFERENCES public.users(user_id),
  created_by_auth_uuid uuid,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.parts_goods_in_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_in_id uuid NOT NULL REFERENCES public.parts_goods_in(id) ON DELETE CASCADE,
  line_number integer,
  part_catalog_id uuid REFERENCES public.parts_catalog(id),
  part_number text,
  manufacturer_part_number text,
  description text,
  bin_location_primary text,
  bin_location_secondary text,
  franchise text,
  retail_price numeric,
  cost_price numeric,
  discount_code text,
  surcharge numeric,
  quantity numeric NOT NULL DEFAULT 1,
  claim_number text,
  pack_size text,
  vat_rate text,
  sales_prices jsonb NOT NULL DEFAULT '[]'::jsonb,
  purchase_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  dealer_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  stock_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_defined jsonb NOT NULL DEFAULT '{}'::jsonb,
  link_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sales_history jsonb NOT NULL DEFAULT '{}'::jsonb,
  audi_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  additional_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  online_store jsonb NOT NULL DEFAULT '{}'::jsonb,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  added_to_job boolean NOT NULL DEFAULT false,
  job_id integer REFERENCES public.jobs(id),
  job_number text,
  job_allocation_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by_user_id integer REFERENCES public.users(user_id),
  created_by_auth_uuid uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parts_goods_in_supplier ON public.parts_goods_in (supplier_account_id);
CREATE INDEX IF NOT EXISTS idx_parts_goods_in_items_goods_in_id ON public.parts_goods_in_items (goods_in_id);
CREATE INDEX IF NOT EXISTS idx_parts_goods_in_items_part_number ON public.parts_goods_in_items (part_number);
