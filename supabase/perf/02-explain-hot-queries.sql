-- supabase/perf/02-explain-hot-queries.sql
--
-- READ-ONLY. EXPLAIN (ANALYZE, BUFFERS) for the exact query shapes this
-- application issues on its hottest screens. These are not generic examples —
-- each mirrors a specific call site, named in the comment above it.
--
-- ANALYZE actually runs the statement. All of these are SELECTs, so they are
-- safe, but they do consume real I/O; run them off-peak if the instance is busy.
--
-- What to look for in each plan:
--   * "Seq Scan" on a large table where a filter or join key exists
--   * "Rows Removed by Filter" much larger than the returned row count
--   * estimated vs actual row counts differing by an order of magnitude
--     (stale statistics — fix with ANALYZE, not an index)
--   * "Buffers: read=" dominating "hit=" (working set not cached)
--
-- Replace :job_number / :job_id / :user_id with real values before running.

\set job_number '''ENR01611'''
\set job_id 1691
\set user_id 45

-- ---------------------------------------------------------------------------
-- A. /jobs — the workload list  (lib/database/jobs.js: JOBS_WORKLOAD_SELECT)
-- ---------------------------------------------------------------------------
-- PostgREST turns the nested select into lateral joins over the child tables.
-- This is the closest SQL equivalent of what that endpoint runs, bounded the
-- same way (created_at desc, limit 400).
explain (analyze, buffers, format text)
select
  j.id, j.job_number, j.status, j.completion_status, j.assigned_to,
  j.customer, j.customer_id, j.vehicle_id, j.vehicle_reg, j.vehicle_make_model,
  j.waiting_status, j.job_source, j.job_division, j.vhc_required,
  j.checked_in_at, j.workshop_started_at, j.status_updated_at,
  j.vhc_completed_at, j.vhc_sent_at, j.created_at, j.next_update_due,
  (select count(*) from vhc_checks vc where vc.job_id = j.id)          as vhc_count,
  (select count(*) from parts_job_items pji where pji.job_id = j.id)   as parts_count,
  (select count(*) from job_clocking jc where jc.job_id = j.id)        as clocking_count,
  (select count(*) from job_notes n where n.job_id = j.id)             as note_count,
  (select count(*) from job_requests r where r.job_id = j.id)          as request_count
from jobs j
order by j.created_at desc
limit 400;

-- The ordering itself: is there an index supporting `order by created_at desc`?
explain (analyze, buffers)
select j.id from jobs j order by j.created_at desc limit 400;

-- ---------------------------------------------------------------------------
-- B. Job card open — single job by number
--    (lib/database/jobs.js: getJobByNumber, via /api/jobcards/[jobNumber])
-- ---------------------------------------------------------------------------
explain (analyze, buffers)
select * from jobs where job_number = :job_number;

-- Each nested relation on the card is a lookup by job_id. Any of these showing
-- a Seq Scan is a missing-index result.
explain (analyze, buffers) select * from vhc_checks       where job_id = :job_id;
explain (analyze, buffers) select * from parts_job_items  where job_id = :job_id;
explain (analyze, buffers) select * from parts_requests   where job_id = :job_id;
explain (analyze, buffers) select * from job_requests     where job_id = :job_id;
explain (analyze, buffers) select * from job_notes        where job_id = :job_id;
explain (analyze, buffers) select * from job_writeups     where job_id = :job_id;
explain (analyze, buffers) select * from job_files        where job_id = :job_id;
explain (analyze, buffers) select * from job_clocking     where job_id = :job_id;
explain (analyze, buffers) select * from appointments     where job_id = :job_id;

-- ---------------------------------------------------------------------------
-- C. Messaging — unread badge  (lib/database/messages.js)
-- ---------------------------------------------------------------------------
explain (analyze, buffers)
select thread_id, last_read_at from message_thread_members where user_id = :user_id;

-- Latest message per thread: the shape behind the badge and the thread list.
explain (analyze, buffers)
select distinct on (m.thread_id) m.thread_id, m.created_at
from messages m
where m.thread_id in (
  select thread_id from message_thread_members where user_id = :user_id
)
order by m.thread_id, m.created_at desc;

-- ---------------------------------------------------------------------------
-- D. Clocking — the per-user active record  (/api/profile/clock)
-- ---------------------------------------------------------------------------
explain (analyze, buffers)
select * from job_clocking
where user_id = :user_id and clock_out is null
order by clock_in desc
limit 1;

-- ---------------------------------------------------------------------------
-- E. Audit writes — the high-frequency path  (/api/audit/events)
-- ---------------------------------------------------------------------------
-- Reads only; the insert path is inspected separately. This shows whether the
-- hash-chain lookup (most recent row) is indexed.
explain (analyze, buffers)
select row_hash from audit_log order by id desc limit 1;

explain (analyze, buffers)
select * from user_activity_events where session_id is not null order by occurred_at desc limit 50;

-- ---------------------------------------------------------------------------
-- F. Status / tracking
-- ---------------------------------------------------------------------------
explain (analyze, buffers)
select * from job_status_history where job_id = :job_id order by changed_at desc;

-- ---------------------------------------------------------------------------
-- G. Statistics freshness
-- ---------------------------------------------------------------------------
-- A plan that is wrong because statistics are stale needs ANALYZE, not an index.
select
  relname,
  last_analyze,
  last_autoanalyze,
  n_mod_since_analyze,
  n_live_tup
from pg_stat_user_tables
where schemaname = 'public'
  and n_live_tup > 1000
order by n_mod_since_analyze desc
limit 25;
