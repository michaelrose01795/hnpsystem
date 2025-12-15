-- file location: src/lib/database/schema/addtable.sql
-- description: defines supplemental tables added beyond reference schema

-- Part categories with auto-detection keywords
CREATE TABLE IF NOT EXISTS public.part_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  keywords text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT part_categories_pkey PRIMARY KEY (id)
);

-- Insert default categories with keywords for auto-detection
INSERT INTO public.part_categories (name, keywords) VALUES
  ('Tyres', ARRAY['tyre', 'tire', 'wheel', 'tread', 'michelin', 'goodyear', 'pirelli', 'bridgestone', 'dunlop']),
  ('Brakes', ARRAY['brake', 'pad', 'disc', 'rotor', 'caliper', 'abs', 'handbrake']),
  ('Suspension', ARRAY['suspension', 'shock', 'spring', 'strut', 'damper', 'coil', 'bushing', 'arm']),
  ('Engine', ARRAY['engine', 'piston', 'cylinder', 'gasket', 'head', 'block', 'crankshaft', 'camshaft', 'valve']),
  ('Exhaust', ARRAY['exhaust', 'muffler', 'silencer', 'manifold', 'catalytic', 'cat', 'dpf', 'egr']),
  ('Filters', ARRAY['filter', 'oil filter', 'air filter', 'fuel filter', 'cabin filter', 'pollen']),
  ('Electrical', ARRAY['battery', 'alternator', 'starter', 'fuse', 'relay', 'sensor', 'ecu', 'wiring', 'bulb', 'light']),
  ('Transmission', ARRAY['gearbox', 'clutch', 'transmission', 'flywheel', 'driveshaft', 'cv joint', 'diff']),
  ('Cooling', ARRAY['radiator', 'coolant', 'thermostat', 'water pump', 'hose', 'fan', 'intercooler']),
  ('Fuel', ARRAY['fuel pump', 'injector', 'carburettor', 'carburetor', 'fuel line', 'tank']),
  ('Body', ARRAY['bumper', 'door', 'bonnet', 'hood', 'wing', 'mirror', 'glass', 'windscreen', 'panel']),
  ('Interior', ARRAY['seat', 'carpet', 'trim', 'dashboard', 'console', 'airbag', 'seatbelt']),
  ('Steering', ARRAY['steering', 'rack', 'pump', 'column', 'wheel', 'tie rod', 'power steering'])
ON CONFLICT (name) DO NOTHING;

