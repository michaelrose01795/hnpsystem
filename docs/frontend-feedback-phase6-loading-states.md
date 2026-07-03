# Phase 6 — Loading-State Standardisation (Shared Primitives + Button-Busy) (Progress)

**Part of** the [Frontend Feedback & Error System rollout](frontend-feedback-system-rollout.md) · follows [Phase 5 API/DB choke point](frontend-feedback-phase5-api-db-choke-point.md).
**Goal (from rollout §Phase 6):** no blank/frozen screens and no double-submits — confirm ONE shared loading primitive (skeleton + inline spinner) and add a reusable **button-busy** pattern (disable + spinner during async), then replace ad-hoc `Loading…` text on high-traffic screens. **Exit:** key fetches show loading feedback; async buttons can't double-fire.
**Status:** ✅ Implemented (primitive + button-busy pattern shipped; high-impact ad-hoc loading text migrated; broad feature adoption deliberately deferred to Phase 10).
**Last updated:** 2026-07-03.

---

## 1. What Phase 6 added

### 1.1 Reusable button-busy pattern — `src/hooks/useBusyAction.js` (new)
- **`useBusyAction(action, { onError? })` → `[run, busy]`** — the single reusable guard for async actions. It:
  1. **Blocks re-entrant double-fire.** A second `run()` while the first is still in flight is ignored (an in-flight `ref`, so it holds even before React has re-rendered the button to `disabled` — the fast double-click / Enter-repeat case).
  2. **Exposes a `busy` flag** to drive `<Button busy>` (disable + inline spinner) and `aria-busy`.
- The runner **resolves to the action's value** (or `undefined` when a call was ignored as a duplicate) and **re-throws errors unchanged** unless an `onError` is supplied — so existing `try/catch` + `reportError`/`reportApiError` (Phase 3/5) flows keep working without modification. It is intentionally **reporting-agnostic**: it guards concurrency and drives the spinner; it does not decide how failures surface.
- The runner identity is **stable** (latest `action`/`onError` held in refs), so it is safe to pass straight to `onClick` or into dependency arrays. Guards against `setState`-after-unmount.

### 1.2 Button-busy visual state — `src/components/ui/Button.js`
- New **additive** `busy` prop (default `false` → **zero behaviour change** for every existing caller). When `busy`:
  - the button is **disabled** (`disabled || busy`) — the double-submit guard even without the hook,
  - `aria-busy` is set for assistive tech,
  - an inline **`ButtonSpinner`** renders before the label (label stays visible), and
  - an `is-busy` class is added (state hook for tests / dev-overlay tracing).
- `ButtonSpinner` is an inline SVG using **`stroke="currentColor"`** (not `border`) — it inherits the button's text colour across every variant and **never trips the border ban**. Rotation + reduced-motion live in the CSS family (below).

### 1.3 Spinner styling — `src/styles/families/buttons.css`
- Adds `.app-btn__spinner` (`animation: app-spin 0.6s linear infinite`), the `@keyframes app-spin`, and a `prefers-reduced-motion: reduce` slow-down — in the **canonical button family file**, tokens/currentColor only, consistent with `staffglobal.css`. No new colour tokens introduced.

### 1.4 Ad-hoc `Loading…` text → shared primitives (high-impact screens)
Every replaced site now renders the shared **`InlineLoading`** (from [LoadingSkeleton.js](../src/components/ui/LoadingSkeleton.js)) — a themed, `role="status"` `aria-live="polite"`, reduced-motion-aware shimmer — or, where a full panel was blanked, a **`SkeletonBlock`** stack. This kills the layout jump + "feels broken" gap the [Phase 1 audit](frontend-feedback-audit-phase1.md) flagged (C15, C4, C5).

---

## 2. Files touched

