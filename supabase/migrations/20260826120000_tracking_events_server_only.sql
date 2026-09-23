begin;

-- Tracking event tables become server-only.
--
-- public.key_tracking_events and public.vehicle_tracking_events are the
-- append-only movement log behind the /tracking list, the job-card tracker
-- panel, the technician workspace tracker and the job timeline in
-- /api/status/getHistory. Until now every one of those reads ran from the
-- browser under the public anon key, so the tables had to stay readable by
-- PostgREST's anon/authenticated roles.
--
-- All of those reads have moved behind server-owned, role-guarded APIs:
--
--   GET  /api/tracking/snapshot        list mode and single-job mode
--   POST /api/tracking/next-action     manual updates and automatic movement
--   GET  /api/status/getHistory        job timeline
--   GET  /api/status/snapshot          job status snapshot
--
-- Each runs behind withRoleGuard (NextAuth session + RBAC) and queries under
-- the service role, which bypasses RLS. Nothing in the browser reads or writes
-- these tables directly any more, so the public grants are now pure attack
-- surface: with the anon key — which ships in every page — anyone could read
-- the whole workshop's vehicle and key movements, or forge movement rows.
--
-- This mirrors the server_only_tables treatment in
-- 20260814150000_harden_supabase_rls_and_function_permissions.sql: RLS enabled
-- with no public policy, and no table privilege for anon/authenticated.
--
-- Realtime is unaffected. Neither table is subscribed to from the browser —
-- /tracking subscribes to public.jobs and refreshes through the snapshot API,
-- and StatusSidebar's channel list does not include either table.
--
-- Reversible: the exact pre-change grants, policies and RLS setting are
-- recorded in public.rls_rollback_tracking_events before anything changes.
-- supabase/rollbacks/20260826120000_tracking_events_server_only_down.sql
-- replays that snapshot verbatim. The rollback deliberately lives outside the
-- migrations folder so `supabase db push` cannot apply it straight after this
-- one and undo the lockdown.

create table if not exists public.rls_rollback_tracking_events (
  id bigint generated always as identity primary key,
  recorded_at timestamptz not null default now(),
  kind text not null,          -- 'rls' | 'grant' | 'column_grant' | 'policy'
  table_name text not null,
  statement text not null
);

revoke all privileges on table public.rls_rollback_tracking_events
  from public, anon, authenticated;

do $$
declare
  target_table text;
  grant_row record;
  policy_row record;
  rls_was_enabled boolean;
  pending_statements text[];
  pending_statement text;
  tracking_tables constant text[] := array[
    'key_tracking_events',
    'vehicle_tracking_events'
  ];
