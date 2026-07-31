BEGIN;

ALTER TABLE public.workshop_consumables
  ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 0
  CHECK (stock_quantity >= 0);

ALTER TABLE public.workshop_consumable_requests
  ADD COLUMN IF NOT EXISTS consumable_id uuid REFERENCES public.workshop_consumables(id),
  ADD COLUMN IF NOT EXISTS arrived_at timestamp with time zone;

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
  SET
    stock_quantity = stock_quantity + arrival_quantity,
    updated_at = now()
  WHERE id = target_consumable_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Linked consumable not found.';
  END IF;

  UPDATE public.workshop_consumable_requests
  SET
    status = 'arrived',
    consumable_id = target_consumable_id,
    arrived_at = now(),
    updated_at = now()
  WHERE id = p_request_id;
END;
$$;

COMMIT;
