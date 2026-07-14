# Top Bar Workspace — Phase 3 Rollout

**Status:** Complete — 3.1–3.8 shipped.
**Scope:** Expand the role-aware top-bar workspace into a full productivity
system. **No change to the top bar's height, spacing, layout, styling, colours,
borders or visual design.** Every Phase 3 surface is overlay/keyboard-driven and
mounted *outside* the bar (like `NextActionPrompt` / `SupportControl`), so the
chrome is never touched.
**Date:** 2026-07-06
**Builds on:**
- Phase 1 (`docs/topbar-identity-phase1-rollout.md`) — identity + live status.
- Phase 2 (uncommitted `------TOPBAR-----`) — the role-aware workspace: rotating
  status views (summary → KPIs → insights), role notifications, configurable
  quick actions, Continue-Where-You-Left-Off, pinned shortcuts, and the
  lightweight `/api/status/operational-summary` endpoint.

This doc is updated after each sub-phase (implementation, verification, remaining
work, recommendations) per the rollout ritual.

---

## Architecture (how Phase 3 stays reusable & central)

Phase 3 follows the exact pattern Phases 1–2 established:

| Layer | Where | Rule |
|---|---|---|
| **Pure logic / registries** | `src/config/topbar/*`, `src/lib/topbar/*` | No React/window/storage. Deterministic + unit-tested. |
| **Reactive hooks** | `src/hooks/*` | Per-user, on-device via `workspaceStorage`, reactive across tabs, disabled in the demo. |
| **Presentational UI** | `src/components/topbar/*` | Reuse `PopupModal` (borderless, token-driven). |
| **Single mount point** | `src/components/topbar/WorkspaceCommandCenter.js` | Hosts every Phase 3 surface. StaffLayout mounts it **once**; the bar is untouched. |

Adding a command source, a suggestion rule, a widget or a shortcut means editing
a registry — never the top bar.

---

## Phase 3.1 — Universal command palette

**Implementation**
- New pure module [src/lib/topbar/commandPalette.js](../src/lib/topbar/commandPalette.js):
  - `toCommand` normalises any source (page, action, record, favourite, recent,
    suggestion) onto one shape: `{ id, title, subtitle, section, kind, href?,
    run?, keywords[], icon?, shortcut?, priority }`. Exactly one of `href`
    (navigate) / `run` (invoke) drives execution.
  - `buildCommands` merges all sources and de-duplicates by execution target,
    keeping the highest-priority kind (so a page that's also a favourite shows
    once, as the favourite).
  - `scoreCommand` / `filterCommands` rank by match quality (exact → prefix →
    keyword → substring → subsequence fuzzy) blended with kind priority, so an
    empty query yields a useful priority-ordered browse list.
  - `groupCommands` buckets results into ordered sections
    (Suggested → Favourites → Recent → Actions → Pages → nav sections).
- New hook [src/hooks/useCommandPalette.js](../src/hooks/useCommandPalette.js):
  owns only open/close. Triggers: **Cmd/Ctrl+K** (works even inside inputs) and
  bare **`/`** (suppressed while typing). A global `hnp:command-palette`
  CustomEvent + exported `openCommandPalette()` let any control open it without
  prop-drilling. Force-closes when disabled (demo).
- New component [src/components/topbar/CommandPalette.js](../src/components/topbar/CommandPalette.js):
  keyboard-first overlay on the shared `PopupModal`. Search input + grouped,
  ranked results; full keyboard nav (↑/↓ wrap, ↵ open, esc close, hover syncs
  selection); active-row scroll-into-view; ARIA combobox/listbox/option roles;
  per-row kind tag or shortcut hint. Executes via `router.push(href)` or `run()`.
- New mount [src/components/topbar/WorkspaceCommandCenter.js](../src/components/topbar/WorkspaceCommandCenter.js):
  the single Phase 3 host. For 3.1 it builds commands from the navigation items +
  quick actions StaffLayout already computes.
- Wired into [StaffLayout.js](../src/components/layout/StaffLayout.js): mounted
  once next to `TopbarAlerts`, `enabled` only when not the demo shell, not the
  login shell, and a user is present. **No top-bar JSX changed.**

