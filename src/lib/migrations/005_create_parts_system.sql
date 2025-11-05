-- ============================================
-- 005_create_parts_system.sql
-- Defines inventory, job allocation, delivery, and movement tables
-- along with supporting view and policies for the parts department.
-- ============================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure helper function for updated_at timestamps exists
CREATE OR REPLACE FUNCTION public.set_row_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Parts catalogue / inventory
-- ============================================
CREATE TABLE IF NOT EXISTS public.parts_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  supplier TEXT,
  oem_reference TEXT,
  barcode TEXT,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  qty_in_stock INTEGER NOT NULL DEFAULT 0,
  qty_reserved INTEGER NOT NULL DEFAULT 0,
  qty_on_order INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 0,
  storage_location TEXT,
  service_default_zone TEXT CHECK (
    service_default_zone IS NULL OR service_default_zone IN (
      'service_rack_1', 'service_rack_2', 'service_rack_3', 'service_rack_4'
    )
  ),
  sales_default_zone TEXT CHECK (
    sales_default_zone IS NULL OR sales_default_zone IN (
      'sales_rack_1', 'sales_rack_2', 'sales_rack_3', 'sales_rack_4'
    )
  ),
  stairs_default_zone TEXT CHECK (
    stairs_default_zone IS NULL OR stairs_default_zone IN (
      'stairs_pre_pick'
    )
  ),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_parts_catalog_updated_at
BEFORE UPDATE ON public.parts_catalog
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

CREATE INDEX IF NOT EXISTS idx_parts_catalog_part_number
  ON public.parts_catalog (part_number);

CREATE INDEX IF NOT EXISTS idx_parts_catalog_name
  ON public.parts_catalog USING gin (to_tsvector('simple', name));

-- ============================================
-- Job-specific parts allocations
-- ============================================
CREATE TABLE IF NOT EXISTS public.parts_job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.parts_catalog (id) ON DELETE RESTRICT,
  quantity_requested INTEGER NOT NULL DEFAULT 1,
  quantity_allocated INTEGER NOT NULL DEFAULT 0,
  quantity_fitted INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'awaiting_stock', 'allocated', 'picked', 'fitted', 'cancelled')
  ),
  origin TEXT DEFAULT 'vhc',
  pre_pick_location TEXT CHECK (
    pre_pick_location IS NULL OR pre_pick_location IN (
      'service_rack_1', 'service_rack_2', 'service_rack_3', 'service_rack_4',
      'sales_rack_1', 'sales_rack_2', 'sales_rack_3', 'sales_rack_4',
      'stairs_pre_pick'
    )
  ),
  storage_location TEXT,
  unit_cost NUMERIC(12,2),
  unit_price NUMERIC(12,2),
  request_notes TEXT,
  allocated_by UUID,
  picked_by UUID,
  fitted_by UUID,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_parts_job_items_updated_at
BEFORE UPDATE ON public.parts_job_items
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

CREATE INDEX IF NOT EXISTS idx_parts_job_items_job_id
  ON public.parts_job_items (job_id);

CREATE INDEX IF NOT EXISTS idx_parts_job_items_part_id
  ON public.parts_job_items (part_id);

CREATE INDEX IF NOT EXISTS idx_parts_job_items_status
  ON public.parts_job_items (status);

-- ============================================
-- Deliveries and delivery line items
-- ============================================
CREATE TABLE IF NOT EXISTS public.parts_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier TEXT,
  order_reference TEXT,
  status TEXT NOT NULL DEFAULT 'ordering' CHECK (
    status IN ('ordering', 'on_route', 'received', 'partial', 'cancelled')
  ),
  expected_date DATE,
  received_date DATE,
  notes TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_parts_deliveries_updated_at
BEFORE UPDATE ON public.parts_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

CREATE INDEX IF NOT EXISTS idx_parts_deliveries_status
  ON public.parts_deliveries (status);

CREATE TABLE IF NOT EXISTS public.parts_delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.parts_deliveries (id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.parts_catalog (id) ON DELETE RESTRICT,
  job_id UUID REFERENCES public.jobs (id) ON DELETE SET NULL,
  quantity_ordered INTEGER NOT NULL DEFAULT 0,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2),
  unit_price NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'ordered' CHECK (
    status IN ('ordered', 'backorder', 'received', 'cancelled')
  ),
  notes TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_parts_delivery_items_updated_at
BEFORE UPDATE ON public.parts_delivery_items
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

CREATE INDEX IF NOT EXISTS idx_parts_delivery_items_delivery
  ON public.parts_delivery_items (delivery_id);

CREATE INDEX IF NOT EXISTS idx_parts_delivery_items_part
  ON public.parts_delivery_items (part_id);

CREATE INDEX IF NOT EXISTS idx_parts_delivery_items_job
  ON public.parts_delivery_items (job_id);

