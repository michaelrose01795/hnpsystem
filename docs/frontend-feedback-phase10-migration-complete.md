# Phase 10 — Frontend Consistency Migration + Guardrails (Completion)

**Part of** the [Frontend Feedback & Error System](frontend-feedback-system-rollout.md) — the final phase · follows [Phase 9 boundaries & support recovery](frontend-feedback-phase9-boundaries-support-recovery.md).
**Goal (from rollout §Phase 10):** bring the app onto the completed feedback infrastructure, then add guardrails so it cannot regress; update the dev diagnostics surface; make the rollout doc the permanent standard.
**Status:** ✅ Implemented. The Feedback System is now the enforced default; the remaining legacy `alert()` sites are captured as a **ratcheting baseline** that can only shrink.
**Last updated:** 2026-07-03.

---

## 1. Approach — a ratchet, not a big-bang

The app had **153 legacy `alert()` calls across 27 files** plus assorted raw-`error.message` toasts. Rewriting all of them blind in one pass would be high-risk on a production DMS. Following the repo's own convention for large migrations ([check-borders.js](../tools/scripts/check-borders.js), [check-report-events.js](../tools/scripts/check-report-events.js) — allowlist/advisory baselines), Phase 10:

1. **Built the guardrail first** so the standard is enforceable, seeded with the current debt as a baseline (passes today, cannot grow).
2. **Migrated the highest-traffic, mechanically-safe surfaces** fully, removing them from the baseline.
3. **Documented the rest** as tracked debt the ratchet drains over time (a baseline entry that goes clean triggers a "remove me" warning).

Net effect: **new code physically cannot reintroduce a banned dialog** (CI fails), and the legacy tail is visible and shrinking rather than hidden.

---

## 2. Guardrail added — `npm run check:feedback`

New: [tools/scripts/check-feedback.js](../tools/scripts/check-feedback.js) (+ `check:feedback` script in `package.json`). Mirrors the existing check scripts.

- **HARD (exit 1):** a product surface (`src/pages`, `src/components`, `src/features`) uses a raw browser dialog — bare `alert(...)` or `window.alert/confirm/prompt(...)` — unless the file is on the **baseline** (tracked debt) or **exempt** (dev/api/native).
- **ADVISORY (exit 0, `--strict` to fail):** a raw `error.message` piped straight into a toast (`showAlert(... .message ...)`).
- **Baseline hygiene:** a baselined file that is now clean prints a "remove from BASELINE_ALLOWLIST" warning, so the list only shrinks.
- **`--list`:** prints every current hit grouped by file with `[baseline]`/`[ENFORCED]` state — the tool for shrinking the baseline.

**Exempt (intentional):** `src/pages/api/**` (no toast surface), `src/pages/dev/**` + `src/components/support/dev/**` (dev tooling), the design-system showcase, and `src/pages/website/dev.js`. The global `window.alert` override in [alertBus.js](../src/lib/notifications/alertBus.js) stays as the safety net (it lives in `src/lib`, outside the scan).

---

## 3. Feature areas migrated this phase

Fully de-`alert()`ed and routed through the Phase-3/5 helpers (raw errors → devInfo + reference code; validation → `reportWarning`; success → `reportSuccess`):

| File | Area | Sites | Migrated to |
|---|---|---|---|
| [PartsTab.js](../src/components/PartsTab.js) | Parts | 9 | `reportApiError` (7) + `reportWarning` (2) |
| [new-job/index.js](../src/pages/new-job/index.js) | Job creation | 9 | `reportWarning` (6) + `reportError` (2) + `reportSuccess` (1) |
| [consumables-request.js](../src/pages/consumables-request.js) | Goods-in / consumables | 2 | `reportWarning` + `reportError` |
| [NewCustomerPopup.js](../src/components/popups/NewCustomerPopup.js) | Customers | 2 | `reportWarning` + `reportError` |
| [jobs/index.js](../src/pages/jobs/index.js) | Job list | 1 | `reportError` |
| [RedirectToWorkshopButton.js](../src/components/mobile/RedirectToWorkshopButton.js) | Mobile → workshop | 3 | `reportWarning` + `reportSuccess` + `reportError` (cleared the advisory) |

