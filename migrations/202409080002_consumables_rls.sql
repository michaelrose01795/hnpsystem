-- Migration: Enable RLS and policies for consumables tables

BEGIN;

ALTER TABLE public.consumables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumable_stock_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumable_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consumables_select ON public.consumables;
CREATE POLICY consumables_select
  ON public.consumables FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS consumables_insert ON public.consumables;
CREATE POLICY consumables_insert
  ON public.consumables FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS consumables_update ON public.consumables;
CREATE POLICY consumables_update
  ON public.consumables FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS consumables_delete ON public.consumables;
CREATE POLICY consumables_delete
  ON public.consumables FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS consumable_stock_checks_select ON public.consumable_stock_checks;
CREATE POLICY consumable_stock_checks_select
  ON public.consumable_stock_checks FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS consumable_stock_checks_insert ON public.consumable_stock_checks;
CREATE POLICY consumable_stock_checks_insert
  ON public.consumable_stock_checks FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS consumable_stock_checks_update ON public.consumable_stock_checks;
CREATE POLICY consumable_stock_checks_update
  ON public.consumable_stock_checks FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS consumable_stock_checks_delete ON public.consumable_stock_checks;
CREATE POLICY consumable_stock_checks_delete
  ON public.consumable_stock_checks FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS consumable_locations_select ON public.consumable_locations;
CREATE POLICY consumable_locations_select
  ON public.consumable_locations FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS consumable_locations_insert ON public.consumable_locations;
CREATE POLICY consumable_locations_insert
  ON public.consumable_locations FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS consumable_locations_update ON public.consumable_locations;
CREATE POLICY consumable_locations_update
  ON public.consumable_locations FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS consumable_locations_delete ON public.consumable_locations;
CREATE POLICY consumable_locations_delete
  ON public.consumable_locations FOR DELETE
  TO authenticated
  USING (true);

COMMIT;