| File | Change |
|---|---|
| `src/hooks/useBusyAction.js` | **New.** Double-fire-guarding async runner + `busy` flag. |
| `src/components/ui/Button.js` | Additive `busy` prop (disable + `aria-busy` + inline `ButtonSpinner`). Backward compatible. |
| `src/styles/families/buttons.css` | `.app-btn__spinner` + `@keyframes app-spin` + reduced-motion (stroke, not border). |
| `src/components/page-ui/dashboard/workshop/dashboard-workshop-ui.js` | 3× `Loading…` paragraphs → `InlineLoading` (import added). |
| `src/components/page-ui/dashboard/managers/dashboard-managers-ui.js` | 1× `Gathering completion statistics…` → `InlineLoading` (import added). |
| `src/components/page-ui/dashboard/parts/dashboard-parts-ui.js` | 5× `Loading…` paragraphs → `InlineLoading` (import added). |
| `src/components/NotesTab.js` | Full-tab `Loading notes...` → `SkeletonBlock` stack; inline `Loading viewers…` → `InlineLoading` (import added). |
| `src/pages/goods-in/index.js` | Supplier-search `Loading suppliers...` → `InlineLoading` (already imported). |
| `src/components/page-ui/workshop/workshop-consumables-tracker-ui.js` | Logs-table `Loading logs…` cell → `InlineLoading` (already in scope via props). |
| `src/pages/dev/user-diagnostic.js` | **Example/showcase:** live `BusyButtonDemo` (useBusyAction) + `<Button busy>` row in the Buttons showcase; loaders "Proposed `<ButtonLoading />`" note updated to point at the shipped primitive. |
| `docs/frontend-feedback-phase6-loading-states.md` | This progress note (new). |

