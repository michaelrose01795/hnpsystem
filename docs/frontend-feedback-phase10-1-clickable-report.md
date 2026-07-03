# Phase 10.1 — Clickable "Report this problem" from every error/warning toast (Progress)

**Part of** the [Frontend Feedback & Error System](frontend-feedback-system-rollout.md) · follows [Phase 10 migration + guardrails](frontend-feedback-phase10-migration-complete.md).
**Goal:** make every user-facing error toast and validation/support warning **clickable into a pre-filled support report** to the `/dev/support` system — one click, no retyping — while keeping technical detail private to authorised roles, and preventing duplicate reports from repeated clicks.
**Status:** ✅ Implemented.
**Last updated:** 2026-07-03.

---

## 1. Behaviour added

- **A "Report this problem" action inside the toast surface.** Every reportable toast now renders a full-width action button under the message. Reportable = **friendly errors** (`type: "error"`), **validation / support warnings** (`type: "warning"`), and **any reference-coded alert** — which covers failed API actions (`reportApiError`), `reportError`, and validation `reportWarning`. Success/info toasts get no button (nothing to report).
- **One click → pre-filled report.** Clicking opens the existing shared support modal (`SupportReportModal`, hosted by the StaffTopbar's `SupportControl`) pre-filled with:
  - **User-visible:** the exact message shown on the toast + its reference code, as an editable description (category defaults to *bug*).
  - **Attached privately (never shown to the reporter):** a **`trigger`** blob — `origin`, `referenceCode`, the friendly `message`, and the alert's **`devInfo`** — folded into the diagnostics payload, plus everything `openSupportReport()` already captures: **route, user, role, page context, recent diagnostics/actions, recent errors, build**. The server re-sanitises all of it.
- **Normal staff still see no technical detail.** The button is visible to everyone, but `devInfo` rides only in the private diagnostics blob; the modal continues to disclose only the *categories* of attached data, and the toast's dev-info row stays `canViewDiagnostics`-gated (Phase 4). No new technical detail is exposed to non-diagnostic staff.
- **Duplicate-click protection.** Once a report is filed for an alert, that toast's button flips to a disabled **"Reported ✓"**. The reported-alert set lives in the shared feedback bridge, so repeated clicks (before or after submit) cannot file a second report for the same alert; `openSupportReport` is also guarded on `hasReportedAlert`.
- **Routed to dev/support + surfaced in dev diagnostics.** The report posts to the existing `/api/support/reports` (→ Developer Platform → Support) exactly like the "?" control. On success it is recorded (origin `error-toast`) into the feedback bridge, and **/dev/feedback-diagnostics** now shows a **"Reports created from clicked errors"** panel + stat card, with a link through to the full reports.

---

## 2. Files changed

| File | Change |
|---|---|
| `src/components/TopbarAlerts.js` | Adds the "Report this problem" action to reportable toasts; builds the pre-fill (message + reference code visible; `trigger` with devInfo private); `useSupportReport().openSupportReport`; disabled "Reported ✓" state via the feedback bridge; re-renders on bridge changes. |
| `src/components/support/SupportReportModal.js` | Folds `prefill.trigger` into the POSTed diagnostics (server-sanitised, never displayed); on successful submit records the created report (origin/reference/alert id) into the feedback bridge. |
| `src/lib/support/feedbackDevBridge.js` | Adds `recordReportCreated()` (idempotent per alert id), `hasReportedAlert()`, a bounded `reportsCreated` history in `getFeedbackState()`, and a `reports()` accessor on `window.__HNP_FEEDBACK__`. |
| `src/pages/dev/feedback-diagnostics.js` | New "Reports created from clicked errors" stat + panel (origin `error-toast`), linking to `/dev/support`. |
| `src/styles/staffglobal.css` | `.app-alert__report` / `.app-alert__report-btn` (full-width ghost action; ghost-ring outline per the Border Law; disabled state). |
| `docs/frontend-feedback-phase10-1-clickable-report.md` | This progress note (new). |

**Files reviewed (not changed):** `src/context/SupportReportContext.js` (consumed via `useSupportReport()` only — `openSupportReport({ prefill })` already threads an arbitrary prefill to the modal; **not** modified, honouring `CLAUDE.md §7` on context providers), `src/lib/support/reportSubmission.js` + `src/lib/support/sanitise.js` (confirmed `buildReportInsert` reads the `diagnostics` blob and `sanitiseValue` **recurses all keys** — so the added `trigger` object is retained and scrubbed, `devInfo` secrets redacted, and the whole thing is counted against the size cap), `src/components/support/SupportControl.js` (the modal host — unchanged; it renders the modal whenever `isOpen`), `src/lib/auth/roles.js` (`canViewDiagnostics` gate unchanged).

**DB schema checked?** Not applicable — client-side toast UX + an additive field inside the already-accepted `diagnostics` blob. No columns, queries, or DB helpers changed; the report insert path is unchanged.

**Scope:** Local to the toast renderer + the support modal + the feedback bridge + the dev page + a scoped CSS block. **No `CLAUDE.md §7` stop-and-confirm file was modified** (`theme.css`/`globals.css`/`Layout`/`Sidebar`/`Section`/`Card`/context providers untouched; `staffglobal.css` is a scoped family already extended in Phases 2/4).

---

## 3. Accessibility & design

- The action is a real `<button>` with an explicit `aria-label` ("Report this problem: <message>" → "Problem reported" once filed); keyboard-operable and part of the toast's focus group (which pauses auto-dismiss on focus, so it doesn't vanish mid-interaction). The toast's Enter/Space-to-dismiss only fires when the toast root itself is focused, so activating the button never also dismisses the toast.
- Token-styled, borderless surface; the only outline is the allowed `--ghostbutton-ring`; focus uses `--focus-ring` (box-shadow). `npm run check:borders` passes.
- Tone is carried by text, not colour alone; the disabled "Reported ✓" state is a text change plus reduced opacity.

