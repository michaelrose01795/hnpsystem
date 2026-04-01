-- file location: supabase/seed/test-seed.sql
-- Test seed data for local development and E2E tests.
-- Run with: npm run db:seed
-- Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING.

-- ============================================================
-- Test users (required for dev login via credentials provider)
-- ============================================================
INSERT INTO users (user_id, first_name, last_name, email, role, password_hash)
VALUES
  (1, 'Admin', 'Manager', 'admin@test.local', 'Admin Manager', 'testpass123'),
  (2, 'Service', 'Adviser', 'service@test.local', 'Service', 'testpass123'),
  (3, 'Workshop', 'Manager', 'workshop@test.local', 'Workshop Manager', 'testpass123'),
  (4, 'Test', 'Technician', 'tech@test.local', 'Techs', 'testpass123'),
  (5, 'Parts', 'Manager', 'parts@test.local', 'Parts Manager', 'testpass123'),
  (6, 'Test', 'Customer', 'customer@test.local', 'Customer', 'testpass123')
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- Test customers
-- ============================================================
INSERT INTO customers (id, title, first_name, last_name, email, phone, address_line_1, postcode)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Mr', 'John', 'Smith', 'john.smith@test.local', '07700900001', '10 High Street', 'AB1 2CD'),
  ('00000000-0000-0000-0000-000000000002', 'Mrs', 'Jane', 'Doe', 'jane.doe@test.local', '07700900002', '20 Main Road', 'EF3 4GH')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Test vehicles
-- ============================================================
INSERT INTO vehicles (id, registration, make, model, year, colour, fuel_type, mileage, customer_id)
VALUES
  ('00000000-0000-0000-0000-000000000010', 'AB12CDE', 'Toyota', 'Corolla', 2022, 'Silver', 'Petrol', 25000, '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000011', 'FG34HIJ', 'Ford', 'Focus', 2021, 'Blue', 'Diesel', 42000, '00000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Test job (seed-stable, used by smoke tests)
-- ============================================================
INSERT INTO jobs (id, job_number, status, description, type, customer_id, vehicle_id, assigned_to, vhc_required)
VALUES
  (99990, 'SEED-001', 'New', 'Full service and MOT', 'Service', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 4, true)
ON CONFLICT (id) DO NOTHING;

-- Seed job requests
INSERT INTO job_requests (job_id, description, hours, job_type)
VALUES
  (99990, 'Full service', 2.0, 'Customer'),
  (99990, 'MOT test', 0.75, 'MOT')
ON CONFLICT DO NOTHING;
