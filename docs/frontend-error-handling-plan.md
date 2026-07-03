# Frontend Error Handling — Improvement Plan

**Status:** Planning only — no app code changes proposed in this document.
**Author:** Engineering
**Scope:** Whole app (staff-scope UI), client-side error surfacing.
**Last updated:** 2026-07-03

---

## 0. TL;DR

The app **already has** a working top-right alert system (`showAlert` → `AlertContext` → `TopbarAlerts`) and an error-payload builder (`buildErrorAlert`). The problem is **coverage and consistency**, not a missing foundation:

- ~868 `catch (…)` blocks and ~868 `console.error(…)` calls exist across ~250 files, but only **15** call `showAlert`/`buildErrorAlert` across **7** files. The overwhelming majority of failures are swallowed to the console or shown via raw `window.alert`.
- `TopbarAlerts` renders with **hardcoded inline styles** and does **not** use the `.app-alert` CSS family already defined in `staffglobal.css`.
- Dev/technical detail ("Copy for Dev") is gated on **whether `devInfo` exists**, not on **who is looking** — so any user can see it.
- Alert **type** is inferred from emoji/keywords in the message string, which is fragile.

This plan standardises **what** users see (plain English), **where/how** they see it (top-right toast using `staffglobal.css`), **how** developers get diagnostics (role-aware), and **how** every part of the app produces errors the same way. It ends with a phased rollout that touches shared plumbing first and leaves per-feature migration incremental.

---

## 1. Current State (as-built inventory)

Read before changing anything. These are the real files, not aspirational.

| Concern | File | Notes |
|---|---|---|
| Alert transport / pub-sub | `src/lib/notifications/alertBus.js` | `showAlert()`, `subscribeToAlerts()`. Overrides `window.alert`. Infers `type` from emoji/keywords via `deriveTypeFromMessage`. |
| Alert state / queue | `src/context/AlertContext.js` | `useAlerts()` → `{ alerts, dismissAlert, pushAlert }`. Auto-dismiss after `duration` (default 5000ms) unless `autoClose === false`. |
| Top-right renderer | `src/components/TopbarAlerts.js` | Fixed top-right stack, shows **3** most recent, newest first. `role="alert"`. Inline styles + tone map. "Copy for Dev" button when `devInfo` present. |
| Error payload builder | `src/lib/notifications/buildErrorAlert.js` | Returns `{ message, type:"error", autoClose:false, devInfo }`. `devInfo` = timestamp + technical message + error name + context + stack. |
| CSS (unused by renderer) | `src/styles/staffglobal.css` (~L6889–6920) | `.app-alert`, `.app-alert--success/--warning/--danger`, `.app-alert__title`, `.app-alert__body`, responsive block ~L7033. |
| Status tone tokens | `src/styles/theme.css` | `--success-surface/-strong`, `--danger-surface/-text`, `--warning-surface/-text`, `--theme`, `--accent-strong`. |
| Server dev gate (reference) | `src/lib/auth/devAuth.js` | Server-side only; not a client role check. |
| Role constants | `src/lib/auth/roles.js` | Source of truth for role groups. |

### 1.1 Key gaps

1. **Coverage** — errors are mostly logged, not surfaced. Users see nothing, or a silent no-op, when an action fails.
2. **Inconsistency** — three coexisting mechanisms: `showAlert`, raw `window.alert` (now proxied through the bus, but callers still pass ad-hoc strings), and silent `console.error`.
3. **Design-system drift** — `TopbarAlerts` bypasses `staffglobal.css`; inline `border`/`background`/`borderRadius` on the toast surface conflicts with the Border Sweep + Layer Primitive rules in `CLAUDE.md §3.0/§3.0a`.
4. **Fragile typing** — a genuine error message that happens not to contain "error"/"fail"/"❌" is classified as `info`.
5. **No role-aware diagnostics** — technical detail is exposed by presence of `devInfo`, not by viewer role.
6. **Plain-English gap** — many raw messages are technical (`err.message` shown directly) or absent.

---