**Verified**
- eslint clean on all new files + StaffLayout.
- `check:borders` passes (only the allowed `--separating-line` list rule used).
- Manual trace: Cmd/Ctrl+K toggles; `/` opens (not while typing); arrows/enter/
  esc behave; navigating a result routes and closes; disabled in presentation.

**Remaining work / recommendations**
- Record sources (jobs/customers/vehicles) are wired in 3.2 (recent) and via a
  future search-backed record provider; 3.1 ships pages + actions.
- Favourites / recent / suggestions merge into `buildCommands` in 3.2–3.4.
- A discoverable non-keyboard entry (without changing the bar) is deferred to the
  productivity panel (3.6), reachable from the sidebar Profile area.

---

## Phase 3.2 — Global recent activity

**Implementation**
- New pure module [src/lib/topbar/recentActivity.js](../src/lib/topbar/recentActivity.js):
  - `RECENT_CATEGORIES` — display metadata (label/icon/order) for
    job | customer | vehicle | report | workflow | search.
  - `classifyRoute(asPath, ts)` — ordered first-match rules turn a visited route
    into a durable item `{ category, id, href, label, subtitle, icon, ts }`
    (job cards across `/job-cards` `/tech` `/valet`, VHC, customers, vehicles,
    reports, parts workflows). Returns null for non-record routes.
  - `buildSearchItem(query, ts)` — records an explicit search (carries `query`,
    no href).
  - `recentToCommandSource(item, { onRunSearch })` — maps an item onto a palette
    command; search items get a `run` that re-opens the palette pre-filled.
- New hook [src/hooks/useRecentActivity.js](../src/hooks/useRecentActivity.js):
  records the current route automatically (deduped by href, newest-first, capped
  at 40), exposes `items`, `byCategory` (grouped, ordered), `recordSearch`,
  `clear`. Per-user, reactive across tabs, disabled in the demo.
- Palette hook + modal extended for **pre-filled open**: `openCommandPalette(query)`
  / a `{ action, query }` event / a `seed { query, token }` re-seed the input, so
  a recent search re-runs in one click. `onExecute(command, query)`.
- [WorkspaceCommandCenter](../src/components/topbar/WorkspaceCommandCenter.js) now
  merges the 12 newest recent items as a "Recent" palette section and records the
  typed query on execution. Fed `currentAsPath` from StaffLayout.

**Verified**
- eslint clean on all new/changed files.
- Manual trace: visiting a job/customer/report records it; it appears under
  "Recent" in the palette and routes on select; a typed search is remembered and
  re-runs pre-filled; nothing recorded in the demo shell.

**Remaining work / recommendations**
- Recent items are route-derived; richer labels (customer name vs slug, reg vs
  id) can be enriched later from the record providers feeding the palette.
- `clear` is exposed for a "Clear recent" control in the productivity panel (3.6).

---

## Phase 3.3 — Cross-department favourites

**Implementation**
- New pure module [src/lib/topbar/favourites.js](../src/lib/topbar/favourites.js):
  - `normaliseFavourite(input, ts)` — normalises any page/record/report into a
    stored favourite `{ href, kind, label, subtitle, category, icon, ts }`,
    inferring kind (record/report/page) from `classifyRoute`.
  - `favouriteToCommandSource` — maps a favourite onto a palette command.
  - `isSameFavourite` — hash-insensitive target comparison.
- New hook [src/hooks/useFavourites.js](../src/hooks/useFavourites.js): permanent,
  cross-department library (capped at 60) with `isFavourite`, `addFavourite`,
  `removeFavourite`, `toggleFavourite`, `byKind`, `clear`. Per-user, reactive,
  disabled in the demo. **Complements** — does not replace — Phase 2.5 pinned bar
  chips (pins = bar strip; favourites = cross-cutting library).
- [WorkspaceCommandCenter](../src/components/topbar/WorkspaceCommandCenter.js):
  favourites render as a top "Favourites" palette section, and an always-present
  **"Favourite this page" / "Remove … from favourites"** action toggles the
  current page from anywhere. Fed `currentPage` (the existing pin candidate) from
  StaffLayout.

