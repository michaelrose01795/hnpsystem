-- supabase/perf/01-baseline-snapshot.sql
--
-- READ-ONLY. Run this in the Supabase SQL editor (or psql) BEFORE changing
-- anything, and keep the output. It is the "before" half of the measurement
-- window; 03-after-snapshot.sql re-runs the same queries afterwards.
--
-- Nothing here writes, locks or changes a plan. The one stateful call
-- (pg_stat_statements_reset) is documented in README.md and is opt-in.
--
-- ---------------------------------------------------------------------------
-- 0. Environment
-- ---------------------------------------------------------------------------
select version() as postgres_version;
select now() as snapshot_taken_at;

-- pg_stat_statements must be enabled for the workload analysis below.
-- Supabase: Dashboard -> Database -> Extensions -> pg_stat_statements.
select
  exists (select 1 from pg_extension where extname = 'pg_stat_statements') as pg_stat_statements_enabled,
  (select stats_reset from pg_stat_statements_info) as stats_last_reset;

-- ---------------------------------------------------------------------------
-- 1. Hot queries by TOTAL time (where the database actually spends its life)
-- ---------------------------------------------------------------------------
-- pg_stat_statements is CUMULATIVE since stats_reset. A query with a modest
-- mean but a huge call count can matter more than a slow rare one, so both are
-- reported. `queryid` is the join key to keep across snapshots.
select
  s.queryid,
  round(s.total_exec_time)::bigint            as total_ms,
  s.calls,
  round(s.mean_exec_time::numeric, 2)         as mean_ms,
  round(s.max_exec_time::numeric, 2)          as max_ms,
  round(s.stddev_exec_time::numeric, 2)       as stddev_ms,
  s.rows,
  round(s.rows::numeric / nullif(s.calls, 0), 1) as rows_per_call,
  left(regexp_replace(s.query, '\s+', ' ', 'g'), 240) as query
from pg_stat_statements s
join pg_roles r on r.oid = s.userid
where s.query not ilike '%pg_stat_statements%'
  and s.query not ilike '%pg_catalog%'
order by s.total_exec_time desc
limit 40;

-- ---------------------------------------------------------------------------
-- 2. Hot queries by MEAN time (the 0.6-0.8s job/job-card queries live here)
-- ---------------------------------------------------------------------------
select
  s.queryid,
  round(s.mean_exec_time::numeric, 1) as mean_ms,
  s.calls,
  round(s.total_exec_time)::bigint    as total_ms,
  round(s.rows::numeric / nullif(s.calls, 0), 1) as rows_per_call,
  left(regexp_replace(s.query, '\s+', ' ', 'g'), 240) as query
from pg_stat_statements s
where s.calls >= 5
  and s.query not ilike '%pg_stat_statements%'
order by s.mean_exec_time desc
limit 40;

-- ---------------------------------------------------------------------------
-- 3. Table sizes and access patterns for the hot relations
-- ---------------------------------------------------------------------------
select
  st.relname                                   as table_name,
  st.n_live_tup                                as live_rows,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
  pg_size_pretty(pg_indexes_size(c.oid))        as index_size,
  st.seq_scan,
  st.seq_tup_read,
  st.idx_scan,
  case when st.seq_scan + st.idx_scan = 0 then null
       else round(100.0 * st.idx_scan / (st.seq_scan + st.idx_scan), 1)
  end                                          as pct_index_scans,
  round(st.seq_tup_read::numeric / nullif(st.seq_scan, 0), 0) as avg_rows_per_seq_scan
from pg_stat_user_tables st
join pg_class c on c.oid = st.relid
where st.schemaname = 'public'
order by st.seq_tup_read desc nulls last
limit 40;

-- ---------------------------------------------------------------------------
-- 4. Foreign keys with NO supporting index
-- ---------------------------------------------------------------------------
-- Every nested relation the app selects (job -> vhc_checks, job -> parts_job_items,
-- job -> job_clocking, ...) becomes a lookup on the child's FK column. Without an
-- index each one is a sequential scan per parent row.
select
  c.conrelid::regclass::text as child_table,
  a.attname                  as fk_column,
  c.confrelid::regclass::text as parent_table,
  pg_size_pretty(pg_total_relation_size(c.conrelid)) as child_size,
  (select st.n_live_tup from pg_stat_user_tables st where st.relid = c.conrelid) as child_rows
