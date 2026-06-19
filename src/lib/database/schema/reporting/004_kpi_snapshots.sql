-- ===========================================================================
-- Reporting foundation — 004 KPI snapshots & rollups
-- Additive, idempotent. Implements Phase-2 §9 (snapshots) + §10 (aggregation).
-- Immutable once written (except explicit recompute). Store ratio INPUTS
-- (numerator/denominator/count), never just the ratio (ADR-16). App-upserted by
-- the aggregation cron (no triggers).
-- ===========================================================================

-- Daily snapshot — one row per (kpi x day x department x team x formula_version).
CREATE TABLE IF NOT EXISTS public.kpi_daily_snapshot (
  snapshot_id     bigserial PRIMARY KEY,
  kpi_id          text NOT NULL,
  day             date NOT NULL,
  department      text NOT NULL DEFAULT 'all',
  team            text NOT NULL DEFAULT 'all',
  value           numeric,
  numerator       numeric,
  denominator     numeric,
  count           bigint,
  amount_gbp      numeric,
  formula_version text NOT NULL DEFAULT 'v1',
  source          text,   -- event|history|base|live-fallback
  built_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kpi_id, day, department, team, formula_version)
);
CREATE INDEX IF NOT EXISTS kpi_daily_snapshot_lookup_idx
  ON public.kpi_daily_snapshot(kpi_id, department, day);

-- Weekly rollup (Phase-2 §9.3) — derived from daily, recombines num/den for ratios.
CREATE TABLE IF NOT EXISTS public.kpi_weekly_snapshot (
  snapshot_id     bigserial PRIMARY KEY,
  kpi_id          text NOT NULL,
  iso_week        text NOT NULL,            -- e.g. 2026-W25
  department      text NOT NULL DEFAULT 'all',
  team            text NOT NULL DEFAULT 'all',
  value           numeric,
  numerator       numeric,
  denominator     numeric,
  count           bigint,
  amount_gbp      numeric,
  formula_version text NOT NULL DEFAULT 'v1',
  built_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kpi_id, iso_week, department, team, formula_version)
);
CREATE INDEX IF NOT EXISTS kpi_weekly_snapshot_lookup_idx
  ON public.kpi_weekly_snapshot(kpi_id, department, iso_week);

-- Monthly rollup.
CREATE TABLE IF NOT EXISTS public.kpi_monthly_snapshot (
  snapshot_id     bigserial PRIMARY KEY,
  kpi_id          text NOT NULL,
  year_month      text NOT NULL,            -- e.g. 2026-06
  department      text NOT NULL DEFAULT 'all',
  team            text NOT NULL DEFAULT 'all',
  value           numeric,
  numerator       numeric,
  denominator     numeric,
  count           bigint,
  amount_gbp      numeric,
  formula_version text NOT NULL DEFAULT 'v1',
  built_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kpi_id, year_month, department, team, formula_version)
);
CREATE INDEX IF NOT EXISTS kpi_monthly_snapshot_lookup_idx
  ON public.kpi_monthly_snapshot(kpi_id, department, year_month);

-- Quarterly rollup.
CREATE TABLE IF NOT EXISTS public.kpi_quarterly_snapshot (
  snapshot_id     bigserial PRIMARY KEY,
  kpi_id          text NOT NULL,
  year_quarter    text NOT NULL,            -- e.g. 2026-Q2
  department      text NOT NULL DEFAULT 'all',
  team            text NOT NULL DEFAULT 'all',
  value           numeric,
  numerator       numeric,
  denominator     numeric,
  count           bigint,
  amount_gbp      numeric,
  formula_version text NOT NULL DEFAULT 'v1',
  built_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kpi_id, year_quarter, department, team, formula_version)
);

-- Yearly rollup.
CREATE TABLE IF NOT EXISTS public.kpi_yearly_snapshot (
  snapshot_id     bigserial PRIMARY KEY,
  kpi_id          text NOT NULL,
  year            integer NOT NULL,
  department      text NOT NULL DEFAULT 'all',
  team            text NOT NULL DEFAULT 'all',
  value           numeric,
  numerator       numeric,
  denominator     numeric,
  count           bigint,
  amount_gbp      numeric,
  formula_version text NOT NULL DEFAULT 'v1',
  built_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kpi_id, year, department, team, formula_version)
);

-- Entity-state snapshots (Phase-2 §9.3) — point-in-time backlog that cannot be
-- reconstructed from flow events alone (a backlog is not additive across days).
CREATE TABLE IF NOT EXISTS public.report_entity_state_snapshot (
  snapshot_id  bigserial PRIMARY KEY,
  metric_id    text NOT NULL,         -- e.g. open_parts_by_status | ar_ageing_buckets
  day          date NOT NULL,
  department   text NOT NULL DEFAULT 'all',
  bucket       text NOT NULL,         -- the state/bucket key (status, ageing band)
  count        bigint,
  amount_gbp   numeric,
  built_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metric_id, day, department, bucket)
);
CREATE INDEX IF NOT EXISTS report_entity_state_snapshot_lookup_idx
  ON public.report_entity_state_snapshot(metric_id, department, day);

-- Pipeline lineage / health (SNAPSHOT_BUILT / AGGREGATION_REBUILT, Phase-2 §10.1).
CREATE TABLE IF NOT EXISTS public.report_aggregation_run (
  run_id       bigserial PRIMARY KEY,
  cadence      text NOT NULL,         -- daily|weekly|monthly|quarterly|yearly
  period_key   text NOT NULL,         -- the day/iso_week/year_month/... processed
  kpi_count    integer,
  row_count    integer,
  status       text NOT NULL DEFAULT 'ok',  -- ok|partial|failed
  reason       text,
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz
);
CREATE INDEX IF NOT EXISTS report_aggregation_run_idx
  ON public.report_aggregation_run(cadence, period_key);

-- ---------------------------------------------------------------------------
-- Row Level Security (mandatory — see README). Server-only snapshot pyramid;
-- the aggregation cron writes via the service role (bypasses RLS). Deny-by-default
-- keeps snapshots off the browser keys. Idempotent.
-- ---------------------------------------------------------------------------
ALTER TABLE public.kpi_daily_snapshot           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_weekly_snapshot          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_monthly_snapshot         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_quarterly_snapshot       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_yearly_snapshot          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_entity_state_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_aggregation_run       ENABLE ROW LEVEL SECURITY;
