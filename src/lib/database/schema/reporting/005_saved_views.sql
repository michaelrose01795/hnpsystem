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
