-- ============================================================
-- Efficiency Tracking Tables
-- ============================================================

-- Tech efficiency entries (individual time entries per technician)
CREATE TABLE IF NOT EXISTS tech_efficiency_entries (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  job_number    TEXT NOT NULL DEFAULT '',
  hours_spent   NUMERIC(6,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  day_type      TEXT NOT NULL DEFAULT 'weekday',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tee_user_date ON tech_efficiency_entries(user_id, date);

-- Tech efficiency targets (monthly target hours + weighting per technician)
CREATE TABLE IF NOT EXISTS tech_efficiency_targets (
  id                    BIGSERIAL PRIMARY KEY,
  user_id               BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  monthly_target_hours  NUMERIC(6,2) NOT NULL DEFAULT 160,
  weight                NUMERIC(4,2) NOT NULL DEFAULT 0.75,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ============================================================
-- FIX: Disable RLS (this app uses NextAuth/Keycloak, not
-- Supabase Auth, so auth.uid() is never populated)
-- ============================================================
ALTER TABLE tech_efficiency_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE tech_efficiency_targets DISABLE ROW LEVEL SECURITY;

-- Drop any leftover RLS policies if they exist
DROP POLICY IF EXISTS "Techs can view own entries" ON tech_efficiency_entries;
DROP POLICY IF EXISTS "Techs can insert own entries" ON tech_efficiency_entries;
DROP POLICY IF EXISTS "Techs can update own entries" ON tech_efficiency_entries;
DROP POLICY IF EXISTS "Techs can delete own entries" ON tech_efficiency_entries;
DROP POLICY IF EXISTS "Service role full access entries" ON tech_efficiency_entries;
DROP POLICY IF EXISTS "Techs can view own targets" ON tech_efficiency_targets;
DROP POLICY IF EXISTS "Service role full access targets" ON tech_efficiency_targets;
