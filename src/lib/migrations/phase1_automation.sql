/* ============================================
   PHASE 1: AUTOMATED STATUS UPDATE SYSTEM
   Database Migration Script - CORRECTED FOR YOUR SCHEMA
   
   This matches your existing database structure:
   - users.user_id is INTEGER (not UUID)
   - jobs.id is INTEGER (not UUID)
   - All other IDs are INTEGER
============================================ */

-- ============================================
-- TABLE 1: JOB CLOCKING
-- Tracks when technicians clock in/out of specific jobs
-- ============================================

CREATE TABLE IF NOT EXISTS job_clocking (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  job_number TEXT NOT NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  work_type TEXT NOT NULL DEFAULT 'initial', -- 'initial' or 'additional'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_clocking_user_id ON job_clocking(user_id);
CREATE INDEX IF NOT EXISTS idx_job_clocking_job_id ON job_clocking(job_id);
CREATE INDEX IF NOT EXISTS idx_job_clocking_job_number ON job_clocking(job_number);
CREATE INDEX IF NOT EXISTS idx_job_clocking_clock_in ON job_clocking(clock_in);
CREATE INDEX IF NOT EXISTS idx_job_clocking_active ON job_clocking(user_id, job_id) WHERE clock_out IS NULL;

-- Add comment
COMMENT ON TABLE job_clocking IS 'Tracks technician clock in/out times for specific jobs';

-- ============================================
-- TABLE 2: JOB STATUS HISTORY
-- Audit trail of all status changes
-- ============================================

CREATE TABLE IF NOT EXISTS job_status_history (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT, -- Can be user_id or 'SYSTEM'
  reason TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_status_history_job_id ON job_status_history(job_id);
CREATE INDEX IF NOT EXISTS idx_job_status_history_changed_at ON job_status_history(changed_at);

-- Add comment
COMMENT ON TABLE job_status_history IS 'Complete audit trail of all job status changes';

-- ============================================
-- TABLE 3: VHC SEND HISTORY
-- Tracks when VHC was sent to customers
-- ============================================

CREATE TABLE IF NOT EXISTS vhc_send_history (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  sent_by TEXT NOT NULL, -- user_id who sent the VHC
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  send_method TEXT DEFAULT 'email', -- 'email', 'sms', 'app', 'manual'
  customer_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vhc_send_history_job_id ON vhc_send_history(job_id);
CREATE INDEX IF NOT EXISTS idx_vhc_send_history_sent_at ON vhc_send_history(sent_at);

-- Add comment
COMMENT ON TABLE vhc_send_history IS 'Records when VHC reports were sent to customers';

-- ============================================
-- TABLE 4: VHC AUTHORIZATIONS
-- Tracks customer authorization of additional work
-- ============================================

CREATE TABLE IF NOT EXISTS vhc_authorizations (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  authorized_by TEXT NOT NULL, -- user_id who recorded the authorization
  authorized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  authorized_items JSONB DEFAULT '[]'::jsonb, -- Array of authorized work items
  customer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vhc_authorizations_job_id ON vhc_authorizations(job_id);
CREATE INDEX IF NOT EXISTS idx_vhc_authorizations_authorized_at ON vhc_authorizations(authorized_at);

-- Add comment
COMMENT ON TABLE vhc_authorizations IS 'Records customer authorization of additional work from VHC';

-- ============================================
-- TABLE 5: VHC DECLINATIONS
-- Tracks when customer declines additional work
-- ============================================

CREATE TABLE IF NOT EXISTS vhc_declinations (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  declined_by TEXT NOT NULL, -- user_id who recorded the declination
  declined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vhc_declinations_job_id ON vhc_declinations(job_id);
CREATE INDEX IF NOT EXISTS idx_vhc_declinations_declined_at ON vhc_declinations(declined_at);

-- Add comment
COMMENT ON TABLE vhc_declinations IS 'Records when customer declines additional work from VHC';

-- ============================================
-- ADD NEW COLUMNS TO JOBS TABLE
-- Additional fields to track status timestamps
-- ============================================

-- Add status tracking columns if they don't exist
DO $$ 
BEGIN
  -- Status update tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='jobs' AND column_name='status_updated_at') THEN
    ALTER TABLE jobs ADD COLUMN status_updated_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='jobs' AND column_name='status_updated_by') THEN
    ALTER TABLE jobs ADD COLUMN status_updated_by TEXT;
  END IF;
  
  -- Check-in timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='jobs' AND column_name='checked_in_at') THEN
    ALTER TABLE jobs ADD COLUMN checked_in_at TIMESTAMPTZ;
  END IF;
  
  -- Workshop start timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='jobs' AND column_name='workshop_started_at') THEN
    ALTER TABLE jobs ADD COLUMN workshop_started_at TIMESTAMPTZ;
  END IF;
  
  -- VHC completion timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='jobs' AND column_name='vhc_completed_at') THEN
    ALTER TABLE jobs ADD COLUMN vhc_completed_at TIMESTAMPTZ;
  END IF;
  
  -- VHC sent timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='jobs' AND column_name='vhc_sent_at') THEN
    ALTER TABLE jobs ADD COLUMN vhc_sent_at TIMESTAMPTZ;
  END IF;
  
  -- Additional work authorization timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='jobs' AND column_name='additional_work_authorized_at') THEN
    ALTER TABLE jobs ADD COLUMN additional_work_authorized_at TIMESTAMPTZ;
  END IF;
  
  -- Additional work start timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='jobs' AND column_name='additional_work_started_at') THEN
    ALTER TABLE jobs ADD COLUMN additional_work_started_at TIMESTAMPTZ;
  END IF;
  
  -- Wash start timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='jobs' AND column_name='wash_started_at') THEN
    ALTER TABLE jobs ADD COLUMN wash_started_at TIMESTAMPTZ;
  END IF;
  
  -- Completion timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='jobs' AND column_name='completed_at') THEN
    ALTER TABLE jobs ADD COLUMN completed_at TIMESTAMPTZ;
  END IF;
  
  -- Parts ordered timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='jobs' AND column_name='parts_ordered_at') THEN
    ALTER TABLE jobs ADD COLUMN parts_ordered_at TIMESTAMPTZ;
  END IF;
  
  -- Warranty parts ordered timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='jobs' AND column_name='warranty_parts_ordered_at') THEN
    ALTER TABLE jobs ADD COLUMN warranty_parts_ordered_at TIMESTAMPTZ;
  END IF;
  
  -- Warranty QC timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='jobs' AND column_name='warranty_qc_started_at') THEN
    ALTER TABLE jobs ADD COLUMN warranty_qc_started_at TIMESTAMPTZ;
  END IF;
  
  -- Warranty ready to claim timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='jobs' AND column_name='warranty_ready_at') THEN
    ALTER TABLE jobs ADD COLUMN warranty_ready_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================