## 2. Goals & Principles

1. **Every user-visible failure gets a plain-English sentence** that says what happened and what to do next — never a raw stack, HTTP code, or Supabase error string in the primary message.
2. **One way to raise an alert** — all success/info/warning/error surfacing flows through `showAlert` (usually via a helper), never `window.alert` with ad-hoc strings, never silent `console.error` for user-affecting failures.
3. **One place it appears** — top-right toast stack, consistent position, tone, and dismissal, styled entirely from `staffglobal.css`.
4. **Diagnostics are role-aware** — technical detail (stack, endpoint, error type) is visible/copyable only to developer/admin roles; regular staff see the friendly sentence and a reference code.
5. **Reusable, boring patterns** — a small set of helpers so a new feature never has to think about error UI plumbing.
6. **Accessible by default** — screen-reader announcement, keyboard-dismissable, not colour-only, respects reduced motion.
7. **No design-system violations** — no inline surface borders/backgrounds; tokens only; passes `npm run check:borders`.

**Explicit non-goals (this phase):** server-side error logging/telemetry pipeline, error monitoring SaaS integration, offline/retry queues, form-field inline validation (separate concern — see §9).

---

## 3. Plain-English User Messages

### 3.1 Message contract

Every error surfaced to a user must have a **user message** that is:

- A complete sentence in plain English (no jargon, no error codes in the sentence itself).
- **What happened** + **what to do** — e.g. *"We couldn't save your note. Please try again in a moment."*
- Free of internal nouns (no "Supabase", "500", "null", "undefined", table names, endpoints).
- Specific to the action when possible — *"We couldn't upload that photo"* beats *"Something went wrong"*.

A **reference code** (short, e.g. the alert id or a timestamp token) may be appended for support: *"…Please try again. (Ref: ALB-4213)"* — the full technical detail sits behind the role-gated dev panel, keyed by that code.

### 3.2 Message catalogue (single source of truth)

Create a small catalogue so wording is consistent and translatable later. Proposed location: `src/lib/notifications/errorMessages.js`.

```
// Shape (illustrative — do NOT implement yet)
export const ERROR_MESSAGES = {
  SAVE_FAILED:   "We couldn't save your changes. Please try again in a moment.",
  LOAD_FAILED:   "We couldn't load this information. Please refresh and try again.",
  UPLOAD_FAILED: "We couldn't upload that file. Check your connection and try again.",
  DELETE_FAILED: "We couldn't delete that item. Please try again.",
  PERMISSION:    "You don't have permission to do that.",
  OFFLINE:       "You appear to be offline. Reconnect and try again.",
  TIMEOUT:       "That took too long to respond. Please try again.",
  VALIDATION:    "Some details need attention before we can continue.",
  UNKNOWN:       "Something went wrong. Please try again, or contact support if it keeps happening.",
};
```

Callers pass a **known key** (preferred) or a bespoke sentence. The bespoke sentence still goes through the same helper so styling/behaviour stay uniform.

### 3.3 Mapping technical failures → friendly keys

A helper maps common failure shapes to a default friendly key so callers don't have to:

- Network / `fetch` rejection / `TypeError: Failed to fetch` → `OFFLINE`.
- HTTP 401/403 → `PERMISSION`.
- HTTP 408 / aborted / timeout → `TIMEOUT`.
- HTTP 400 / validation payload → `VALIDATION`.
- HTTP 5xx / Supabase error / anything else → `SAVE_FAILED` or `LOAD_FAILED` depending on verb, falling back to `UNKNOWN`.

The **raw** error always survives into `devInfo` (already the case in `buildErrorAlert`).

---

## 4. Top-Right Alert / Toast Behaviour

Keep the current architecture; tighten the contract.

### 4.1 Behaviour spec

