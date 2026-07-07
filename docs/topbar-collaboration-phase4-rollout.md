# Top Bar Workspace — Phase 4 Rollout (Collaborative Operational Workspace)

**Status:** Complete — 4.1–4.8 shipped.
**Scope:** Turn the role-aware top-bar workspace into a **collaborative operational
workspace** — live team presence, staff availability, shared department activity,
quick communication, escalation/priority workflows, manager collaboration tools
and cross-department coordination — **with zero change to the top bar's height,
spacing, styling, colours, borders or visual design.** Every Phase 4 surface is
overlay/keyboard-driven and mounted *outside* the bar (through the single
`WorkspaceCommandCenter` host, exactly like Phases 3), so the chrome is untouched.
**Date:** 2026-07-06
**Builds on:**
- Phase 1 — identity + live status (`docs/topbar-identity-phase1-rollout.md`).
- Phase 2 — role-aware workspace (`docs/topbar-identity-phase2-rollout.md`): the
  lean `/api/status/operational-summary` metrics + roster headcounts.
- Phase 3 — productivity system (`docs/topbar-workspace-phase3-rollout.md`): the
  command palette, workspace panel, shortcuts, personalisation and the
  `WorkspaceCommandCenter` single mount point.

This doc is updated after each sub-phase (implementation, verification, remaining
work, recommendations) per the rollout ritual.

---

## Architecture (how Phase 4 stays reusable, central & honest)

Phase 4 follows the exact seam Phases 2–3 established — **pure registry → thin
reactive hook → presentational overlay → single mount** — so nothing touches the
bar:

| Layer | Where | Rule |
|---|---|---|
| **Pure logic / registries** | `src/config/topbar/*` | No React/window/storage. Deterministic + unit-tested. |
| **Live data (lean, read-only)** | `src/lib/database/dashboard/teamPresence.js`, `src/pages/api/status/team-presence.js` | One cheap query, department scoped server-side from the caller's own roles, short private cache — mirrors `operational-summary`. |
| **Reactive hooks** | `src/hooks/*` | Merge free client roster + the lean endpoint + on-device self state; poll-light, focus-refreshed, abortable, demo-suppressed. |
| **Presentational UI** | `src/components/topbar/TeamPanel.js` | Reuses `PopupModal` (borderless) + `LayerTheme` surfaces; obeys the layer/border laws. |
| **Single mount point** | `src/components/topbar/WorkspaceCommandCenter.js` | Hosts the Team panel alongside the Phase 3 surfaces. StaffLayout mounts it **once**; the bar is untouched. |

**The honest data boundary (important).** The app has **no presence, no user-status
and no activity-feed tables** (confirmed by a full survey of the schema + helpers).
Phase 4 is therefore built truthfully on what *is* real:

- **Real live signal:** `job_clocking.clock_out IS NULL` → a colleague is
  **Working** on a job (the same signal Phase 2 uses for `techniciansOnJobs`).
- **Roster-derived:** everyone else mapped to a department (by **role**, via
  `resolveDepartmentForRoles` — never the unreliable `users.department`) is shown
  as **Available** (on the team, free to take work).
- **Self-declared:** the current user can broadcast break / road-test / training /
  maintenance / other — persisted per-user **on this device** (there is no server
  user-status store), authoritative for their own row.
- **Activity** is **derived** from movement between two consecutive snapshots
  (metrics + presence), not read from a log.

We never claim a colleague is "offline" (no attendance/last-seen source exists), so
presence is framed as **availability**, not online/offline. Every "remaining work"
note below points at the single write-point to swap for a persisted source when
product wants cross-device broadcast — no consumer changes required.

**Messaging is real.** Quick communication reuses the existing, fully DB-backed
Messages workspace (`ensureDirectThread` / `createGroupThread`) via two new
additive deep-links; no new messaging backend.

Adding a department, an escalation rule, an availability state, a coordination
link or a manager view is an edit to one registry — never the top bar.

