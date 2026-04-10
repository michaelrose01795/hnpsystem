# `src/api/` — DEPRECATED PHANTOM TREE

**Do not add new files here. Do not import from `@/api/...`.**

This directory is **not** served by Next.js. The Next.js Pages Router only
serves API routes from `src/pages/api/`. Files in this folder are leftover
duplicates from an earlier attempt at organising server code by domain — they
were never wired into the runtime, and a full grep on 2026-04-10 confirms
zero importers (`@/api/clocking`, `@/api/jobcards`, `@/api/customers`,
`@/api/vehicles` all return no matches outside this folder itself).

Several of the files here have a misleading `// File location: src/pages/api/...`
header. That header is wrong — the live equivalents live under `src/pages/api/`
and are listed in the table below.

## Live equivalents

| Phantom file (here)                  | Live route                                       | Live source                                                                 |
|--------------------------------------|--------------------------------------------------|------------------------------------------------------------------------------|
| `clocking/clockIn.js`                | `POST /api/profile/clock` (action=clock-in)      | `src/pages/api/profile/clock.js`                                             |
| `clocking/clockOut.js`               | `POST /api/profile/clock` (action=clock-out)     | `src/pages/api/profile/clock.js`                                             |
| `clocking/getClocking.js`            | `GET  /api/profile/clock`                        | `src/pages/api/profile/clock.js`                                             |
| `jobcards/index.js`                  | (list) folded into per-route handlers            | `src/pages/api/jobcards/create.js`, `src/pages/api/jobcards/[jobNumber]/index.js` |
| `jobcards/[jobNumber].js`            | `GET/PATCH /api/jobcards/[jobNumber]`            | `src/pages/api/jobcards/[jobNumber]/index.js`                                |
| `customers/[customerId].js`          | (no direct equivalent — use lib/database)        | `src/lib/database/customers.js`                                              |
| `customers/by-vehicle.js`            | (no direct equivalent — use lib/database)        | `src/lib/database/customers.js`                                              |
| `vehicles/[reg].js`                  | (no direct equivalent — see DVLA route)          | `src/pages/api/vehicles/dvla.js`                                             |
| `vehicles/lookup.js`                 | `POST /api/vehicles/dvla`                        | `src/pages/api/vehicles/dvla.js`                                             |
| `vehicles/maintenance-history.js`    | (no direct equivalent — use lib/database/jobs)   | `src/lib/database/jobs.js`                                                   |
| `vehicles/manufacturing.js`          | (no direct equivalent)                           | n/a                                                                          |

## Why these files are still on disk

They are kept rather than deleted to:

1. preserve git history at the original paths in case anyone goes looking,
2. avoid any tiny chance of breaking a dynamic `require()` we missed in grep,
3. let the removal happen as a single deletion PR after one production release
   confirms no inbound traffic to the (non-existent) routes they describe.

## Removal plan

1. Land this README so future devs cannot mistake the directory for live code.
2. After one release window with no `@/api/` references appearing in logs or
   bundle analysis, delete the entire `src/api/` directory in a follow-up PR.
3. Update `MEMORY.md` and any structure dumps (`src-structure.txt`,
   `project-structure.txt`) at the same time.