-- ============================================
-- Stock movements / adjustments
-- ============================================
CREATE TABLE IF NOT EXISTS public.parts_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID NOT NULL REFERENCES public.parts_catalog (id) ON DELETE CASCADE,
  job_item_id UUID REFERENCES public.parts_job_items (id) ON DELETE SET NULL,
  delivery_item_id UUID REFERENCES public.parts_delivery_items (id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (
    movement_type IN ('delivery', 'allocation', 'return', 'adjustment', 'stock_take', 'correction')
  ),
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC(12,2),
  unit_price NUMERIC(12,2),
  reference TEXT,
  notes TEXT,
  performed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parts_stock_movements_part
  ON public.parts_stock_movements (part_id);

CREATE INDEX IF NOT EXISTS idx_parts_stock_movements_type
  ON public.parts_stock_movements (movement_type);

-- ============================================
-- Manager summary view
-- ============================================
CREATE OR REPLACE VIEW public.parts_manager_summary AS
WITH stock AS (
  SELECT
    COALESCE(SUM(qty_in_stock), 0)::BIGINT AS total_parts_in_stock,
    COALESCE(SUM(qty_in_stock * unit_cost), 0)::NUMERIC(18,2) AS stock_value,
    COALESCE(SUM(qty_reserved * unit_cost), 0)::NUMERIC(18,2) AS reserved_value,
    COALESCE(SUM(qty_on_order * unit_cost), 0)::NUMERIC(18,2) AS on_order_value
  FROM public.parts_catalog
),
income AS (
  SELECT
    COALESCE(SUM(quantity_fitted * COALESCE(unit_price, unit_cost, 0)), 0)::NUMERIC(18,2) AS total_income
  FROM public.parts_job_items
),
spending AS (
  SELECT
    COALESCE(SUM(quantity_received * COALESCE(unit_cost, 0)), 0)::NUMERIC(18,2) AS total_spending
  FROM public.parts_delivery_items
),
deliveries AS (
  SELECT
    COALESCE(COUNT(*), 0)::BIGINT AS outstanding_delivery_count
  FROM public.parts_deliveries
  WHERE status NOT IN ('received', 'cancelled')
)
SELECT
  stock.total_parts_in_stock,
  stock.stock_value,
  stock.reserved_value,
  stock.on_order_value,
  income.total_income,
  spending.total_spending,
  deliveries.outstanding_delivery_count,
  NOW() AS generated_at
FROM stock, income, spending, deliveries;

-- ============================================
-- Row level security & policies
-- ============================================
ALTER TABLE public.parts_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts_job_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts_delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts_stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY parts_catalog_select
  ON public.parts_catalog
  FOR SELECT
  USING (get_user_role() IN ('admin', 'parts_manager', 'parts_staff', 'service_manager', 'workshop_manager'));

CREATE POLICY parts_catalog_insert
  ON public.parts_catalog
  FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'parts_manager'));

CREATE POLICY parts_catalog_update
  ON public.parts_catalog
  FOR UPDATE
  USING (get_user_role() IN ('admin', 'parts_manager'))
  WITH CHECK (get_user_role() IN ('admin', 'parts_manager'));

CREATE POLICY parts_catalog_delete
  ON public.parts_catalog
  FOR DELETE
  USING (get_user_role() IN ('admin', 'parts_manager'));

CREATE POLICY parts_job_items_select
  ON public.parts_job_items
  FOR SELECT
  USING (get_user_role() IN ('admin', 'parts_manager', 'parts_staff', 'service_manager', 'workshop_manager'));

CREATE POLICY parts_job_items_insert
  ON public.parts_job_items
  FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'parts_manager', 'parts_staff'));

CREATE POLICY parts_job_items_update
  ON public.parts_job_items
  FOR UPDATE
  USING (get_user_role() IN ('admin', 'parts_manager', 'parts_staff'))
  WITH CHECK (get_user_role() IN ('admin', 'parts_manager', 'parts_staff'));

CREATE POLICY parts_job_items_delete
  ON public.parts_job_items
  FOR DELETE
  USING (get_user_role() IN ('admin', 'parts_manager'));

CREATE POLICY parts_deliveries_select
  ON public.parts_deliveries
  FOR SELECT
  USING (get_user_role() IN ('admin', 'parts_manager', 'parts_staff'));

CREATE POLICY parts_deliveries_insert
  ON public.parts_deliveries
  FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'parts_manager'));

CREATE POLICY parts_deliveries_update
  ON public.parts_deliveries
  FOR UPDATE
  USING (get_user_role() IN ('admin', 'parts_manager'))
  WITH CHECK (get_user_role() IN ('admin', 'parts_manager'));

CREATE POLICY parts_deliveries_delete
  ON public.parts_deliveries
  FOR DELETE
  USING (get_user_role() IN ('admin', 'parts_manager'));

CREATE POLICY parts_delivery_items_select
  ON public.parts_delivery_items
  FOR SELECT
  USING (get_user_role() IN ('admin', 'parts_manager', 'parts_staff'));

CREATE POLICY parts_delivery_items_insert
  ON public.parts_delivery_items
  FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'parts_manager', 'parts_staff'));

CREATE POLICY parts_delivery_items_update
  ON public.parts_delivery_items
  FOR UPDATE
  USING (get_user_role() IN ('admin', 'parts_manager', 'parts_staff'))
  WITH CHECK (get_user_role() IN ('admin', 'parts_manager', 'parts_staff'));

CREATE POLICY parts_delivery_items_delete
  ON public.parts_delivery_items
  FOR DELETE
  USING (get_user_role() IN ('admin', 'parts_manager'));

CREATE POLICY parts_stock_movements_select
  ON public.parts_stock_movements
  FOR SELECT
  USING (get_user_role() IN ('admin', 'parts_manager', 'parts_staff'));

CREATE POLICY parts_stock_movements_insert
  ON public.parts_stock_movements
  FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'parts_manager', 'parts_staff'));

CREATE POLICY parts_stock_movements_delete
  ON public.parts_stock_movements
  FOR DELETE
  USING (get_user_role() IN ('admin', 'parts_manager'));

COMMIT;