---

## Phase 4.1 — Live team presence

**Implementation**
- Lean live signal: [src/lib/database/dashboard/teamPresence.js](../src/lib/database/dashboard/teamPresence.js)
  `getWorkingStaff()` runs one cheap query (`job_clocking` open rows, newest-first,
  one entry per user) → `[{ userId, jobNumber, workType }]`; never throws.
- Endpoint [src/pages/api/status/team-presence.js](../src/pages/api/status/team-presence.js)
  mirrors `operational-summary` — any authenticated staff user; department derived
  server-side from the caller's own roles; `Cache-Control: private, max-age=20`.
- Pure builder [src/config/topbar/teamPresence.js](../src/config/topbar/teamPresence.js):
  `toTeamMembers` shapes the roster into staff members with a role-resolved
  department (drops unmapped roles, e.g. customers); `buildTeamPresence` merges the
  roster + the live working ids + self availability into ordered per-department
  groups (`{ code, name, members, available, working, total }`), a `byId` map,
  the viewer's `self` row and cross-department `totals`. Members sort self →
  available → working → other, each alphabetical.
- Hook [src/hooks/useTeamPresence.js](../src/hooks/useTeamPresence.js) merges the
  free `RosterContext` data with the polled endpoint (poll `presencePollMs`,
  focus-refresh, in-flight abort), degrading to roster-only "available" on any
  error and suppressing entirely in the demo shell.
- Rendered as the department presence groups in the new
  [TeamPanel](../src/components/topbar/TeamPanel.js) (viewer's department first,
  then others), each row showing the availability icon, name, role and current job.

**Verified**
- `phase4.test.js` — presence: maps roster/drops unmapped roles, derives
  working-vs-available, groups + totals, self-first ordering, group summary.
- eslint clean; `check:borders` passes; presentation shell returns empty groups.

**Remaining work / recommendations**
- "Available" is roster membership, not clocked-in attendance. To make presence
  reflect *on-site* staff, swap `getWorkingStaff` to also read `time_records`
  open rows (attendance) — the builder already treats non-working as available.
- Presence is not yet realtime; it polls. The `useMessagesBadge` Supabase-channel
  pattern is the drop-in upgrade path (subscribe to `job_clocking`) with no
  consumer change.

---

## Phase 4.2 — Live staff availability

**Implementation**
- Canonical registry [src/config/topbar/availabilityStates.js](../src/config/topbar/availabilityStates.js):
  one source of truth for every operational state — **available, working, busy,
  road-test, training, maintenance (workshop maintenance), break, other** plus a
  derived-only **offline** — each with label/short/icon/tone/`available`/`working`
  flags. `resolveAvailabilityState` never returns null; `selectableStates()` powers
  the self picker (excludes offline); `availabilityFromLegacyStatus` maps the app's
  existing technician status (In Progress / Tea Break / Waiting for Job) so the two
  stay consistent.
- Hook [src/hooks/useSelfAvailability.js](../src/hooks/useSelfAvailability.js): the
  user's self-declared availability, per-user on-device (workspaceStorage),
  reactive across tabs, demo-disabled. `effectiveId` = explicit declaration →
  legacy-status mapping → null (then presence falls back to the live signal).
- In `buildTeamPresence`, a self-declared state **wins** for the current user's own
  row (so declaring "on break" shows break even while clocked in). The
  [TeamPanel](../src/components/topbar/TeamPanel.js) "You're …" block renders the
  picker (token-driven `app-btn` chips, `aria-pressed`) + a Reset.

**Verified**
- `phase4.test.js` — availability: known/unknown id resolution, legacy-status
  mapping, offline excluded from the picker; presence: self-declared beats the live
  working signal.
- eslint clean; `check:borders` passes.

**Remaining work / recommendations**
- Self-declared availability is device-local (no user-status table). This hook is
  the single write-point to swap for a persisted `PATCH /api/status/availability`
  when cross-device broadcast is wanted — `buildTeamPresence` already consumes a
  plain id per user, so colleagues' declared states would appear with no UI change.