-- CREATE VIEWS FOR EASY REPORTING
-- ============================================

-- View: Active technician jobs
CREATE OR REPLACE VIEW active_technician_jobs AS
SELECT 
  jc.id AS clocking_id,
  jc.user_id,
  jc.job_id,
  jc.job_number,
  jc.clock_in,
  jc.work_type,
  EXTRACT(EPOCH FROM (NOW() - jc.clock_in)) / 3600 AS hours_worked,
  u.first_name,
  u.last_name,
  u.email,
  j.vehicle_reg,
  j.vehicle_make_model,
  j.status,
  j.customer_id
FROM job_clocking jc
LEFT JOIN users u ON jc.user_id = u.user_id
LEFT JOIN jobs j ON jc.job_id = j.id
WHERE jc.clock_out IS NULL
ORDER BY jc.clock_in DESC;

COMMENT ON VIEW active_technician_jobs IS 'Shows all jobs that technicians are currently clocked into';

-- View: Job status timeline
CREATE OR REPLACE VIEW job_status_timeline AS
SELECT 
  jsh.job_id,
  j.job_number,
  jsh.from_status,
  jsh.to_status,
  jsh.changed_by,
  jsh.reason,
  jsh.changed_at,
  LEAD(jsh.changed_at) OVER (PARTITION BY jsh.job_id ORDER BY jsh.changed_at) AS next_change,
  EXTRACT(EPOCH FROM (
    LEAD(jsh.changed_at) OVER (PARTITION BY jsh.job_id ORDER BY jsh.changed_at) - jsh.changed_at
  )) / 3600 AS hours_in_status
