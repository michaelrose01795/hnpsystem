# Phase 8 — Validation Standardisation (`useFormValidation` Framework) (Progress)

**Part of** the [Frontend Feedback & Error System rollout](frontend-feedback-system-rollout.md) · follows [Phase 7 empty-state standardisation](frontend-feedback-phase7-empty-states.md).
**Goal (from rollout §Phase 8):** one validation pattern — inline field-level errors, `aria-invalid` + `aria-describedby`, guarded/disabled submit, focus the first invalid field — replacing `if (!x) alert(...)` guards and HTML5-only forms on key forms. **Exit:** key forms give accessible, inline validation feedback.
**Status:** ✅ Implemented (framework shipped + reference forms migrated; full app migration deliberately deferred to Phase 10).
**Last updated:** 2026-07-03.

---

## 1. The validation framework

One reusable system, layered so a form can adopt as much as it needs.

### 1.1 Configurable rules — `src/lib/validation/rules.js` (new)
Rule factories returning `(value, allValues) => message | undefined`. Empty values are skipped so `required()` owns emptiness (combine `required()` + a format rule to make a field mandatory). Shipped: `required`, `minLength`, `maxLength`, `pattern`, `email`, `phone`, `numeric`, `min`, `max`, `matches` (cross-field), `custom` (predicate), and `asyncRule` (Promise-returning, for uniqueness-style checks). Every rule takes an optional custom message.

### 1.2 Pure runner — `src/lib/validation/validate.js` (new)
`runValidation(values, schema)` → `Promise<{ field: message }>` of only the failing fields. Accepts a per-field rule **array**, a single rule, or a whole-form **function**; **awaits async** rules; **first failing rule per field wins**. `firstInvalidField(errors, order)` returns the field to focus, honouring an explicit visual/tab order. Side-effect free — it backs the hook, but can also validate on a server handler or in a test.

### 1.3 The hook — `src/hooks/useFormValidation.js` (new)
The single entry point. Returns `{ values, errors, touched, submitted, submitting, isValid, getFieldProps, handleChange, handleBlur, handleSubmit, setFieldValue, setFieldError, setValues, reset, focusField, summaryErrors }`. Behaviours (each a rollout §Phase 8 requirement):

| Requirement | How |
|---|---|
| Inline field errors (no `alert`) | `errors[name]` + `getFieldProps` wire `aria-invalid`/`aria-describedby`. |
| Accessible messaging | `getFieldProps` sets the ARIA attributes; `<FieldError>` is `role="alert"`. |
| Focus first invalid field | `handleSubmit` calls `focusField(firstInvalidField(errs, fieldOrder))` — focus **and** `scrollIntoView`. Stable per-field ref callbacks. |
| Live validation after first submit | once `submitted`, an effect re-validates on every value change so fixes clear as typed — **no red-on-load** (errors stay empty until the first submit/live pass). |
| Optional real-time while editing | `validateOnChange: true`. |
| Grouped summary for large forms | `summaryErrors` (array of `{ name, message, id }`) feeds `<FormErrorSummary>`. |
| Async validation | rules may return Promises; `handleSubmit` awaits `runValidation`. |
| Server-side field errors | `setFieldError(name, message)` (e.g. a 409 "email already exists") — marks submitted + focuses. |
| Success states | `getFieldProps` adds `data-valid="true"` (touched, validated, non-empty, no error) → the success ring. |
| Reporting integration | `onSubmit(values, { setFieldError, setErrors, reset })` — throw and catch with `reportApiError` (Phase 5), or return field errors for inline display; `submitting` drives `<Button busy>` (Phase 6). |

Stable handler identities via latest-closure refs, so inline `schema`/`onSubmit` objects don't churn.

