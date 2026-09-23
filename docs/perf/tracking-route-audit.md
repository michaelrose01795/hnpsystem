# /tracking — performance pass and automatic-movement ownership

Follows the method established in [tech-route-second-pass.md](./tech-route-second-pass.md):
attribute weight at **module** level (chunk grouping moves between builds and is
not a cost breakdown), and only keep changes with a measured effect.

Two separate problems live on this route. The bundle work is ordinary. The
automatic movement workflow is an architectural fault, and it is the more
important of the two.

---

## 1. Automatic movement was owned by the wrong process

### What it was

`src/pages/tracking/index.js` opened a Supabase Realtime subscription on **every
`UPDATE` to `public.jobs`**, unfiltered. On each event it compared the new status
against a local rule table and, on a match, POSTed the movement itself:

```js
performedBy: dbUserId || null   // ← the *viewer's* id, not the actor's
```

Three consequences, in increasing order of severity:

| | |
|---|---|
| **Duplicates** | The subscription runs in every browser with the page open, so one status change wrote one key event and one vehicle event *per viewer*. Already contained by a server-side de-duplication window (below), but the burst still went out over the network. |
| **Wrong attribution** | `performed_by` / `created_by` recorded whoever happened to have /tracking open. The tracking timeline credited movements to a member of staff who did nothing. |
| **Missing movements** | If nobody had /tracking open — out of hours, or simply because everyone was on another page — the movement **never happened at all**. This is the one that silently corrupts the record. |

The de-duplication added previously (`hasMatchingRecentEvent`, 30s window, keyed
on job + vehicle status + key action) contained the duplicate symptom. It did
not, and could not, address attribution or the missing-movement case: it is a
filter on writes that arrive, not a source of writes that never happen.

### A finding worth stating separately: two of the three rules are dead

`AUTO_MOVEMENT_RULES` is keyed on the lower-cased `jobs.status`:

```
"workshop in progress"  →  never matches any status the app writes
"wash"                  →  never matches any status the app writes
"complete"              →  matches (jobStatusService.autoSetCompleteStatus)
```

The canonical main statuses are **Booked, Checked In, In Progress, Invoiced,
Released, Cancelled** (`src/lib/status/catalog/job.js`). `being_washed` is a
legacy sub-status id, and `autoSetBeingWashedStatus` does not change the main
status at all — it only stamps `wash_started_at`.

So in practice the entire automatic movement workflow amounts to *one* rule,
firing only when a job goes Complete, and only when somebody has /tracking open.

**The rule table has been preserved byte-for-byte.** Widening the keys to match
`"In Progress"` would start creating movements that do not happen today — a
workflow change, not a correctness fix. It belongs in a deliberate decision with
the workshop, not in a performance pass.

### What it is now

Movement is recorded by **the action that changes the status**.

```
                          ┌─ /api/status/update  ────────────┐
 status change ───────────┤                                  ├──► recordAutomaticMovementForStatus()
                          └─ lib/database/jobs.js updateJob ──┘         │
                                    │ (browser)                         │  server, service role
                                    └──► POST /api/tracking/next-action ┘
                                          actor resolved from SESSION
```

New module `src/lib/tracking/autoMovement.js` holds the rule table — framework
free, shared by client and server, so there is exactly one copy.

New helper `recordAutomaticMovementForStatus()` in `src/lib/database/tracking.js`
resolves the rule, looks the job up, and writes through the existing
`logNextActionEvents`. It never throws and every call site is fire-and-forget: a
tracking event must not be able to fail a status change.

Two chokepoints call it:

* **`updateJob`** (`src/lib/database/jobs.js`) — every `jobStatusService`
  transition funnels through here, including `autoSetCompleteStatus`, the only
  rule that currently fires. On the server it calls the helper directly; in the
  browser it POSTs to `/api/tracking/next-action`.
* **`/api/status/update`** — writes `jobs.status` directly rather than through
  `updateJob`, so it needs its own call or transitions made there would produce
  no movement now that /tracking no longer writes one.

`/api/tracking/next-action` now resolves the actor for `job_status_change` from
the **session** (`resolveSessionUserId`) and ignores any `performedBy` in the
body. A client can no longer decide who a movement is attributed to. It also
resolves the rule and the job server-side — the browser only says "this job's
status became X".

