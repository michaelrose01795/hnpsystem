-- Stock Access (/access) — the back-shed stock ledger.
--
-- Workshop staff record what they take, return, use, store for warranty or
-- flag for restocking; Parts / managers / admin maintain the item records,
-- adjust stock and process restock requests (/access/manage).
--
-- Tables
--   stock_access_locations         storage areas (department-aware)
--   stock_access_items             the item record
--   stock_access_checkouts         custody of reusable items (who holds what)
--   stock_access_restock_requests  Requested -> Ordered -> (Partially) Received / Cancelled
--   stock_access_warranty_records  parts held in warranty storage + their outcome
--   stock_access_transactions      APPEND-ONLY ledger; every change writes a row
--
-- Every quantity change goes through public.stock_access_apply(), which locks
-- the item row, refuses negative stock unless an authorised override is
-- passed, updates any checkout / restock row and writes the ledger row in one
-- transaction. client_request_id makes a submission idempotent. The ledger
-- cannot be updated or deleted (trigger).
--
-- Safe to run more than once. Served only by /api/access/* under the service
-- role; no anon / authenticated grants.
--
-- Rollback: supabase/rollbacks/20260928130000_stock_access_down.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Locations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_access_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  department text NOT NULL DEFAULT 'workshop',
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_access_locations_pkey PRIMARY KEY (id)
);

INSERT INTO public.stock_access_locations (key, name, department, sort_order)
VALUES
  ('back_shed', 'Back shed', 'workshop', 10),
  ('warranty_store', 'Warranty store', 'workshop', 20)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_access_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sku text,
  barcode text,
  category text NOT NULL CHECK (category = ANY (ARRAY['tools'::text, 'consumables'::text, 'oils'::text, 'parts'::text, 'warranty'::text])),
  subcategory text,
  department text NOT NULL DEFAULT 'workshop',
  location_id uuid,
  bin text,
  unit_type text NOT NULL DEFAULT 'each' CHECK (unit_type = ANY (ARRAY['each'::text, 'pair'::text, 'box'::text, 'pack'::text, 'roll'::text, 'litre'::text, 'millilitre'::text, 'kilogram'::text, 'metre'::text])),
  -- Everything the business holds (on the shelf + checked out).
  current_quantity numeric NOT NULL DEFAULT 0,
  -- Reusable units currently with someone. Available = current - checked out.
  checked_out_quantity numeric NOT NULL DEFAULT 0 CHECK (checked_out_quantity >= 0),
  min_quantity numeric CHECK (min_quantity IS NULL OR min_quantity >= 0),
  reorder_quantity numeric CHECK (reorder_quantity IS NULL OR reorder_quantity >= 0),
  -- Size of one tap on the quantity stepper (0.5 for oil in litres, 1 for gloves).
  quantity_step numeric NOT NULL DEFAULT 1 CHECK (quantity_step > 0),
  return_required boolean NOT NULL DEFAULT false,
  -- Hours a reusable item may be out before it shows Overdue (NULL = never).
  loan_period_hours integer CHECK (loan_period_hours IS NULL OR loan_period_hours > 0),
  supplier_name text,
  supplier_part_number text,
  unit_cost numeric CHECK (unit_cost IS NULL OR unit_cost >= 0),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  last_movement_at timestamp with time zone,
  created_by integer,
  updated_by integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_access_items_pkey PRIMARY KEY (id),
  CONSTRAINT stock_access_items_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.stock_access_locations(id),
  CONSTRAINT stock_access_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id) ON DELETE SET NULL,
  CONSTRAINT stock_access_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(user_id) ON DELETE SET NULL
);

-- Codes are unique case-insensitively so a scan can only ever mean one item.
CREATE UNIQUE INDEX IF NOT EXISTS stock_access_items_sku_key
  ON public.stock_access_items (lower(sku)) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS stock_access_items_barcode_key
  ON public.stock_access_items (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_access_items_category_idx
  ON public.stock_access_items (category, name) WHERE is_active;

-- ---------------------------------------------------------------------------
-- 3. Checkouts (custody of reusable items)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_access_checkouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  holder_user_id integer,
  holder_name text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  quantity_returned numeric NOT NULL DEFAULT 0 CHECK (quantity_returned >= 0),
  status text NOT NULL DEFAULT 'out' CHECK (status = ANY (ARRAY['out'::text, 'returned'::text, 'missing'::text, 'written_off'::text])),
  taken_at timestamp with time zone NOT NULL DEFAULT now(),
  due_at timestamp with time zone,
  returned_at timestamp with time zone,
  returned_by integer,
  missing_at timestamp with time zone,
  missing_by integer,
  job_number text,
  vehicle_reg text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_access_checkouts_pkey PRIMARY KEY (id),
  CONSTRAINT stock_access_checkouts_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.stock_access_items(id),
  CONSTRAINT stock_access_checkouts_holder_user_id_fkey FOREIGN KEY (holder_user_id) REFERENCES public.users(user_id) ON DELETE SET NULL,
  CONSTRAINT stock_access_checkouts_returned_by_fkey FOREIGN KEY (returned_by) REFERENCES public.users(user_id) ON DELETE SET NULL,
  CONSTRAINT stock_access_checkouts_missing_by_fkey FOREIGN KEY (missing_by) REFERENCES public.users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS stock_access_checkouts_open_idx
  ON public.stock_access_checkouts (item_id) WHERE status IN ('out', 'missing');
CREATE INDEX IF NOT EXISTS stock_access_checkouts_holder_idx
  ON public.stock_access_checkouts (holder_user_id) WHERE status IN ('out', 'missing');

-- ---------------------------------------------------------------------------
-- 4. Restock requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_access_restock_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status = ANY (ARRAY['requested'::text, 'ordered'::text, 'partially_received'::text, 'received'::text, 'cancelled'::text])),
  quantity_requested numeric NOT NULL CHECK (quantity_requested > 0),
  quantity_received numeric NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  reason text NOT NULL,
  notes text,
  requested_by integer,
  requester_name text,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  supplier_reference text,
  expected_at date,
  ordered_by integer,
  ordered_at timestamp with time zone,
  received_at timestamp with time zone,
  cancelled_by integer,
  cancelled_at timestamp with time zone,
  cancel_reason text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_access_restock_requests_pkey PRIMARY KEY (id),
  CONSTRAINT stock_access_restock_requests_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.stock_access_items(id),
  CONSTRAINT stock_access_restock_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(user_id) ON DELETE SET NULL,
  CONSTRAINT stock_access_restock_requests_ordered_by_fkey FOREIGN KEY (ordered_by) REFERENCES public.users(user_id) ON DELETE SET NULL,
  CONSTRAINT stock_access_restock_requests_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.users(user_id) ON DELETE SET NULL
);

-- One open request per item: a second "running low" tap joins the first.
CREATE UNIQUE INDEX IF NOT EXISTS stock_access_restock_one_open_idx
  ON public.stock_access_restock_requests (item_id)
  WHERE status IN ('requested', 'ordered', 'partially_received');
CREATE INDEX IF NOT EXISTS stock_access_restock_status_idx
  ON public.stock_access_restock_requests (status, requested_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Warranty storage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_access_warranty_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid,
  part_description text NOT NULL,
  part_number text,
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  job_number text,
  vehicle_reg text,
  claim_reference text,
  location_id uuid,
  bin text,
  status text NOT NULL DEFAULT 'stored' CHECK (status = ANY (ARRAY['stored'::text, 'awaiting_return'::text, 'returned'::text, 'disposed'::text])),
  stored_by integer,
  stored_by_name text,
  stored_at timestamp with time zone NOT NULL DEFAULT now(),
  status_changed_by integer,
  status_changed_at timestamp with time zone,
  outcome_reference text,
  notes text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_access_warranty_records_pkey PRIMARY KEY (id),
  CONSTRAINT stock_access_warranty_records_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.stock_access_items(id),
  CONSTRAINT stock_access_warranty_records_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.stock_access_locations(id),
  CONSTRAINT stock_access_warranty_records_stored_by_fkey FOREIGN KEY (stored_by) REFERENCES public.users(user_id) ON DELETE SET NULL,
  CONSTRAINT stock_access_warranty_records_status_changed_by_fkey FOREIGN KEY (status_changed_by) REFERENCES public.users(user_id) ON DELETE SET NULL,
  CONSTRAINT stock_access_warranty_records_job_or_vehicle CHECK (job_number IS NOT NULL OR vehicle_reg IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS stock_access_warranty_status_idx
  ON public.stock_access_warranty_records (status, stored_at DESC);

-- ---------------------------------------------------------------------------
-- 6. The ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_access_transactions (
  id bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  item_id uuid,
  action text NOT NULL CHECK (action = ANY (ARRAY[
    'take_out'::text, 'return'::text, 'consume'::text, 'warranty_store'::text,
    'warranty_status'::text, 'restock_request'::text, 'restock_update'::text,
    'receive'::text, 'adjustment'::text, 'mark_missing'::text, 'found'::text,
    'write_off'::text, 'created'::text, 'edited'::text, 'activated'::text,
    'deactivated'::text
  ])),
  quantity numeric NOT NULL DEFAULT 0,
  quantity_out numeric NOT NULL DEFAULT 0,
  quantity_returned numeric NOT NULL DEFAULT 0,
  quantity_consumed numeric NOT NULL DEFAULT 0,
  quantity_delta numeric NOT NULL DEFAULT 0,
  stock_before numeric,
  stock_after numeric,
  checked_out_after numeric,
  available_after numeric,
  user_id integer,
  user_name text,
  location_id uuid,
  location_name text,
  bin text,
  job_number text,
  vehicle_reg text,
  reason text,
  notes text,
  checkout_id uuid,
  restock_request_id uuid,
  warranty_record_id uuid,
  override_negative boolean NOT NULL DEFAULT false,
  client_request_id uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_access_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT stock_access_transactions_subject CHECK (item_id IS NOT NULL OR warranty_record_id IS NOT NULL),
  CONSTRAINT stock_access_transactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.stock_access_items(id),
  CONSTRAINT stock_access_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE SET NULL,
  CONSTRAINT stock_access_transactions_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.stock_access_locations(id),
  CONSTRAINT stock_access_transactions_checkout_id_fkey FOREIGN KEY (checkout_id) REFERENCES public.stock_access_checkouts(id),
  CONSTRAINT stock_access_transactions_restock_request_id_fkey FOREIGN KEY (restock_request_id) REFERENCES public.stock_access_restock_requests(id),
  CONSTRAINT stock_access_transactions_warranty_record_id_fkey FOREIGN KEY (warranty_record_id) REFERENCES public.stock_access_warranty_records(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_access_transactions_client_request_key
  ON public.stock_access_transactions (client_request_id) WHERE client_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_access_transactions_item_idx
  ON public.stock_access_transactions (item_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS stock_access_transactions_user_idx
  ON public.stock_access_transactions (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS stock_access_transactions_occurred_idx
  ON public.stock_access_transactions (occurred_at DESC);
CREATE INDEX IF NOT EXISTS stock_access_transactions_warranty_idx
  ON public.stock_access_transactions (warranty_record_id) WHERE warranty_record_id IS NOT NULL;

-- Append-only: history is corrected by a new row, never by editing an old one.
CREATE OR REPLACE FUNCTION public.stock_access_transactions_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'stock_access_transactions is append-only';
END;
$$;

DROP TRIGGER IF EXISTS stock_access_transactions_no_change ON public.stock_access_transactions;
CREATE TRIGGER stock_access_transactions_no_change
  BEFORE UPDATE OR DELETE ON public.stock_access_transactions
  FOR EACH ROW EXECUTE FUNCTION public.stock_access_transactions_immutable();

-- ---------------------------------------------------------------------------
-- 7. The one path for every quantity change
-- ---------------------------------------------------------------------------
--   p_checkout  NULL | {"op":"open", holder_user_id, holder_name, quantity, due_at, job_number, vehicle_reg, notes}
--                    | {"op":"return", checkout_id, quantity}
--                    | {"op":"missing"|"found"|"write_off", checkout_id}
--   p_restock   NULL | {"request_id", "quantity"}
CREATE OR REPLACE FUNCTION public.stock_access_apply(
  p_item_id uuid,
  p_action text,
  p_quantity_delta numeric,
  p_checked_out_delta numeric,
  p_allow_negative boolean,
  p_entry jsonb,
  p_checkout jsonb DEFAULT NULL,
  p_restock jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item public.stock_access_items%ROWTYPE;
  v_checkout public.stock_access_checkouts%ROWTYPE;
  v_restock public.stock_access_restock_requests%ROWTYPE;
  v_existing public.stock_access_transactions%ROWTYPE;
  v_tx public.stock_access_transactions%ROWTYPE;
  v_location_name text;
  v_request_id uuid := NULLIF(p_entry->>'client_request_id', '')::uuid;
  v_user_id integer := NULLIF(p_entry->>'user_id', '')::integer;
  v_new_current numeric;
  v_new_out numeric;
  v_qty numeric;
  v_op text := p_checkout->>'op';
  v_now timestamp with time zone := now();
BEGIN
  SELECT * INTO v_item FROM public.stock_access_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_ACCESS_NOT_FOUND';
  END IF;

  -- Idempotency, checked after the lock so two identical in-flight
  -- submissions cannot both pass.
  IF v_request_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.stock_access_transactions WHERE client_request_id = v_request_id;
    IF FOUND THEN
      RETURN jsonb_build_object('duplicate', true, 'transaction', to_jsonb(v_existing), 'item', to_jsonb(v_item));
    END IF;
  END IF;

  IF NOT v_item.is_active AND p_action NOT IN ('return', 'found', 'mark_missing', 'write_off', 'adjustment') THEN
    RAISE EXCEPTION 'STOCK_ACCESS_INACTIVE';
  END IF;

  v_new_current := v_item.current_quantity + COALESCE(p_quantity_delta, 0);
  v_new_out := v_item.checked_out_quantity + COALESCE(p_checked_out_delta, 0);

  IF v_new_out < 0 THEN
    RAISE EXCEPTION 'STOCK_ACCESS_NOT_CHECKED_OUT';
  END IF;
  IF (v_new_current - v_new_out < 0 OR v_new_current < 0) AND NOT COALESCE(p_allow_negative, false) THEN
    RAISE EXCEPTION 'STOCK_ACCESS_NEGATIVE';
  END IF;

  -- Custody
  IF v_op = 'open' THEN
    INSERT INTO public.stock_access_checkouts (
      item_id, holder_user_id, holder_name, quantity, due_at, job_number, vehicle_reg, notes, taken_at
    ) VALUES (
      p_item_id,
      NULLIF(p_checkout->>'holder_user_id', '')::integer,
      COALESCE(NULLIF(p_checkout->>'holder_name', ''), 'Unknown'),
      (p_checkout->>'quantity')::numeric,
      NULLIF(p_checkout->>'due_at', '')::timestamp with time zone,
      NULLIF(p_checkout->>'job_number', ''),
      NULLIF(p_checkout->>'vehicle_reg', ''),
      NULLIF(p_checkout->>'notes', ''),
      v_now
    ) RETURNING * INTO v_checkout;
  ELSIF v_op IS NOT NULL THEN
    SELECT * INTO v_checkout FROM public.stock_access_checkouts
      WHERE id = (p_checkout->>'checkout_id')::uuid AND item_id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'STOCK_ACCESS_CHECKOUT_NOT_FOUND';
    END IF;

    IF v_op = 'return' THEN
      IF v_checkout.status NOT IN ('out', 'missing') THEN
        RAISE EXCEPTION 'STOCK_ACCESS_CHECKOUT_CLOSED';
      END IF;
      v_qty := (p_checkout->>'quantity')::numeric;
      IF v_qty IS NULL OR v_qty <= 0 OR v_checkout.quantity_returned + v_qty > v_checkout.quantity THEN
        RAISE EXCEPTION 'STOCK_ACCESS_RETURN_TOO_MANY';
      END IF;
      UPDATE public.stock_access_checkouts
        SET quantity_returned = quantity_returned + v_qty,
            status = CASE WHEN quantity_returned + v_qty >= quantity THEN 'returned' ELSE 'out' END,
            returned_at = CASE WHEN quantity_returned + v_qty >= quantity THEN v_now ELSE returned_at END,
            returned_by = v_user_id,
            updated_at = v_now
        WHERE id = v_checkout.id
        RETURNING * INTO v_checkout;
    ELSIF v_op = 'missing' THEN
      IF v_checkout.status <> 'out' THEN
        RAISE EXCEPTION 'STOCK_ACCESS_CHECKOUT_CLOSED';
      END IF;
      UPDATE public.stock_access_checkouts
        SET status = 'missing', missing_at = v_now, missing_by = v_user_id, updated_at = v_now
        WHERE id = v_checkout.id RETURNING * INTO v_checkout;
    ELSIF v_op = 'found' THEN
      IF v_checkout.status <> 'missing' THEN
        RAISE EXCEPTION 'STOCK_ACCESS_CHECKOUT_CLOSED';
      END IF;
      UPDATE public.stock_access_checkouts
        SET status = 'out', updated_at = v_now
        WHERE id = v_checkout.id RETURNING * INTO v_checkout;
    ELSIF v_op = 'write_off' THEN
      IF v_checkout.status NOT IN ('out', 'missing') THEN
        RAISE EXCEPTION 'STOCK_ACCESS_CHECKOUT_CLOSED';
      END IF;
      UPDATE public.stock_access_checkouts
        SET status = 'written_off', updated_at = v_now
        WHERE id = v_checkout.id RETURNING * INTO v_checkout;
    ELSE
      RAISE EXCEPTION 'STOCK_ACCESS_BAD_CHECKOUT_OP';
    END IF;
  END IF;

  -- Restock receipt
  IF p_restock IS NOT NULL THEN
    SELECT * INTO v_restock FROM public.stock_access_restock_requests
      WHERE id = (p_restock->>'request_id')::uuid AND item_id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'STOCK_ACCESS_RESTOCK_NOT_FOUND';
    END IF;
    IF v_restock.status NOT IN ('requested', 'ordered', 'partially_received') THEN
      RAISE EXCEPTION 'STOCK_ACCESS_RESTOCK_CLOSED';
    END IF;
    v_qty := (p_restock->>'quantity')::numeric;
    UPDATE public.stock_access_restock_requests
      SET quantity_received = quantity_received + v_qty,
          status = CASE WHEN quantity_received + v_qty >= quantity_requested THEN 'received' ELSE 'partially_received' END,
          received_at = v_now,
          updated_at = v_now
      WHERE id = v_restock.id
      RETURNING * INTO v_restock;
  END IF;

  UPDATE public.stock_access_items
    SET current_quantity = v_new_current,
        checked_out_quantity = v_new_out,
        last_movement_at = v_now,
        updated_at = v_now,
        updated_by = COALESCE(v_user_id, updated_by)
    WHERE id = p_item_id
    RETURNING * INTO v_item;

  SELECT name INTO v_location_name FROM public.stock_access_locations WHERE id = v_item.location_id;

  INSERT INTO public.stock_access_transactions (
    item_id, action, quantity, quantity_out, quantity_returned, quantity_consumed, quantity_delta,
    stock_before, stock_after, checked_out_after, available_after,
    user_id, user_name, location_id, location_name, bin,
    job_number, vehicle_reg, reason, notes,
    checkout_id, restock_request_id, override_negative, client_request_id, detail, occurred_at
  ) VALUES (
    p_item_id,
    p_action,
    COALESCE((p_entry->>'quantity')::numeric, 0),
    COALESCE((p_entry->>'quantity_out')::numeric, 0),
    COALESCE((p_entry->>'quantity_returned')::numeric, 0),
    COALESCE((p_entry->>'quantity_consumed')::numeric, 0),
    COALESCE(p_quantity_delta, 0),
    v_new_current - COALESCE(p_quantity_delta, 0),
    v_new_current,
    v_new_out,
    v_new_current - v_new_out,
    v_user_id,
    NULLIF(p_entry->>'user_name', ''),
    v_item.location_id,
    v_location_name,
    v_item.bin,
    NULLIF(p_entry->>'job_number', ''),
    NULLIF(p_entry->>'vehicle_reg', ''),
    NULLIF(p_entry->>'reason', ''),
    NULLIF(p_entry->>'notes', ''),
    v_checkout.id,
    v_restock.id,
    COALESCE(p_allow_negative, false),
    v_request_id,
    COALESCE(p_entry->'detail', '{}'::jsonb),
    v_now
  ) RETURNING * INTO v_tx;

  RETURN jsonb_build_object(
    'duplicate', false,
    'transaction', to_jsonb(v_tx),
    'item', to_jsonb(v_item),
    'checkout', CASE WHEN v_checkout.id IS NULL THEN NULL ELSE to_jsonb(v_checkout) END,
    'restock', CASE WHEN v_restock.id IS NULL THEN NULL ELSE to_jsonb(v_restock) END
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Access — server only
-- ---------------------------------------------------------------------------
ALTER TABLE public.stock_access_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_access_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_access_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_access_restock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_access_warranty_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_access_transactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.stock_access_locations FROM public, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.stock_access_items FROM public, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.stock_access_checkouts FROM public, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.stock_access_restock_requests FROM public, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.stock_access_warranty_records FROM public, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.stock_access_transactions FROM public, anon, authenticated;

REVOKE ALL ON FUNCTION public.stock_access_apply(uuid, text, numeric, numeric, boolean, jsonb, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stock_access_apply(uuid, text, numeric, numeric, boolean, jsonb, jsonb, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_access_apply(uuid, text, numeric, numeric, boolean, jsonb, jsonb, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.stock_access_transactions_immutable() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Central audit trail registry (only when the audit trail is installed)
-- ---------------------------------------------------------------------------
-- New tables are not picked up automatically; they are registered here. The
-- ledger is already a history, so it uses 'mutations_only' (the convention in
-- docs/Other/database-audit-trail.md): only an edit or delete of it would be
-- audited, and the append-only trigger refuses both. Each registration is
-- non-fatal, so an audit problem can never roll back the tables above.
DO $$
DECLARE
  v_table record;
BEGIN
  IF to_regprocedure('public.audit_enable_table(text, text, text, text, text[], text[])') IS NULL THEN
    RAISE NOTICE 'Central audit trail not installed - skipping audit registration.';
    RETURN;
  END IF;
  FOR v_table IN
    SELECT * FROM (VALUES
      ('stock_access_locations', 'stock_access_location', 'all'),
      ('stock_access_items', 'stock_access_item', 'all'),
      ('stock_access_checkouts', 'stock_access_checkout', 'all'),
      ('stock_access_restock_requests', 'stock_access_restock', 'all'),
      ('stock_access_warranty_records', 'stock_access_warranty', 'all'),
      ('stock_access_transactions', 'stock_access_transaction', 'mutations_only')
    ) AS t(table_name, record_type, capture_mode)
  LOOP
    BEGIN
      PERFORM public.audit_enable_table(v_table.table_name, v_table.record_type, 'stock_access', v_table.capture_mode);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Audit registration skipped for %: %', v_table.table_name, SQLERRM;
    END;
  END LOOP;
END
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