| Aspect | Rule |
|---|---|
| Position | Fixed, top-right, below the topbar. Keep existing offset token math (`top: calc(var(--page-gutter-y) + 75px + 12px)`), move the literal values into CSS. |
| Stack | Newest on top. Show up to **3**; if more, collapse the overflow into a count (already partly done via `AlertBadge`). |
| Auto-dismiss | `success`/`info` auto-close after ~5s. `warning` ~8s. `error` **does not auto-close** (matches `buildErrorAlert`'s `autoClose:false`) — user must dismiss or act. |
| Dismiss | Always a visible ✕ button; also dismissable via keyboard (Esc when focused / Enter/Space on the button). |
| Pause on hover/focus | Auto-close timer pauses while the toast is hovered or focused (prevents disappearing mid-read). *(New behaviour — currently the timer runs unconditionally in `AlertContext`.)* |
| De-duplication | Identical `(type, message)` within a short window collapses to one with a ×N counter, so a retry loop can't spam the stack. *(New behaviour.)* |
| Max lifetime | Even non-auto-close errors should be capped or clearable in bulk ("Dismiss all") to avoid pile-up. |

### 4.2 Type/tone — stop inferring from strings

Replace emoji/keyword inference with an **explicit `type`** on every call. Keep `deriveTypeFromMessage` only as a last-resort fallback for legacy `window.alert(string)` interceptions. Tones: `success | info | warning | error`.

---

## 5. Consistent, Reusable Error Patterns

The aim: a feature author writes **one line** to handle an error correctly.

### 5.1 Proposed helper surface (design, not final code)

Location: `src/lib/notifications/` (extend, don't replace, existing files).

- **`reportError(userMessageOrKey, err, context?)`** — thin wrapper over `buildErrorAlert` + `showAlert`. The 90%-case call:
  ```
  try { await saveNote(...) }
  catch (err) { reportError("SAVE_FAILED", err, { jobNumber, endpoint: "notes.update" }); }
  ```
- **`reportSuccess(message)` / `reportInfo(message)` / `reportWarning(message)`** — trivial typed wrappers over `showAlert` so success paths are as uniform as error paths.
- **`withErrorToast(fn, { message, context })`** — wraps an async action; on throw, calls `reportError` and re-throws (or swallows, configurable) so button handlers stay clean.
- **`apiClient` integration** — `src/lib/api/client.js` already exists; give it a single choke point that throws typed errors (`ApiError` with `status`, `code`, `friendlyKey`) so `reportError` can map without every caller re-deriving.

### 5.2 Error Boundary strategy

- There is already `src/components/support/SupportErrorBoundary.js`. Generalise the pattern into a **shared `AppErrorBoundary`** for render-time crashes: shows a friendly full-panel fallback ("This section hit a problem") with a role-gated "details" expander, and a reset action.
- Wrap major route/layout regions (via `StaffLayout`) so a crashing tab doesn't white-screen the whole app. **Flag:** touching `StaffLayout`/`Layout` is a global change per `CLAUDE.md §7` — confirm before implementing.

### 5.3 Rules for authors (to document in CLAUDE.md once shipped)

1. Never show a raw `err.message` as the primary user message.
2. Never leave a user-affecting `catch` with only `console.error`. Either `reportError(...)` or deliberately annotate why it's silent.
3. Never call `window.alert`/`confirm` for product UI.
4. Always pass `context` (endpoint, ids) so dev diagnostics are useful.
5. Choose an explicit `type`.

---

## 6. `staffglobal.css` Styling Requirements

`TopbarAlerts` must be **restyled to use CSS classes** rather than inline styles, so the toast obeys the design system and the Border Sweep.

### 6.1 Required class structure (extend the existing `.app-alert` family)

Reuse/extend the classes already at `staffglobal.css` ~L6889:

```
.app-toast-stack              /* fixed top-right container, gap, max-width, z-index */
.app-alert                    /* one toast surface — bg var(--theme), radius, padding, NO border */
.app-alert--success           /* bg var(--success-surface) */
.app-alert--warning           /* bg var(--warning-surface) */
.app-alert--danger            /* bg var(--danger-surface) */   ← maps to type "error"
.app-alert--info              /* bg var(--theme) */
.app-alert__title             /* friendly headline */
.app-alert__body              /* message text */
.app-alert__actions           /* dismiss + copy-for-dev row */
.app-alert__dismiss           /* ✕ button */
.app-alert__dev               /* role-gated dev row (hidden for non-dev) */
```

### 6.2 Hard styling constraints (from `CLAUDE.md`)

- **No `border:` on the toast surface** — the Border Sweep (`§3.0a`) bans decorative borders on cards/panels/toasts. Current `TopbarAlerts` uses `border: "none"` inline (fine) but also `boxShadow` inline — move shadow to a token/class. State signalling is **background tint + icon colour**, not coloured side-borders (`§3.0a` rule 3).
- **No inline `background` / `borderRadius`** on the surface — use classes + tokens (`§3.0` rule 4).
- **Tokens only** — tones from `--success-surface`, `--danger-surface`, `--warning-surface`, `--theme`; text from `--text-1`/status text tokens; radius from `--radius-md`; pill from `--radius-pill`.
- **Z-index** — use a token (there is `--z-toast` in `staffglobal.css` ~L1105). Replace the literal `zIndex: 1200`.
- **Ghost/copy buttons** — the "Copy for Dev" button may keep its outline via `--ghostbutton-ring` (the one allowed button outline per `§3.0a`).
- Must pass **`npm run check:borders`**.

### 6.3 Responsive

- On mobile (`< 768px`), toasts should span near-full width with side gutters (`width: min(400px, calc(100vw - 48px))` already used — move to CSS). Touch target for dismiss ≥ 44×44px (`§3.6`). Use `useIsMobile` only if JS branching is truly needed; prefer CSS media queries (a responsive block already exists ~L7033).

---

## 7. Accessibility

| Requirement | Implementation note |
|---|---|
| Announce to screen readers | Wrap the stack in a **single persistent live region** (`aria-live="assertive"` for errors, `"polite"` for success/info; or two regions). Currently each toast has `role="alert"`, which re-announces the whole node on mount — a stable container region is more reliable. |
| Atomic announcement | `aria-atomic="true"` on each toast so the full message is read, not just diffs. |
| Not colour-only | Pair each tone with an **icon** (✓ / ⚠ / ✕ / ℹ) and/or a text label ("Error:") so meaning survives for colour-blind users and greyscale. |
| Keyboard | Dismiss reachable and operable by keyboard; `Esc` dismisses the focused toast; focus not trapped. Copy-for-dev button focusable. |
| Focus management | Do **not** steal focus on toast appearance (disruptive); errors that block a flow should instead move focus to the relevant control or an inline message. |
| Reduced motion | Respect `@media (prefers-reduced-motion: reduce)` — no slide/fade for users who opt out. |
| Contrast | Verify tone `surface`/`text` token pairs meet WCAG AA (4.5:1 body). Add to the review checklist. |
| Timing | Auto-dismiss + pause-on-hover satisfies WCAG 2.2.1 (enough time); errors never auto-dismiss. |

---

## 8. Role-Aware / Dev-Only Diagnostic Detail

### 8.1 What each audience sees

| Audience | Sees |
|---|---|
| Regular staff | Friendly sentence + optional reference code. **No** stack, endpoint, error type, or "Copy for Dev". |
| Developer / admin roles | Everything above **plus** a "Details"/"Copy for Dev" affordance exposing the full `devInfo` blob (timestamp, technical error, error type, context, stack). |

### 8.2 How to gate (client-side)

- Add a **client-side role check** — there is currently no client `isDev` helper (only server `devAuth.js`). Derive from `UserContext` + `roles.js` (e.g. an `isDeveloperRole`/`isAdminManagerRole`-style check). Do **not** hardcode role strings (`CLAUDE.md §6`).
- `TopbarAlerts` renders the `.app-alert__dev` row **only** when `devInfo` exists **and** the viewer holds a diagnostic role.
- `devInfo` should still always be **built and attached** (cheap, and lets us log/telemetry later) — it's just not *rendered* for non-dev users.

### 8.3 Reference code linkage

- Every error gets a short reference id (reuse the existing `alert.id`, or a shorter derived token). Show it to all users; log the full `devInfo` against it (console today, telemetry later) so a staff member can quote the code and a developer can retrieve detail.

---

## 9. Examples for Common App Errors

Concrete target behaviours (illustrative — not implemented here). Feature areas taken from the real codebase (`jobs`, `vhc`, `parts`, `notes`, `clocking`, `messages`, `hr`).

| Scenario | Regular-staff toast | Dev extra |
|---|---|---|
| Save note fails (`notes.js` catch) | ⚠️/✕ *"We couldn't save your note. Please try again."* (error, no auto-close) | endpoint `notes.update`, jobNumber, stack |
| Load job card fails (`[jobNumber].js`) | *"We couldn't load this job card. Refresh to try again."* + **Retry** action | endpoint, jobNumber, HTTP status |
| VHC media upload fails (`upload-media`) | *"We couldn't upload that photo. Check your connection and try again."* | endpoint `/api/vhc/upload-media`, file name, size |
| Parts goods-in save fails | *"We couldn't record that delivery. Please try again."* | endpoint, goodsInId |
| Permission denied (401/403) | *"You don't have permission to do that."* (warning) | required role, actual roles |
| Offline / fetch failed | *"You appear to be offline. Reconnect and try again."* (warning) | raw `TypeError`, URL |
| Validation error on form submit | *"Some details need attention before we can continue."* + focus first bad field | field-level errors payload |
| Background poll fails (e.g. badge counts) | **Silent** — no toast; log only. Do not nag for non-user-initiated failures. | logged with context |
| Success (save) | ✓ *"Note saved."* (success, auto-close 5s) | — |
| Unexpected render crash | Error-boundary panel: *"This section hit a problem."* + reset | component stack (dev only) |

**Design rule surfaced by these examples:** distinguish **user-initiated** failures (always surface) from **background** failures (log, surface only if they degrade the visible screen). This prevents toast spam from polling/websocket retries.

---

## 10. Phased Implementation Recommendations

Each phase is independently shippable and low-risk. Shared plumbing first; per-feature migration is incremental and can proceed in parallel once Phase 2 lands.

### Phase 0 — Audit & baseline (no code)
- Enumerate every `catch`/`console.error`/`window.alert` site and tag: user-initiated vs background, has-friendly-message vs raw. Produce a migration checklist (spreadsheet or `docs/` table).
- Confirm token/contrast readiness for tones.
- **Exit:** agreed catalogue of message keys (§3.2) + prioritised feature list.

### Phase 1 — Styling & a11y of the existing toast (self-contained)
- Move `TopbarAlerts` inline styles into the `.app-alert` / `.app-toast-stack` classes in `staffglobal.css` (§6). No behaviour change.
- Add live region, icons, reduced-motion, keyboard dismiss, pause-on-hover (§7, §4.1).
- Run `npm run check:borders`.
- **Exit:** visually identical (or better), design-system compliant, accessible. **Low blast radius — touches only `TopbarAlerts` + `staffglobal.css`.**

### Phase 2 — Helper layer + role-aware dev gating
- Add `errorMessages.js` catalogue (§3.2) and `reportError`/`reportSuccess`/`reportWarning`/`withErrorToast` (§5.1).
- Add a **client-side developer-role check** and gate the dev row in `TopbarAlerts` on it (§8.2).
- Make `type` explicit; downgrade `deriveTypeFromMessage` to fallback-only (§4.2).
- Add de-duplication in `AlertContext`/`alertBus` (§4.1).
- **Exit:** a one-line, correct way to report any error exists; diagnostics are role-aware.

### Phase 3 — API choke point
- Standardise `src/lib/api/client.js` to throw a typed `ApiError` (`status`, `friendlyKey`) and map failure shapes → friendly keys (§3.3). DB helpers under `src/lib/database/` surface errors consistently (they already `console.error`; wrap so callers can `reportError`).
- **Exit:** most network/DB errors auto-map to good messages with zero caller effort.

### Phase 4 — Feature migration (incremental, prioritised)
- Migrate high-traffic, high-value flows first, in this rough order (by `console.error` density + user impact): **job cards** (`[jobNumber].js` — 48 sites), **VHC** (`VhcDetailsPanel.js` — 37), **parts** (`PartsTab.js`, goods-in), **notes**, **clocking**, **messages**, **HR**.
- For each: replace silent `console.error` on user-initiated actions with `reportError`; add success toasts; verify with `/verify`.
- Track progress against the Phase 0 checklist.
- **Exit:** all user-initiated failures in migrated features surface a friendly message.

### Phase 5 — Error boundaries + hardening
- Ship shared `AppErrorBoundary` and wrap route/layout regions (**global change — confirm per `CLAUDE.md §7`**) (§5.2).
- Add "Dismiss all", overflow collapse polish, and background-vs-user-initiated policy enforcement (§9).
- **Exit:** no white-screens; toast stack can't pile up unboundedly.

### Phase 6 — Documentation & guardrails
- Add the authoring rules (§5.3) to `CLAUDE.md`.
- Optional lint/CI: flag new `window.alert(` in `src/` and `catch` blocks whose only body is `console.error` in page/component files (advisory).
- **Exit:** the pattern is the path of least resistance for future work.

---

## 11. Risks & Open Questions

1. **Global-change gates** — Phases 5 (error boundary in layout) and any `AlertContext`/`Layout` edits trip `CLAUDE.md §7`. Must stop-and-confirm before those.
2. **Role source for dev gating** — confirm which role group counts as "developer/diagnostic" (needs `roles.js` decision; don't hardcode).
3. **`window.alert` override** — the bus already hijacks `window.alert`. Migrating callers off it must not regress third-party/library code that expects native `alert`. Keep the fallback.
4. **Toast fatigue** — background/polling failures must stay silent (§9) or the stack becomes noise. Needs a clear user-initiated flag on `reportError`.
5. **Message translation** — catalogue keys make future i18n possible but this phase ships English only.
6. **Contrast** — verify every tone token pair meets AA before Phase 1 exit.

---

## 12. Acceptance Criteria (definition of done for the initiative)

- [ ] No product code path shows a raw stack/HTTP code/DB string as the **primary** user message.
- [ ] All user-initiated failures in migrated features surface a top-right toast with a plain-English sentence.
- [ ] `TopbarAlerts` uses `staffglobal.css` classes/tokens only; passes `npm run check:borders`.
- [ ] Toasts are screen-reader announced, keyboard-dismissable, not colour-only, respect reduced motion.
- [ ] Technical detail is visible/copyable only to developer/admin roles.
- [ ] A single documented helper (`reportError`) is the standard way to raise an error, referenced in `CLAUDE.md`.
- [ ] Background failures do not spam the toast stack.

---

## 13. Files This Initiative Will Touch (forecast)

| Phase | Files |
|---|---|
| 1 | `src/components/TopbarAlerts.js`, `src/styles/staffglobal.css` |
| 2 | `src/lib/notifications/alertBus.js`, `src/context/AlertContext.js`, `src/lib/notifications/buildErrorAlert.js`, **new** `src/lib/notifications/errorMessages.js`, **new** `src/lib/notifications/reportError.js`, `src/lib/auth/roles.js` (read), `src/context/UserContext.js` (read) |
| 3 | `src/lib/api/client.js`, `src/lib/database/*.js` (wrapping) |
| 4 | Per-feature: `src/pages/job-cards/[jobNumber].js`, `src/components/VHC/*`, `src/components/PartsTab.js`, `src/lib/database/notes.js` + `NotesTab.js`, clocking, messages, HR |
| 5 | **new** `src/components/AppErrorBoundary.js`, `src/components/layout/StaffLayout.js` *(global — confirm)* |
| 6 | `CLAUDE.md`, optional CI script under `tools/scripts/` |

---

*Planning document only. No application behaviour changes until each phase is approved and implemented per the `CLAUDE.md` pre-flight and output rules.*
