-- // file location: src/lib/database/schema/addtable.sql
-- // description: defines supplemental tables added beyond reference schema

-- Ensure job notes track who last updated each entry
ALTER TABLE job_notes
  ADD COLUMN IF NOT EXISTS last_updated_by integer;

ALTER TABLE job_notes
  ADD CONSTRAINT IF NOT EXISTS job_notes_last_updated_by_fkey
    FOREIGN KEY (last_updated_by) REFERENCES public.users(user_id);

-- Seed a few catalogue rows so parts dashboards can show data in fresh environments
INSERT INTO public.parts_catalog (
  part_number,
  name,
  category,
  supplier,
  unit_cost,
  unit_price,
  qty_in_stock,
  qty_reserved,
  qty_on_order,
  reorder_level,
  storage_location,
  service_default_zone,
  notes,
  created_at,
  updated_at
)
VALUES
  (
    'BRK-FR-001',
    'Front brake kit',
    'Brakes',
    'TPS Leeds',
    180,
    285,
    2,
    0,
    1,
    2,
    'Aisle 1 / Bin 3',
    'service_rack_1',
    'Seed data for dev',
    NOW(),
    NOW()
  ),
  (
    'CAB-FLTR-019',
    'OEM cabin filter',
    'HVAC',
    'TPS Leeds',
    12.5,
    29.5,
    12,
    0,
    0,
    5,
    'Aisle 4 / Bin 9',
    'service_rack_2',
    'Seed data for dev',
    NOW(),
    NOW()
  ),
  (
    'WHL-19-SET',
    '19" diamond cut wheel (set of 4)',
    'Wheels',
    'VW UK',
    980,
    1280,
    1,
    0,
    0,
    1,
    'Bulk storage',
    'service_rack_3',
    'Seed data for dev',
    NOW(),
    NOW()
  )
ON CONFLICT (part_number) DO NOTHING;

-- Record a stock movement so the inventory page can show baseline history
INSERT INTO public.parts_stock_movements (
  part_id,
  movement_type,
  quantity,
  unit_cost,
  reference,
  notes
)
SELECT
  p.id,
  'stock_take',
  p.qty_in_stock,
  p.unit_cost,
  format('seed-%s', p.part_number),
  'Initial seeded inventory level'
FROM public.parts_catalog p
WHERE p.part_number IN ('BRK-FR-001', 'CAB-FLTR-019', 'WHL-19-SET')
  AND NOT EXISTS (
    SELECT 1
    FROM public.parts_stock_movements m
    WHERE m.reference = format('seed-%s', p.part_number)
  );

CREATE TABLE IF NOT EXISTS public.parts_delivery_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id integer NOT NULL,
  customer_id uuid NOT NULL,
  delivery_date date NOT NULL,
  time_leave time,
  time_arrive time,
  mileage integer NOT NULL DEFAULT 0,
  fuel_cost numeric NOT NULL DEFAULT 0,
  stops_count integer NOT NULL DEFAULT 1,
  destination_address text,
  status text NOT NULL DEFAULT 'planned'::text CHECK (status = ANY (ARRAY['planned'::text, 'dispatched'::text, 'completed'::text, 'cancelled'::text])),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT parts_delivery_runs_pkey PRIMARY KEY (id),
  CONSTRAINT parts_delivery_runs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id),
  CONSTRAINT parts_delivery_runs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);

CREATE TABLE IF NOT EXISTS public.parts_delivery_settings (
  fuel_type text NOT NULL PRIMARY KEY,
  price_per_litre numeric NOT NULL,
  last_updated timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO public.parts_delivery_settings (fuel_type, price_per_litre)
VALUES ('diesel', 1.75)
ON CONFLICT (fuel_type) DO UPDATE
  SET price_per_litre = EXCLUDED.price_per_litre,
      last_updated = now();
