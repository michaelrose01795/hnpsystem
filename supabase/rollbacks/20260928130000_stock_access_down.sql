-- Rollback for supabase/migrations/20260928130000_stock_access.sql
--
-- Drops the Stock Access (/access) ledger and every record in it. Export
-- stock_access_transactions first if the history must be kept. Safe to run
-- whether or not the migration was applied (dropping a table drops its
-- triggers, so no DROP TRIGGER is needed).

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.audit_tracked_tables') IS NOT NULL THEN
    DELETE FROM public.audit_tracked_tables WHERE table_name LIKE 'stock\_access\_%';
  END IF;
  IF to_regclass('public.audit_excluded_tables') IS NOT NULL THEN
    DELETE FROM public.audit_excluded_tables WHERE table_name LIKE 'stock\_access\_%';
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.stock_access_apply(uuid, text, numeric, numeric, boolean, jsonb, jsonb, jsonb);
DROP TABLE IF EXISTS public.stock_access_transactions;
DROP FUNCTION IF EXISTS public.stock_access_transactions_immutable();
DROP TABLE IF EXISTS public.stock_access_warranty_records;
DROP TABLE IF EXISTS public.stock_access_restock_requests;
DROP TABLE IF EXISTS public.stock_access_checkouts;
DROP TABLE IF EXISTS public.stock_access_items;
DROP TABLE IF EXISTS public.stock_access_locations;

COMMIT;

NOTIFY pgrst, 'reload schema';