---

## 4. Testing performed

- ✅ `npx vitest run src/lib/support/ src/lib/notifications/` — **281 passed** (no regression; confirms the modal → `feedbackDevBridge` → `diagnosticsLog` import chain has no cycle, and the sanitiser retains the new `trigger` key).
- ✅ `npx eslint` on all changed files — **0 errors** (fixed one: dev-page link now uses `next/link`).
- ✅ `npm run check:borders` — passes (the new `.app-alert__report-btn` uses the ghost ring only).
- ✅ `npm run check:feedback` — passes (no banned dialogs introduced).

**Not yet done (recommend before sign-off):**
- [ ] Manual smoke: trigger an error toast (e.g. a failed save), click **Report this problem**, confirm the modal opens pre-filled with the message + reference code, submit, and confirm the toast flips to **Reported ✓** and a second click does nothing.
- [ ] As a `dev` user, open `/dev/feedback-diagnostics` and confirm the filed report appears under "Reports created from clicked errors"; open `/dev/support` and confirm the report's diagnostics carries the private `trigger` (devInfo + reference) — and that a **non-diagnostic** staff user never saw that detail on the toast or in the modal.
- [ ] Screen-reader pass: the action button announces correctly and the "Reported ✓" state is conveyed.

---

## 5. Remaining risks & follow-up

- **Dedup is per browser session / per alert id.** The reported-alert set is in-memory (feedback bridge) — a reload clears it, so the same *underlying* problem could be reported again from a fresh toast. That is acceptable (each is a distinct occurrence with its own reference code); server-side incident clustering (`incidentClustering.js`, already present) is what de-duplicates *across* reports.
- **`trigger.devInfo` size.** `devInfo` includes a stack; it is scrubbed and counted against the diagnostics size cap, so a very large snapshot + devInfo could hit the cap and be rejected with a clean error. In practice the cap is generous; if it becomes an issue, trim `devInfo` in the prefill (the reference code already links to the full `diagnosticsLog` entry).
- **Boundary recovery reports** (Phase 9) still use their own prefill path (`buildBoundaryReportPrefill`) without a `trigger.origin`, so they record as origin `support-modal`, not `error-toast`. If desired, a follow-up could tag boundary reports with their own origin so the dev page can distinguish crash-reports from toast-reports.
- **Follow-up:** consider a compact "Report" affordance on inline `<FieldError>` validation messages too (this phase covers the toast surface, which is where validation `reportWarning`s and all errors already land); and a server view that filters reports by `diagnostics.trigger.origin`.

No unrelated changes were made.

---

*Phase 10.1 only. Builds on the Phase 3/4/9/10 infrastructure; no context provider or `CLAUDE.md §7` file was modified. Any further change must keep `check:feedback` and `check:borders` green.*