**Files reviewed (not changed):** [LoadingSkeleton.js](../src/components/ui/LoadingSkeleton.js) (confirmed `InlineLoading` / `SkeletonBlock` / `SkeletonKeyframes` exports + `role="status"`/reduced-motion behaviour — reused as-is, not rebuilt), [StaffButton.js](../src/components/ui/StaffButton.js) (link-styled sibling — left unchanged; a matching `busy` prop can follow if link-buttons ever need it), the goods-in **Add part** button ([parts-goods-in-ui.js:620-625](../src/components/page-ui/parts/parts-goods-in-ui.js#L620)) and NotesTab **Save note** button ([NotesTab.js:920-927](../src/components/NotesTab.js#L920)) — both **already** disable + show "Adding…"/"Saving…" via local `savingPart`/`savingNewNote` state and are raw `.app-btn` (not `<Button>`), so converting them to the new prop would be an out-of-scope feature migration; left for Phase 10.

**DB schema checked?** Not applicable — Phase 6 is a presentation/interaction layer (loading feedback + double-submit guard). No data access, no query/column changes.

**Scope:** Local presentational edits + two new/edited shared primitives. **One shared-component touch (`Button.js`) — flagged, not silent.** It is **not** in the `CLAUDE.md §7` stop-and-confirm set (that lists `Section.js`/`Card.js`/`Layout`/`Sidebar`/context/`theme.css`/`globals.css`); `Button.js` was changed **additively** (new opt-in prop, default off, zero change for existing callers), which is exactly the button-busy primitive the task authorised. No new component/layout region landed. `buttons.css` is the design-system family file (already border-allowlisted); the additions are tokens/`currentColor` only.

---

## 3. Tests run

- ✅ `npx eslint` on all 9 changed files — **0 errors.** Two **pre-existing** warnings remain and are unrelated to this phase (verified by re-running against `git stash`): `NotesTab.js` `useEffect`/`loadNotes` exhaustive-deps, and `dashboard-parts-ui.js` unused `Section` prop.
- ✅ `npm run check:borders` — **passes** (spinner uses `stroke`, not `border`; no card/surface borders added).
- ✅ `npm run check:layers` — **passes** (no surface-primitive nesting introduced; skeleton placeholders are plain `role="status"` divs, same as `PageSkeleton`).
- ✅ `npm run check:encoding` — **passes.**
- ✅ **Double-fire reasoning** — the `inFlightRef` gate is set synchronously *before* the first `await`, so a second `run()` in the same tick (double-click) short-circuits to `undefined`; `finally` clears it. `busy` state additionally disables the button on the next render. Two independent guards.

**Examples updated:** the design-system showcase (`/dev/user-diagnostic` → **Buttons** section) now demonstrates `<Button busy>` (static) and a live `BusyButtonDemo` you can double-click to see the action fire **once** — the canonical, non-product reference for the pattern. The loaders showcase note now points at `useBusyAction.js` instead of the old "Proposed `<ButtonLoading />`" placeholder.

**Not yet done (recommend before Phase 6 sign-off):**
- [ ] Manual smoke: open a workshop/parts/managers dashboard on a throttled connection and confirm the `InlineLoading` shimmer shows (no bare "Loading…" paragraph, no layout jump when data lands).
- [ ] Manual smoke: on `/dev/user-diagnostic`, double-click **Save (click me twice)** and confirm the spinner shows, the button disables, and the (simulated) work runs once.
- [ ] Screen-reader pass on one migrated dashboard + a `busy` button (confirm the `role="status"` shimmer and `aria-busy` are announced).

---

## 4. Remaining risks / considerations (documented, not regressions)

- **Adoption is intentionally partial.** Phase 6 ships the *primitive* + the *high-impact* text swaps (dashboards, notes, goods-in supplier search, consumables tracker). The broad sweep — every remaining ad-hoc `Loading…`/one-off spinner and wiring `<Button busy>`/`useBusyAction` into every async submit — is **Phase 10** by design (rollout §Phase 10). Buttons that already self-manage busy state (goods-in Add, NotesTab Save) were **left as-is** to avoid an out-of-scope migration.
- **`StaffButton` (link variant) has no `busy` prop yet.** Only `Button.js` gained it. A `<Link>`-as-button can't truly be "disabled", so this was deferred deliberately; add it in Phase 10 if a link-styled async action needs the spinner.
- **`is-busy` class is currently un-styled** — it exists as a state/selector hook (tests, dev-overlay). Harmless; not a visual dependency.
- **Skeleton vs spinner choice is per-site judgement.** Panels that were fully blanked (NotesTab) got a `SkeletonBlock` stack (shape-preserving); inline/section loaders got `InlineLoading`. Both are the shared primitive — consistency is in the *primitive*, not a single visual.
- **`useBusyAction` is concurrency + spinner only** — it deliberately does **not** report errors itself (re-throws by default). Call sites still own their `reportError`/`reportApiError`. This keeps it composable with Phase 3/5 rather than a second, competing error path.

---

## 5. What should be done next (no later-phase work started here)

- **Phase 6 exit (met):** one shared loading primitive is confirmed and reused (`InlineLoading` / skeletons); a reusable button-busy pattern exists (`useBusyAction` + `<Button busy>`) and cannot double-fire; the highest-visibility ad-hoc `Loading…` text (dashboards + notes + goods-in + consumables) now shows consistent, accessible feedback. Remaining gate: the manual/SR smoke checks in §3.
- **Phase 7 (next — NOT started):** empty-state standardisation — a shared `EmptyState` component rendering the existing `.app-empty-state` classes, adopted on lists/tables/grids that currently render blank (audit: `StaffEmptyState` has **zero** feature adoption; admin/users MOCK-data masking is the headline fix). **Flag:** like P6, a shared component may trip the `CLAUDE.md §7` shared-component gate — confirm before implementing. Deliberately untouched here.

---

*Phase 6 only. Phase 7 (empty-state standardisation) and later phases were not started or modified. `Button.js` was changed additively and flagged in §2; no `CLAUDE.md §7` stop-and-confirm file was modified. Any later-phase work must re-run the CLAUDE.md pre-flight and stop-and-confirm on global changes.*
