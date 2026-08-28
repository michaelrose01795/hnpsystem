# Tracking events — server-only lockdown runbook

Covers `supabase/migrations/20260826120000_tracking_events_server_only.sql` and
its rollback
`supabase/rollbacks/20260826120000_tracking_events_server_only_down.sql`.

The rollback lives outside `supabase/migrations/` deliberately: `supabase db
push` applies everything in that folder in filename order, so a rollback stored
beside its own migration would run immediately after it and quietly undo the
lockdown. Apply the rollback by hand only when you mean to revert.

The application-side changes are already merged and are **safe either way** —
every caller goes through the service role, which bypasses RLS, so the app
behaves identically before and after the migration. The migration only removes
access that nothing uses any more.

## What changes

`public.key_tracking_events` and `public.vehicle_tracking_events` stop being
reachable through PostgREST's `anon` / `authenticated` roles. RLS is enabled
with no public policy, and all public table privileges are revoked — the same
treatment the `server_only_tables` list in
`20260814150000_harden_supabase_rls_and_function_permissions.sql` already
applies to `audit_log`, `payslips` and friends.

## Why it is now safe

Every read and write of these tables runs server-side under the service role,
behind `withRoleGuard` (NextAuth session + RBAC):

| Path | Route |
|---|---|
| `/tracking` list | `GET /api/tracking/snapshot` |
| Job-card tracker panel | `GET /api/tracking/snapshot?jobId=…&jobNumber=…&vehicleReg=…` |
| Technician workspace tracker | `GET /api/tracking/snapshot?jobId=…&jobNumber=…&vehicleReg=…` |
| Manual location update | `POST /api/tracking/next-action` |
| Automatic movement | `POST /api/tracking/next-action` → `recordAutomaticMovementForStatus` |
| Job timeline | `GET /api/status/getHistory` |
| Job status snapshot | `GET /api/status/snapshot` |
| Job-card archive | `POST /api/jobcards/archive/create` (`supabaseService`) |

**Realtime is not affected.** Neither table is subscribed to from the browser:
`/tracking` subscribes to `public.jobs` and refreshes through the snapshot API,
and `StatusSidebar`'s channel list covers `jobs`, `job_status_history`,
`job_requests`, `vhc_checks`, `parts_job_items`, `job_clocking`, `job_writeups`,
`invoices`, `vhc_declinations`, `job_activity_events` and `job_files` — not the
tracking event tables. `public.jobs` is untouched by this migration.

**Not in scope.** `LoanCarSchedulePanel` still calls the `tracking_loan_car*`
helpers directly from the browser. Those are different tables and are left
exactly as they are; locking them down needs its own API migration first.

## Current exposure (measured 2026-08-26, before the migration)

`npm run check:tracking-rls`

```
public.key_tracking_events
  anon    SELECT  ALLOWED (HTTP 200)
  anon    INSERT  ALLOWED (HTTP 400, 23502)
  service SELECT  allowed (HTTP 200)

public.vehicle_tracking_events
  anon    SELECT  ALLOWED (HTTP 200)
  anon    INSERT  ALLOWED (HTTP 400, 23502)
  service SELECT  allowed (HTTP 200)
```

`23502` is a not-null violation, **not** a permission error — the insert passed
the privilege check and only failed on a missing column. So today anyone holding
the anon key (which ships in every page) can read the whole workshop's vehicle
and key movements *and* forge movement rows.

## State of the data (measured 2026-08-26, read-only via the service role)

```
key_tracking_events     1200 rows, rows-per-job histogram {"1": 1000}
vehicle_tracking_events 1200 rows, rows-per-job histogram {"1": 1000}
```

Essentially **every job has exactly one row per table**. That is the real
signature of the `update(payload).eq("job_id", …)` bug: because the insert only
fired when the update matched nothing, a job's first event was created once and
then overwritten in place forever after. The movement history was not merely
rewritten — it was never allowed to accumulate.

Two consequences worth knowing before verifying:

- There is **no historical timeline to lose**. The append-only fix starts
  building one from now on; existing rows keep their current values.
- Each job's single row currently carries the timestamp and actor of its *last*
  location change, so the "Added to parking & key tracking" marker in
  `/api/status/getHistory` presently claims every job joined tracking at the
  moment it was last moved. New appends will sit on top of that row, and the
  marker becomes correct for everything recorded from here.

This is also why the snapshot scan window was raised from 50 to 400 rows: at
~1.0 rows per job the old window covered the whole workshop, but once history
actually accumulates a 50-row scan would collapse to a handful of jobs.

## Applying — Supabase SQL Editor

