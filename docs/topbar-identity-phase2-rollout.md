# Top Bar Workspace — Phase 2 Rollout

**Status:** Phase 2 complete (2.1 → 2.8)
**Scope:** Turns the role-aware top bar into a live, role-aware *workspace* —
live operational status, compact KPIs, Continue-Where-You-Left-Off, configurable
quick actions, pinned shortcuts, rotating insights and adaptive notifications —
**with zero change to the bar's height, spacing, styling, colours, positioning or
visual design.**
**Date:** 2026-07-06
**Builds on:** `topbar-identity-phase1-rollout.md` (reviewed before starting).

---

## The unifying design (how it fits without changing the bar)

The bar keeps its exact three-slot layout. New capability slots into the space
that already exists:

- **Rotating status line.** The identity block's secondary line now *rotates*
  through: live department summary (2.1) → compact KPI line (2.2) → smart
  insights (2.6). One line, same type treatment, content cycles — no size change.
- **Configurable centre strip.** The centre strip now renders, in order:
  technician controls (unchanged) → a Resume chip (2.3) → role quick actions
  (2.4) → pinned shortcuts + a pin-this-page toggle (2.5). It already scrolls
  horizontally, so extra chips never resize the bar.
- **Right side unchanged.** Search, next-action and help stay put; notifications
  (2.7) are announced to assistive tech, not added as visual chrome.

**Extensibility (2.8):** every per-department behaviour lives in a small registry
under `src/config/topbar/`. Adding a department = editing config, never the bar.

---

## Architecture / files

**Data layer (real application data):**
- [src/lib/database/dashboard/topbarSummary.js](../src/lib/database/dashboard/topbarSummary.js)
  — lean `head:true` counts per department (mirrors the dashboard helpers' exact
  filters; columns verified against the schema).
- [src/pages/api/status/operational-summary.js](../src/pages/api/status/operational-summary.js)
  — thin authenticated route; department derived from the caller's own roles.
- [src/lib/topbar/rosterHeadcount.js](../src/lib/topbar/rosterHeadcount.js) —
  free client-side headcounts from the roster.
- [src/hooks/useOperationalSnapshot.js](../src/hooks/useOperationalSnapshot.js) —
  fetches + merges endpoint metrics with roster counts (throttled, focus-aware,
  abortable, desktop-only, presentation-suppressed).

**Registries (the extensibility seam):**
- [departmentStatus.js](../src/config/topbar/departmentStatus.js) — live summaries + fallbacks (2.1)
- [departmentKpis.js](../src/config/topbar/departmentKpis.js) — KPI widgets (2.2)
- [departmentInsights.js](../src/config/topbar/departmentInsights.js) — rotating insights (2.6)
- [departmentNotifications.js](../src/config/topbar/departmentNotifications.js) — prioritised notifications (2.7)
- [quickActions.js](../src/config/topbar/quickActions.js) — role quick actions (2.4)
- [statusViews.js](../src/config/topbar/statusViews.js) — composes the rotating line
- [liveDepartments.js](../src/config/topbar/liveDepartments.js) — which departments poll live data

**Persistence + hooks:**
- [src/lib/topbar/workspaceStorage.js](../src/lib/topbar/workspaceStorage.js) — SSR-safe, per-user, reactive localStorage
- [src/lib/topbar/continueContext.js](../src/lib/topbar/continueContext.js) + [useContinueContext.js](../src/hooks/useContinueContext.js) — Continue-Where-You-Left-Off (2.3)
- [usePinnedShortcuts.js](../src/hooks/usePinnedShortcuts.js) — pins (2.5)
- [useRotatingViews.js](../src/hooks/useRotatingViews.js) — rotation + reduced-motion (2.6)
- [useRoleNotifications.js](../src/hooks/useRoleNotifications.js) — notifications (2.7)

**Edited chrome:** [StaffTopbar.js](../src/components/layout/StaffTopbar.js) (presentational render), [StaffLayout.js](../src/components/layout/StaffLayout.js) (owns the hooks/props).

**Tests:** `departmentStatus.test.js`, `topbarWorkspace.test.js`, `rolePrecedence.test.js` — 36 passing.

---

## Sub-phase detail