FROM job_status_history jsh
LEFT JOIN jobs j ON jsh.job_id = j.id
ORDER BY jsh.job_id, jsh.changed_at;

COMMENT ON VIEW job_status_timeline IS 'Shows complete timeline of status changes for each job with duration';

-- View: Daily technician summary
CREATE OR REPLACE VIEW daily_technician_summary AS
SELECT 
  jc.user_id,
  u.first_name,
  u.last_name,
  DATE(jc.clock_in) AS work_date,
  COUNT(DISTINCT jc.job_id) AS jobs_worked,
  COUNT(DISTINCT CASE WHEN jc.clock_out IS NULL THEN jc.job_id END) AS active_jobs,
  COUNT(DISTINCT CASE WHEN jc.clock_out IS NOT NULL THEN jc.job_id END) AS completed_jobs,
  SUM(
    CASE 
      WHEN jc.clock_out IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (jc.clock_out - jc.clock_in)) / 3600
      ELSE EXTRACT(EPOCH FROM (NOW() - jc.clock_in)) / 3600
    END
  ) AS total_hours
FROM job_clocking jc
LEFT JOIN users u ON jc.user_id = u.user_id
GROUP BY jc.user_id, u.first_name, u.last_name, DATE(jc.clock_in)
ORDER BY work_date DESC, total_hours DESC;

COMMENT ON VIEW daily_technician_summary IS 'Daily summary of hours and jobs for each technician';

-- View: VHC workflow status
CREATE OR REPLACE VIEW vhc_workflow_status AS
SELECT 
  j.id AS job_id,
  j.job_number,
  j.vehicle_reg,
  j.status,
  j.vhc_required,
  COUNT(DISTINCT vc.vhc_id) AS vhc_checks_count,
  MAX(vsh.sent_at) AS last_sent_at,
  COUNT(DISTINCT va.id) AS authorization_count,
  COUNT(DISTINCT vd.id) AS declination_count,
  j.vhc_completed_at,
  j.vhc_sent_at
FROM jobs j
LEFT JOIN vhc_checks vc ON j.id = vc.job_id
LEFT JOIN vhc_send_history vsh ON j.id = vsh.job_id
LEFT JOIN vhc_authorizations va ON j.id = va.job_id
LEFT JOIN vhc_declinations vd ON j.id = vd.job_id
WHERE j.vhc_required = true
GROUP BY j.id, j.job_number, j.vehicle_reg, j.status, j.vhc_required, j.vhc_completed_at, j.vhc_sent_at
ORDER BY j.created_at DESC;

COMMENT ON VIEW vhc_workflow_status IS 'Overview of VHC workflow status for all jobs requiring VHC';

-- ============================================
-- CREATE FUNCTIONS FOR COMMON OPERATIONS
-- ============================================

-- Function: Get total hours worked on a job
CREATE OR REPLACE FUNCTION get_job_total_hours(p_job_id INTEGER)
RETURNS NUMERIC AS $$
DECLARE
  total_hours NUMERIC;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN clock_out IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600
      ELSE EXTRACT(EPOCH FROM (NOW() - clock_in)) / 3600
    END
  ), 0)
  INTO total_hours
  FROM job_clocking
  WHERE job_id = p_job_id;
  
  RETURN ROUND(total_hours, 2);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_job_total_hours IS 'Calculates total hours worked on a specific job';

