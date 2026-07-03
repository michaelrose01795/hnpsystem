# Phase 9 — Error Boundaries + Support Reporting (Support & Recovery System) (Progress)

**Part of** the [Frontend Feedback & Error System rollout](frontend-feedback-system-rollout.md) · follows [Phase 8 validation standardisation](frontend-feedback-phase8-validation.md).
**Goal (from rollout §Phase 9):** contain crashes *granularly* so a leaf failure recovers locally instead of white-screening the shell; connect every user-facing failure to the existing support-report pipeline with a **Phase-4 reference code**; give customer/non-staff surfaces a graceful recovery screen + a manual report path; distinguish recoverable vs unrecoverable failures and prevent crash loops; preserve unsaved form data where practical — all accessible and design-system compliant.
**Status:** ✅ Implemented (boundary architecture + reference-code linkage + customer surfaces shipped; the broad staff-page sweep is deliberately deferred to Phase 10).
**Last updated:** 2026-07-03.

---

## 1. Recovery architecture

Phase 4 already mounted **one** `SupportErrorBoundary` app-wide and wired caught render errors into the shared diagnostics store. Phase 9 turns that single boundary into a **levelled, audience-aware recovery system** without changing the app-shell behaviour.

### 1.1 Pure decision layer — `src/lib/support/recoveryModel.js` (new)
All decisions the boundary makes on catch are factored into a **pure, unit-tested** module (same rationale as `errorBoundaryDiagnostics.js` — the repo's Vitest runner is node, no jsdom):

| Concern | API | Behaviour |
|---|---|---|
| **Levels** | `RECOVERY_LEVELS` = `app` / `route` / `section` | Drives which actions make sense at each granularity. |
| **Audience** | `RECOVERY_VARIANTS` = `staff` / `customer` | Copy tone, home route, and whether a diagnostics panel is offered. |
| **Classification** | `classifyError(error)` | `chunk` (stale dynamic import → retry useless, reload suggested), `network` (retry still helps), `render` (transient, recoverable). |
| **Crash-loop** | `nextCrashState` / `isCrashLoop` | Rolling window (`CRASH_LOOP_WINDOW_MS` = 8 s, `CRASH_LOOP_THRESHOLD` = 3). A lull prunes old crashes so an occasional failure is **not** a loop. |
| **Plan** | `resolveRecovery({ level, variant, error, loopDetected, homeHref, sectionLabel })` | Returns `{ recoverable, loop, headline, message, primaryActionId, actions[], homeHref, allowDiagnostics }` — the ordered, labelled, tone-assigned action set. |

### 1.2 Reference-code linkage — `src/lib/support/errorBoundaryDiagnostics.js` (extended)
- New `mintBoundaryReferenceCode()` reuses the Phase-4 `generateReferenceCode()` (from `buildErrorAlert.js`), so a **render crash gets the same `ERR-…` shape** as an async/toast error and is traced the same way.
- `buildBoundaryReportPrefill({ error, componentStack, referenceCode })` now embeds `Reference: ERR-…` in the report body and returns the code.
- `buildBoundaryEvent(kind, { …, referenceCode })` now prefixes the timeline label with `[ERR-…]` and keeps the raw code on the event, so the code rides along in `recent_actions` in the captured bundle.

### 1.3 The boundary — `src/components/support/SupportErrorBoundary.js` (extended)
The class core now, on catch: **mints a reference code**, folds the crash into the rolling crash-state, computes `loopDetected`, records the render error + a reference-code-stamped `boundary_caught` event, and renders a recovery screen driven by `resolveRecovery`. New instance behaviour:
- **Contextual actions** (each wired to a real handler): `retry` (reset state → re-mount subtree), `reload` (`location.reload`), `back` (`router.back`, else home), `home` (`router.push`), `report` (open the pre-filled support modal).
- **Crash-loop / unrecoverable handling:** `retry` state survives a Retry (same instance), so a rapid re-crash counts toward the loop; once looping (or on a stale-chunk error) **retry is withdrawn** and `reload` becomes primary with "keeps happening" copy.
- **Reference code shown to everyone**; a **diagnostics `<details>` panel** (error, component, reference, "Copy diagnostics" → sanitised snapshot to clipboard) renders **only** for `canViewDiagnostics` roles on **staff** surfaces.
- **Reset on route change** (`resetKey = router.asPath`) also resets crash-state, so navigating away is a clean slate.
- New exports **`RouteBoundary`** and **`SectionBoundary`** — thin wrappers that set `level`; the **default export is unchanged** for `_app.js`.

### 1.4 Manual report path off-topbar — `src/components/support/SupportReportLauncher.js` (new)
A self-hosting "Report a problem" button for surfaces with **no StaffTopbar** (public website, customer VHC views, tech/kiosk). Opens the same `SupportReportModal` with the same private, sanitised snapshot, and **hosts the modal itself**. Accepts `variant`, `label`, `prefill`.

---

## 2. Boundary locations (where they're mounted)

| Location | Level | Variant | Notes |
|---|---|---|---|
| `src/pages/_app.js` (existing `<SupportErrorBoundary hostSupportModal>`) | `app` | staff | **Unchanged call site** — now resolves to level `app` by default. Last line of defence. |
| `src/pages/website.js` | `route` | **customer** | `homeHref="/website"`, `hostSupportModal`. |
| `src/pages/vhc/customer-preview/[jobNumber].js` | `route` | **customer** | Wraps `VhcDirectCustomerPage`. |
| `src/pages/vhc/customer-view/[jobNumber].js` | `route` | **customer** | Share-code-free customer route. |
| `src/components/layout/CustomerWebsiteLayout.js` | — | — | Mounts a discreet `SupportReportLauncher` (fixed bottom-left) so `/website` has a manual report path. |

`RouteBoundary` / `SectionBoundary` are ready for the Phase 10 staff-page sweep (job-cards already has a bespoke `JobCardErrorBoundary` that can migrate to a `SectionBoundary` per tab).

---

## 3. Support integration & automatic capture

- On **Report a problem**, the boundary calls `openSupportReport({ prefill })` — the Phase-2 provider takes a **sanitised diagnostics snapshot** at that moment and the Phase-3 modal sends it to the existing `POST /api/support/reports`. Nothing new on the wire.
- The snapshot **automatically captures** (unchanged from Phase 2/4/5, now correlated by the boundary's reference code): current **route** (`asPath`/`pathname`/`query`), **user + roles + auth status**, **page/UI state** (registered diagnostic providers), **browser/device** info, **build/commit**, **recent actions** (incl. the `[ERR-…]` boundary timeline), and the **recorded render error + component stack**.
- **Role-aware detail:** the reference code is shown to **all** users; the technical diagnostics panel + "Copy diagnostics" are gated on `canViewDiagnostics` (the strict `dev` Developer Platform role from Phase 4) and only on **staff** surfaces — customers never see technical detail.

---

## 4. Recovery flows (by level)

| Level | Actions offered (healthy) | On crash-loop / stale chunk |
|---|---|---|
| **app** | Try again · Reload app · Return to dashboard · Report a problem | drop Try again; Reload app primary |
| **route** | Try again · Reload page · Go back · Return to dashboard · Report a problem | drop Try again; Reload page primary |
| **section** | Retry · Report a problem (compact, page stays usable) | escalate: Reload page · Report a problem |

- **Recoverable vs unrecoverable:** a transient render throw is recoverable in place (Retry). A **stale dynamic-import chunk** or a **crash loop** is treated as not-in-place-recoverable — Retry is withdrawn, copy explains why, and the user is steered to Reload / navigation / Report.
- **Preserving unsaved data:** `GlobalDraftPersistence` already auto-saves draftable fields per route to `localStorage` on input/change/blur/route-change/`beforeunload`. The recovery actions **never clear those drafts**; a Retry re-mounts the subtree and Reload fires `beforeunload` (draft flush) then restores on mount — so typed data survives where practical.

---

## 5. Accessibility

- Recovery screen is `role="alert"` `aria-live="assertive"` (announced on appearance); the reference code is `user-select: all` for one-drag copy; every action is a real `<button>` with a **44 px** min touch target and a visible label (never colour-only — icon tint is decorative/`aria-hidden`).
- Borderless `LayerSurface` per CLAUDE.md §3.0; status tint is a background fill on a non-surface span (allowed under §3.0 rule 5), not a border. `npm run check:borders` passes.
- The diagnostics panel is a native `<details>` (keyboard-operable disclosure).

---

## 6. Files changed

| File | Change |
|---|---|
| `src/lib/support/recoveryModel.js` | **New.** Pure classification / crash-loop / action-plan model. |
| `src/lib/support/recoveryModel.test.js` | **New.** 20 cases — classification, loop window, level/variant action sets, unrecoverable handling. |
| `src/lib/support/errorBoundaryDiagnostics.js` | Adds `mintBoundaryReferenceCode()`; threads `referenceCode` into prefill + timeline event. |
| `src/lib/support/errorBoundaryDiagnostics.test.js` | Adds reference-code assertions (+ mint uniqueness). |
| `src/components/support/SupportErrorBoundary.js` | Levelled/audience-aware boundary: reference code, crash-loop, contextual actions, diagnostics panel, `RouteBoundary`/`SectionBoundary` exports. Default export unchanged for `_app.js`. |
| `src/components/support/SupportReportLauncher.js` | **New.** Self-hosting report entry for off-topbar surfaces. |
| `src/components/layout/CustomerWebsiteLayout.js` | Mounts a discreet `SupportReportLauncher` for `/website`. |
| `src/pages/website.js` | Wrap in customer `RouteBoundary`. |
| `src/pages/vhc/customer-preview/[jobNumber].js` | Wrap default export in customer `RouteBoundary`. |
| `src/pages/vhc/customer-view/[jobNumber].js` | Wrap in customer `RouteBoundary`. |
| `docs/frontend-feedback-phase9-boundaries-support-recovery.md` | This progress note (new). |

**Files reviewed (not changed):** `src/pages/_app.js` (confirmed the existing `<SupportErrorBoundary hostSupportModal>` call site is backward-compatible — defaults to level `app`), `src/context/SupportReportContext.js` (consumed via `useSupportReport()` only — `recordRenderError` / `recordDiagnosticEvent` / `openSupportReport` / `captureDiagnostics` all already exist; **not** modified), `src/components/support/SupportReportModal.js` + `SupportControl.js` (report flow reused unchanged), `src/lib/notifications/buildErrorAlert.js` (reference-code generator reused), `src/lib/auth/roles.js` (`canViewDiagnostics` reused), `src/components/App/GlobalDraftPersistence.js` (confirmed drafts survive retry/reload), `src/pages/job-cards/[jobNumber].js` (`JobCardErrorBoundary` — left for the Phase 10 migration).

**DB schema checked?** Not applicable — Phase 9 is a client-side boundary/recovery/reporting layer. No queries, columns, or DB helpers changed. Reports post to the existing `/api/support/reports` unchanged.

**Scope:** New files + additive extension of the existing boundary + wrapping customer-facing routes.

---

## 7. Compatibility notes

- **App-shell behaviour unchanged.** `_app.js` still renders `<SupportErrorBoundary hostSupportModal>`; the default export defaults to level `app` / variant `staff`, so the existing recovery is identical plus the new reference code + contextual actions.
- **No `CLAUDE.md §7` stop-and-confirm file was modified.** `Layout`/`StaffLayout`, `Sidebar`, `Section`, `Card`, the context providers, `theme.css`, and `globals.css` were **not** touched. `SupportErrorBoundary.js` is extended additively; `SupportReportContext.js` is only consumed.
- **Flagged customer-facing change:** `CustomerWebsiteLayout.js` now renders a discreet fixed-position "Report a problem" launcher on `/website`. This is the rollout §Phase 9 "extend a report entry to customer/website surfaces" requirement; it is out of the content flow, print-hidden, token-styled, and self-hosting. **Confirm placement/label with the owner** before public launch — it is trivial to relocate or gate.
- **One error path, not two.** Boundaries reuse the same `SupportReportModal` + `/api/support/reports` + sanitised snapshot as the topbar "?" control; async failures still flow through Phase 3/5 `reportError`/`reportApiError`. No duplicate window listeners (Phase 4 rationale preserved).
- **i18n-ready.** Recovery copy is English literals matching the app; centralised in `recoveryModel.js` for a future catalogue.

---

## 8. Testing performed

- ✅ `npx vitest run src/lib/support/recoveryModel.test.js src/lib/support/errorBoundaryDiagnostics.test.js` — **34 passed** (classification incl. odd values, crash-loop window prune, per-level/variant action sets, loop/chunk retry-withdrawal, single-primary/ghost-report invariants, reference-code prefill/event/mint).
- ✅ `npx vitest run src/lib/support/` — **281 passed** (no regression across the support lib, incl. privacy/sanitise/diagnostics).
- ✅ `npx eslint` on all changed files — **0 errors** (only pre-existing warnings in the large `customer-preview` page, none from Phase 9 edits).
- ✅ `npm run check:borders` — passes (recovery surfaces are borderless `LayerSurface`; tints are background fills, not borders).

**Not yet done (recommend before sign-off):**
- [ ] Manual smoke: force a render throw in a leaf under a `SectionBoundary` (dev showcase) → confirm the page stays usable, Retry recovers, and 3 rapid re-crashes withdraw Retry and switch to Reload.
- [ ] Manual smoke: crash a customer route (`/vhc/customer-view/...`) → confirm the customer-variant screen (no technical detail), that "Report a problem" opens + sends, and the sent report contains the on-screen `ERR-…`.
- [ ] Screen-reader pass on the recovery screen (announcement + action labels + reference-code readout).
- [ ] Confirm a `dev`-role staff user sees the diagnostics panel + "Copy diagnostics", and a normal staff user does not.

---

## 9. Remaining work for Phase 10 (the final migration phase — NOT started here)

- **Staff-page adoption sweep:** wrap high-traffic pages in `RouteBoundary` and volatile leaf subtrees (job-card tabs, VHC panels, parts/goods-in widgets) in `SectionBoundary`; migrate the bespoke `JobCardErrorBoundary` onto `SectionBoundary`.
- **~150 caught-async `alert(err.message)` sinks:** the audit's core P9/P10 gap — route them through `reportError`/`reportApiError` (Phase 3/5) so each carries a reference code and a report affordance, feature by feature in priority order.
- **Guardrails:** optional CI to flag new `window.alert(` and console-error-only catches in pages/components; add the boundary-authoring rules to `CLAUDE.md`.

---

*Phase 9 only. Phase 10 (feature migration sweep + guardrails) was not started or modified. `SupportErrorBoundary.js` was extended additively and `CustomerWebsiteLayout.js` gained a flagged customer-facing launcher; no `CLAUDE.md §7` stop-and-confirm file was modified. Any later-phase work must re-run the CLAUDE.md pre-flight and stop-and-confirm on global changes.*
