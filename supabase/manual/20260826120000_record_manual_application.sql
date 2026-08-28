-- Run this ONLY after applying
-- supabase/migrations/20260826120000_tracking_events_server_only.sql by hand
-- (Supabase SQL Editor / psql), and only if that migration succeeded.
--
-- Why it is a separate step rather than part of the migration
-- ----------------------------------------------------------
-- When `supabase db push` applies a migration it inserts the version row into
-- supabase_migrations.schema_migrations *itself*, after running the file. A
-- migration that also inserted its own version row would collide with that
-- insert and break the push. So the row is recorded here instead, out of band.
--
-- What it does
-- ------------
-- Tells the CLI's migration history that version 20260826120000 is already
-- applied, so a later `supabase db push` skips it instead of re-running it.
--
-- Skipping this is not dangerous. The migration is idempotent by design — the
-- rollback snapshot is captured only when no snapshot exists for the table, and
-- every other statement (enable RLS, revoke, drop policy if exists, grant to
-- service_role) is safe to repeat. A push that re-runs it is a no-op that
-- leaves the original snapshot intact. Recording it simply keeps `supabase
-- migration list` honest about what is on the remote.

insert into supabase_migrations.schema_migrations (version, name)
values ('20260826120000', 'tracking_events_server_only')
on conflict (version) do nothing;

-- Confirm it landed. Expect one row.
select version, name
from supabase_migrations.schema_migrations
where version = '20260826120000';
