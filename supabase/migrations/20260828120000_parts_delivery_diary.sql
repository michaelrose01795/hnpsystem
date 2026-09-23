-- Parts delivery diary / tracker.
--
-- The /deliveries page grew from a two-button driver list ("scheduled" ->
-- "completed") into the daily control screen for the parts van run. This
-- migration adds ONLY the fields that had nowhere to live on
-- public.parts_delivery_jobs:
--
--   * a real workflow (picking -> ready -> loaded -> out for delivery ->
--     delivered / failed / returned) instead of the three-value chip,
--   * driver + delivery-vehicle assignment,
--   * planned time, delivery window and the workflow timestamps,
--   * picking / packing facts (package count, missing items, cores),
--   * proof of delivery and failure reasons,
--   * a per-delivery event trail the page can render.
--
-- Everything already available elsewhere is reused, not duplicated:
-- invoice_id / invoice_number / job_id / customer_id / items / total_price /
-- is_paid / payment_method / address / contact_* / notes / sort_order all stay
-- exactly as they are, and sort_order remains the route order.
--
-- The legacy status values ('scheduled', 'en_route', 'completed') stay in the
-- CHECK constraint and are NOT rewritten. /delivery-planner still writes them;
-- src/features/deliveries/deliveryStatus.js maps them onto the canonical states
-- at read time, so no existing row or workflow changes behaviour.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Workflow state
-- ---------------------------------------------------------------------------
ALTER TABLE public.parts_delivery_jobs
  DROP CONSTRAINT IF EXISTS parts_delivery_jobs_status_check;

ALTER TABLE public.parts_delivery_jobs
  ADD CONSTRAINT parts_delivery_jobs_status_check CHECK (
    status = ANY (ARRAY[
      -- canonical
      'planned'::text,
      'picking'::text,
      'ready'::text,
      'loaded'::text,
      'out_for_delivery'::text,
      'delivered'::text,
      'failed'::text,
      'returned'::text,
      -- legacy, still written by /delivery-planner
      'scheduled'::text,
      'en_route'::text,
      'completed'::text
    ])
  );

-- ---------------------------------------------------------------------------
-- 2. Assignment, scheduling and workflow timestamps
-- ---------------------------------------------------------------------------
ALTER TABLE public.parts_delivery_jobs
  ADD COLUMN IF NOT EXISTS driver_id integer
    REFERENCES public.users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS driver_name text,
  -- Free-text registration, matching public.deliveries.vehicle_reg. There is no
  -- delivery-van roster table in the schema and inventing one would duplicate a
  -- concept the business keeps in company_settings; the option list is served
  -- from company_settings.parts_delivery_vehicles with a fallback derived from
  -- registrations already used on public.deliveries.
  ADD COLUMN IF NOT EXISTS vehicle_reg text,
  ADD COLUMN IF NOT EXISTS planned_time time without time zone,
  ADD COLUMN IF NOT EXISTS window_start time without time zone,
  ADD COLUMN IF NOT EXISTS window_end time without time zone,
  ADD COLUMN IF NOT EXISTS eta_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS picked_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS ready_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS loaded_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS failed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS returned_at timestamp with time zone;

-- completed_at already exists and is the delivered timestamp. It keeps that
-- meaning so existing rows and /delivery-planner reporting stay correct.
COMMENT ON COLUMN public.parts_delivery_jobs.completed_at IS
  'Actual delivered-at timestamp. Set when status becomes delivered.';

-- ---------------------------------------------------------------------------
-- 3. Picking / packing facts
-- ---------------------------------------------------------------------------
ALTER TABLE public.parts_delivery_jobs
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_collection boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS package_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missing_items text,
  ADD COLUMN IF NOT EXISTS order_reference text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS surcharge_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS core_return_expected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS core_return_collected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS core_return_notes text;

-- ---------------------------------------------------------------------------
-- 4. Proof of delivery and failure reasons
-- ---------------------------------------------------------------------------
ALTER TABLE public.parts_delivery_jobs
  ADD COLUMN IF NOT EXISTS pod_recipient_name text,
  ADD COLUMN IF NOT EXISTS pod_notes text,
  ADD COLUMN IF NOT EXISTS pod_photo_url text,
  ADD COLUMN IF NOT EXISTS pod_photo_path text,
  ADD COLUMN IF NOT EXISTS pod_signature_url text,
  ADD COLUMN IF NOT EXISTS pod_signature_path text,
  ADD COLUMN IF NOT EXISTS pod_captured_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS pod_captured_by integer
    REFERENCES public.users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS failed_reason text,
  ADD COLUMN IF NOT EXISTS failed_notes text;

ALTER TABLE public.parts_delivery_jobs
  DROP CONSTRAINT IF EXISTS parts_delivery_jobs_failed_reason_check;

ALTER TABLE public.parts_delivery_jobs
  ADD CONSTRAINT parts_delivery_jobs_failed_reason_check CHECK (
    failed_reason IS NULL OR failed_reason = ANY (ARRAY[
      'customer_closed'::text,
      'wrong_address'::text,
      'refused'::text,
      'unable_to_contact'::text,
      'no_access'::text,
      'vehicle_issue'::text,
      'other'::text
    ])
  );

-- ---------------------------------------------------------------------------
-- 5. Per-delivery event trail
-- ---------------------------------------------------------------------------
-- public.audit_events remains the central platform audit record (written by the
-- API route through recordAuditEvent). This table is the small, page-facing
-- history the delivery detail panel renders — audit_events is deliberately not
-- readable by the browser and carries no delivery-shaped query path.
CREATE TABLE IF NOT EXISTS public.parts_delivery_events (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  delivery_job_id uuid NOT NULL
    REFERENCES public.parts_delivery_jobs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  actor_user_id integer REFERENCES public.users(user_id) ON DELETE SET NULL,
  actor_name text,
  summary text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parts_delivery_events_job_idx
  ON public.parts_delivery_events (delivery_job_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 6. Indexes for the day view
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS parts_delivery_jobs_date_order_idx
  ON public.parts_delivery_jobs (delivery_date, sort_order, created_at);

CREATE INDEX IF NOT EXISTS parts_delivery_jobs_driver_idx
  ON public.parts_delivery_jobs (delivery_date, driver_id);

-- ---------------------------------------------------------------------------
-- 7. Access
-- ---------------------------------------------------------------------------
-- The diary is served exclusively by /api/parts/delivery-diary/* using the
-- service role, matching the hardening pass in
-- 20260814150000_harden_supabase_rls_and_function_permissions.sql. No anon /
-- authenticated grant is issued for the new event table.
ALTER TABLE public.parts_delivery_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.parts_delivery_events FROM public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Delivery vehicle roster seed (existing company_settings table)
-- ---------------------------------------------------------------------------
INSERT INTO public.company_settings (setting_key, setting_value, setting_type, description)
VALUES (
  'parts_delivery_vehicles',
  '[]',
  'json',
  'Registrations offered when assigning a delivery vehicle on /deliveries. An empty list means the options are derived from registrations already used on public.deliveries.'
)
ON CONFLICT (setting_key) DO NOTHING;

COMMIT;
