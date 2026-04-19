-- file location: src/lib/database/schema/migrations/2026-04-19-showcase-notes.sql
-- Adds a table for storing developer notes against individual showcase
-- sections on the /dev/user-diagnostic page. Each row is keyed by the
-- showcase section's itemKey so notes persist across sessions.

CREATE TABLE IF NOT EXISTS public.showcase_notes (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  section_key text   NOT NULL UNIQUE,
  note_text   text   NOT NULL DEFAULT '',
  updated_by  integer REFERENCES public.users(user_id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS showcase_notes_section_key_idx
  ON public.showcase_notes (section_key);

NOTIFY pgrst, 'reload schema';