begin
  foreach target_table in array tracking_tables loop
    if to_regclass(format('public.%I', target_table)) is null then
      raise exception 'Expected table public.% does not exist', target_table;
    end if;

    -- Nothing recorded yet for this table: capture the current state so the
    -- down migration can restore it byte for byte. Guarded so re-running the
    -- migration cannot overwrite the original snapshot with the hardened one.
    if not exists (
      select 1 from public.rls_rollback_tracking_events where table_name = target_table
    ) then
      select c.relrowsecurity
        into rls_was_enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = target_table;

      insert into public.rls_rollback_tracking_events (kind, table_name, statement)
      values (
        'rls',
        target_table,
        format(
          'alter table public.%I %s row level security',
          target_table,
          case when rls_was_enabled then 'enable' else 'disable' end
        )
      );

      for grant_row in
        select grantee, privilege_type
        from information_schema.role_table_grants
        where table_schema = 'public'
          and table_name = target_table
          and grantee in ('PUBLIC', 'anon', 'authenticated')
      loop
        insert into public.rls_rollback_tracking_events (kind, table_name, statement)
        values (
          'grant',
          target_table,
          format(
            'grant %s on table public.%I to %s',
            grant_row.privilege_type,
            target_table,
            case when grant_row.grantee = 'PUBLIC' then 'public' else quote_ident(grant_row.grantee) end
          )
        );
      end loop;

      -- Column-level grants are NOT removed by a table-level REVOKE, so they
      -- have to be captured and revoked in their own right or the table stays
      -- partly open. PostgreSQL's information_schema.column_privileges also
      -- lists the per-column consequences of a table-wide grant, which would
      -- make this snapshot record a table grant as N column grants and restore
      -- a different catalog state on rollback — so rows already explained by a
      -- table-level grant are excluded here.
      for grant_row in
        select cp.grantee, cp.privilege_type, cp.column_name
        from information_schema.column_privileges cp
        where cp.table_schema = 'public'
          and cp.table_name = target_table
          and cp.grantee in ('PUBLIC', 'anon', 'authenticated')
          and not exists (
            select 1
            from information_schema.role_table_grants rtg
            where rtg.table_schema = 'public'
              and rtg.table_name = target_table
              and rtg.grantee = cp.grantee
              and rtg.privilege_type = cp.privilege_type
          )
      loop
        insert into public.rls_rollback_tracking_events (kind, table_name, statement)
        values (
          'column_grant',
          target_table,
          format(
            'grant %s (%I) on table public.%I to %s',
            grant_row.privilege_type,
            grant_row.column_name,
            target_table,
            case when grant_row.grantee = 'PUBLIC' then 'public' else quote_ident(grant_row.grantee) end
          )
        );
      end loop;

      for policy_row in
        select
          policyname,
          permissive,
          roles,
          cmd,
          qual,
          with_check
        from pg_policies
        where schemaname = 'public'
          and tablename = target_table
      loop
        insert into public.rls_rollback_tracking_events (kind, table_name, statement)
        values (
          'policy',
          target_table,
          format(
            'create policy %I on public.%I as %s for %s to %s%s%s',
            policy_row.policyname,
            target_table,
            policy_row.permissive,
            policy_row.cmd,
            (
              select string_agg(quote_ident(role_name), ', ')
              from unnest(policy_row.roles) as role_name
            ),
            case when policy_row.qual is null then '' else format(' using (%s)', policy_row.qual) end,
            case when policy_row.with_check is null then '' else format(' with check (%s)', policy_row.with_check) end
          )
        );
      end loop;
    end if;

    -- Close the table to PostgREST's public roles.
    execute format('alter table public.%I enable row level security', target_table);
    execute format(
      'revoke all privileges on table public.%I from public, anon, authenticated',
      target_table
    );

    -- Collect the statements before executing any of them. Iterating a catalog
    -- view while the loop body changes that same catalog can let the cursor see
    -- its own writes and skip rows; materialising first makes the set fixed.
    select coalesce(
      array_agg(
        format(
          'revoke %s (%I) on table public.%I from %s',
          cp.privilege_type,
          cp.column_name,
          target_table,
          case when cp.grantee = 'PUBLIC' then 'public' else quote_ident(cp.grantee) end
        )
      ),
      '{}'::text[]
    )
      into pending_statements
    from information_schema.column_privileges cp
    where cp.table_schema = 'public'
      and cp.table_name = target_table
      and cp.grantee in ('PUBLIC', 'anon', 'authenticated');

    foreach pending_statement in array pending_statements loop
      execute pending_statement;
    end loop;

    select coalesce(
      array_agg(format('drop policy if exists %I on public.%I', policyname, target_table)),
      '{}'::text[]
    )
      into pending_statements
    from pg_policies
    where schemaname = 'public'
      and tablename = target_table;

    foreach pending_statement in array pending_statements loop
      execute pending_statement;
    end loop;

    -- Fail the migration rather than leaving a half-open table.
    if has_table_privilege(
      'anon',
      format('public.%I', target_table),
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ) or has_table_privilege(
      'authenticated',
      format('public.%I', target_table),
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ) then
      raise exception 'Public database privilege remains on tracking table public.%', target_table;
    end if;

    if exists (
      select 1
      from information_schema.column_privileges cp
      where cp.table_schema = 'public'
        and cp.table_name = target_table
        and cp.grantee in ('PUBLIC', 'anon', 'authenticated')
    ) then
      raise exception 'Public column privilege remains on tracking table public.%', target_table;
    end if;
  end loop;
end
$$;

-- The service role must keep full access — every application read and write
-- now depends on it. This is a no-op on a standard Supabase project and exists
-- so a project with narrowed service_role grants cannot silently lose tracking.
grant select, insert, update, delete
  on table public.key_tracking_events, public.vehicle_tracking_events
  to service_role;

commit;
