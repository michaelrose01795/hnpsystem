# Frontend Feedback & Error System — The Standard (all 10 phases complete)

**Status:** ✅ **COMPLETE — this document is now the permanent standard**, not a plan. All ten phases are implemented; Phase 10 migrated the app onto the primitives and added the CI guardrail (`npm run check:feedback`) that keeps it that way.
**Scope:** Whole app — errors, alerts/toasts, form validation, loading states, empty states, support-reporting, and error boundaries. Applies to staff, customer, and dev surfaces.
**Source:** Expands [frontend-error-handling-plan.md](frontend-error-handling-plan.md) from error-handling-only into the full **user-feedback surface**.
**Last updated:** 2026-07-03

> **If you are building a new page or component, jump to [§6 Adoption checklist](#6-adoption-checklist-for-every-new-page--component).** The rest is the rationale and the phase history.

---

## 0. Why this is broader than "error handling"

The original plan ([frontend-error-handling-plan.md](frontend-error-handling-plan.md)) covered errors, alerts/toasts, and role-aware diagnostics. This rollout treats those as part of one **Feedback System** and adds the three feedback surfaces the app also handles inconsistently:

- **Validation feedback** — telling a user *before* submit what needs fixing.
- **Loading feedback** — telling a user the app is working, not frozen.
- **Empty-state feedback** — telling a user a screen is empty *on purpose*, with a next step.
- **Support reporting** — letting a failure become a developer-actionable record.

All five surfaces share the same principles: plain English, consistent placement, design-system styling from `staffglobal.css`, accessibility by default, and role-aware technical detail.

The single source of truth for the underlying alert/error contracts remains the original plan; this document is the **sequenced delivery plan** and the home of the **Phase 1 audit**.

---

## 1. Guiding principles (apply to every phase)

1. **Plain English first.** Never show a raw stack, HTTP code, or DB string as the primary message (validation, error, or empty).
2. **One shared primitive per surface.** One toast path, one loading primitive, one empty-state primitive, one validation pattern, one error boundary. No one-off reinventions.
3. **Styled from `staffglobal.css` with tokens only.** No inline surface borders/backgrounds; passes `npm run check:borders`.
4. **Accessible by default.** Live-region announcements, keyboard operable, not colour-only, `aria-invalid`/`aria-describedby` on fields, reduced-motion respected.
5. **Role-aware detail.** Staff see friendly copy + a reference code; developer/admin roles see technical detail.
6. **User-initiated vs background.** Always surface user-initiated failures; keep background/polling failures silent (log only).
7. **No silent catch on user actions.** Every user-affecting `catch` either reports or is deliberately annotated as silent.

---

## 2. Phase map (at a glance)

| Phase | Name | Status | Key artefacts |
|---|---|---|---|
| **P1** | **Audit & baseline** | ✅ | [audit](frontend-feedback-audit-phase1.md) |
| P2 | Toast styling + a11y | ✅ | `TopbarAlerts` + `.app-alert` in `staffglobal.css` |
| P3 | Core helper layer | ✅ | [report.js](../src/lib/notifications/report.js) + `errorMessages.js` |
| P4 | Role-aware diagnostics | ✅ | `canViewDiagnostics`, reference codes, `diagnosticsLog.js` |
| P5 | API/DB choke point | ✅ | [apiError.js](../src/lib/api/apiError.js), `reportApiError` |
| P6 | Loading-state standard | ✅ | `LoadingSkeleton` / `InlineLoading`, `<Button busy>` |
| P7 | Empty-state standard | ✅ | `EmptyState` / `.app-empty-state` |
| P8 | Validation standard | ✅ | [useFormValidation.js](../src/hooks/useFormValidation.js), `FieldError` |
| P9 | Boundaries + support reporting | ✅ | `RouteBoundary` / `SectionBoundary`, reference-coded recovery |
| P10 | Feature migration + guardrails | ✅ | `check:feedback` ratchet, feature sweep, `/dev/feedback-diagnostics` |

Plumbing first (P2–P5), primitives next (P6–P8), integration (P9), then the broad migration (P10). Every phase shipped independently.

---

## 3. The 10 phases in detail

### Phase 1 — Audit & baseline *(this phase — delivered as a checklist, no code)*
**Goal:** Know exactly what exists and where the gaps are before touching anything.
- Sweep the app for all seven pattern types: **error handling, alerts/toasts, validation, loading, empty-state, support-reporting**, plus existing shared primitives.
- Classify every finding by **feature area, category, severity, user impact, recommended phase**.
- Confirm which shared primitives already exist (alert bus, `buildErrorAlert`, `SupportErrorBoundary`, LoadingSkeleton, `.app-empty-state`) and their adoption level.
- Confirm tone-token contrast readiness.
- **Deliverable:** [frontend-feedback-audit-phase1.md](frontend-feedback-audit-phase1.md) — grouped markdown checklist.
- **Exit:** agreed message-key catalogue targets + prioritised feature list + severity-ranked backlog.

### Phase 2 — Toast styling + accessibility *(self-contained, low risk)*
**Goal:** Make the existing top-right toast design-system compliant and accessible, with no behaviour change.
- Move `TopbarAlerts` inline styles into `.app-toast-stack` / `.app-alert` classes in `staffglobal.css`.
- Tokens only; `--z-toast`; no inline surface borders; passes `npm run check:borders`.
- Add: single persistent live region, tone icons (not colour-only), keyboard dismiss (Esc/Enter/Space), pause-on-hover, reduced-motion.
- **Touches:** `src/components/TopbarAlerts.js`, `src/styles/staffglobal.css`.
- **Exit:** visually equal-or-better, accessible, compliant.

### Phase 3 — Core helper layer
**Goal:** One line to report anything correctly.
- Add `src/lib/notifications/errorMessages.js` (friendly-message catalogue, keyed).
- Add `reportError(msgOrKey, err, context?)`, `reportSuccess`, `reportInfo`, `reportWarning`, `withErrorToast(fn, opts)`.
- Make `type` explicit on all new calls; downgrade `deriveTypeFromMessage` to fallback-only.
- Add toast de-duplication (identical `(type,message)` within a window → ×N counter).
- **Exit:** the standard reporting API exists and is documented.

### Phase 4 — Role-aware diagnostics
**Goal:** Staff see friendly copy; developers see detail.
- Add a **client-side** developer/diagnostic-role check derived from `UserContext` + `roles.js` (no hardcoded role strings).
- Gate the `TopbarAlerts` dev row ("Copy for Dev" / details) on that role; still always *build* `devInfo`.
- Attach a short **reference code** to every error; show it to all users, log full `devInfo` against it.
- **Exit:** technical detail is role-gated; every error is traceable by code.

### Phase 5 — API/DB choke point
**Goal:** Most network/DB errors auto-map to good messages with zero caller effort.
- Standardise `src/lib/api/client.js` to throw a typed `ApiError` (`status`, `code`, `friendlyKey`).
- Map failure shapes → friendly keys (offline/permission/timeout/validation/server) per the original plan §3.3.
- Wrap `src/lib/database/*` helpers so callers can `reportError` consistently (they already log-and-rethrow).
- **Exit:** callers rarely need to hand-write a message.

### Phase 6 — Loading-state standardisation
**Goal:** No blank/frozen screens; no double-submits.
- Establish/confirm ONE shared loading primitive (skeleton + inline spinner) and a **button-busy** pattern (disable + spinner during async).
- Replace ad-hoc `Loading...` text and one-off spinners on high-traffic screens.
- **Flag:** if a new shared component lands, that may be a `CLAUDE.md §7` shared-component change — confirm.
- **Exit:** key fetches show loading feedback; async buttons can't double-fire.

### Phase 7 — Empty-state standardisation
**Goal:** Empty screens read as intentional, with a next step.
- Add/confirm a shared `EmptyState` component rendering the existing `.app-empty-state` classes (title, description, optional action).
- Apply to lists/tables/grids that currently render blank when empty.
- **Exit:** major lists have a proper empty state.

### Phase 8 — Validation standardisation
**Goal:** Tell users what to fix, inline, before submit.
- Establish ONE validation pattern: inline field-level errors, `aria-invalid` + `aria-describedby`, disabled/guarded submit, focus first invalid field.
- Replace `if (!x) alert(...)` validation and silent submit-blocks on key forms (new-job, new-order, HR, accounts, admin/users, parts).
- **Exit:** key forms give accessible, inline validation feedback.

### Phase 9 — Error boundaries + support reporting
**Goal:** Contain crashes *granularly*; connect async failures to the existing report pipeline.
- **Note (from audit):** `SupportErrorBoundary` is already mounted app-wide in `src/pages/_app.js` and a `SupportControl` "report a problem" hub already exists in `StaffTopbar`. White-screen risk is therefore low — the real gaps are (a) **granularity** (a crash in any leaf unmounts the whole shell; only `job-cards` has a nested boundary) and (b) the **~150 caught-async `alert(err.message)` sinks that connect to nothing** — no reference code, no report affordance.
- Add **per-route/per-section boundaries** (reuse the existing boundary component) so a leaf crash recovers locally instead of replacing the whole shell.
- Wire a **"report this problem"** action + reference code from async failures (via the P3 helper + `devInfo`) into the existing report flow (`src/pages/api/support/reports.js`, `src/lib/support/**`).
- Extend a report entry to **customer/website/tech surfaces** that render outside `StaffTopbar` (currently no manual report path).
- Wrapping/adjusting layout regions trips **`CLAUDE.md §7` — stop-and-confirm**.
- **Exit:** crashes recover locally; async failures are reportable with a reference code, from every surface.

### Phase 10 — Feature migration sweep + guardrails
**Goal:** Bring the whole app onto the primitives and stop regressions.
- Migrate features in priority order (by density + impact): job-cards → VHC → parts/goods-in → notes → clocking → messages → HR → accounts → deliveries → dashboards.
- For each: silent catch → `reportError`; add success toasts; add loading + empty states; convert validation; verify with `/verify`.
- Add the authoring rules to `CLAUDE.md`; optional CI: flag new `window.alert(` and console-error-only catches in pages/components.
- **Exit:** the feedback system is the path of least resistance; regressions are caught.

---

## 4. The helper reference (what to reach for)

One import per surface — never reinvent these.

| You need to… | Use | From |
|---|---|---|
| Report a failure (friendly msg + reference code + devInfo) | `reportError(keyOrSentence, err, ctx)` | `@/lib/notifications/report` |
| Report a caught API/DB error (auto friendly-key) | `reportApiError(err, ctx)` | `@/lib/notifications/report` |
| Confirm success / neutral status / caveat | `reportSuccess` / `reportInfo` / `reportWarning` | `@/lib/notifications/report` |
| Wrap a `try/catch` around an async action | `withErrorToast(fn, opts)` | `@/lib/notifications/report` |
| Validate a form (inline, a11y, focus-first-invalid) | `useFormValidation(...)` + `<FieldError>` / `<FormErrorSummary>` | `@/hooks/useFormValidation`, `@/components/ui` |
| Show loading | `LoadingSkeleton` / `InlineLoading` / `PageSkeleton`, `<Button busy>` | `@/components/ui/LoadingSkeleton`, `@/components/ui/Button` |
| Show an intentional empty screen | `<EmptyState>` / `.app-empty-state` | `@/components/ui` |
| Contain a crash locally | `<RouteBoundary>` (page) / `<SectionBoundary>` (leaf) | `@/components/support/SupportErrorBoundary` |
| Offer a manual report off the StaffTopbar | `<SupportReportLauncher>` | `@/components/support/SupportReportLauncher` |
| Ask a confirm/prompt | `useConfirmation()` | `@/context/ConfirmationContext` — **never** `window.confirm/prompt` |
| Inspect live feedback state (dev) | `/dev/feedback-diagnostics` · `window.__HNP_FEEDBACK__` · `window.__HNP_DIAGNOSTICS__` | — |

**Confirmed acceptance criteria (met):** no product path shows a raw stack/HTTP/DB string as the primary message; user-initiated failures surface a friendly toast with a reference code; all feedback surfaces are token-styled (`check:borders` passes), screen-reader announced/associated, keyboard operable, not colour-only, reduced-motion aware; technical detail is `dev`-role-gated; major lists/fetches have empty/loading states; async buttons can't double-fire; key forms validate inline; render crashes are contained + reportable; background failures stay silent.

---

## 5. Intentional exceptions (allowed, on purpose)

These are **not** violations — they are documented and encoded in the guardrails' allowlists.

1. **The global `window.alert` override** ([alertBus.js](../src/lib/notifications/alertBus.js)) stays. It routes any stray `alert()` (incl. third-party/library code) through the toast bus so nothing ever shows a raw browser dialog. Product code must still use the typed helpers; the override is a safety net, not a sanctioned path.
2. **`useConfirmation()`** is the app confirm/prompt. Bare `confirm(...)` in product code is this helper (destructured), which is fine; only `window.confirm/prompt` is banned.
3. **Dev / diagnostics surfaces** (`src/pages/dev/**`, `src/components/support/dev/**`, the design-system showcase) may use native dialogs and demonstrate old patterns — they are `EXEMPT` in `check-feedback.js`. Example: the readiness-gate override uses `window.confirm` deliberately.
4. **Server handlers** (`src/pages/api/**`) have no toast surface; excluded.
5. **Background / polling failures** are logged (`console.*`), never toasted — a `console.error`-only catch is correct there. The ban is on **user-initiated** actions swallowing errors silently.
6. **Baseline debt** — files still carrying a legacy `alert()` are listed in `BASELINE_ALLOWLIST` in [check-feedback.js](../tools/scripts/check-feedback.js). They pass today but cannot regress, and each is removed the moment it is migrated (the script warns when a baseline entry goes clean). See the Phase 10 completion note for the current list.
7. **i18n** — messages ship English; catalogue keys + rule messages are translation-ready.

---

## 6. Adoption checklist (for every new page / component)

Copy this into your PR description.

- [ ] **Errors:** every user-action `catch` calls `reportError` / `reportApiError` (or `withErrorToast`). No `alert()`, no `window.confirm/prompt`, no raw `error.message` shown to the user. Background/polling catches log only.
- [ ] **Success:** state-changing actions confirm with `reportSuccess` (no ad-hoc banners).
- [ ] **Validation:** forms use `useFormValidation` (or the helpers + `<FieldError>`), wire `aria-invalid`/`aria-describedby`, disable/guard submit, focus first invalid field. No `if (!x) alert()`.
- [ ] **Loading:** fetches show `LoadingSkeleton`/`InlineLoading`; async buttons use `<Button busy>` (can't double-fire). No bare `Loading…` text.
- [ ] **Empty:** lists/tables/grids render `<EmptyState>` when empty (title + next step). No blank screens; no mock/placeholder fallback data.
- [ ] **Boundaries:** wrap the page in `<RouteBoundary>` and volatile leaves in `<SectionBoundary>`; customer/non-staff routes pass `variant="customer" hostSupportModal`.
- [ ] **Design system:** token-styled, borderless surfaces (`LayerSurface`/`LayerTheme`), `DropdownField` for selects; passes `npm run check:borders`.
- [ ] **Guardrail:** `npm run check:feedback` passes (and you did **not** add your file to `BASELINE_ALLOWLIST`).

**Guardrails that enforce this:**
- `npm run check:feedback` — bans new `alert()` / `window.confirm/prompt` on product surfaces; advisories for raw messages piped into toasts (`--strict` to fail on them).
- `npm run check:borders` — token/borderless surface enforcement.
- `npm run lint` — includes React hooks + a11y rules.

---

*This document is the permanent standard. All ten phases are complete; see the per-phase progress notes (`docs/frontend-feedback-phase*.md`) and the [Phase 10 completion note](frontend-feedback-phase10-migration-complete.md) for details, remaining baseline debt, and follow-up work. Any change that reintroduces a banned pattern must pass `check:feedback` — which it will not.*