### 2.1 — Live operational summaries
Static Phase-1 strings replaced with live summaries from the merged metrics
snapshot (e.g. "7 jobs in progress", "12 appointments booked today", "3 MOT
testers on shift"), each with a per-department static fallback. **Real data**:
`jobs` (in-progress / waiting via `checked_in_at`/`workshop_started_at`/
`completed_at`), `appointments` (today), roster headcounts. **Verified**:
registry unit tests (live vs fallback, presentation suppression, zero-guard).

### 2.2 — Compact role-specific KPIs
Per-department KPI lists (jobs waiting, in progress, appts today, techs free,
overdue, approvals, parts outstanding, deliveries, testers, valeters). Rendered
as a compact capped line ("4 waiting · 7 in progress · 2 techs free") in the
rotation — within existing dimensions. Missing metrics are dropped. **Verified**:
`resolveKpis`/`formatKpiLine` tests.

### 2.3 — Continue Where You Left Off
Records the user's resumable routes (job cards, reports, customers, parts orders,
searches) to per-user on-device storage and offers a one-click **Resume** chip
back to the most recent item that isn't the current page. Cross-tab reactive,
presentation-disabled. **Verified**: `resolveResumable`/`isSamePath` classifier
tests.

### 2.4 — Configurable quick actions
Hardcoded service/parts action links removed from the component and centralised in
`quickActions.js` (manifest wins, else capability defaults, de-duped). **All
technician controls preserved verbatim** (status dropdown, Open/No current job,
Start Job). **Verified**: `resolveQuickActions` tests + build.

### 2.5 — Pinned shortcuts
Users pin favourite pages (per-user, on-device); pins render as chips in the
strip, with a ☆/★ pin-this-page toggle. **Verified**: build + lint; storage layer
is SSR/quota-safe.

### 2.6 — Rotating smart insights
Actionable prompts (overdue, waiting-to-start, idle techs, approvals, arrivals,
parts outstanding) generated per department in priority order and rotated on the
status line. Rotation respects `prefers-reduced-motion` (static) and pauses on
hover/focus. **Verified**: `resolveInsights` tests.

### 2.7 — Adaptive role-aware notifications
A prioritised (high/medium/low), department-filtered view over the same metrics
(reusing the insight wording). High-priority items lead the rotation and are
announced via a visually-hidden `aria-live` region — **no visual chrome added**,
honouring the no-visual-change constraint. **Verified**: `resolveNotifications`
tests.

### 2.8 — Performance, a11y, consistency, cleanup, reusable architecture
- **Performance:** `head:true` counts only; 90s poll + focus refresh + in-flight
  abort; live fetch skipped for non-live departments, the presentation shell, and
  tablet/mobile; short private cache; SSR/quota-safe storage.
- **Accessibility:** identity `aria-label`, `aria-live` notifications, pin toggle
  `aria-pressed`/`aria-label`, truncation `title`s, reduced-motion rotation.
- **Consistency:** all controls reuse `app-btn` classes + tokens; no borders
  added (pin toggle uses the allowed ghost ring).
- **Cleanup:** removed hardcoded action links, deleted the superseded
  `useDepartmentStatus` hook, shared `actionGroupStyle` + `rosterHeadcount`.
- **Reusable architecture:** department-keyed registries; new departments extend
  config only.

---

## Verification (full pass)
- `npx vitest run` — **36 tests passing** (3 suites).
- `npx eslint` on all 19 new/changed files — **clean**.
- `npm run check:borders` — **passed**.
- `npx next build` — **succeeds**; the new `/api/status/operational-summary`
  route compiled.
- Verified via build + unit tests + lint (not a live browser drive).

---

## Remaining work / known limitations
1. **Customers-waiting, revenue (today/month), efficiency, overdue** — not yet
   wired: the data survey found only capped samples / weekly figures / heavy
   aggregations. `overdueJobs` uses `next_update_due` (a proxy, not a true
   promised-time). These currently rely on fallbacks or the proxy.
2. **Headcounts are rostered, not clocked-in** — "on shift" reflects roster size,
   not live presence, except `techniciansAvailable` (which uses open `job_clocking`).
3. **KPIs render as a compact line**, not individual chip widgets, to hold the
   bar's dimensions.
4. **Mobile** — the rotating status line is desktop-only (as the Phase-1 identity
   line was); identity on mobile remains the sidebar Profile name.
5. **Notifications are announced, not shown** — no bell/badge, to preserve the
   visual design.
6. **Pins/continue are device-local** (localStorage), not synced across devices.

## Recommended work for the next phase (2.2-style follow-ups)
1. Add cheap dedicated counts for customers-waiting, today/month revenue, and a
   true overdue query; extend `topbarSummary.js` — registries pick them up with
   no chrome change.
2. Switch headcounts to live clocked-in presence (`clocking.js`
   `getDepartmentSummary`).
3. If product wants visible notifications/KPI chips, design a compact badge/menu
   that fits the bar — a deliberate visual addition (out of scope here).
4. Persist pins/continue server-side for cross-device sync.
5. Optional: a subtle crossfade on the rotating line (needs a small global CSS
   keyframe — intentionally omitted here to honour the no-visual-change rule).