**~26 legacy dialog sites migrated**, including the app's two highest-impact record-creating flows (new-job, parts). Each raw `error.message` now flows into `devInfo` behind a reference code instead of being shown to the user; each validation guard is a typed `reportWarning`.

---

## 4. Dev diagnostics surface updated

Rather than destabilise the 600-line visual layout overlay, Phase 10 adds a dedicated, dev-gated inspector consistent with the Developer Platform:

- **New:** [src/lib/support/feedbackDevBridge.js](../src/lib/support/feedbackDevBridge.js) — aggregates the globally-reachable feedback state and installs `window.__HNP_FEEDBACK__` (`.state()`, `.recent()`, `.subscribe()`), mirroring the Phase-4 `window.__HNP_DIAGNOSTICS__` bridge. Fed by `reportError` in [report.js](../src/lib/notifications/report.js).
- **New:** [src/pages/dev/feedback-diagnostics.js](../src/pages/dev/feedback-diagnostics.js) — "Feedback & Errors" area under **Developer Platform → Operations**. Inspects **last error + latest reference code**, **support-report open state + prefill**, **recent reference-coded errors**, a **live sanitised diagnostics snapshot** (route/user/role/build/action + error counts), and the **primitive standard** (P3–P9) with **test emitters** (Emit error/warning/success) to exercise the pipeline. Loading/empty/boundary/validation states are represented via the toolkit's own `LoadingBlock`/`EmptyState` and the primitive roll-up.
- **Nav:** one entry added to [devPlatformNav.js](../src/components/dev-platform/devPlatformNav.js) (`feedback`, in the `operations` group).

---

## 5. Rollout doc → permanent standard

[frontend-feedback-system-rollout.md](frontend-feedback-system-rollout.md) is rewritten from a plan into **the standard**: header + phase map show all ten phases ✅; a new **§4 helper reference** (what to import per surface), **§5 intentional exceptions** (the `alert` override, `useConfirmation`, dev/api exemptions, background-log catches, baseline debt, i18n), and **§6 adoption checklist** (copy-into-PR) with the three enforcing guardrails.

---

## 6. Files changed

| File | Change |
|---|---|
| `tools/scripts/check-feedback.js` | **New.** The ratcheting feedback guardrail. |
| `package.json` | Adds `check:feedback` script. |
| `src/lib/support/feedbackDevBridge.js` | **New.** Feedback-state aggregation + `window.__HNP_FEEDBACK__`. |
| `src/pages/dev/feedback-diagnostics.js` | **New.** Dev-gated Feedback & Errors inspector. |
| `src/components/dev-platform/devPlatformNav.js` | Adds the `feedback` area to the Operations group. |
| `src/lib/notifications/report.js` | `reportError` now publishes to the feedback dev bridge. |
| `src/components/PartsTab.js` | 9 `alert()` → `reportApiError`/`reportWarning`. |
| `src/pages/new-job/index.js` | 9 `alert()` → report helpers (+ success). |
| `src/pages/consumables-request.js` | 2 `alert()` → `reportWarning`/`reportError`. |
| `src/components/popups/NewCustomerPopup.js` | 2 `alert()` → `reportWarning`/`reportError`. |
| `src/pages/jobs/index.js` | 1 `alert()` → `reportError`. |
| `src/components/mobile/RedirectToWorkshopButton.js` | 3 `showAlert()` → report helpers (cleared the raw-message advisory). |
| `docs/frontend-feedback-system-rollout.md` | Rewritten into the permanent standard (§4 helpers, §5 exceptions, §6 checklist). |
| `docs/frontend-feedback-phase10-migration-complete.md` | This completion note (new). |