Both branches in `updateJob` are lazy: the rule is checked first, so a status
with no rule costs nothing — no import, no request. The server branch uses
`await import()` so `lib/database/tracking.js` does not enter the eager client
graph of every page that imports `jobs.js`.

### What /tracking does now

It stays a *viewer*. The subscription is unchanged and still gated on the same
rule table, so the refresh cadence the page has today is identical — only the
write has moved away. The callback now does no network work of its own.

### Deliberately kept

* **Server-side de-duplication stays on**, as instructed, as a safety layer while
  both paths can theoretically fire (a stale client; a status routed through two
  chokepoints). It is scoped to `job_status_change` only.
* **Manual actions are untouched.** The `location_update` path on /tracking still
  attributes to `dbUserId` — that is a real user action by the person on the
  page, and it is correct.
* Tracking history, realtime updates, role access, map behaviour and
  auditability are unchanged.

### Two things found but not changed

Both are real and both are out of scope for this pass:

1. **`updateTrackingLocations` destroys history.** It runs
   `.update(payload).eq("job_id", jobId)` with no row filter, so a manual
   location update rewrites the `action`, `notes`, `performed_by` and
   `occurred_at` of **every historical event for that job**, not just the latest.
   These are append-only event tables — this should be an insert. Fixing it
   changes what the timeline shows, so it needs its own review.

2. **`status_updated_by` is a text column carrying sentinels** such as
   `"SYSTEM_CLOCKING"` alongside real ids, while `performed_by` / `created_by`
   are integer FKs to `public.users`. The helper guards this with
   `toUserIdOrNull` (a digit-free sentinel becomes `NULL`, not `0` — the
   existing `toNullableInteger` would have produced `0` and broken the FK).

3. **The tracking event tables are open to the anon key.** They are not in the
   `server_only_tables` list in
   `20260814150000_harden_supabase_rls_and_function_permissions.sql`. Routing the
   read through the API (below) removes the last browser dependency on that
   access, so they can now be locked down in a follow-up migration.

---

## 2. Route weight

### Measured baseline

Eager (static-import-only) module graph for `/tracking`:

```
193 modules / 1283.8 kB of source

Tracking-only (present on /tracking, absent from _app + Layout):
    47 modules / 351.7 kB

    116.5 kB  src/pages/tracking/index.js
     78.4 kB  src/components/LoanCars/LoanCarSchedulePanel.js
     33.2 kB  src/lib/database/tracking.js
     17.0 kB  src/components/ui/calendarAPI/Calendar.js
     13.1 kB  src/features/tracking/map/TrackingMap.js
     11.8 kB  src/components/page-ui/tracking/tracking-ui.js
      8.3 kB  src/components/ui/monthPickerAPI/MonthPicker.js
      ... 40 more
```

### What was deferred

**`LoanCarSchedulePanel`** (78.4 kB, plus `FuelGauge` and the calendar family it
pulls in) mounts only when the Loan Cars tab is selected — and that tab only
exists for workshop controllers. Every other role downloaded it and could never
reach it.

**`TrackingMapModal`** → `TrackingMap` → `trackingMapLayout` (18.2 kB) mounts
only while the map overlay is open; `tracking-ui.js` already renders it behind
`{trackingMapOpen && …}`.

Both are `next/dynamic` and warmed on idle via the existing `useIdleWarm`, so the
first press finds the chunk in cache rather than waiting on a request. Same DOM,
same effects. The loan-car warm is folded into the workshop-controller idle
effect rather than `useIdleWarm`, because that hook runs once per mount and
`isWorkshopManager` is still false on the first render while `UserContext`
resolves.

### The data read moved to the API

`loadEntries()` called `fetchTrackingSnapshot()` **directly in the browser** —
two deeply-joined Supabase queries under the public anon key. That:

* put the whole of `lib/database/tracking.js` (loan-car helpers included) in the
  route's first-load bundle;
* made the route's data load **invisible to the Server-Timing / `hnpPerf`
  instrumentation every other hot route reports through** — there was no request
  to attribute; and
* required the tracking tables to stay readable by anon.

