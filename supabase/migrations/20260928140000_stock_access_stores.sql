-- Stock Access stores (/access/<store>).
--
-- Every store (Back Shed, and later e.g. Yellow Storage) shares the Stock
-- Access tables; rows carry `store_key`, the store's URL segment registered in
-- src/config/stockAccessStores.js. Adding a store needs no schema change.
--
--   * store_key on items, locations, warranty records and the ledger.
--     Checkouts and restock requests belong to an item, so they follow it.
--   * SKU / barcode are unique per store (the same gloves can live in two).
--   * a trigger stamps each ledger row with its item's store.
--
-- Existing rows become Back Shed. Safe to run more than once.
-- Rollback: supabase/rollbacks/20260928140000_stock_access_stores_down.sql

BEGIN;

ALTER TABLE public.stock_access_items
  ADD COLUMN IF NOT EXISTS store_key text NOT NULL DEFAULT 'back-shed';
ALTER TABLE public.stock_access_locations
  ADD COLUMN IF NOT EXISTS store_key text NOT NULL DEFAULT 'back-shed';
ALTER TABLE public.stock_access_warranty_records
  ADD COLUMN IF NOT EXISTS store_key text NOT NULL DEFAULT 'back-shed';
-- ADD COLUMN ... DEFAULT fills existing rows without firing row triggers, so
-- the append-only ledger takes the column too.
ALTER TABLE public.stock_access_transactions
  ADD COLUMN IF NOT EXISTS store_key text NOT NULL DEFAULT 'back-shed';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_access_items_store_key_format') THEN
    ALTER TABLE public.stock_access_items
      ADD CONSTRAINT stock_access_items_store_key_format CHECK (store_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_access_locations_store_key_format') THEN
    ALTER TABLE public.stock_access_locations
      ADD CONSTRAINT stock_access_locations_store_key_format CHECK (store_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_access_warranty_store_key_format') THEN
    ALTER TABLE public.stock_access_warranty_records
      ADD CONSTRAINT stock_access_warranty_store_key_format CHECK (store_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  END IF;
END
$$;

-- Location keys were unique across the whole system; they are now unique
-- within a store, so every store can have its own "Warranty store" etc.
ALTER TABLE public.stock_access_locations DROP CONSTRAINT IF EXISTS stock_access_locations_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS stock_access_locations_store_key_key
  ON public.stock_access_locations (store_key, key);

-- Codes are unique within a store.
DROP INDEX IF EXISTS public.stock_access_items_sku_key;
DROP INDEX IF EXISTS public.stock_access_items_barcode_key;
CREATE UNIQUE INDEX IF NOT EXISTS stock_access_items_store_sku_key
  ON public.stock_access_items (store_key, lower(sku)) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS stock_access_items_store_barcode_key
  ON public.stock_access_items (store_key, barcode) WHERE barcode IS NOT NULL;

DROP INDEX IF EXISTS public.stock_access_items_category_idx;
CREATE INDEX IF NOT EXISTS stock_access_items_store_category_idx
  ON public.stock_access_items (store_key, category, name) WHERE is_active;
CREATE INDEX IF NOT EXISTS stock_access_locations_store_idx
  ON public.stock_access_locations (store_key, sort_order);
CREATE INDEX IF NOT EXISTS stock_access_warranty_store_idx
  ON public.stock_access_warranty_records (store_key, status, stored_at DESC);
CREATE INDEX IF NOT EXISTS stock_access_transactions_store_idx
  ON public.stock_access_transactions (store_key, occurred_at DESC);

-- Every ledger row takes its item's store, whoever writes it (the
-- stock_access_apply() function or the API), so the function is unchanged.
CREATE OR REPLACE FUNCTION public.stock_access_transactions_set_store()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.item_id IS NOT NULL THEN
    SELECT store_key INTO NEW.store_key FROM public.stock_access_items WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_access_transactions_store ON public.stock_access_transactions;
CREATE TRIGGER stock_access_transactions_store
  BEFORE INSERT ON public.stock_access_transactions
  FOR EACH ROW EXECUTE FUNCTION public.stock_access_transactions_set_store();

REVOKE ALL ON FUNCTION public.stock_access_transactions_set_store() FROM PUBLIC, anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
