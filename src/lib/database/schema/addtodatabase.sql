-- Reporting Phase 16.1 - final acceptance blocker schema.
-- Apply this whole file in Supabase SQL editor to create/update the reporting
-- schema from the repo. It intentionally mirrors
-- src/lib/database/schema/reporting/000_all_reporting.sql.

CREATE TABLE IF NOT EXISTS public.dim_department (
  code text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL,
  parent_code text REFERENCES public.dim_department(code),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dim_department
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.dim_actor (
  actor_id bigserial PRIMARY KEY,
  canonical_user_id integer,
  users_user_id integer,
  auth_uuid uuid,
  current_role_name text,
  current_department text REFERENCES public.dim_department(code),
  display_name text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dim_kpi (
  kpi_id text PRIMARY KEY,
  label text NOT NULL,
  department text NOT NULL REFERENCES public.dim_department(code),
  related_departments text[] NOT NULL DEFAULT '{}',
  tier text,
  readiness text,
  unit text,
  format text,
  formula_version text NOT NULL DEFAULT 'v1',
  source_type text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.report_event (
  event_id bigserial PRIMARY KEY,
  event_uuid text NOT NULL,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  event_name text NOT NULL,
  event_category text,
  domain text,
  entity_type text,
  entity_id text,
  parent_entity_type text,
  parent_entity_id text,
  from_state text,
  to_state text,
  actor_kind text NOT NULL DEFAULT 'system',
  actor_user_id integer,
  actor_auth_uuid uuid,
  actor_role text,
  owner_department text REFERENCES public.dim_department(code),
  related_departments text[] NOT NULL DEFAULT '{}',
  amount_gbp numeric(14,2),
  quantity numeric(14,4),
  duration_seconds integer,
  payload jsonb,
  source text NOT NULL DEFAULT 'emit',
  formula_context jsonb
);

CREATE TABLE IF NOT EXISTS public.parts_job_items_status_history (
  id bigserial PRIMARY KEY,
  entity_id text,
  from_status text,
  to_status text,
  changed_by integer,
  actor_kind text NOT NULL DEFAULT 'system',
  reason text,
  department text REFERENCES public.dim_department(code),
  changed_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb
);

CREATE TABLE IF NOT EXISTS public.vhc_item_status_history (
  id bigserial PRIMARY KEY,
  entity_id text,
  from_status text,
  to_status text,
  changed_by integer,
  actor_kind text NOT NULL DEFAULT 'system',
  reason text,
  department text REFERENCES public.dim_department(code),
  changed_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb
);

CREATE TABLE IF NOT EXISTS public.invoice_status_history (
  id bigserial PRIMARY KEY,
  entity_id text,
  from_status text,
  to_status text,
  changed_by integer,
  actor_kind text NOT NULL DEFAULT 'system',
  reason text,
  department text REFERENCES public.dim_department(code),
  changed_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb
);

CREATE TABLE IF NOT EXISTS public.account_status_history (
  id bigserial PRIMARY KEY,
  entity_id text,
  from_status text,
  to_status text,
  changed_by integer,
  actor_kind text NOT NULL DEFAULT 'system',
  reason text,
  department text REFERENCES public.dim_department(code),
  changed_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb
);

CREATE TABLE IF NOT EXISTS public.appointment_status_history (
  id bigserial PRIMARY KEY,
  entity_id text,
  from_status text,
  to_status text,
  changed_by integer,
  actor_kind text NOT NULL DEFAULT 'system',
  reason text,
  department text REFERENCES public.dim_department(code),
  changed_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb
);

CREATE TABLE IF NOT EXISTS public.delivery_status_history (
  id bigserial PRIMARY KEY,
  entity_id text,
  from_status text,
  to_status text,
  changed_by integer,
  actor_kind text NOT NULL DEFAULT 'system',
  reason text,
  department text REFERENCES public.dim_department(code),
  changed_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb
);

CREATE TABLE IF NOT EXISTS public.kpi_daily_snapshot (
  snapshot_id bigserial PRIMARY KEY,
  kpi_id text NOT NULL,
  day date NOT NULL,
  department text NOT NULL DEFAULT 'all',
  team text NOT NULL DEFAULT 'all',
  value numeric,
  numerator numeric,
  denominator numeric,
  count numeric,
  amount_gbp numeric(14,2),
  formula_version text NOT NULL DEFAULT 'v1',
  source text,
  built_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kpi_weekly_snapshot (
  snapshot_id bigserial PRIMARY KEY,
  kpi_id text NOT NULL,
  iso_week text NOT NULL,
  department text NOT NULL DEFAULT 'all',
  team text NOT NULL DEFAULT 'all',
  value numeric,
  numerator numeric,
  denominator numeric,
  count numeric,
  amount_gbp numeric(14,2),
  formula_version text NOT NULL DEFAULT 'v1',
  built_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kpi_monthly_snapshot (
  snapshot_id bigserial PRIMARY KEY,
  kpi_id text NOT NULL,
  year_month text NOT NULL,
  department text NOT NULL DEFAULT 'all',
  team text NOT NULL DEFAULT 'all',
  value numeric,
  numerator numeric,
  denominator numeric,
  count numeric,
  amount_gbp numeric(14,2),
  formula_version text NOT NULL DEFAULT 'v1',
  built_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kpi_quarterly_snapshot (
  snapshot_id bigserial PRIMARY KEY,
  kpi_id text NOT NULL,
  year_quarter text NOT NULL,
  department text NOT NULL DEFAULT 'all',
  team text NOT NULL DEFAULT 'all',
  value numeric,
  numerator numeric,
  denominator numeric,
  count numeric,
  amount_gbp numeric(14,2),
  formula_version text NOT NULL DEFAULT 'v1',
  built_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kpi_yearly_snapshot (
  snapshot_id bigserial PRIMARY KEY,
  kpi_id text NOT NULL,
  year text NOT NULL,
  department text NOT NULL DEFAULT 'all',
  team text NOT NULL DEFAULT 'all',
  value numeric,
  numerator numeric,
  denominator numeric,
  count numeric,
  amount_gbp numeric(14,2),
  formula_version text NOT NULL DEFAULT 'v1',
  built_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.report_entity_state_snapshot (
  snapshot_id bigserial PRIMARY KEY,
  metric_id text NOT NULL,
  day date NOT NULL,
  department text NOT NULL DEFAULT 'all',
  bucket text NOT NULL,
  count numeric,
  amount_gbp numeric(14,2),
  built_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.report_aggregation_run (
  run_id bigserial PRIMARY KEY,
  cadence text NOT NULL,
  period_key text NOT NULL,
  kpi_count integer,
  row_count integer,
  status text NOT NULL DEFAULT 'ok',
  reason text,
  finished_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.report_saved_view (
  view_id bigserial PRIMARY KEY,
  owner_user_id integer NOT NULL,
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'personal',
  target_ref text,
  filter jsonb,
  layout jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_saved_view_scope_chk CHECK (scope IN ('personal', 'shared'))
);

CREATE TABLE IF NOT EXISTS public.report_user_preferences (
  user_id integer PRIMARY KEY,
  default_department text,
  default_range text,
  default_dashboard text,
  density text,
  units text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mot_test_status_history (
  id bigserial PRIMARY KEY,
  entity_id text,
  from_status text,
  to_status text,
  changed_by integer,
  actor_kind text NOT NULL DEFAULT 'system',
  reason text,
  department text REFERENCES public.dim_department(code),
  changed_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb
);

CREATE TABLE IF NOT EXISTS public.wash_status_history (
  id bigserial PRIMARY KEY,
  entity_id text,
  from_status text,
  to_status text,
  changed_by integer,
  actor_kind text NOT NULL DEFAULT 'system',
  reason text,
  department text REFERENCES public.dim_department(code),
  changed_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb
);

CREATE TABLE IF NOT EXISTS public.paint_stage_history (
  id bigserial PRIMARY KEY,
  entity_id text,
  from_status text,
  to_status text,
  changed_by integer,
  actor_kind text NOT NULL DEFAULT 'system',
  reason text,
  department text REFERENCES public.dim_department(code),
  changed_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb
);

ALTER TABLE public.dim_department ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_actor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_kpi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts_job_items_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vhc_item_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_daily_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_weekly_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_monthly_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_quarterly_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_yearly_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_entity_state_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_aggregation_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_saved_view ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mot_test_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wash_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paint_stage_history ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS report_event_uuid_idx ON public.report_event(event_uuid);
CREATE UNIQUE INDEX IF NOT EXISTS kpi_daily_snapshot_unique_idx ON public.kpi_daily_snapshot(kpi_id, day, department, team, formula_version);
CREATE UNIQUE INDEX IF NOT EXISTS kpi_weekly_snapshot_unique_idx ON public.kpi_weekly_snapshot(kpi_id, iso_week, department, team, formula_version);
CREATE UNIQUE INDEX IF NOT EXISTS kpi_monthly_snapshot_unique_idx ON public.kpi_monthly_snapshot(kpi_id, year_month, department, team, formula_version);
CREATE UNIQUE INDEX IF NOT EXISTS kpi_quarterly_snapshot_unique_idx ON public.kpi_quarterly_snapshot(kpi_id, year_quarter, department, team, formula_version);
CREATE UNIQUE INDEX IF NOT EXISTS kpi_yearly_snapshot_unique_idx ON public.kpi_yearly_snapshot(kpi_id, year, department, team, formula_version);
CREATE UNIQUE INDEX IF NOT EXISTS report_entity_state_snapshot_unique_idx ON public.report_entity_state_snapshot(metric_id, day, department, bucket);
CREATE INDEX IF NOT EXISTS report_saved_view_owner_idx ON public.report_saved_view(owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS report_saved_view_target_idx ON public.report_saved_view(target_ref);
CREATE INDEX IF NOT EXISTS report_saved_view_scope_idx ON public.report_saved_view(scope);
CREATE INDEX IF NOT EXISTS report_aggregation_run_finished_idx ON public.report_aggregation_run(finished_at DESC);
CREATE INDEX IF NOT EXISTS report_event_occurred_at_idx ON public.report_event(occurred_at);
CREATE INDEX IF NOT EXISTS report_event_name_idx ON public.report_event(event_name);
CREATE INDEX IF NOT EXISTS report_event_entity_idx ON public.report_event(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS report_event_owner_department_idx ON public.report_event(owner_department);
CREATE INDEX IF NOT EXISTS report_event_actor_user_idx ON public.report_event(actor_user_id);

INSERT INTO public.dim_department (code, name, kind, parent_code)
VALUES
  ('management', 'Management', 'oversight', null),
  ('aftersales', 'Aftersales', 'group', 'management'),
  ('system', 'System', 'system', null),
  ('workshop', 'Workshop', 'operational', 'aftersales'),
  ('parts', 'Parts', 'operational', 'aftersales'),
  ('service', 'Service Advisors', 'operational', 'aftersales'),
  ('mot', 'MOT', 'operational', 'aftersales'),
  ('valeting', 'Valeting', 'operational', 'aftersales'),
  ('paint', 'Paint / Bodyshop', 'operational', 'aftersales'),
  ('accounts', 'Accounts', 'commercial', 'management'),
  ('admin', 'Admin', 'support', 'management'),
  ('hr', 'HR', 'support-sensitive', 'management')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  parent_code = EXCLUDED.parent_code,
  updated_at = now();