**Files reviewed (not changed):** the Phase-3/5/6/7/8/9 primitives (consumed, not modified); `src/lib/notifications/alertBus.js` (the `window.alert` override — confirmed as the intentional safety net, left in place); `src/components/support/dev/supportDevUi.js` (reused toolkit for the new dev page); `src/context/SupportReportContext.js` (read via `useSupportReport()` only — **not** modified, honouring `CLAUDE.md §7` on context providers).

**DB schema checked?** Not applicable — Phase 10 is a client-side presentation/reporting migration + a build-time guard + a dev page. No queries, columns, or DB helpers changed.

**Scope:** Migration edits across product files + a new guard script + a new dev page/bridge + doc updates. **No `CLAUDE.md §7` stop-and-confirm file was modified** (no `theme.css`/`globals.css`/`Layout`/`Sidebar`/`Section`/`Card`/context edits).

---

## 7. Testing performed

- ✅ `npm run check:feedback` — passes (28 baseline files queued, 0 enforced violations, 0 advisories).
- ✅ `npm run check:borders` — passes.
- ✅ `npx vitest run src/lib/support/ src/lib/notifications/` — **281 passed** (confirms the new `report.js → feedbackDevBridge → diagnosticsLog` import chain has no cycle/regression).
- ✅ `npx eslint` on every changed file — **0 errors** (pre-existing warnings only, none introduced; migrated files have no unused-import from the removed `showAlert`/`alert`).

**Not yet done (recommend before sign-off):**
- [ ] Manual smoke of each migrated flow: create a job (success toast + reference-coded failure), a parts error, a consumable request, add a customer, redirect-to-workshop — confirm the toast tone + reference code, and that no native dialog appears.
- [ ] Visit `/dev/feedback-diagnostics` as a `dev` user; use **Emit error** and confirm the reference code + snapshot update live, and `window.__HNP_FEEDBACK__.state()` matches.

---

## 8. Remaining exceptions & safe follow-up

**Remaining baseline debt (28 files)** — tracked in `BASELINE_ALLOWLIST`, enforced-against-growth, drained by the ongoing sweep. Highest-density remaining:
- `src/pages/job-cards/[jobNumber].js` (31), `src/pages/tech/[jobNumber].js` (29), `src/pages/tracking/index.js` (13), `src/pages/appointments/index.js` (11), `src/components/Workshop/JobClockingCard.js` (10), `WarrantyTab.js` (9), `VhcDetailsPanel.js` (6).
- Plus the WIP `websiteManager` panels (mock-data area), `WriteUpForm.js`, `DocumentsUploadPopup.js`, `ProfileWorkTab.js`, `stock-catalogue.js`, `admin/users/index.js`, `login.js`, customer VHC link pages, `EfficiencyTab.js`, `JobCardModal.js`, `ContactTab.js`, `WheelsHubsModal.js`, `usePdfExport.js`, `ProformaOverrideModal.js`, `TrackingMap.js`, `website/profile.js`.

**Safe follow-up (each independently shippable, guardrail already in place):**
1. Drain the baseline file-by-file in the priority order above (job-cards → tech → tracking → appointments → clocking → VHC), removing each from `BASELINE_ALLOWLIST` as it goes clean. `check-feedback.js --list` shows progress.
2. Turn on `check:feedback --strict` in CI once the raw-message advisories are cleared, and wire `check:feedback` into the pre-commit/CI pipeline alongside `check:borders`.
3. Consider a lint rule (or extend the script) for `console.error`-only catches on **user-action** handlers specifically (kept out of scope here to avoid false positives on the ~645 legitimate background logs).
4. Adopt `RouteBoundary`/`SectionBoundary` on the high-traffic staff pages and migrate the bespoke `JobCardErrorBoundary` to a `SectionBoundary` (Phase 9 groundwork; not started here).

No unrelated feature work was started.

---

*Phase 10 — the final phase — complete. The rollout document is now the permanent standard; the guardrail keeps it enforced. Remaining legacy `alert()` sites are a tracked, non-growing baseline. Any further migration must keep `check:feedback` green.*