---

## Phase 4.3 — Shared department activity

**Implementation**
- Pure delta engine [src/config/topbar/departmentActivity.js](../src/config/topbar/departmentActivity.js):
  `deriveActivityEvents(prev, next, { ts })` diffs two consecutive snapshots
  (metrics + presence) into events — **technicians becoming available, new
  appointments, jobs completed / started, approvals waiting, workload moving
  through the queue, parts booked in, deliveries received** — plus per-person
  presence transitions (someone became available / started a job / changed state).
  Timestamps are injected (kept deterministic/testable).
- Hook [src/hooks/useDepartmentActivity.js](../src/hooks/useDepartmentActivity.js)
  holds the previous snapshot and prepends new events to a capped, session-lived
  rolling feed (`WORKSPACE_LIMITS.activityFeed`). It reuses the metrics + presence
  already flowing — **no polling of its own** — and never emits on first load.
- Rendered as the "Recent team activity" block in the TeamPanel (toned rows, links
  through to the relevant workspace where one exists).

**Verified**
- `phase4.test.js` — activity: baseline-required, metric movement (job complete +
  appointment), per-person "became available" transition.
- eslint clean; `check:borders` passes.

**Remaining work / recommendations**
- The feed is derived movement, not a durable log (there is no activity table). It
  is intentionally in-memory/session-lived. `job_status_history` +
  `customer_activity_events` are the building blocks for a persisted, cross-session
  feed if product wants one — `deriveActivityEvents` output shape would be reused.

---

## Phase 4.4 — Quick communication shortcuts