`/api/tracking/snapshot` already existed, is role-guarded, runs the identical
query under the service role and returns the identical shape. It was simply
unused. The page now calls it, and the endpoint carries `createServerTimer()` so
`db` (the two event queries plus their job/customer/vehicle joins) and `app` (the
merge into display entries) are separable. `/api/tracking/next-action` is
instrumented the same way.

Presentation mode is unaffected: `/api/tracking/snapshot` already has an entry in
`apiRouteTable.js`, and the tracker list rendered empty under the stub client
before this change too (`activeEntries` filters on `entry.jobId`, and the demo
rows have none).

### Background work removed from the cold load

Equipment and oil/stock were both fetched **during mount** for every workshop
controller — two API round trips racing the tracking snapshot, for data the
landing tab never shows.

They are deferred to idle rather than to tab activation. Loading on activation
would be cheaper, but neither tab has a loading state, so the first switch would
flash *"Equipment service list is empty."* — a visible change. Idle warming keeps
the data present the moment anyone switches while leaving the cold load to the
snapshot alone.

### Result

Isolated build (same tree, only this changeset reverted for the baseline, so the
concurrent unrelated edits in the working tree cancel out):

```
 ΔfirstLoad    Δroute       before        after   route
   -74.4 kB   -73.5 kB    1447.8 kB    1373.4 kB   /tracking
    -0.9 kB     0.0 kB          …            …     every other route
```

**−74.4 kB first-load JS on /tracking (−5.1%)**, and −0.9 kB on every route that
imports `jobs.js`, from splitting the tracking helper out of its graph.

That pair was captured before a final tweak routing the new `updateJob` POST
through `buildApiUrl`; the shipped tree reads **1375.4 kB**, so call it ≈ −72 kB.
Absolute first-load figures are not comparable to builds taken on a different
tree — the shared-chunk bucket moves — which is why the baseline above was
re-measured by reverting only this changeset rather than reusing an earlier run.

Eager module graph: **193 modules / 1283.8 kB → 186 modules / 1145.5 kB** —
138.3 kB of source off the route's eager import graph.

---

## 3. Measured and rejected

Recorded so the next pass does not re-investigate them.

**Repeated tracker calculations.** `getTrackerLocationFlags()` runs roughly eight
to ten times per entry per derivation: once in the `activeEntries` sort
comparator (so `O(n log n)`), twice in `filteredActiveEntries` (once directly,
once via `getTrackerGroup`), four times in `trackerSummaryItems`, and again in
`groupedTrackerEntries`. It looks wasteful and it is — but every one of those
sits inside a `useMemo` keyed on `entries`, so it runs on refetch, not on render,
and `fetchTrackingSnapshot` caps the list at 50 events. That is a few thousand
cheap string operations per refetch: **sub-millisecond, not measurable.** A
`WeakMap` cache would also freeze the time-dependent `isOverdue` flag between
fetches, which is a behaviour change for no gain. Left alone.

**`trackingMap.css` is imported globally from `_app.js`** (7.6 kB), so every
route in the app carries the site-map stylesheet for a modal on one route. Real,
and worth ~7.6 kB off all 60-odd routes' CSS — but the Pages Router requires
plain-CSS imports to live in `_app`, so removing it means converting the map to a
CSS Module and rewriting its class names. That is a visual-risk change on a
diagram with many positioned elements and belongs in its own pass with a visual
review. `_app.js` already carries a comment saying as much.

**Indexes on the tracking event tables.** `fetchTrackingSnapshot` orders 50 rows
by `occurred_at DESC`, and `hasMatchingRecentEvent` filters on
`job_id + status/action + occurred_at`. Whether indexes exist could not be
verified from the repo — `schemaReference.sql` is a table-only dump with no
`CREATE INDEX` statements at all. Worth checking against the live database before
the next pass; `Server-Timing: db` on `/api/tracking/snapshot` now makes the cost
visible either way.

---

## 4. What to measure next

The route is now instrumented, which it was not before. On a real load:

```
hnpPerf()               network / html / js / hydrate / shell / data, plus
                        api.tracking.snapshot split into db vs app
hnpPerf.interactions()  long tasks and INP, for the tracker list render
```

`db` on `/api/tracking/snapshot` is the number the index question above turns on.
