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
