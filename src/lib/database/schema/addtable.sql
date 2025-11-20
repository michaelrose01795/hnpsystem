-- // file location: src/lib/database/schema/addtable.sql
-- // description: defines supplemental tables added beyond reference schema

-- Add description column for free-text technician part requests
ALTER TABLE IF EXISTS public.parts_requests
  ADD COLUMN IF NOT EXISTS description text;