**Implementation**
- Pure builders [src/config/topbar/communicationShortcuts.js](../src/config/topbar/communicationShortcuts.js):
  `messageUserHref(id)` → `/messages?to=<id>`, `messageGroupHref(ids, title)` →
  `/messages?compose=group&members=…&title=…`, plus `memberContactAction`,
  `departmentContactAction` (falls back to a DM for a team of one) and
  `audienceContactAction` (resolve a department code → its team's message action).
- New additive deep-link handling in [src/pages/messages/index.js](../src/pages/messages/index.js):
  a single once-guarded effect reads `?to=` / `?compose=group` and reuses the
  **existing** `startDirectThread` / `createThread` primitives (real
  `ensureDirectThread` / `createGroupThread`), then cleans the URL. No new
  messaging backend; the customer/job deep-link path is untouched.
- Wired everywhere contextual: every presence row and manager "free now" row has a
  💬 message action; each department group and escalation/coordination row has a
  📣 "message the team" action; the command palette gains **"Message the …
  team"** and **"Open team workspace"** actions.

**Verified**
- `phase4.test.js` — communication: direct + group href building, null-guards,
  single-member DM fallback.
- eslint clean on the builders + messages page (only pre-existing unrelated
  warnings remain in the large messages file; the new effect is clean).

**Remaining work / recommendations**
- Department messaging builds a group from the roster member ids client-side (no
  "message a department by code" server helper exists). A future
  `createDepartmentThread(deptCode)` server helper would let very large teams avoid
  shipping the id list in the URL.

---

## Phase 4.5 — Escalation & priority workflows

**Implementation**
- Pure rule engine [src/config/topbar/escalations.js](../src/config/topbar/escalations.js):
  `resolveEscalations({ metrics, roles, department })` runs a severity-ranked
  (`critical`/`high`/`medium`) rule set over the live metrics — overdue pile-ups,
  approvals blocking work, the queue backing up, **no free technicians while jobs
  wait**, parts/deliveries backlogs (role-gated) — returning deduped, ranked items
  each carrying a destination and an **audience** (the department to notify).
  Broken rules can never throw into the chrome. `topEscalation` gives the single
  most-urgent item for compact cues.
- Hook [src/hooks/useEscalations.js](../src/hooks/useEscalations.js) memoises the
  resolved list against a primitive metrics/roles key (reuses the Phase 2 snapshot,
  no new polling).
- Rendered as the "Needs attention" block at the **top** of the TeamPanel when
  present, tone-coloured by severity, each with a one-click "message the
  responsible team" action (4.4).

**Verified**
- `phase4.test.js` — escalations: severity ranking (critical overdue first),
  role-gating (parts rule silent for non-parts), empty-safe `topEscalation`.
- eslint clean; `check:borders` passes.

**Remaining work / recommendations**
- Thresholds are fixed constants; they could move into `workspaceConfig` for
  per-site tuning. Escalations are metric-derived; a true promised-time source
  (rather than the `next_update_due` proxy noted in Phase 2) would sharpen the
  overdue rules.

---

## Phase 4.6 — Manager collaboration tools

**Implementation**
- Pure builder [src/config/topbar/managerTools.js](../src/config/topbar/managerTools.js):
  `isManagerRole` (permissive management-tier gate) + `buildManagerTools` produce
  three sections from presence + metrics:
  - **Department monitoring** — one toned line per department (available vs
    working), giving cross-department visibility with a "message this team" action.
  - **Workload balancing** — reads the viewer's department queue vs free capacity
    and proposes the move ("assign N waiting to M free", "queue building, no free
    techs", "spare capacity — pull work forward", "overdue to redistribute"), then
    lists the staff actually free right now (each messageable).
  - **Staff visibility** — a floor-wide roll-up (total / available / working) plus
    the viewer's department KPI snapshot (reuses `resolveKpis`).
  Non-managers get an empty set (the panel hides the block entirely).

**Verified**
- `phase4.test.js` — manager tools: role gating, three sections, the
  "Assign 2 waiting" balancing line from metrics.
- eslint clean; `check:borders` passes.

**Remaining work / recommendations**
- Cross-department **metrics** aren't available (the endpoint is scoped to the
  viewer's own department), so monitoring uses cross-department **presence** +
  the viewer's own KPIs. A manager multi-department metrics endpoint would let
  monitoring show each department's live queue, not just its headcount.

---

## Phase 4.7 — Cross-department coordination

**Implementation**
- Pure registry [src/config/topbar/crossDepartment.js](../src/config/topbar/crossDepartment.js):
  a coordination graph (Workshop ↔ Parts ↔ Service ↔ MOT ↔ Valeting ↔ Paint ↔
  Accounts ↔ Sales/Management) plus page-contextual boosts (on a job card → "chase
  parts for this job"; in a VHC → "send for authorisation"; in parts/goods-in →
  "tell workshop parts have landed"). `resolveCoordinationLinks({ department,
  pathname })` ranks boosts above the base graph, dedupes by target department,
  excludes the viewer's own department and caps the list. Each link carries an
  `audience` so the comms layer offers "message their team".
- Rendered as the "Coordinate across departments" block in the TeamPanel (go +
  message-team on each). Adding a new department's coordination is one registry
  edit and it appears wherever others link to it.

**Verified**
- `phase4.test.js` — coordination: excludes the viewer's own department, includes
  related ones, and promotes the job-card contextual boost to the top.
- eslint clean; `check:borders` passes.

**Remaining work / recommendations**
- Sales is represented via the `management` rollup for now (no dedicated sales
  department code in the operational dimension); when a `sales` operational code
  lands it slots straight into the graph.

---

## Phase 4.8 — Responsive, accessibility, performance, reusable architecture & docs

**Responsiveness**
- Every Phase 4 surface is overlay-based and adds nothing to the bar. The Team
  panel is a full-height edge drawer at `min(100%, 460px)` / `100dvh`, so it is
  fluid to mobile; content scrolls internally. The availability picker wraps.

**Accessibility**
- The panel closes on Escape (`useEscapeKey`, matching the other overlays), uses
  `PopupModal`'s `role="dialog"`/`aria-modal`/`aria-label`; the availability chips
  are `aria-pressed` toggles; every message/close control has an `aria-label`; the
  presence icons are `aria-hidden` with text labels alongside.

**Performance**
- One extra lean poll (`presencePollMs`, focus-refreshed, aborted in-flight) reusing
  the same defensive pattern as `operational-summary`; the activity feed and manager
  tools reuse already-fetched data (no extra polling); all assembly is memoised
  against primitive keys; storage reads are SSR/quota-safe. Nothing added to the
  bar's render path.

**Centrally configurable**
- New tunables in [workspaceConfig.js](../src/config/topbar/workspaceConfig.js):
  `presencePollMs`, `presencePerDepartment`, `activityFeed`, `panelActivity`,
  `escalations`. The barrel [config/topbar/index.js](../src/config/topbar/index.js)
  re-exports every Phase 4 registry as one import surface.

**Reusable architecture**
- Every feature is a pure registry (+ a thin hook where it needs live data) + the
  single presentational `TeamPanel`, mounted once through
  `WorkspaceCommandCenter`. New collaboration behaviour = a registry edit.

**Keyboard**
- New global shortcut **⌘/Ctrl+U** ("Open team workspace") added to the central
  registry, dispatched by the single Phase 3.5 handler; it appears automatically in
  the `?` shortcut-hints overlay.

**Tests**
- New [src/config/topbar/phase4.test.js](../src/config/topbar/phase4.test.js) — 13
  tests across all seven pure modules.

**Verified (full pass)**
- `npx vitest run src/config/topbar/` — **58 tests passing** (Phase 2 + Phase 3's
  20 + Phase 4's 13, plus role precedence) — no regressions.
- `npx eslint` on all new/changed Phase 4 files — **clean** (only pre-existing,
  unrelated warnings remain in the large `messages/index.js`).
- `npm run check:borders` — **passes** (Team panel uses only the allowed
  `--separating-line` / ring tokens; all surfaces are `LayerTheme`, borderless).
- **Top bar unchanged:** no `StaffTopbar` JSX/height/style edits; `StaffLayout`
  only passes the already-computed props to the single `WorkspaceCommandCenter`,
  which now also hosts `<TeamPanel>`.

---

## Summary — what Phase 4 delivered

| Sub-phase | Feature | Entry points |
|---|---|---|
| 4.1 | Live team presence | Team panel department groups (⌘/Ctrl+U) |
| 4.2 | Staff availability | Self picker in the panel; drives your presence row |
| 4.3 | Shared department activity | "Recent team activity" feed (derived) |
| 4.4 | Quick communication | 💬/📣 on every row; palette "Message the … team"; `/messages?to=` + group deep-links |
| 4.5 | Escalation & priority | "Needs attention" block (severity-ranked) |
| 4.6 | Manager collaboration | Monitoring / balancing / visibility (manager-only) |
| 4.7 | Cross-department coordination | "Coordinate across departments" block |
| 4.8 | Responsive / a11y / perf / config / tests | ⌘/Ctrl+U shortcut, `workspaceConfig`, barrel, `phase4.test.js` |

**How to extend (all central, none touch the bar):** add an availability state in
`availabilityStates`; a presence source in `teamPresence` + the endpoint; an
activity signal in `departmentActivity`; an escalation in `escalations`; a manager
view in `managerTools`; a coordination link in `crossDepartment`; a message target
in `communicationShortcuts`; a limit in `workspaceConfig`.

**Deferred / future (all with a single documented swap-point):** persisted
presence/attendance (`time_records`) and realtime presence (the `useMessagesBadge`
channel pattern); a persisted user-availability store for cross-device broadcast; a
durable activity feed (`job_status_history` / `customer_activity_events`); a
manager multi-department metrics endpoint; a `createDepartmentThread(code)` server
helper; a dedicated `sales` operational department code.