The CLI has no access token on this machine and the local migration history
cannot be read, so `supabase db push` might also try to re-run earlier
migrations. Apply this one by hand instead.

**Step 1 — run the migration.** Paste the whole of
`supabase/migrations/20260826120000_tracking_events_server_only.sql` into the
SQL Editor and run it. It is a single `begin … commit`, so it either applies
completely or not at all. Expect `Success. No rows returned`.

**Step 2 — record it in migration history.** Paste and run
`supabase/manual/20260826120000_record_manual_application.sql`. This inserts
the version row that `supabase db push` would normally write itself, so a
later push skips this migration instead of re-running it. It is kept out of the
migration file on purpose: the CLI writes that row itself after applying, and a
migration that inserted its own version row would collide with that write and
break the push.

**Step 3 — verify.** `npm run check:tracking-rls` must print `PASS`, then work
through the checklist below.

### Safe to run exactly once — and safe to repeat

Every statement is idempotent, so a later accidental re-run is a no-op:

| Statement | On re-run |
|---|---|
| `create table if not exists` the snapshot table | no-op |
| snapshot capture | guarded by `if not exists (… where table_name = …)`, so the **original** pre-lockdown state is never overwritten by the hardened one |
| `alter table … enable row level security` | no-op |
| `revoke all privileges …` | no-op |
| column-grant revokes | set is empty second time round |
| `drop policy if exists` | no-op |
| `grant … to service_role` | no-op |

That matters for the rollback too: re-running the migration cannot corrupt the
captured snapshot, so the rollback still restores the true original grants.

### Scope

The table list inside the migration is exactly:

```
'key_tracking_events',
'vehicle_tracking_events'
```

Every `alter`, `revoke`, `grant` and `drop policy` runs inside a
`foreach target_table in array tracking_tables` loop over that list and is
built with `format(… %I, target_table)`, so no unrelated table or policy can
be reached. `tracking_loan_cars`, `tracking_loan_car_bookings` and
`tracking_loan_car_fuel_history` are **not** in the list and are untouched —
they still have browser-side callers and need their own API migration first.

The migration also captures and revokes **column-level** grants. A table-level
`REVOKE` does not remove column-specific privileges, so without this a table
could look closed while individual columns stayed readable; the final assertion
fails the transaction if any table or column privilege survives for
`public` / `anon` / `authenticated`.

## Verification checklist

Run these against the environment you applied to.

1. **Unauthorised direct access** — `npm run check:tracking-rls` prints `PASS`:
   anon SELECT and INSERT denied on both tables, service role SELECT allowed.
   The probe classifies on the PostgREST error *code*, not the HTTP status: a
   400 carrying `23502` (not-null violation) means the write got past the
   privilege check and is reported as ALLOWED, which is how the currently-open
   insert path was found. Note the probe can only exercise `anon` — this app
   authenticates with NextAuth and never mints a Supabase Auth JWT, so the
   `authenticated` role is unreachable from here. Its lockdown is covered by
   the migration's own assertion, which aborts the transaction if any table or
   column privilege survives for `public`, `anon` or `authenticated`.
2. **Tracking list** — `/tracking` loads and shows current key and vehicle
   locations for active jobs.
3. **Manual location update** — change a location from `/tracking`, from the job
   card tracker panel, and from the technician workspace. Each saves, and the
   card shows the new location.
4. **Historical timeline integrity** — open the same job's timeline
   (`/api/status/getHistory`, the job-card status history). Every prior movement
   is still listed at its original timestamp, with its original actor, and the
   oldest entry still reads "Added to parking & key tracking". The manual update
   appears as one new entry on top.
5. **Realtime refresh** — with `/tracking` open in one browser, change a job's
   status in another. The list refreshes and the automatic movement is recorded
   once, attributed to whoever changed the status.
6. **Multiple users** — repeat step 5 with `/tracking` open in three browsers.
   Still exactly one key event and one vehicle event (the 30s de-duplication
   window in `hasMatchingRecentEvent` is unchanged).
7. **Rollback** — run
   `supabase/rollbacks/20260826120000_tracking_events_server_only_down.sql` by
   hand, then re-run `npm run check:tracking-rls`. **This leaves the tables
   open** — you must re-apply the up migration afterwards to get back to the
   locked-down state. Verified on 2026-08-26: the rollback restored anon's
   grants verbatim and removed the snapshot table, so reversibility works. It
   should return to the "before" output above, i.e. the recorded grants are
   restored verbatim. Then re-apply the up migration.

Steps 2–6 exercise the application only and can be run before the migration too;
they should give identical results either side of it.
