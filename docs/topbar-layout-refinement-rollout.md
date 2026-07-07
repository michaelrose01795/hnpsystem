# Top Bar — Layout Refinement Rollout

**Status:** Complete.
**Scope:** Simplify the role-aware top bar. Remove the sections that added noise or
duplicated capability found elsewhere, reorder the survivors into a clearer
left-to-right reading order, and rebalance the width so the bar feels intentional
and uncluttered — **with no change to the bar's height, shell, styling, spacing,
colours, tokens or borders.**
**Date:** 2026-07-07
**Builds on:**
- Phase 1 (`docs/topbar-identity-phase1-rollout.md`) — identity + live status.
- Phase 2 (`docs/topbar-identity-phase2-rollout.md`) — the role-aware workspace:
  rotating status views (summary → KPIs → insights), role notifications,
  configurable quick actions, Continue-Where-You-Left-Off, pinned shortcuts.
- Phase 3–5 (`topbar-workspace-phase3`, `topbar-collaboration-phase4`,
  `topbar-assistant-phase5`) — the overlay/keyboard productivity, collaboration
  and assistant surfaces, which live *outside* the bar and are untouched here.

---

## New top bar structure

The bar keeps its exact shell (`--surface`, `--radius-md`, `75px` min-height,
`0 16px` padding, borderless) and its `app-topbar-*` class system. What changed is
the **content and its ordering**. Left → right, the desktop bar now reads:

| # | Section | Source | Data |
|---|---|---|---|
| 1 | **Live KPI Widgets** | `resolveKpis` → `buildTopbarSections().kpis` | Real metrics (jobs waiting / in progress / techs free / overdue / appts / approvals / parts / deliveries), per department. Each is a stacked count widget (label over count). |
| 2 | **Technician workflow controls** | Owned by the bar | **Tech role only.** Status dropdown, Open/No current job, Start Job — preserved verbatim. The former role-specific quick-action *links* were removed from the bar (see below). |
| 3 | **Smart Insight** | `resolveInsights` → `buildTopbarSections().insights` | Rotating actionable prompts (overdue, waiting-to-start, idle techs, approvals, arrivals, parts), rendered in the same stacked count widget. Pauses on hover/focus; respects reduced-motion. |
| 4 | **Continue Where You Left Off** | `useContinueContext` | The most recent resumable route that isn't the current page. |
| 5 | **Global Search & Help** | `GlobalSearch`, `NextActionPrompt`, `SupportControl` | Unchanged; pinned to the far right. `Create User` for admin managers. |

**Stacked count widgets (statuscount style).** The KPI line previously rendered as
one horizontal `value label · value label · …` run that overflowed and clipped
("57 waiting 87 in progress 0 techs fr…"). Live KPIs and Smart Insight now share a
`StatWidget` — **label on the top line, count underneath** — in two short lines of
`0.6rem`/`1.05rem` type. Stacking keeps each item narrow (so all fit) and reads
cleanly, all **within the unchanged `75px` bar height**. Smart Insight strings
(e.g. "225 VHCs awaiting approval") are split into a leading count + label so they
use the same widget.

**Quick-action links removed from the bar.** The role-specific quick-action links
(service: *Create Job Card*, *Appointments*; parts: *Delivery/Collection Planner*,
*Create Order*, *Goods In*; and any manifest-supplied links) no longer render in
the top bar for any role — they duplicated primary navigation and crowded the bar.
They remain fully reachable via the **command palette** (`WorkspaceCommandCenter`
still receives `topbarQuickActions`), so no capability was lost. The **technician
controls are untouched** — the tech role's bar is exactly as it was.

**Width balance.** The bar is now a single flex row. The two informational
sections — **Live KPIs** and **Smart Insight** — carry `flex: 1 1 0` so they
expand naturally into the space freed by the removed sections, on either side of
the centre-weighted Quick Actions. **Continue** takes `flex: 0 1 auto` (grows a
little, truncates before it crowds), and **Search & Help** is `flex: 0 0 auto`,
`margin-left: auto` so it always sits hard-right. The result reads as a deliberate
left-info / centre-actions / right-tools rhythm rather than a crowded strip.

**Responsive.** Live KPIs, Smart Insight and Search are desktop-only (exactly as
the identity line and search were before — identity/search on tablet & mobile are
surfaced via the sidebar Profile and the below-tabs search). Quick Actions and
Continue remain on tablet, spanning the full row (`flex: 1 1 100%`) and wrapping;
the action strip keeps its horizontal scroll on a vertical phone. Technician
controls are present at every breakpoint.

---

## What was removed, and why

