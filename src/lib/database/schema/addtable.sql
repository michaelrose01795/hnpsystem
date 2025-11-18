-- // file location: src/lib/database/schema/addtable.sql
-- // description: defines supplemental tables added beyond reference schema

-- Workshop consumables tracking -------------------------------------------
CREATE TABLE IF NOT EXISTS workshop_consumables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  part_number TEXT,
  supplier TEXT,
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  estimated_quantity INTEGER NOT NULL DEFAULT 0,
  last_order_date DATE,
  next_estimated_order_date DATE,
  last_order_quantity INTEGER NOT NULL DEFAULT 0,
  last_order_total_value NUMERIC(14, 2),
  reorder_frequency_days INTEGER DEFAULT 30,
  is_required BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workshop_consumable_orders (
  order_id BIGSERIAL PRIMARY KEY,
  consumable_id UUID NOT NULL REFERENCES workshop_consumables(id) ON DELETE CASCADE,
  order_date DATE NOT NULL DEFAULT now(),
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_value NUMERIC(14, 2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  supplier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
