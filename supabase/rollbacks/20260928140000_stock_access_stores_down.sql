-- Rollback for supabase/migrations/20260928140000_stock_access_stores.sql
--
-- Returns Stock Access to a single store: store_key is dropped and codes /
-- location keys become globally unique again (fails if two stores now share a
-- code — resolve those first).

BEGIN;

DROP TRIGGER IF EXISTS stock_access_transactions_store ON public.stock_access_transactions;
DROP FUNCTION IF EXISTS public.stock_access_transactions_set_store();

DROP INDEX IF EXISTS public.stock_access_transactions_store_idx;
DROP INDEX IF EXISTS public.stock_access_warranty_store_idx;
DROP INDEX IF EXISTS public.stock_access_locations_store_idx;
DROP INDEX IF EXISTS public.stock_access_items_store_category_idx;
DROP INDEX IF EXISTS public.stock_access_items_store_sku_key;
DROP INDEX IF EXISTS public.stock_access_items_store_barcode_key;
DROP INDEX IF EXISTS public.stock_access_locations_store_key_key;

ALTER TABLE public.stock_access_transactions DROP COLUMN IF EXISTS store_key;
ALTER TABLE public.stock_access_warranty_records DROP COLUMN IF EXISTS store_key;
ALTER TABLE public.stock_access_locations DROP COLUMN IF EXISTS store_key;
ALTER TABLE public.stock_access_items DROP COLUMN IF EXISTS store_key;

CREATE UNIQUE INDEX IF NOT EXISTS stock_access_items_sku_key
  ON public.stock_access_items (lower(sku)) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS stock_access_items_barcode_key
  ON public.stock_access_items (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_access_items_category_idx
  ON public.stock_access_items (category, name) WHERE is_active;
ALTER TABLE public.stock_access_locations ADD CONSTRAINT stock_access_locations_key_key UNIQUE (key);

COMMIT;

NOTIFY pgrst, 'reload schema';