| Removed | Was | Why it went |
|---|---|---|
| **Role & Department** | The identity block: the `primaryRoleLabel` heading + the live department status/summary line. | The user already knows their role; the sidebar Profile carries identity, and the summary largely duplicated the KPI/insight content. Removing it frees the left third of the bar for the Live KPIs the summary was competing with. |
| **Pinned Shortcuts** | A chip strip of user-pinned pages + a ☆/★ pin-this-page toggle. | Overlapped with the command palette's favourites (`useFavourites`) and the quick-actions strip. Two "your links" mechanisms in one bar was clutter; favourites in the palette remain the single home for personalised links. |
| **Notifications** | A visually-hidden `aria-live` region announcing role notifications. | Notifications are already handled by the Messages system elsewhere in the app; a second, bar-local notification channel was redundant. (Nothing visual was ever shown, so nothing visible was lost.) |

---

## What changed (files)

**Config / reusable helpers**
- [statusViews.js](../src/config/topbar/statusViews.js) — added
  `buildTopbarSections(department, metrics, opts)`. Phase 2 folded summary + KPIs +
  insights into one rotating line (`buildStatusViews`, still exported and used by
  tests); the refined bar needs KPIs and insights as **separate** sections, so this
  returns `{ kpis, insights }`. Pure + presentation-safe (demo shell gets neither).
- [config/topbar/index.js](../src/config/topbar/index.js) — barrel now exports
  `buildTopbarSections` alongside `buildStatusViews`.

**Chrome (owner of state / props)**
- [StaffLayout.js](../src/components/layout/StaffLayout.js) — computes
  `topbarSections` (via `buildTopbarSections`) and passes `kpis` + `insightViews`.
  Dropped the now-unused `primaryRoleLabel`, `useRoleNotifications` and
  `usePinnedShortcuts` plumbing and their imports. No longer passes `quickActions`
  to the bar, but **keeps** computing `topbarQuickActions` (the command centre still
  uses it) and `currentPinItem` (feeds the command centre's "favourite this page").

**Chrome (presentational render)**
- [StaffTopbar.js](../src/components/layout/StaffTopbar.js) — restructured from the
  old three-slot grid (identity | actions | search) into the five-section flex row
  above. Removed the identity block, the pinned-shortcuts group + pin toggle, the
  SR-only notification region and the role-specific quick-action links (with their
  now-unused `quickActions` prop, `isActionHref` helper and `useRouter` import).
  Added a shared `StatWidget` (stacked label-over-count) used by the Live KPI row
  and the Smart Insight section, plus `splitCountLabel` to parse insight strings.
  Technician controls copied across verbatim. Reuses the same tokens
  (`colors.accent`, `colors.mutedText`), `app-btn`/`app-topbar-*` classes and the
  existing muted-uppercase type treatment — no new CSS, no borders.

**Tests**
- [topbarWorkspace.test.js](../src/config/topbar/topbarWorkspace.test.js) — added a
  `buildTopbarSections` suite (separate KPI/insight sections, per-section caps,
  presentation suppression).

---

## Verification

- `npx vitest run src/config/topbar/topbarWorkspace.test.js` — **20 tests passing**
  (incl. the 3 new `buildTopbarSections` cases; the retained `buildStatusViews`
  suite is unaffected).
- `npx eslint` on the four changed source files — **clean** (no unused
  imports/vars after removing the role-label / notifications / pins plumbing).
- `npm run check:borders` — **passed** (no borders introduced; KPI/insight widgets
  are text-only, using existing tokens).
- Verified via unit tests + lint + border check + static review of the single
  `StaffTopbar` call site (only `StaffLayout` renders it). **Not** a live browser
  drive — see recommendations.

---

## Recommendations for future refinement

1. **Live-drive the responsive bar.** Confirm in a real browser at 1280px+, the
   768–1279px tablet band and < 768px that the flex balance holds with a long KPI
   set + a long resume label + many quick actions, and that nothing overflows the
   `75px` bar. The math and truncation are in place; a visual pass would confirm.
2. **Richer KPI widgets.** KPIs/insights now render as stacked label-over-count
   `StatWidget`s. If product wants sparklines/deltas/colour on threshold, feed the
   Phase 5 trend ring (`useOperationalTrends`) into `StatWidget` — the data is
   already in hand.
3. **Insight ↔ KPI de-dupe.** A KPI ("3 overdue") and an insight ("3 jobs overdue
   — needs chasing") can restate the same metric side by side. Consider suppressing
   an insight whose headline metric is already shown as a KPI.
4. **Empty-state polish.** For departments with no KPIs/insights (or while metrics
   load) the bar is just Quick Actions + Continue + Search. That's clean, but a
   subtle skeleton for the KPI slot could reduce the on-load reflow.
5. **Retire the now-unused hooks.** `useRoleNotifications` and `usePinnedShortcuts`
   are no longer referenced by the bar. If no other surface adopts them, delete the
   hooks (and `departmentNotifications.js`) in a follow-up cleanup.
