-- // file location: src/lib/database/schema/addtable.sql
-- // description: defines supplemental tables added beyond reference schema

-- Seed data for the Parts workspace (kept minimal so local/dev builds have real rows)
INSERT INTO jobs (
  job_number,
  vehicle_reg,
  vehicle_make_model,
  status,
  waiting_status,
  description,
  type,
  created_at,
  updated_at
) VALUES (
  'SEED-JOB-5001',
  'SE12ABC',
  'Toyota Corolla',
  'New',
  'Waiting on parts',
  'Seed job created for the parts workspace',
  'Service',
  now(),
  now()
) ON CONFLICT (job_number) DO NOTHING;

INSERT INTO parts_catalog (
  part_number,
  name,
  category,
  description,
  supplier,
  storage_location,
  service_default_zone,
  unit_cost,
  unit_price,
  qty_in_stock,
  qty_reserved,
  qty_on_order,
  reorder_level,
  is_active,
  created_at,
  updated_at
) VALUES (
  'BRAKE-PAD-L',
  'Front Brake Pads (Seed)',
  'Brakes',
  'Seed row for front brake pads',
  'RPM Supplies',
  'Rack A1',
  'service_rack_1',
  24.5,
  58.0,
  14,
  2,
  3,
  8,
  true,
  now(),
  now()
) ON CONFLICT (part_number) DO NOTHING;

INSERT INTO parts_catalog (
  part_number,
  name,
  category,
  description,
  supplier,
  storage_location,
  sales_default_zone,
  unit_cost,
  unit_price,
  qty_in_stock,
  qty_reserved,
  qty_on_order,
  reorder_level,
  is_active,
  created_at,
  updated_at
) VALUES (
  'OIL-FILTER-PRE',
  'Premium Oil Filter (Seed)',
  'Filters',
  'Demo oil filter line used to validate the catalogue',
  'RPM Supplies',
  'Shelf B2',
  'sales_rack_1',
  8.75,
  21.5,
  32,
  1,
  0,
  6,
  true,
  now(),
  now()
) ON CONFLICT (part_number) DO NOTHING;

INSERT INTO parts_job_items (
  job_id,
  part_id,
  quantity_requested,
  quantity_allocated,
  quantity_fitted,
  status,
  origin,
  pre_pick_location,
  storage_location,
  unit_cost,
  unit_price,
  request_notes,
  created_at,
  updated_at
) SELECT
  job.id,
  part.id,
  2,
  0,
  0,
  'pending',
  'vhc',
  'service_rack_1',
  'Shelves A1',
  COALESCE(part.unit_cost, 0),
  COALESCE(part.unit_price, 0),
  'Seed job item to keep the workspace busy',
  now(),
  now()
FROM
  (SELECT id FROM jobs WHERE job_number = 'SEED-JOB-5001') job,
  (SELECT id, unit_cost, unit_price FROM parts_catalog WHERE part_number = 'BRAKE-PAD-L') part
WHERE
  job.id IS NOT NULL
  AND part.id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO parts_requests (
  job_id,
  quantity,
  status,
  source,
  description,
  part_id,
  created_at,
  updated_at
) SELECT
  job.id,
  1,
  'waiting_authorisation',
  'tech_request',
  'Seed request generated from the consumables tracker',
  part.id,
  now(),
  now()
FROM
  (SELECT id FROM jobs WHERE job_number = 'SEED-JOB-5001') job,
  (SELECT id FROM parts_catalog WHERE part_number = 'OIL-FILTER-PRE') part
WHERE
  job.id IS NOT NULL
  AND part.id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO parts_deliveries (
  id,
  supplier,
  order_reference,
  status,
  expected_date,
  notes,
  created_at,
  updated_at
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  'RPM Supplies',
  'SEED-DEL-001',
  'on_route',
  CURRENT_DATE + INTERVAL '3 days',
  'Seed delivery used for demo purposes',
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO parts_delivery_items (
  delivery_id,
  part_id,
  job_id,
  quantity_ordered,
  quantity_received,
  unit_cost,
  unit_price,
  status,
  notes,
  created_at,
  updated_at
) SELECT
  delivery.id,
  part.id,
  job.id,
  5,
  0,
  COALESCE(part.unit_cost, 0),
  COALESCE(part.unit_price, 0),
  'ordered',
  'Seed inbound items to exercise the deliveries table',
  now(),
  now()
FROM
  (SELECT id FROM parts_deliveries WHERE order_reference = 'SEED-DEL-001') delivery,
  (SELECT id, unit_cost, unit_price FROM parts_catalog WHERE part_number = 'BRAKE-PAD-L') part,
  (SELECT id FROM jobs WHERE job_number = 'SEED-JOB-5001') job
WHERE
  delivery.id IS NOT NULL
  AND part.id IS NOT NULL
  AND job.id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO parts_stock_movements (
  part_id,
  delivery_item_id,
  movement_type,
  quantity,
  unit_cost,
  notes,
  created_at
) SELECT
  part.id,
  item.id,
  'delivery',
  5,
  item.unit_cost,
  'Seed stock movement tied to the inbound delivery',
  now()
FROM
  (SELECT id FROM parts_catalog WHERE part_number = 'BRAKE-PAD-L') part,
  (SELECT id, unit_cost FROM parts_delivery_items WHERE delivery_id = (SELECT id FROM parts_deliveries WHERE order_reference = 'SEED-DEL-001') AND part_id = (SELECT id FROM parts_catalog WHERE part_number = 'BRAKE-PAD-L')) item
WHERE
  part.id IS NOT NULL
  AND item.id IS NOT NULL
ON CONFLICT DO NOTHING;