from pg_constraint c
join lateral unnest(c.conkey) with ordinality as k(attnum, ord) on true
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
where c.contype = 'f'
  and connamespace = 'public'::regnamespace
  and not exists (
    select 1
    from pg_index i
    where i.indrelid = c.conrelid
      and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] @> c.conkey
      and (i.indkey::int2[])[0] = c.conkey[1]
  )
order by pg_total_relation_size(c.conrelid) desc;

-- ---------------------------------------------------------------------------
-- 5. Unused and duplicate indexes
-- ---------------------------------------------------------------------------
-- NEVER drop on idx_scan = 0 alone: a fresh stats_reset, a seasonal report or a
-- uniqueness constraint can all look "unused". Treat this as a candidate list to
-- confirm against a full business cycle.
select
  s.relname   as table_name,
  s.indexrelname as index_name,
  s.idx_scan,
  pg_size_pretty(pg_relation_size(s.indexrelid)) as index_size,
  ix.indisunique as is_unique,
  ix.indisprimary as is_primary
from pg_stat_user_indexes s
join pg_index ix on ix.indexrelid = s.indexrelid
where s.schemaname = 'public'
  and s.idx_scan = 0
  and not ix.indisprimary
  and not ix.indisunique
order by pg_relation_size(s.indexrelid) desc;

-- Exact duplicates: same table, same column list, same predicate. Only these are
-- safe removal candidates, and only the non-constraint-backed copy.
select
  indrelid::regclass::text as table_name,
  array_agg(indexrelid::regclass::text order by indexrelid) as duplicate_indexes,
  pg_size_pretty(sum(pg_relation_size(indexrelid))) as combined_size
from pg_index
where indrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace)
group by indrelid, indkey, coalesce(indpred::text, ''), coalesce(indexprs::text, '')
having count(*) > 1;

-- ---------------------------------------------------------------------------
-- 6. RLS policies that re-evaluate auth functions PER ROW
-- ---------------------------------------------------------------------------
-- `auth.uid()` / `auth.jwt()` written bare are evaluated once per row. Wrapping
-- them as `(select auth.uid())` makes Postgres treat the value as a one-time
-- InitPlan for the statement. Same semantics, evaluated once.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles::text,
  case
    when qual ~* '\(\s*select\s+auth\.' or with_check ~* '\(\s*select\s+auth\.' then 'already wrapped'
    when qual ~* 'auth\.(uid|jwt|role)\s*\(' or with_check ~* 'auth\.(uid|jwt|role)\s*\(' then 'PER-ROW — candidate'
    else 'no auth call'
  end as auth_evaluation,
  qual       as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
order by
  case when qual ~* 'auth\.(uid|jwt|role)\s*\(' and qual !~* '\(\s*select\s+auth\.' then 0 else 1 end,
  tablename, policyname;

-- ---------------------------------------------------------------------------
-- 7. Multiple PERMISSIVE policies for the same role+action
-- ---------------------------------------------------------------------------
-- Postgres ORs every permissive policy together, so each one is executed for
-- every row. Consolidating is only safe when the combined expression accepts
-- exactly the same rows for exactly the same roles — verify per table before
-- touching anything.
select
  tablename,
  cmd,
  roles::text,
  count(*)                       as permissive_policy_count,
  array_agg(policyname order by policyname) as policies
from pg_policies
where schemaname = 'public'
  and permissive = 'PERMISSIVE'
group by tablename, cmd, roles
having count(*) > 1
order by count(*) desc, tablename;

-- ---------------------------------------------------------------------------
-- 8. Cache hit ratios (is this a memory problem rather than an index problem?)
-- ---------------------------------------------------------------------------
select
  'index hit rate' as metric,
  round(100.0 * sum(idx_blks_hit) / nullif(sum(idx_blks_hit + idx_blks_read), 0), 2) as pct
from pg_statio_user_indexes
union all
select
  'table hit rate',
  round(100.0 * sum(heap_blks_hit) / nullif(sum(heap_blks_hit + heap_blks_read), 0), 2)
from pg_statio_user_tables;
