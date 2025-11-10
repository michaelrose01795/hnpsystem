/* ============================================
   WRITE-UP RECTIFICATION ITEMS TABLE
   Stores individual rectification entries so
   the workshop and service teams can track
   authorized additional work with completion
   status linked to the VHC dashboard
============================================ */

CREATE TABLE IF NOT EXISTS writeup_rectification_items (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  job_number TEXT NOT NULL,
  writeup_id INTEGER NOT NULL REFERENCES job_writeups(writeup_id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  is_additional_work BOOLEAN NOT NULL DEFAULT TRUE,
  vhc_item_id INTEGER,
  authorization_id INTEGER,
  authorized_amount NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_writeup_rectification_job_id ON writeup_rectification_items(job_id);
CREATE INDEX IF NOT EXISTS idx_writeup_rectification_writeup_id ON writeup_rectification_items(writeup_id);
CREATE INDEX IF NOT EXISTS idx_writeup_rectification_status ON writeup_rectification_items(status);

COMMENT ON TABLE writeup_rectification_items IS 'Stores rectification checklist entries linked to VHC additional work authorizations.';
COMMENT ON COLUMN writeup_rectification_items.status IS 'Either complete or waiting to flag outstanding additional work.';

CREATE OR REPLACE FUNCTION set_writeup_rectification_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_writeup_rectification_items_updated_at ON writeup_rectification_items;
CREATE TRIGGER trg_writeup_rectification_items_updated_at
BEFORE UPDATE ON writeup_rectification_items
FOR EACH ROW
EXECUTE FUNCTION set_writeup_rectification_items_updated_at();
