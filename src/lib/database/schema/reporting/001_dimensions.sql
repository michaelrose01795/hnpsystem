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
