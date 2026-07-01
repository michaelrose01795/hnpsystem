-- Help & Diagnostics ("support") — Phase 1 foundation schema.
-- Apply this whole file in the Supabase SQL editor. It is idempotent
-- (CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS) so it is safe to
-- re-run. The canonical table definition is mirrored into
-- src/lib/database/schema/schemaReference.sql.
--
-- This feature is deliberately separate from the Reporting/KPI platform
-- (report_event, kpi_* tables) — different namespace, different purpose.
--
-- Privacy model: the table holds a private `diagnostics` blob that must never
-- be exposed to the reporter. RLS is enabled with NO permissive policies, so
-- the anon/auth keys cannot read or write it at all — every read/write goes
-- through role-guarded API routes using the service-role key (which bypasses
-- RLS). See docs/Support/help-diagnostics.md §4 and §11.

CREATE TABLE IF NOT EXISTS public.support_reports (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  -- user-supplied
  title           text,
  description     text NOT NULL,
  category        text NOT NULL DEFAULT 'bug'
                    CHECK (category IN ('bug','question','suggestion','visual','data','other')),
  -- attachment (screenshot) — object path inside the private support-reports bucket.
  -- screenshot_path keeps the FIRST/primary image (legacy single-image column);
  -- screenshot_paths holds the full ordered list once a report has several.
  screenshot_path text,
  screenshot_paths text[],
  -- reporter identity (denormalised snapshot; FK kept loose to survive user deletion)
  reporter_user_id  integer,
  reporter_username text,
  reporter_roles    text[],
  -- triage
  status          text NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new','triaged','in_progress','resolved','wont_fix','duplicate')),
  severity        text NOT NULL DEFAULT 'unset'
                    CHECK (severity IN ('unset','low','medium','high','critical')),
  assigned_to     integer,
  -- linkage / code ownership
  route           text,
  section_key     text,
  source_file     text,
  source_line     integer,
  -- code-state pinning (populated from Phase 5 onward)
  app_version     text,
  commit_sha      text,
  commit_ref      text,
  build_id        text,
  -- private diagnostic blob (already sanitised before insert)
  diagnostics     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  updated_at      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT support_reports_pkey PRIMARY KEY (id),
  CONSTRAINT support_reports_reporter_fkey FOREIGN KEY (reporter_user_id)
    REFERENCES public.users(user_id),
  CONSTRAINT support_reports_assigned_fkey FOREIGN KEY (assigned_to)
    REFERENCES public.users(user_id)
);

-- Additive columns for tables created before this column existed (idempotent).
ALTER TABLE public.support_reports
  ADD COLUMN IF NOT EXISTS screenshot_paths text[];

