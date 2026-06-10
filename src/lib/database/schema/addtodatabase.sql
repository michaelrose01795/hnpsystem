-- Pending schema changes to apply in Supabase, then mirror into schemaReference.sql.

-- Internal phone extension (e.g. "212") for staff users, shown in the messages thread header.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS extension text;
