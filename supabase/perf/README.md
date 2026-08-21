# Database performance kit

Read-only analysis plus reversible migrations for the Supabase side of the
performance work. Nothing here runs automatically.

## Why this is a kit rather than applied changes

Index, RLS and policy changes must be driven by *this* workload, not by generic
advice. That needs `pg_stat_statements` output and `EXPLAIN (ANALYZE)` plans from
the live database, which cannot be read from the repository: `.env.local` carries
the PostgREST service key but no Postgres connection string, and the Supabase CLI
in this project is not logged in.

So the analysis is scripted and ready to run, and any migration it justifies is
written to be reversible.

## Order of operations

| Step | File | Writes? |
|---|---|---|
| 1 | `01-baseline-snapshot.sql` | No — capture and keep the output |
| 2 | `02-explain-hot-queries.sql` | No — `EXPLAIN (ANALYZE)` runs real SELECTs |
| 3 | Supabase Dashboard → Advisors → Performance | No |
| 4 | Decide which indexes/policies the plans actually justify | — |
| 5 | `../migrations/*_perf_*.sql` | Yes — reversible, see below |
| 6 | `03-after-snapshot.sql` | No — same queries as step 1 |

## How to run it (full working day window)

**Day 0 — after the application changes from this pass are deployed.**
Deploying first matters: several queries in any older sample no longer exist, and
indexing a query the app has stopped issuing is wasted write cost.

1. Confirm the extension is on: Dashboard → Database → Extensions →
   `pg_stat_statements`.
2. First thing in the morning, in the SQL editor:
   ```sql
   select pg_stat_statements_reset();
   ```
3. Let the team work a normal day.
4. End of day, run `01-baseline-snapshot.sql`. Save **all eight result sets**.
5. Run `02-explain-hot-queries.sql`. Substitute a real `job_number`, `job_id`
   and `user_id` for a job with plenty of VHC items and parts — a busy card
   shows the joins that a sparse one hides.
6. Dashboard → Advisors → Performance. Export or screenshot the findings.

**What to send back**

| From | What matters most |
|---|---|
| `01` §1 and §2 | Full tables. These decide what is worth indexing. |
| `01` §3 | Rows where `pct_index_scans` is low and `seq_tup_read` is high. |
| `01` §4 | All of it — unindexed foreign keys are the most likely win. |
| `01` §5 | Both result sets, for the "safe removal" decision. |
| `01` §6 and §7 | All of it — this drives the RLS work. |
| `02` | The plan text for each statement, especially any `Seq Scan` on a big table and any large `Rows Removed by Filter`. |
| Advisors | The findings list. |

Plans are long; the `Seq Scan` / `Rows Removed by Filter` / `Buffers` lines carry
most of the signal if you need to trim.

**Then:** migrations get written against those plans (templates are in
`migrations-templates/`), you apply them, reset again, run another full day, and
run `03-after-snapshot.sql`.

## The measurement window

`pg_stat_statements` is **cumulative since `stats_reset`**. Comparing a snapshot
taken after a change against one taken before it, without resetting, mixes the
old workload into both numbers and understates the improvement.

```sql
-- Establish a clean window. Requires the pg_stat_statements extension.
select pg_stat_statements_reset();
```

Then:

1. Reset.
2. Let the app run through a representative period — ideally a full working day,
   at minimum a busy hour that includes job-card opens, `/jobs` loads and
   clock-ins.
3. Run `01-baseline-snapshot.sql`. **This is the "before".**
4. Apply changes.
5. Reset again, run the same representative period, run `03-after-snapshot.sql`.

Judging a change on a window shorter than one business cycle will mislead: a
report that runs once a morning can dominate `total_exec_time` in a 10-minute
sample and vanish in a daily one.

## Rules for anything applied

* **Indexes are created `CONCURRENTLY`.** A plain `CREATE INDEX` takes an
  `ACCESS EXCLUSIVE`-adjacent lock that blocks writes to the table for the whole
  build. `CONCURRENTLY` cannot run inside a transaction block, so those
  statements live in their own migration with no `BEGIN`/`COMMIT`.
* **Every migration has a documented `-- Down:` section.** Reversal for an index
  is `DROP INDEX CONCURRENTLY IF EXISTS`.
* **No index is added without a plan that shows it being used.** An unused index
  is not free: it is written on every insert, update and delete of that table.
* **No index is dropped on `idx_scan = 0` alone.** That counter resets with
  statistics and misses seasonal work. Only exact duplicates (same table, same
  column list, same predicate) are safe candidates, and only the copy that is not
  backing a constraint.
* **RLS changes must be semantics-preserving.** Wrapping `auth.uid()` as
  `(select auth.uid())` changes only *when* the value is evaluated — once per
  statement instead of once per row. Consolidating multiple permissive policies
  changes the *expression*, so it is only safe when the combined policy admits
  exactly the same rows for exactly the same roles. Confirm per table, per role,
  before and after, with a real query.
* **No destructive schema changes.** No dropped columns, no altered types, no
  data migrations in this workstream.

## What the application side already changed

These land before any database change and affect what the database is asked to
do, so re-baseline after deploying them:

* Vercel functions pinned to `lhr1` to match the database region (`eu-west-2`).
  Before this, every round trip crossed the Atlantic. See `docs/perf-region-note.md`.
* `/api/users/roster` no longer runs an unbounded scan of `customers` on every
  authenticated page load, and no longer runs the same `users` query twice.
* `/api/shell/bootstrap` resolves sidebar access, roster and unread count in one
  request instead of three.
* The job card fetches once through `/api/jobcards/[jobNumber]` instead of a
  browser query plus two sequential follow-ups.
* `/jobs` uses a narrow bounded workload query instead of an unbounded
  all-relations select, and patches single rows on realtime events.
* `resolveSessionUserId` no longer re-queries `users` on every API call.

Several of the "hot queries" in an old `pg_stat_statements` sample will therefore
no longer exist. That is why step 1 must be re-run *after* the application
changes are deployed — otherwise the index work optimises queries the app has
stopped issuing.
