-- file location: src/lib/database/schema/addtable.sql
-- description: defines supplemental tables added beyond reference schema

-- ============================================================
-- Company Settings Table
-- Stores company-wide configuration including VAT rate, labour rates, etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  setting_type text NOT NULL DEFAULT 'string'::text CHECK (setting_type = ANY (ARRAY['string'::text, 'number'::text, 'boolean'::text, 'json'::text])),
  description text,
  updated_by integer,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT company_settings_pkey PRIMARY KEY (id),
  CONSTRAINT company_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(user_id)
);

-- Create index for faster lookups by setting_key
CREATE INDEX IF NOT EXISTS idx_company_settings_key ON public.company_settings(setting_key);

-- Insert default values for VAT rate and labour rate
INSERT INTO public.company_settings (setting_key, setting_value, setting_type, description)
VALUES
  ('vat_rate', '20.0', 'number', 'VAT percentage rate (e.g., 20 for 20%)'),
  ('default_labour_rate', '85.0', 'number', 'Default labour rate per hour in GBP'),
  ('invoice_terms', '30', 'number', 'Default payment terms in days'),
  ('company_name', 'HNP System', 'string', 'Company name for invoices'),
  ('company_address', '', 'string', 'Company address for invoices'),
  ('company_phone', '', 'string', 'Company phone number'),
  ('company_email', '', 'string', 'Company email address')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- Workshop Consumable Usage Table
-- Links consumables to specific jobs for invoice tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workshop_consumable_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id integer NOT NULL,
  consumable_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost numeric NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  total_cost numeric GENERATED ALWAYS AS (quantity::numeric * unit_cost) STORED,
  used_by integer,
  used_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workshop_consumable_usage_pkey PRIMARY KEY (id),
  CONSTRAINT workshop_consumable_usage_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE,
  CONSTRAINT workshop_consumable_usage_consumable_id_fkey FOREIGN KEY (consumable_id) REFERENCES public.workshop_consumables(id) ON DELETE RESTRICT,
  CONSTRAINT workshop_consumable_usage_used_by_fkey FOREIGN KEY (used_by) REFERENCES public.users(user_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_workshop_consumable_usage_job_id ON public.workshop_consumable_usage(job_id);
CREATE INDEX IF NOT EXISTS idx_workshop_consumable_usage_consumable_id ON public.workshop_consumable_usage(consumable_id);
CREATE INDEX IF NOT EXISTS idx_workshop_consumable_usage_used_at ON public.workshop_consumable_usage(used_at);

