-- file location: src/lib/database/schema/addtable.sql
-- description: defines supplemental tables added beyond reference schema

-- 2024-12 customer detail view supplemental tables
-- Additional linking data to support the enhanced customer workspace.

CREATE TABLE IF NOT EXISTS public.customer_vehicle_links (
  link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  vehicle_id integer NOT NULL REFERENCES public.vehicles(vehicle_id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'owner',
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, vehicle_id, relationship)
);

CREATE INDEX IF NOT EXISTS customer_vehicle_links_customer_idx
  ON public.customer_vehicle_links (customer_id);

CREATE TABLE IF NOT EXISTS public.customer_activity_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  job_id integer REFERENCES public.jobs(id) ON DELETE SET NULL,
  vehicle_id integer REFERENCES public.vehicles(vehicle_id) ON DELETE SET NULL,
  activity_type text NOT NULL,
  activity_source text,
  activity_payload jsonb DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by integer REFERENCES public.users(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_activity_events_customer_idx
  ON public.customer_activity_events (customer_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.customer_job_history (
  history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  job_id integer REFERENCES public.jobs(id) ON DELETE SET NULL,
  job_number text,
  status_snapshot text,
  vehicle_reg text,
  vehicle_make_model text,
  mileage_at_service integer,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_job_history_customer_idx
  ON public.customer_job_history (customer_id, recorded_at DESC);

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS slug_key text GENERATED ALWAYS AS (
    regexp_replace(
      lower(coalesce(firstname, '') || coalesce(lastname, '')),
      '[^a-z0-9]',
      '',
      'g'
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS customers_slug_key_idx
  ON public.customers (slug_key);
