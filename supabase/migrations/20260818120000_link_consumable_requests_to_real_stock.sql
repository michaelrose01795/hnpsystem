BEGIN;

ALTER TABLE public.workshop_consumable_requests
  ADD COLUMN IF NOT EXISTS consumable_id uuid
    REFERENCES public.workshop_consumables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS catalog_consumable_id uuid
    REFERENCES public.consumables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS arrived_at timestamp with time zone;

-- Stock-check-generated requests reuse the stock-check UUID, so retain their
-- source catalogue relationship for an exact audit trail.
UPDATE public.workshop_consumable_requests AS request
SET catalog_consumable_id = stock_check.consumable_id
FROM public.consumable_stock_checks AS stock_check
WHERE request.id = stock_check.id
  AND request.catalog_consumable_id IS NULL;

-- Link historical copied names only when the normalized tracker name is
-- unique. Ambiguous or unmatched names intentionally remain unlinked.
WITH unique_tracker_names AS (
  SELECT
    MIN(id::text)::uuid AS consumable_id,
    regexp_replace(lower(btrim(item_name)), '\s+', '', 'g') AS normalized_name
  FROM public.workshop_consumables
  GROUP BY regexp_replace(lower(btrim(item_name)), '\s+', '', 'g')
  HAVING COUNT(*) = 1
)
UPDATE public.workshop_consumable_requests AS request
SET consumable_id = tracker.consumable_id
FROM unique_tracker_names AS tracker
WHERE request.consumable_id IS NULL
  AND regexp_replace(lower(btrim(request.item_name)), '\s+', '', 'g') = tracker.normalized_name;

-- Normalize lifecycle values already deployed before the current workflow.
UPDATE public.workshop_consumable_requests
SET
  status = CASE
    WHEN lower(status) = 'approved' THEN 'ordered'
    WHEN lower(status) IN ('received', 'completed', 'fulfilled') THEN 'arrived'
    ELSE lower(status)
  END,
  arrived_at = CASE
    WHEN lower(status) IN ('received', 'completed', 'fulfilled', 'arrived')
      THEN COALESCE(arrived_at, updated_at, requested_at)
    ELSE arrived_at
  END
WHERE lower(status) IN ('approved', 'received', 'completed', 'fulfilled', 'arrived');

CREATE OR REPLACE FUNCTION public.mark_workshop_consumable_request_arrived(
  p_request_id uuid,
  p_consumable_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  request_row public.workshop_consumable_requests%ROWTYPE;
  target_consumable_id uuid;
  arrival_quantity integer;
BEGIN
  SELECT *
  INTO request_row
  FROM public.workshop_consumable_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consumable request not found.';
  END IF;

  IF request_row.status <> 'ordered' THEN
    RAISE EXCEPTION 'Only an ordered consumable request can be marked as arrived.';
  END IF;

  target_consumable_id := COALESCE(request_row.consumable_id, p_consumable_id);
  IF target_consumable_id IS NULL THEN
    RAISE EXCEPTION 'The request is not linked to a consumable.';
  END IF;

  arrival_quantity := COALESCE(request_row.quantity, 0);
  IF arrival_quantity <= 0 THEN
    RAISE EXCEPTION 'The arrived quantity must be greater than zero.';
  END IF;

  UPDATE public.workshop_consumables
  SET stock_quantity = stock_quantity + arrival_quantity,
      updated_at = now()
  WHERE id = target_consumable_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Linked consumable not found.';
  END IF;

  UPDATE public.workshop_consumable_requests
  SET status = 'arrived',
      consumable_id = target_consumable_id,
      arrived_at = now(),
      updated_at = now()
  WHERE id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_workshop_consumable_request_arrived(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_workshop_consumable_request_arrived(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_workshop_consumable_request_arrived(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_workshop_consumable_request_arrived(uuid, uuid) TO service_role;

COMMIT;
