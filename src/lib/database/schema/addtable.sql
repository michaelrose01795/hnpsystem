-- // file location: src/lib/database/schema/addtable.sql
-- // description: defines supplemental tables added beyond reference schema

-- Ensure job notes track who last updated each entry
ALTER TABLE job_notes
  ADD COLUMN IF NOT EXISTS last_updated_by integer;

ALTER TABLE job_notes
  ADD CONSTRAINT IF NOT EXISTS job_notes_last_updated_by_fkey
    FOREIGN KEY (last_updated_by) REFERENCES public.users(user_id);