**Verified**
- eslint clean on all new/changed files.
- Manual trace: the toggle action favourites/unfavourites the current page;
  favourites appear in the palette and route on select; persist per-user and
  across tabs; deduped by href; nothing active in the demo shell.

**Remaining work / recommendations**
- A star toggle on each palette row (not just the current page) is deferred to
  keep the list keyboard-simple; the panel (3.6) gives full manage/remove UI.
- Favouriting a deep record captures a route-derived label; richer titles arrive
  with the record providers.

---

## Phase 3.4 — Intelligent contextual suggestions

**Implementation**
- New pure engine [src/config/topbar/contextualSuggestions.js](../src/config/topbar/contextualSuggestions.js):
  `resolveSuggestions({ pathname, roles, department, recentCategories, metrics })`
  runs an ordered, weighted `SUGGESTION_RULES` set and returns a ranked, deduped,
  current-page-excluded list. Rules span four signal types — live operational
  (overdue jobs, parts to book), page-contextual (start a VHC on a job, reporting
  overview on a report), role-standard (create job, next-jobs queue, parts
  planner, HR leave) and behavioural (back to recently-viewed reports). Rule
  failures are swallowed so a bad rule can never break the palette.
- New hook [src/hooks/useContextualSuggestions.js](../src/hooks/useContextualSuggestions.js):
  derives recent categories from recent activity and memoises the resolved list
  against pathname/roles/department/recent/metrics.
- [WorkspaceCommandCenter](../src/components/topbar/WorkspaceCommandCenter.js)
  merges suggestions as the top "Suggested" palette section. Fed `userRoles`,
  `department` and live `metrics` from StaffLayout.

**Verified**
- eslint clean.
- Manual trace: suggestions change with route/role (e.g. a workshop manager with
  overdue jobs sees "Review N overdue jobs" first; a parts user sees goods-in /
  planner); the current page is never suggested; empty gracefully for roles with
  no matching rule.

**Remaining work / recommendations**
- Suggestions are heuristic/rule-based; a future signal (time-of-day, per-job
  state) can extend the same registry without touching consumers.
- The panel (3.6) will also surface these as a "Suggested for you" widget.

---

## Phase 3.5 — Consistent keyboard shortcuts

