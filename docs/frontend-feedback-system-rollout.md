# Frontend Feedback & Error System — 10-Phase Rollout Plan

**Status:** Planning + Phase 1 (audit) in progress. No app behaviour changes.
**Scope:** Whole app (staff-scope UI) — errors, alerts/toasts, form validation, loading states, empty states, and support-reporting.
**Source:** Expands [frontend-error-handling-plan.md](frontend-error-handling-plan.md) from error-handling-only into the full **user-feedback surface**.
**Last updated:** 2026-07-03

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

| Phase | Name | Theme | Blast radius | Global-gate? |
|---|---|---|---|---|
| **P1** | **Audit & baseline** | Inventory every feedback pattern; rubric; checklist | None (docs only) | No |
| P2 | Toast styling + a11y | Migrate `TopbarAlerts` onto `staffglobal.css`; live region, icons, reduced motion | Low | No |
| P3 | Core helper layer | `reportError`/`reportSuccess`/… + message catalogue | Low–med | No |
| P4 | Role-aware diagnostics | Client dev-role gate; dev-only detail; reference codes | Low | No |
| P5 | API/DB choke point | Typed `ApiError`; failure-shape → friendly key mapping | Medium | No |
| P6 | Loading-state standard | Shared skeleton/spinner primitive + button-busy pattern | Medium | Maybe (shared cmp) |
| P7 | Empty-state standard | Shared `EmptyState` primitive on lists/tables/grids | Medium | Maybe (shared cmp) |
| P8 | Validation standard | Inline field errors, disabled submit, a11y association | Medium | No |
| P9 | Boundaries + support reporting | App-wide `AppErrorBoundary`; failure→report path; reference-code linkage | Med–high | **Yes** (layout) |
| P10 | Feature migration + guardrails | Sweep features onto the new primitives; docs + CI checks | High (many files) | No |

Plumbing first (P2–P5), primitives next (P6–P8), integration (P9), then the broad migration (P10). Every phase is independently shippable.

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

## 4. Cross-cutting acceptance criteria

- [ ] No product path shows a raw stack/HTTP/DB string as the primary user message.
- [ ] All user-initiated failures in migrated features surface a friendly top-right toast.
- [ ] Toasts, empty states, loading states, and field errors are all styled from `staffglobal.css` tokens; pass `npm run check:borders`.
- [ ] All feedback surfaces are screen-reader announced/associated, keyboard operable, not colour-only, reduced-motion aware.
- [ ] Technical detail is visible only to developer/admin roles; every error carries a reference code.
- [ ] Major lists have empty states; major fetches have loading states; async buttons can't double-fire.
- [ ] Key forms give inline, accessible validation feedback.
- [ ] Render crashes are contained by a boundary and reportable.
- [ ] Background failures do not spam the toast stack.

---

## 5. Risks & global gates (carried from source plan)

1. **Global-change gates** — P6/P7 (new shared components) and P9 (`StaffLayout`/`Layout`, `AlertContext`) trip `CLAUDE.md §7`. Stop-and-confirm before those.
2. **Role source** — confirm the "developer/diagnostic" role group in `roles.js`; never hardcode.
3. **`window.alert` override** — keep the bus fallback; don't regress library code expecting native `alert`.
4. **Toast fatigue** — enforce the user-initiated flag so background failures stay silent.
5. **i18n** — catalogue keys enable future translation; ships English only.
6. **Contrast** — verify tone token pairs meet WCAG AA before P2 exit.

---

*Planning + audit only. No application behaviour changes until each phase is approved and implemented per the `CLAUDE.md` pre-flight and output rules.*
