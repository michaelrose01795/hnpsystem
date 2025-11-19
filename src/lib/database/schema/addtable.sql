-- // file location: src/lib/database/schema/addtable.sql
-- // description: defines supplemental tables added beyond reference schema

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS metadata jsonb;