-- Phase 6 (dev Support Centre) — duplicate grouping / report linking. Points a
-- report at the canonical report it duplicates (nullable; self-reference kept
-- loose via ON DELETE SET NULL so deleting the canonical report doesn't cascade).
ALTER TABLE public.support_reports
  ADD COLUMN IF NOT EXISTS duplicate_of uuid;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'support_reports_duplicate_of_fkey'
  ) THEN
    ALTER TABLE public.support_reports
      ADD CONSTRAINT support_reports_duplicate_of_fkey
      FOREIGN KEY (duplicate_of) REFERENCES public.support_reports(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS support_reports_duplicate_of_idx
  ON public.support_reports (duplicate_of);

CREATE INDEX IF NOT EXISTS support_reports_status_idx
  ON public.support_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS support_reports_reporter_idx
  ON public.support_reports (reporter_user_id);
CREATE INDEX IF NOT EXISTS support_reports_section_idx
  ON public.support_reports (section_key);

-- Triage thread (developer notes / internal comments — Phase 6).
CREATE TABLE IF NOT EXISTS public.support_report_comments (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  report_id   uuid NOT NULL,
  author_id   integer,
  -- denormalised author name snapshot so the thread survives user deletion and
  -- avoids a users join on every read.
  author_username text,
  body        text NOT NULL,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT support_report_comments_pkey PRIMARY KEY (id),
  CONSTRAINT support_report_comments_report_fkey FOREIGN KEY (report_id)
    REFERENCES public.support_reports(id) ON DELETE CASCADE
);

-- Additive column for comment tables created before author_username existed.
ALTER TABLE public.support_report_comments
  ADD COLUMN IF NOT EXISTS author_username text;

CREATE INDEX IF NOT EXISTS support_report_comments_report_idx
  ON public.support_report_comments (report_id, created_at);

-- Lock both tables down: RLS on, no permissive policies. Only the
-- service-role key (server-side, RLS-exempt) may read/write. The anon and
-- authenticated keys get nothing — this guarantees the private diagnostics
-- blob can never leak to a client.
ALTER TABLE public.support_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_report_comments ENABLE ROW LEVEL SECURITY;

-- Phase 7 (hardening) — retention policy row so tools/scripts/run-retention.js
-- picks up the `support_report` handler (which deletes reports + their private
-- screenshots older than 180 days). Guarded on the retention_policies table
-- existing so this migration stays self-contained and idempotent even in an
-- environment where the compliance module has not been applied.
DO $$
BEGIN
  IF to_regclass('public.retention_policies') IS NOT NULL THEN
    INSERT INTO public.retention_policies (entity_type, retention_period, action, notes)
    SELECT 'support_report', '180 days', 'delete',
           'Help & Diagnostics reports + private screenshots. Handler: tools/scripts/run-retention.js.'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.retention_policies WHERE entity_type = 'support_report'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Phase 8 (Developer Platform) — server-synced saved views + developer
-- preferences. These upgrade the previously device-local savedViews.js store to
-- personal + shared team workspaces persisted per developer. Same privacy model
-- as above: RLS enabled with NO permissive policies — all access is via the
-- dev-gated, service-role API routes (src/lib/database/supportSavedViews.js).
--
-- Ownership is keyed by a TEXT `owner_key` (the session user id, stringified)
-- rather than an integer FK to users, because the `dev` role is synthetic: it is
-- minted in code by the Dev Login and has no users row (its key is the literal
-- 'dev-platform'). A real numeric user carrying the dev role simply keys by their
-- stringified user_id. Owner scoping is enforced in the data layer.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.support_saved_views (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_key   text NOT NULL,
  name        text NOT NULL,
  -- 'personal' → visible only to the owner; 'shared' → visible to the whole team.
  scope       text NOT NULL DEFAULT 'personal'
                CHECK (scope IN ('personal','shared')),
  -- which platform surface the view belongs to (e.g. 'support').
  surface     text NOT NULL DEFAULT 'support',
  -- normalised filter object (validated by savedViewValidation.js before insert).
  filters     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT support_saved_views_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS support_saved_views_owner_idx
  ON public.support_saved_views (owner_key, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_saved_views_shared_idx
  ON public.support_saved_views (surface, scope);

CREATE TABLE IF NOT EXISTS public.support_user_preferences (
  owner_key   text NOT NULL,
  -- free-form, validated developer + notification preferences.
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT support_user_preferences_pkey PRIMARY KEY (owner_key)
);

ALTER TABLE public.support_saved_views      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_user_preferences ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Phase 10 (Developer Platform — Integration, Extensibility & Hardening).
-- Five additive tables for: two-way GitHub linkage, in-app notification
-- delivery + subscription rules, release approval / deployment-readiness
-- records, and the engineering knowledge centre. Same privacy model as every
-- other support table: RLS ENABLED with NO permissive policies, so all access
-- is via the dev-gated, service-role API routes. All owner scoping is keyed by
-- the same TEXT `owner_key` used by the Phase 8 saved views (the synthetic
-- `dev` role has no users row). Every statement is idempotent
-- (CREATE TABLE / INDEX IF NOT EXISTS) so this file stays safe to re-run.
-- ---------------------------------------------------------------------------

-- Two-way GitHub linkage. One row per artifact (issue / PR / commit /
-- deployment) linked to a support report. `synced_at` records the last time the
-- live GitHub state (title/state) was refreshed via the GitHub API.
CREATE TABLE IF NOT EXISTS public.support_github_links (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  report_id   uuid NOT NULL,
  kind        text NOT NULL DEFAULT 'issue'
                CHECK (kind IN ('issue','pull_request','commit','deployment')),
  repo        text NOT NULL,          -- "owner/repo"
  number      integer,                -- issue / PR number (null for commit/deployment)
  sha         text,                   -- commit sha (null for issue/PR)
  url         text NOT NULL,
  title       text,
  state       text,                   -- open / closed / merged / success ...
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by  text,                   -- owner_key of the linking developer
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  synced_at   timestamp with time zone,
  CONSTRAINT support_github_links_pkey PRIMARY KEY (id),
  CONSTRAINT support_github_links_report_fkey FOREIGN KEY (report_id)
    REFERENCES public.support_reports(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS support_github_links_report_idx
  ON public.support_github_links (report_id, kind);
-- Prevent duplicate links to the same artifact on the same report.
CREATE UNIQUE INDEX IF NOT EXISTS support_github_links_unique_idx
  ON public.support_github_links (report_id, kind, url);

-- In-app notification delivery. One row per recipient (owner_key); a broadcast
-- is fanned out to a row per subscriber by the delivery layer, so reads stay a
-- simple owner-scoped query. Content-free of secrets (title/body/link only).
CREATE TABLE IF NOT EXISTS public.support_notifications (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_key   text NOT NULL,
  kind        text NOT NULL DEFAULT 'info',
  title       text NOT NULL,
  body        text,
  link        text,
  severity    text NOT NULL DEFAULT 'info'
                CHECK (severity IN ('info','success','warning','critical')),
  entity_type text,
  entity_id   text,
  read_at     timestamp with time zone,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT support_notifications_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS support_notifications_owner_idx
  ON public.support_notifications (owner_key, read_at, created_at DESC);

-- Notification subscription / delivery rules. When a platform event fires the
-- delivery layer matches it against these rules (event + jsonb filters) to
-- decide who is notified and how (channels; only 'inapp' is wired in Phase 10).
CREATE TABLE IF NOT EXISTS public.support_notification_rules (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_key   text NOT NULL,
  event       text NOT NULL,          -- e.g. 'report.created','report.regression','release.blocked'
  filters     jsonb NOT NULL DEFAULT '{}'::jsonb,
  channels    text[] NOT NULL DEFAULT ARRAY['inapp']::text[],
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT support_notification_rules_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS support_notification_rules_owner_idx
  ON public.support_notification_rules (owner_key);
CREATE INDEX IF NOT EXISTS support_notification_rules_event_idx
  ON public.support_notification_rules (event, enabled);

-- Release approval / deployment-readiness records. One canonical row per
-- release (keyed by release_key — commit sha where available, else version),
-- carrying the computed readiness score at approval time and the approver.
CREATE TABLE IF NOT EXISTS public.support_release_approvals (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  release_key     text NOT NULL,
  app_version     text,
  commit_sha      text,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','blocked')),
  readiness_score integer,
  approver_key    text,
  notes           text,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  updated_at      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT support_release_approvals_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS support_release_approvals_key_idx
  ON public.support_release_approvals (release_key);

-- Engineering knowledge centre. Curated write-ups linking recurring incidents
-- (by fingerprint) to their fixes / previous investigations. report_ids and
-- links are JSON-able cross-references (no diagnostics blob is copied in).
CREATE TABLE IF NOT EXISTS public.support_knowledge_entries (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  fingerprint text,
  title       text NOT NULL,
  body        text,
  category    text,
  tags        text[],
  report_ids  uuid[],
  links       jsonb NOT NULL DEFAULT '[]'::jsonb,
  author_key  text,
  status      text NOT NULL DEFAULT 'published'
                CHECK (status IN ('draft','published','archived')),
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT support_knowledge_entries_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS support_knowledge_entries_fingerprint_idx
  ON public.support_knowledge_entries (fingerprint);
CREATE INDEX IF NOT EXISTS support_knowledge_entries_status_idx
  ON public.support_knowledge_entries (status, updated_at DESC);

ALTER TABLE public.support_github_links        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_notification_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_release_approvals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_knowledge_entries   ENABLE ROW LEVEL SECURITY;
