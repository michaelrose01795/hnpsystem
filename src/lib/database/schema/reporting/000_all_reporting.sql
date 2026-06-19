-- ===========================================================================
-- Reporting foundation — 000 ALL (combined 001–005)
-- ===========================================================================
-- This is the FULL reporting schema (migrations 001–005) in one ready-to-run
-- script, ordered so every foreign key resolves (dim_department in 001 is
-- referenced by 001/005). It is additive + idempotent (CREATE … IF NOT EXISTS,
-- ENABLE ROW LEVEL SECURITY is re-runnable) and mirrors the per-section files
-- exactly. Paste into the Supabase SQL editor and run once, OR apply 001–005
-- individually — the result is identical.
--
-- After applying, seed dim_department:
--   call seedDepartments() in src/lib/database/reporting/dimDepartment.js
--   (or via the reporting validation CLI: npm run validate:reporting -- --seed).
--
-- Every table created here has RLS ENABLED (deny-by-default for the anon/auth
-- keys). Reporting reads/writes via the service-role client, which bypasses RLS.
-- ===========================================================================


-- ###########################################################################
-- # 001_dimensions.sql
-- ###########################################################################

-- ===========================================================================
-- Reporting foundation — 001 Dimensions
-- Additive, idempotent. Implements Phase-2 §7 (department), §8.4 (actor), §14.3.
-- No operational table is altered. No triggers.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- dim_department — canonical department lookup + hierarchy (Phase-2 §7.1/§7.2).
-- Seeded from src/lib/reporting/config/departments.js. `parent_code` enables
-- rollups (workshop -> aftersales -> management -> company total).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dim_department (
  code         text PRIMARY KEY,
  name         text NOT NULL,
  kind         text,                 -- operational|commercial|support|support-sensitive|oversight|group|system
  parent_code  text REFERENCES public.dim_department(code),
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- dim_actor — canonical-id bridge (Phase-2 §8.4, debt D4).
-- Resolves the dual user identity: int users.user_id vs uuid auth.users.id.
-- Per-user KPIs are blocked until this is populated (Risk R2).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dim_actor (
  canonical_user_id  bigint PRIMARY KEY,   -- canonical id space (= users.user_id today)
  users_user_id      integer,              -- public.users.user_id (int)
  auth_uuid          uuid,                 -- auth.users.id (uuid)
  display_name       text,
  current_role       text,
  current_department text REFERENCES public.dim_department(code),
  is_active          boolean NOT NULL DEFAULT true,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dim_actor_users_user_id_idx
  ON public.dim_actor(users_user_id) WHERE users_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS dim_actor_auth_uuid_idx
  ON public.dim_actor(auth_uuid) WHERE auth_uuid IS NOT NULL;

-- ---------------------------------------------------------------------------
-- dim_kpi — the KPI catalogue persisted (Phase-2 §14.3 / Phase-3 §0.1).
-- The authoritative definitions live in code (src/lib/reporting/kpiDefinitions/*),
-- registered into the in-memory catalogue. This table is the persisted mirror so
-- snapshots/targets can FK to a kpi_id and historical formula_versions are
-- explainable a decade later (Principle 2.6 / ADR-17).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dim_kpi (
  kpi_id          text NOT NULL,
  formula_version text NOT NULL DEFAULT 'v1',
  label           text,
  department      text REFERENCES public.dim_department(code),
  tier            text,             -- operational|tactical|strategic|executive
  unit            text,             -- count|percent|currency|hours|duration
  format          text,
  target_type     text,             -- higher_is_better|lower_is_better|band|informational
  readiness       text,             -- R1|R2|R3
  definition      text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kpi_id, formula_version)
);

-- ---------------------------------------------------------------------------
-- report_kpi_target — versioned targets per KPI/scope (Phase-3 §3.5).
-- TARGET_SET / TARGET_CHANGED events (audited) maintain this.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_kpi_target (
  target_id    bigserial PRIMARY KEY,
  kpi_id       text NOT NULL,
  scope_level  text NOT NULL DEFAULT 'company',  -- company|department|team|individual
  scope_ref    text,                              -- dept code / team / user id
  target_value numeric,
  band_low     numeric,
  band_high    numeric,
  period_from  date,
  period_to    date,
  set_by       bigint,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_kpi_target_kpi_idx
  ON public.report_kpi_target(kpi_id, scope_level, scope_ref);

-- ---------------------------------------------------------------------------
-- Row Level Security (mandatory — see README). These tables are server-only:
-- written/read exclusively via the service-role client, which bypasses RLS.
-- Enabling RLS with no policy makes them deny-by-default for the anon/auth keys,
-- so a reporting table can never be read or written from the browser.
-- ENABLE ROW LEVEL SECURITY is idempotent (safe to re-run).
-- ---------------------------------------------------------------------------
ALTER TABLE public.dim_department     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_actor          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_kpi            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_kpi_target  ENABLE ROW LEVEL SECURITY;

-- ###########################################################################
-- # 002_report_event.sql
-- ###########################################################################

-- ===========================================================================
-- Reporting foundation — 002 Event spine
-- Additive, idempotent. Implements Phase-2 §3.1 (report_event) + indexes §3.1.
-- Append-only, immutable, department-stamped. Fed by emit helpers + bridges.
-- No triggers — written by src/lib/database/reporting/reportEvent.js.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.report_event (
  event_id            bigserial PRIMARY KEY,
  event_uuid          uuid,                 -- stable external id (idempotency / dedupe)
  occurred_at         timestamptz NOT NULL DEFAULT now(),  -- business time
  recorded_at         timestamptz NOT NULL DEFAULT now(),  -- ingestion time (late-arrival detection)
  event_name          text NOT NULL,        -- canonical UPPERCASE name (catalogue)
  event_category      text,                 -- Phase-2 §3.3
  domain              text,                 -- open vocabulary (Phase-2 §3.1/§15)
  entity_type         text,
  entity_id           text,                 -- text to allow int + uuid + composite keys
  parent_entity_type  text,
  parent_entity_id    text,
  from_state          text,
  to_state            text,
  actor_kind          text,                 -- user|system|customer|integration
  actor_user_id       bigint,               -- canonical users.user_id (dim_actor)
  actor_auth_uuid     uuid,                 -- auth.users.id when that is the only id present
  actor_role          text,                 -- point-in-time role
  owner_department    text,                 -- the dimension (Phase-2 §7)
  related_departments text[],               -- consuming/affected departments
  amount_gbp          numeric,
  quantity            numeric,
  duration_seconds    bigint,
  payload             jsonb,                -- minimal typed extras (keys + delta only)
  source              text,                 -- emit|bridge:audit_log|bridge:job_activity_events|bridge:job_status_history|notification|backfill
  formula_context     text
);

-- Idempotency / dedupe on the deterministic event_uuid (Phase-2 §3.2).
CREATE UNIQUE INDEX IF NOT EXISTS report_event_uuid_idx
  ON public.report_event(event_uuid) WHERE event_uuid IS NOT NULL;

-- Query indexes (Phase-2 §3.1).
CREATE INDEX IF NOT EXISTS report_event_domain_time_idx
  ON public.report_event(domain, occurred_at);
CREATE INDEX IF NOT EXISTS report_event_entity_idx
  ON public.report_event(entity_type, entity_id, occurred_at);
CREATE INDEX IF NOT EXISTS report_event_owner_dept_time_idx
  ON public.report_event(owner_department, occurred_at);
CREATE INDEX IF NOT EXISTS report_event_name_time_idx
  ON public.report_event(event_name, occurred_at);
CREATE INDEX IF NOT EXISTS report_event_actor_time_idx
  ON public.report_event(actor_user_id, occurred_at);

-- ---------------------------------------------------------------------------
-- Row Level Security (mandatory — see README). Server-only spine; the service
-- role bypasses RLS, so enabling deny-by-default RLS keeps the append-only event
-- stream unreachable from the browser. Idempotent.
-- ---------------------------------------------------------------------------
ALTER TABLE public.report_event ENABLE ROW LEVEL SECURITY;

-- ###########################################################################
-- # 003_status_history.sql
-- ###########################################################################

-- ===========================================================================
-- Reporting foundation — 003 Status history
-- Additive, idempotent. Implements Phase-2 §6 (generic per-entity pattern).
-- One table per entity (not polymorphic) — clean FKs/types/indexes, mirrors the
-- existing job_status_history (which already exists and is the reference template).
-- App-emitted (no triggers). Rollout priority per Phase-2 §6 / §19.
-- ===========================================================================

-- Generic pattern (Phase-2 §6.1):
--   history_id, entity_id, from_status, to_status, changed_by (canonical user id),
--   actor_kind, reason, department (denormalised owner), changed_at, meta jsonb.

-- P4 priority 1 — Parts (unlocks parts cycle-time, dwell, ageing, fill).
CREATE TABLE IF NOT EXISTS public.parts_job_items_status_history (
  history_id  bigserial PRIMARY KEY,
  entity_id   uuid NOT NULL,        -- parts_job_items.id
  from_status text,
  to_status   text,
  changed_by  bigint,               -- canonical user id (dim_actor), not free text
  actor_kind  text,
  reason      text,
  department  text DEFAULT 'parts',
  changed_at  timestamptz NOT NULL DEFAULT now(),
  meta        jsonb
);
CREATE INDEX IF NOT EXISTS parts_status_history_entity_idx
  ON public.parts_job_items_status_history(entity_id, changed_at);

-- P4 priority 2 — VHC item (decision-level transitions, not derived projection).
CREATE TABLE IF NOT EXISTS public.vhc_item_status_history (
  history_id  bigserial PRIMARY KEY,
  entity_id   integer NOT NULL,     -- vhc_checks.vhc_id
  from_status text,
  to_status   text,
  changed_by  bigint,
  actor_kind  text,
  reason      text,
  department  text DEFAULT 'workshop',
  changed_at  timestamptz NOT NULL DEFAULT now(),
  meta        jsonb
);
CREATE INDEX IF NOT EXISTS vhc_item_status_history_entity_idx
  ON public.vhc_item_status_history(entity_id, changed_at);

-- P4 priority 3 — Invoice (Draft->Sent->Paid latency, AR ageing by transition).
CREATE TABLE IF NOT EXISTS public.invoice_status_history (
  history_id  bigserial PRIMARY KEY,
  entity_id   uuid NOT NULL,        -- invoices.id
  from_status text,
  to_status   text,
  changed_by  bigint,
  actor_kind  text,
  reason      text,
  department  text DEFAULT 'accounts',
  changed_at  timestamptz NOT NULL DEFAULT now(),
  meta        jsonb
);
CREATE INDEX IF NOT EXISTS invoice_status_history_entity_idx
  ON public.invoice_status_history(entity_id, changed_at);

-- Account (credit-control freeze/close events with reason).
CREATE TABLE IF NOT EXISTS public.account_status_history (
  history_id  bigserial PRIMARY KEY,
  entity_id   uuid NOT NULL,        -- accounts.id
  from_status text,
  to_status   text,
  changed_by  bigint,
  actor_kind  text,
  reason      text,
  department  text DEFAULT 'accounts',
  changed_at  timestamptz NOT NULL DEFAULT now(),
  meta        jsonb
);
CREATE INDEX IF NOT EXISTS account_status_history_entity_idx
  ON public.account_status_history(entity_id, changed_at);

-- Appointment (booking funnel, no-show rate, lead time).
CREATE TABLE IF NOT EXISTS public.appointment_status_history (
  history_id  bigserial PRIMARY KEY,
  entity_id   uuid NOT NULL,        -- appointments.id
  from_status text,
  to_status   text,
  changed_by  bigint,
  actor_kind  text,
  reason      text,
  department  text DEFAULT 'service',
  changed_at  timestamptz NOT NULL DEFAULT now(),
  meta        jsonb
);
CREATE INDEX IF NOT EXISTS appointment_status_history_entity_idx
  ON public.appointment_status_history(entity_id, changed_at);

-- Delivery (delivery SLA, on-time %). NOTE: reconcile duplicate delivery
-- families first (debt D7) before treating this as authoritative.
CREATE TABLE IF NOT EXISTS public.delivery_status_history (
  history_id  bigserial PRIMARY KEY,
  entity_id   text NOT NULL,        -- delivery key (family TBD, D7)
  from_status text,
  to_status   text,
  changed_by  bigint,
  actor_kind  text,
  reason      text,
  department  text DEFAULT 'parts',
  changed_at  timestamptz NOT NULL DEFAULT now(),
  meta        jsonb
);
CREATE INDEX IF NOT EXISTS delivery_status_history_entity_idx
  ON public.delivery_status_history(entity_id, changed_at);

-- NOTE: mot_test / paint_stage / wash status-history tables are intentionally
-- omitted — they require their missing domain entities first (Phase-2 TD-E / P7).

-- ---------------------------------------------------------------------------
-- Row Level Security (mandatory — see README). Server-only; the service role
-- bypasses RLS, so deny-by-default keeps lifecycle history off the browser keys.
-- Idempotent.
-- ---------------------------------------------------------------------------
ALTER TABLE public.parts_job_items_status_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vhc_item_status_history         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_status_history          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_status_history          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_status_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_status_history         ENABLE ROW LEVEL SECURITY;

-- ###########################################################################
-- # 004_kpi_snapshots.sql
-- ###########################################################################

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

-- ###########################################################################
-- # 005_saved_views.sql
-- ###########################################################################

-- ===========================================================================
-- Reporting foundation — 005 Saved views & preferences
-- Additive, idempotent. Implements Phase-1 §10 (saved views, user preferences).
-- Reuses the established personal-preferences pattern (user_personal_widgets).
-- ===========================================================================

-- A saved view = a report/dashboard reference + its filter + layout, recallable.
CREATE TABLE IF NOT EXISTS public.report_saved_view (
  view_id        bigserial PRIMARY KEY,
  owner_user_id  bigint NOT NULL,                 -- canonical users.user_id
  scope          text NOT NULL DEFAULT 'personal',-- personal|shared
  name           text NOT NULL,
  target_ref     text,                            -- dashboard/report id this view targets
  filter         jsonb,                           -- the normalised filter object
  layout         jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_saved_view_owner_idx
  ON public.report_saved_view(owner_user_id, scope);

-- Per-user reporting preferences.
CREATE TABLE IF NOT EXISTS public.report_user_preferences (
  user_id            bigint PRIMARY KEY,          -- canonical users.user_id
  default_department text REFERENCES public.dim_department(code),
  default_range      text,                        -- preset key, e.g. last_7d
  default_dashboard  text,
  density            text,                        -- comfortable|compact
  units              text,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security (mandatory — see README). Saved views / preferences are
-- written via the service role today (reporting API). Deny-by-default RLS keeps
-- them off the anon/auth keys until an explicit owner-scoped policy is added if
-- the reporting UI ever reads them with the user key. Idempotent.
-- ---------------------------------------------------------------------------
ALTER TABLE public.report_saved_view        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_user_preferences  ENABLE ROW LEVEL SECURITY;
