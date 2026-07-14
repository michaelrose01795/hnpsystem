-- Sidebar access v4 stores role-module layout metadata in the existing JSONB
-- users.sidebar_access column. This migration is deliberately non-destructive:
-- existing v1-v3 rows are preserved and normalized by the application on read.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sidebar_access jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_sidebar_access_is_object'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_sidebar_access_is_object
      CHECK (sidebar_access IS NULL OR jsonb_typeof(sidebar_access) = 'object');
  END IF;
END $$;

COMMENT ON COLUMN public.users.sidebar_access IS
  'Optional presentation-only sidebar layout override. v4 supports modules/sourceRole while preserving legacy items/groups snapshots; route/API permissions remain role-based.';