-- Function: Get technician daily hours
CREATE OR REPLACE FUNCTION get_technician_daily_hours(p_user_id INTEGER, p_date DATE)
RETURNS NUMERIC AS $$
DECLARE
  total_hours NUMERIC;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN clock_out IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600
      ELSE EXTRACT(EPOCH FROM (NOW() - clock_in)) / 3600
    END
  ), 0)
  INTO total_hours
  FROM job_clocking
  WHERE user_id = p_user_id
    AND DATE(clock_in) = p_date;
  
  RETURN ROUND(total_hours, 2);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_technician_daily_hours IS 'Calculates total hours worked by a technician on a specific date';

-- Function: Check if user is clocked into any job
CREATE OR REPLACE FUNCTION is_user_clocked_in(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  is_clocked_in BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 
    FROM job_clocking 
    WHERE user_id = p_user_id 
      AND clock_out IS NULL
  )
  INTO is_clocked_in;
  
  RETURN is_clocked_in;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_user_clocked_in IS 'Checks if a user is currently clocked into any job';

-- ============================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on new tables
ALTER TABLE job_clocking ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE vhc_send_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE vhc_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vhc_declinations ENABLE ROW LEVEL SECURITY;

-- Create policies for job_clocking (allow all authenticated users for now)
CREATE POLICY "Authenticated users can manage job clocking"
  ON job_clocking FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create policies for job_status_history (read-only for most users)
CREATE POLICY "All authenticated users can view status history"
  ON job_status_history FOR SELECT
  USING (true);

CREATE POLICY "System can insert status history"
  ON job_status_history FOR INSERT
  WITH CHECK (true);

-- Create policies for VHC tables (allow all authenticated users)
CREATE POLICY "Authenticated users can manage VHC send history"
  ON vhc_send_history FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage VHC authorizations"
  ON vhc_authorizations FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage VHC declinations"
  ON vhc_declinations FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant usage on tables to authenticated users
GRANT ALL ON job_clocking TO authenticated;
GRANT ALL ON job_status_history TO authenticated;
GRANT ALL ON vhc_send_history TO authenticated;
GRANT ALL ON vhc_authorizations TO authenticated;
GRANT ALL ON vhc_declinations TO authenticated;

-- Grant usage on sequences
GRANT USAGE, SELECT ON SEQUENCE job_clocking_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE job_status_history_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE vhc_send_history_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE vhc_authorizations_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE vhc_declinations_id_seq TO authenticated;

-- Grant usage on views
GRANT SELECT ON active_technician_jobs TO authenticated;
GRANT SELECT ON job_status_timeline TO authenticated;
GRANT SELECT ON daily_technician_summary TO authenticated;
GRANT SELECT ON vhc_workflow_status TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_job_total_hours TO authenticated;
GRANT EXECUTE ON FUNCTION get_technician_daily_hours TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_clocked_in TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Insert a record to track this migration
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  migration_name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schema_migrations (migration_name) 
VALUES ('phase1_automation_corrected')
ON CONFLICT (migration_name) DO NOTHING;

-- Output success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Phase 1 Migration Complete!';
  RAISE NOTICE '📊 Created tables: job_clocking, job_status_history, vhc_send_history, vhc_authorizations, vhc_declinations';
  RAISE NOTICE '📈 Created views: active_technician_jobs, job_status_timeline, daily_technician_summary, vhc_workflow_status';
  RAISE NOTICE '⚙️ Created functions: get_job_total_hours, get_technician_daily_hours, is_user_clocked_in';
  RAISE NOTICE '🔒 Enabled RLS and created policies';
  RAISE NOTICE '🎉 System ready for automated status updates!';
END $$;