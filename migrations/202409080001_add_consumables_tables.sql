-- Migration: Add consumables, consumable_stock_checks, and consumable_locations tables
-- Ensures stock-check popup has persistence with RLS ready columns.

BEGIN;

CREATE TABLE IF NOT EXISTS public.consumable_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.consumables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  location_id UUID REFERENCES public.consumable_locations(id) ON DELETE SET NULL,
  temporary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.consumable_stock_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumable_id UUID NOT NULL REFERENCES public.consumables(id) ON DELETE CASCADE,
  technician_id INTEGER REFERENCES public.users(user_id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consumables_location_id ON public.consumables(location_id);
CREATE INDEX IF NOT EXISTS idx_consumable_stock_checks_consumable_id ON public.consumable_stock_checks(consumable_id);

COMMENT ON TABLE public.consumables IS 'Consumables available in the workshop including temporary ad-hoc entries.';
COMMENT ON TABLE public.consumable_stock_checks IS 'Submitted stock check requests from technicians routed to the workshop manager.';
COMMENT ON COLUMN public.consumables.temporary IS 'True when the item was added for a one-off temporary stock check.';

COMMIT;