### 1.4 Presentation — components + design-system CSS
- **`src/components/ui/FieldError.js`** (new) — accessible inline error (`role="alert"`, `aria-live="polite"`, `id` matched by the field's `aria-describedby`), with a background-fill `!` badge (not a border).
- **`src/components/ui/FormErrorSummary.js`** (new) — grouped `role="alert"` summary; each entry links to (and focuses) its field.
- **`src/components/ui/InputField.js`** — now `forwardRef` + `error` / `hint` / `required` props: auto-renders `<FieldError>`, wires `aria-invalid`/`aria-describedby`/`aria-required`, and forwards its `<input>` ref for focus. **Backward compatible** (all props optional).
- **`src/styles/families/forms.css`** (new; imported in `families/index.css`) — `.app-field-error(+__icon)`, `.app-field-hint`, `.app-field-required`, the invalid/valid field **rings drawn with `box-shadow` (not `border`)** to respect the border ban, and `.app-form-summary`. Tokens only.

---

## 2. Files changed

| File | Change |
|---|---|
| `src/lib/validation/rules.js` | **New.** Configurable rule factories (+ async). |
| `src/lib/validation/validate.js` | **New.** Pure async runner + `firstInvalidField`. |
| `src/hooks/useFormValidation.js` | **New.** The reusable form hook. |
| `src/components/ui/FieldError.js` | **New.** Accessible inline field error. |
| `src/components/ui/FormErrorSummary.js` | **New.** Grouped, linkable validation summary. |
| `src/components/ui/InputField.js` | `forwardRef` + `error`/`hint`/`required` + ARIA wiring (additive, backward compatible). |
| `src/components/ui/index.js` | Barrel-exports `FieldError`, `FormErrorSummary`. |
| `src/styles/families/forms.css` | **New.** Validation family CSS (box-shadow rings, tokens only). |
| `src/styles/families/index.css` | Imports `forms.css`. |
| `src/components/Admin/AdminUserForm.js` | **Migrated** (reference #1) — full hook adoption. |
| `src/features/payslips/PayslipUpsertModal.js` | **Migrated** (reference #2) — money-critical inline validation. |
| `src/pages/dev/user-diagnostic.js` | Showcase: live `FormValidationDemo` + registry entry. |
| `docs/frontend-feedback-phase8-validation.md` | This progress note (new). |

**Files reviewed (not changed):** [report.js](../src/lib/notifications/report.js) / [apiError.js](../src/lib/api/apiError.js) (confirmed `reportApiError` + friendly-key mapping consume a thrown error unchanged — the hook's `onSubmit` throw→catch path integrates cleanly), [DropdownField](../src/components/ui/dropdownAPI/DropdownField.js) / [CalendarField](../src/components/ui/calendarAPI) (used in the payslip form; they receive `aria-invalid`/`aria-describedby` — inline `<FieldError>` renders regardless of whether a given control forwards ARIA), [AccountForm.js](../src/components/accounts/AccountForm.js) / appointments & consumables pages (candidate migrations left for Phase 10 — the latter two render inputs in a separate `-ui.js` from their submit handler, so a faithful migration threads props across files and belongs in the sweep, not a reference).

**DB schema checked?** Not applicable — Phase 8 is client-side validation + presentation. No queries, columns, or DB helpers changed. The payslip guard prevents a **bad write** (zero/empty money) but reads no schema.

**Scope:** New shared components/hook/lib + two form migrations. **Shared-component touches flagged per `CLAUDE.md §7` / rollout §5:** all additions are **new files** except `InputField.js` (changed **additively** — `forwardRef` + optional props, zero change for existing callers) and `forms.css` (new family, tokens/box-shadow only). **No §7 stop-and-confirm file** (`Section`/`Card`/`Layout`/`Sidebar`/context/`theme.css`/`globals.css`) was modified.

---

## 3. Migrated forms (reference implementations)

### 3.1 `AdminUserForm` — full hook adoption (audit C12)
Was HTML5-`required`-only with an unguarded role/department select and a single result banner. Now: `useFormValidation` with a `required`/`email`/`phone` schema, **inline** `<FieldError>` per field, a **`<FormErrorSummary>`** at the top, **focus-on-first-invalid**, **live re-validation** after submit, a **busy** submit button, and **`reportSuccess`/`reportApiError`** for the result (raw message → devInfo only). A server 409 / "email"-shaped failure is surfaced **inline on the email field** via `setFieldError`. Demonstrates the full stack (text inputs + native selects + summary + async submit + reporting).

### 3.2 `PayslipUpsertModal` — money-critical inline validation (audit C10, 🟠 Critical)
Was able to **save a payslip with an empty/zero gross or net figure** and used ad-hoc `throw new Error("Select a user")` guards surfaced in one banner. Now validates `userId` / `paidDate` / `grossPay` (`> 0`) / `netPay` (`≥ 0`) with `runValidation` **before any network call**, shows **inline `<FieldError>`** under each of those fields (ARIA wired), and **live-clears** a field's error as it is edited. Demonstrates the composable helpers + `FieldError` on bespoke controls (`DropdownField`/`CalendarField`/`NumberField`) without a full rewrite.

### 3.3 Showcase — live reference
`/dev/user-diagnostic` → **Form Validation (standard pattern)**: a live `FormValidationDemo` (name/email/password) using the real hook — submit empty to see inline errors + focus + summary; toggle **real-time** to validate while typing; success rings appear as fields pass. Replaces the "Proposed" placeholder.

---

## 4. Accessibility testing

- ✅ **ARIA wiring** — each invalid field gets `aria-invalid="true"` + `aria-describedby="<id>-error"`; `<FieldError>` renders that id with `role="alert"` `aria-live="polite"`, so the message is announced on appearance. `<FormErrorSummary>` is `role="alert"` `aria-live="assertive"` (announces "N problems" immediately) with links that focus their field. Required fields carry `aria-required` + a visible `*`.
- ✅ **Focus management** — a failed submit moves focus (and scrolls) to the first invalid field in the declared `fieldOrder`; summary links focus their target.
- ✅ **Not colour-only** — errors are text + an icon badge + a box-shadow ring; success is a ring **and** the `data-valid` state, never colour alone.
- ✅ **`box-shadow` rings** keep the field-state styling within the border ban (`npm run check:borders` passes).
- ✅ **No red-on-load** — errors stay empty until the first submit (or real-time opt-in), so a pristine form is never announced as invalid.
- [ ] **Manual screen-reader pass (recommended before sign-off)** — drive AdminUserForm + the payslip modal with NVDA/VoiceOver: confirm the summary announces on submit, each field error announces on focus, and the success ring doesn't over-announce.
- [ ] **Keyboard-only pass** — tab order + summary-link activation + focus-on-first-invalid land where expected.

---

## 5. Compatibility notes

- **Additive, backward compatible.** `InputField` gained `forwardRef` + optional `error`/`hint`/`required`; every existing spread-props caller is unchanged. All other framework pieces are new files. No existing form's behaviour changes except the two deliberately migrated.
- **Composable, not all-or-nothing.** A form can use the **full hook** (AdminUserForm), or just the **helpers + `FieldError`** on bespoke controls (payslip), or drop a **`<FormErrorSummary>`** onto an existing errors object. This matters for the Phase 10 sweep, where many forms use `DropdownField`/`CalendarField` with custom `onChange` signatures that don't fit `getFieldProps` directly.
- **Reporting boundaries preserved.** The hook is validation-only; it never reports. Submit failures still flow through the caller's `reportError`/`reportApiError` (Phase 3/5), so there is one error path, not two. Validation errors are inline; server/network errors are toasts.
- **`window.alert` untouched.** The migrated forms stop using it, but the global `alertBus` override (audit assumption #1) is unchanged — no library code that expects native `alert` is affected.
- **i18n-ready.** Messages are literals today (matching the app); rules accept a custom message, so a future catalogue can supply them like the Phase 3 keys.

---

## 6. Remaining rollout work (Phase 10)

The audit ([frontend-feedback-audit-phase1.md](frontend-feedback-audit-phase1.md) §E) sizes P8 at ~25 forms. Phase 8 ships the framework + two references; the sweep migrates the rest:

- **new-job** — job-card creation guard (`alert` ×; record-creating) → hook + inline.
- **appointments** — booking guards (`alert` ×3: job number/date/time) → inline (input in `-ui.js`, handler in page: thread `getFieldProps`/errors through props).
- **new-order** — already has a banner + disabled submit; upgrade to field-level.
- **tech / clocking** — part-request & note guards (`alert`) → inline.
- **consumables-request**, **login** selection guard, **WarrantyTab**, **stock-catalogue**, **tracking** equipment/check forms, **AccountForm**/**CompanyAccountForm** — `alert`/HTML5-only → hook or helpers.

**Adoption rule for Phase 10:** no user-facing form may block submit with `alert()`; use `useFormValidation` (or the helpers + `<FieldError>` for bespoke controls), wire ARIA, focus the first invalid field, and route server failures through `reportApiError`.

**Remaining risks / considerations (documented, not regressions):**
- **`getFieldProps` id contract.** `summaryErrors`/`FieldError` ids default to `field-<name>`; a form that overrides `getFieldProps({ id })` must render its `<FieldError>`/summary with the matching id (documented in-file).
- **Bespoke controls & focus.** Focus-on-first-invalid needs a focusable ref. Native inputs and `InputField` provide one; a custom control (some dropdowns) may not focus programmatically — the inline error + summary still surface it.
- **Async rules run on submit.** `asyncRule` is awaited in `handleSubmit` (and on change when real-time) — debounce/caching for a chatty uniqueness endpoint is a per-form concern, not built into the hook.

---

## 7. What should be done next (no later-phase work started here)

- **Phase 8 exit (met):** one accessible validation pattern exists and is proven on two audit forms (incl. the 🔴/🟠 payslip money guard); fields show inline, ARIA-wired errors; submit focuses the first invalid field; large forms get a grouped summary. Remaining gate: the manual SR/keyboard passes in §4.
- **Phase 9 (next — NOT started):** error boundaries + support reporting — per-route/section `AppErrorBoundary` granularity (a leaf crash recovers locally), and wiring the ~150 caught-async failures into the existing report pipeline with a reference code, extended to customer/website/tech surfaces. **Flag:** P9 adjusts layout regions (`StaffLayout`/`Layout`, `AlertContext`) → `CLAUDE.md §7` stop-and-confirm. Deliberately untouched here.

---

*Phase 8 only. Phase 9 (boundaries + support reporting) and later phases were not started or modified. `InputField.js` was changed additively and flagged in §2; no `CLAUDE.md §7` stop-and-confirm file was modified. Any later-phase work must re-run the CLAUDE.md pre-flight and stop-and-confirm on global changes.*
