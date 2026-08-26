-- Diagnostic. Read-only — changes nothing.
--
-- Run this in the Supabase SQL Editor, on the SAME project the app points at
-- (NEXT_PUBLIC_SUPABASE_URL = https://qtqlhbtqezesssdbhdlu.supabase.co), and
-- send back all five result sets.
--
-- Context: after the migration was reported as applied, the anon key can still
-- read 1200 real rows from both tracking tables, and public.rls_rollback_
-- tracking_events is not visible to PostgREST. That combination says the
-- migration did not commit here. These five queries say exactly which part is
-- missing.

-- 1. Is RLS actually on?
--    Expected after a successful migration: relrowsecurity = true for both.
select
  c.relname            as table_name,
  c.relrowsecurity     as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  pg_get_userbyid(c.relowner) as owner
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('key_tracking_events', 'vehicle_tracking_events');

-- 2. Who still holds table privileges?
--    Expected after a successful migration: no rows for PUBLIC/anon/authenticated.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('key_tracking_events', 'vehicle_tracking_events')
  and grantee in ('PUBLIC', 'anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- 3. Any column-level privileges left?
--    Expected after a successful migration: no rows.
select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name in ('key_tracking_events', 'vehicle_tracking_events')
  and grantee in ('PUBLIC', 'anon', 'authenticated')
order by table_name, grantee, column_name;

-- 4. Did the migration create its rollback snapshot?
--    Expected after a successful migration: 'present', with rows per table.
select
  case
    when to_regclass('public.rls_rollback_tracking_events') is null then 'ABSENT — migration did not commit'
    else 'present'
  end as snapshot_table,
  (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'rls_rollback_tracking_events'
  ) as matched_relations;

-- 5. What does the CLI migration history think?
--    The manual record step should have inserted 20260826120000. If this row is
--    present while 1–4 show an untouched database, the history record was run
--    but the migration itself was not (or errored and rolled back).
select version, name
from supabase_migrations.schema_migrations
where version >= '20260814150000'
order by version;
