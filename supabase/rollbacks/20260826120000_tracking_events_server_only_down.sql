begin;

-- Rollback for
-- supabase/migrations/20260826120000_tracking_events_server_only.sql.
--
-- This file lives in supabase/rollbacks/, NOT supabase/migrations/, on purpose.
-- `supabase db push` applies every file in the migrations folder in filename
-- order, so a rollback sitting next to its own migration would be applied
-- immediately after it and silently undo the lockdown. Run this one by hand
-- (SQL editor or psql) and only when you actually want to revert.
--
-- Apply this ONLY to undo that migration. It replays the grants, policies and
-- RLS setting captured in public.rls_rollback_tracking_events at the moment the
-- tables were locked down, so the tables return to exactly the state they were
-- in beforehand — it does not guess at a "sensible" open configuration.
--
-- Run it if closing the tables turns out to break a read path that was missed:
-- the application side is unaffected by this file, because every current caller
-- already goes through the service role and keeps working either way.
--
-- If the rollback table is empty or missing, the lockdown migration never ran
-- here and this is a no-op.

do $$
declare
  target_table text;
  rollback_row record;
  pending_statements text[];
  pending_statement text;
  tracking_tables constant text[] := array[
    'key_tracking_events',
    'vehicle_tracking_events'
  ];
begin
  if to_regclass('public.rls_rollback_tracking_events') is null then
    raise notice 'No rollback snapshot present; nothing to restore.';
    return;
  end if;

  foreach target_table in array tracking_tables loop
    if to_regclass(format('public.%I', target_table)) is null then
      continue;
    end if;

    if not exists (
      select 1 from public.rls_rollback_tracking_events where table_name = target_table
    ) then
      raise notice 'No rollback snapshot for public.%; leaving it as is.', target_table;
      continue;
    end if;

    -- Drop whatever the lockdown left behind before restoring, so replaying the
    -- snapshot cannot collide with an existing policy of the same name.
    -- Materialised first: iterating pg_policies while dropping from it can let
    -- the cursor see its own writes and skip rows.
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

    -- Restore in recorded order: RLS setting, then table grants, then the
    -- column grants that were not implied by a table grant, then policies.
    for rollback_row in
      select statement
      from public.rls_rollback_tracking_events
      where table_name = target_table
      order by
        case kind
          when 'rls' then 1
          when 'grant' then 2
          when 'column_grant' then 3
          else 4
        end,
        id
    loop
      execute rollback_row.statement;
    end loop;

    delete from public.rls_rollback_tracking_events where table_name = target_table;
  end loop;
end
$$;

-- Drop the snapshot table once it has been fully replayed and emptied.
--
-- The guard cannot be written as
--
--   if to_regclass('public.rls_rollback_tracking_events') is not null
--      and not exists (select 1 from public.rls_rollback_tracking_events)
--
-- because PL/pgSQL plans the WHOLE expression before evaluating any of it. The
-- `to_regclass` test never gets the chance to short-circuit: the planner
-- resolves public.rls_rollback_tracking_events while preparing the statement and
-- raises 42P01 if it is gone. That is exactly what happens on a second run of
-- this file, after the first run has already dropped the table — the rollback
-- itself succeeded, then failed on this cosmetic last step.
--
-- Splitting the guard into its own statement and reaching the table through
-- EXECUTE defers parsing until after the existence check has passed, so a
-- repeat run is a clean no-op.
do $$
declare
  snapshot_has_rows boolean;
begin
  if to_regclass('public.rls_rollback_tracking_events') is null then
    raise notice 'Snapshot table already removed; nothing to drop.';
    return;
  end if;

  execute 'select exists (select 1 from public.rls_rollback_tracking_events)'
    into snapshot_has_rows;

  if snapshot_has_rows then
    raise notice 'Snapshot table still holds rows for other tables; keeping it.';
    return;
  end if;

  execute 'drop table public.rls_rollback_tracking_events';
end
$$;

commit;