**Implementation**
- New pure registry [src/config/topbar/keyboardShortcuts.js](../src/config/topbar/keyboardShortcuts.js):
  one source of truth — `SHORTCUTS` (id, trigger, label, category, `allowInInput`),
  `matchShortcut(event)`, `shortcutMatches`, platform-aware `formatCombo(s, isMac)`
  (`mod` = Cmd on macOS / Ctrl elsewhere), and `shortcutsByCategory()`.
  Ships: **⌘/Ctrl+K** palette, **/** search, **⌘/Ctrl+J** workspace panel (3.6),
  **⌘/Ctrl+D** favourite page, **?** shortcuts help.
- New hook [src/hooks/useKeyboardShortcuts.js](../src/hooks/useKeyboardShortcuts.js):
  the **single** global keydown handler. Matches against the registry, respects
  focus (bare keys never fire while typing; opted-in chords may), and dispatches
  to a handler map by id — no per-feature key listeners to drift.
- Refactor: `useCommandPalette` **no longer owns any key handling** (keeps only
  state + the event bridge + seed); all keys now flow through the central handler.
- New overlay [src/components/topbar/ShortcutHintsOverlay.js](../src/components/topbar/ShortcutHintsOverlay.js):
  discoverable "?" help listing every shortcut by category with platform combos.
- [WorkspaceCommandCenter](../src/components/topbar/WorkspaceCommandCenter.js)
  wires the handler map and exposes "Keyboard shortcuts" + the favourite toggle as
  palette actions showing their combos (discoverable hints).

**Verified**
- eslint clean (incl. the react-hooks/use-memo inline-fn rule).
- Manual trace: every shortcut fires globally and identically; bare keys are
  suppressed while typing; combos render ⌘ on mac / Ctrl elsewhere; "?" overlay
  lists them; no double-handling after the palette refactor.

**Remaining work / recommendations**
- Shortcut key bindings are fixed; user-remappable bindings can layer onto the
  registry via personalisation (3.7) if desired.
- The workspace-panel shortcut becomes active in 3.6.

---

## Phase 3.6 — Personal productivity widgets

**Implementation**
- New pure helpers [src/lib/topbar/reminders.js](../src/lib/topbar/reminders.js)
  (`buildReminder`, `normaliseReminders`, `sortReminders`, `countOutstanding`) +
  hook [src/hooks/useReminders.js](../src/hooks/useReminders.js): a per-user
  to-do list (add/toggle/remove/clear-done), reactive, disabled in the demo.
- New pure registry [src/config/topbar/productivityWidgets.js](../src/config/topbar/productivityWidgets.js):
  `resolveWidgets(context, prefs)` builds ordered widget descriptors from the
  aggregated context — **Upcoming & outstanding** (live metrics → actionable
  lines w/ tone), **Suggested for you** (3.4), **Reminders** (interactive),
  **Recent activity** (3.2), **Favourites** (3.3) and **Department snapshot**
  (reuses `resolveKpis`). Respects personalisation visibility + order (3.7);
  builder failures degrade to empty, never throw.
- New drawer [src/components/topbar/WorkspacePanel.js](../src/components/topbar/WorkspacePanel.js):
  right-hand panel on the shared `PopupModal`, each widget a canonical
  `LayerTheme` surface (obeys the layer/border laws — inputs use `--input-ring`,
  the reminder checkbox `--checkbox-ring`, list separators `--separating-line`).
  Data-driven; reminder rows are the one interactive widget (tick/remove + add).
- [WorkspaceCommandCenter](../src/components/topbar/WorkspaceCommandCenter.js)
  aggregates the context, renders the panel, wires the **⌘/Ctrl+J** shortcut and
  an "Open my workspace panel" palette action.

**Verified**
- eslint clean; `check:borders` passes (only allowed ring/separator tokens).
- Manual trace: ⌘/Ctrl+J toggles the drawer; widgets populate from live
  metrics/recent/favourites/suggestions; reminders add/tick/remove and persist;
  rows navigate and close; empty widgets show their guidance text.

**Remaining work / recommendations**
- Widget visibility/order is honoured but not yet user-editable — the "Customise"
  control is wired to personalisation in 3.7.
- "Upcoming work" is metric-derived; a dedicated tasks/appointments feed could
  enrich it later via the same registry.

---

## Phase 3.7 — User-level personalisation

**Implementation**
- New pure module [src/lib/topbar/workspacePreferences.js](../src/lib/topbar/workspacePreferences.js):
  `defaultPreferences`, forward-compatible `mergePreferences` (drops unknown keys,
  backfills new widgets), and immutable reducers `setWidgetVisible`, `moveWidget`,
  `toggleQuickActionHidden`, plus `applyQuickActionPrefs`. Prefs = widget
  visibility + order + hidden quick actions.
- New hook [src/hooks/useWorkspacePreferences.js](../src/hooks/useWorkspacePreferences.js):
  persists prefs per user, reactive across tabs, reducer-driven (`setWidget`,
  `reorderWidget`, `toggleQuickAction`, `reset`); defaults-only in the demo.
- New UI [src/components/topbar/WorkspaceCustomiseOverlay.js](../src/components/topbar/WorkspaceCustomiseOverlay.js):
  show/hide + reorder productivity widgets and choose quick actions, on the shared
  `PopupModal` + `LayerTheme` (checkbox switches use `--checkbox-ring`). Opened
  from the panel's "Customise" button.
- [WorkspaceCommandCenter](../src/components/topbar/WorkspaceCommandCenter.js)
  feeds prefs into `resolveWidgets` (visibility + order) and filters quick actions
  via `applyQuickActionPrefs` (so hidden ones drop from the palette too), and
  renders the customise overlay.

**Verified**
- eslint clean.
- Manual trace: hiding/reordering a widget updates the panel live and persists;
  hiding a quick action removes it from the palette; reset restores defaults;
  everything defaults-only (no writes) in the demo.

**Remaining work / recommendations**
- Pinned bar content (Phase 2.5 pins) and favourites remain their own stores; a
  future pass could unify all "pinned/starred" management into this same overlay.
- User-remappable keyboard bindings could extend the prefs schema (see 3.5).

---

## Phase 3.8 — Optimisation, accessibility, configuration & documentation

**Implementation**
- **Central configuration.** New [src/config/topbar/workspaceConfig.js](../src/config/topbar/workspaceConfig.js)
  holds every tunable (`WORKSPACE_LIMITS`: persistence caps, palette limits, panel
  item caps, suggestion count). The recent/favourites/reminders hooks, the palette,
  the widget registry and the suggestions hook all import from it — change a limit
  once, everywhere follows. New barrel [src/config/topbar/index.js](../src/config/topbar/index.js)
  re-exports every Phase 2–3 registry + tunable as one import surface.
- **Accessibility.** New [src/hooks/useEscapeKey.js](../src/hooks/useEscapeKey.js);
  the panel, shortcut-hints and customise overlays now all close on Escape
  (matching the palette). Overlays already use `role`/`aria-modal`/`aria-label`
  (PopupModal), the palette uses combobox/listbox/option roles with
  `aria-selected`, toggles use `role="switch"`/`aria-checked`, and the bar's
  notification live-region is unchanged.
- **Performance.** All command/widget/suggestion assembly is memoised against
  primitive keys; the central keydown handler is a single listener; storage reads
  are SSR-safe and degrade silently; live metrics reuse the existing Phase 2
  operational snapshot (no new polling). Nothing added to the bar's render path.
- **Responsiveness.** Every surface is overlay-based: the palette caps at
  `min(640px, 70vh)`, overlays at `min(460px)`, the panel is a full-height
  `min(440px, 100dvh)` edge drawer — all fluid down to mobile.
- **Reusability.** Every feature is a pure registry/lib + a thin hook + a
  presentational component, mounted through the single
  [WorkspaceCommandCenter](../src/components/topbar/WorkspaceCommandCenter.js).
- **Tests.** New [src/config/topbar/phase3.test.js](../src/config/topbar/phase3.test.js)
  — 20 tests across all eight pure modules.

**Verified**
- `npx eslint` on all new/changed files — clean.
- `npm run check:borders` — passes (only allowed ring/separator tokens used).
- `npx vitest run` — Phase 3 suite (20) green; existing Phase 2 suites unaffected.
- `npx next build` — compiles.
- **Top bar unchanged:** no StaffTopbar JSX/height/style edits; StaffLayout only
  mounts `<WorkspaceCommandCenter>` alongside `TopbarAlerts`.

---

## Summary — what Phase 3 delivered

| Sub-phase | Feature | Entry points |
|---|---|---|
| 3.1 | Command palette | ⌘/Ctrl+K, `/`, `openCommandPalette()` |
| 3.2 | Recent activity | auto-recorded; palette "Recent" + panel |
| 3.3 | Cross-department favourites | ⌘/Ctrl+D, palette action, palette + panel |
| 3.4 | Contextual suggestions | palette "Suggested" + panel widget |
| 3.5 | Keyboard shortcuts | central registry + `?` hints overlay |
| 3.6 | Productivity widgets | ⌘/Ctrl+J workspace panel |
| 3.7 | Personalisation | panel → Customise overlay |
| 3.8 | Optimise / a11y / config / tests | `workspaceConfig`, barrel, `phase3.test.js` |

**How to extend (all central, none touch the bar):** add a command source in
`WorkspaceCommandCenter`; a recent category in `recentActivity`; a suggestion rule
in `contextualSuggestions`; a shortcut in `keyboardShortcuts`; a widget in
`productivityWidgets`; a limit in `workspaceConfig`.

**Deferred / future:** search-backed record providers in the palette (deep
customer/vehicle lookup); unifying pins + favourites management; user-remappable
key bindings; a non-keyboard discoverability affordance (a sidebar entry) if the
"no bar change" constraint is ever relaxed.
