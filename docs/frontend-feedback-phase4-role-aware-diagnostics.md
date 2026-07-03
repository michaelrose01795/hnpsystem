# Phase 4 — Role-aware Diagnostics + Error Reference Codes (Progress)

**Part of** the [Frontend Feedback & Error System rollout](frontend-feedback-system-rollout.md) · follows [Phase 3 helper layer](frontend-feedback-phase3-helper-layer.md).
**Goal (from rollout §Phase 4):** staff see friendly copy; developers see detail. A **client-side** diagnostic-role check (derived from `UserContext` + `roles.js`, no hardcoded strings) gates the `TopbarAlerts` dev row; every error carries a short **reference code** shown to everyone, with the full `devInfo` logged against that code for developer tracing.
**Status:** ✅ Implemented.
**Last updated:** 2026-07-03.

---

## 1. What Phase 4 added

### 1.1 Error reference codes — `src/lib/notifications/buildErrorAlert.js`
- Every error is now stamped with a short, human-quotable **reference code** (e.g. `ERR-K3F9Q2`) via a new `generateReferenceCode()` (time-seeded base36 + a rolling counter, so two errors in the same millisecond still differ).
- The code is embedded at the top of `devInfo` (`Reference: ERR-…`) **and** returned as `referenceCode` on the payload, so the renderer can show it independently of the technical detail.
- `buildErrorAlert` stays a pure builder — no side effects; it only mints + returns the code. All existing direct callers (VHC upload flows, `DocumentsUploadPopup`) get a reference code for free because they spread the payload into `showAlert`.

### 1.2 Diagnostic-role gate — `src/lib/auth/roles.js`
- New **`canViewDiagnostics(userRoles)`** — the single source of truth for "who may see/copy technical `devInfo`". It delegates to the existing `hasDevPlatformAccess()` (the purpose-built `dev` Developer Platform role, `DEV_PLATFORM_ROLES`), so **no hardcoded role string** lives at the call site and the gate can be widened in one place if an approved diagnostic group is later ratified.
- **Role decision used (rollout P4 open gate → now resolved):** diagnostics are gated on the strict `dev` Developer Platform role — the same isolated role that already gates the Support Centre (Phase 8). It is deliberately **not** part of `DEV_FULL_ACCESS_ROLES`/`roleCategories`, so presentation-mode and normal staff (including managers/admins) see only the friendly message + reference code, never raw `devInfo`.

### 1.3 Renderer gating — `src/components/TopbarAlerts.js`
- `TopbarAlerts` reads the current user from `UserContext` (guarded: `useUser()?.user`, since the provider can be absent on some shells) and computes `showDiagnostics = canViewDiagnostics(user?.roles)` **once**, passing it down to each `ToastItem`.
- The **reference-code row** renders for **every** user whenever `alert.referenceCode` is present ("Reference code: `ERR-…`", selectable in one drag).
- The **dev row** ("Dev info available" / "Copy for Dev") now renders **only** when `showDiagnostics` is true. `devInfo` is still always *built* and carried on the alert — it is just no longer *shown* to non-diagnostic roles.

### 1.4 Developer trace log — `src/lib/notifications/diagnosticsLog.js` (new)
- `logDiagnostic({ referenceCode, message, devInfo })` records each reported error's full `devInfo` against its reference code in a bounded (50-entry) in-memory ring buffer, and `console.debug`s it so a developer can always retrieve detail by code even though the toast row is hidden for staff.
- `getDiagnostic(code)` / `getRecentDiagnostics()` read it back, and a `window.__HNP_DIAGNOSTICS__` bridge (`.get(code)`, `.recent()`) lets a developer pull the full detail for a **staff-quoted code** straight from dev tools.
- Wired into **`reportError`** (`src/lib/notifications/report.js`): after `buildErrorAlert`, it logs `{ referenceCode, message, devInfo }` before emitting. (A de-dup-suppressed duplicate is not re-logged — same error, already captured.)

### 1.5 Reference-code passthrough — `src/lib/notifications/alertBus.js`
- `showAlert` now copies `referenceCode` (from the payload, or `options`) onto the emitted alert object so the renderer can read it. Purely additive — untouched for callers that don't set it (`referenceCode: null`).

---

## 2. Files touched

| File | Change |
|---|---|
| `src/lib/notifications/buildErrorAlert.js` | Adds `generateReferenceCode()`; stamps every error with a `referenceCode` (in `devInfo` header + on the payload). |
| `src/lib/notifications/diagnosticsLog.js` | **New.** In-memory ring buffer keyed by reference code + `console.debug` trace + `window.__HNP_DIAGNOSTICS__` dev-tools bridge. |
| `src/lib/notifications/report.js` | `reportError` now logs `{ referenceCode, message, devInfo }` via `logDiagnostic` before emitting. |
| `src/lib/notifications/alertBus.js` | `showAlert` passes `referenceCode` through onto the alert object (additive; `null` when unset). |
| `src/lib/auth/roles.js` | New `canViewDiagnostics(userRoles)` delegating to `hasDevPlatformAccess()` (no hardcoded strings). |
| `src/components/TopbarAlerts.js` | Reads roles from `UserContext`, computes `showDiagnostics`, gates the dev row on it, and always renders the reference-code row. |
| `src/styles/staffglobal.css` | Adds `.app-alert__ref` / `.app-alert__ref-code` styling (sibling of the existing toast rules); updates the dev-row comment. |
| `docs/frontend-feedback-phase4-role-aware-diagnostics.md` | This progress note (new). |

**Files reviewed (not changed):** `src/context/UserContext.js` (consumed via `useUser()` only — **not** modified, so no §7 global-context touch), `src/context/AlertContext.js` (the store; unchanged), `src/lib/notifications/errorMessages.js` (unchanged), the direct `buildErrorAlert` callers `src/components/VHC/MediaUploadConfirmModal.js` / `FullScreenCapture.js` / `CustomerVideoButton.js` and `src/components/popups/DocumentsUploadPopup.js` (confirmed they spread the payload into `showAlert`, so they inherit reference codes and role-gated dev rows with no edit).

**DB schema checked?** No — Phase 4 is a presentation/diagnostics layer (role gating + client-side trace log). No data access.

**Scope:** Local to `src/lib/notifications/**`, `src/components/TopbarAlerts.js`, one helper in `src/lib/auth/roles.js`, and a scoped CSS block in `staffglobal.css`. **No §7 stop-and-confirm files were modified** — in particular `UserContext.js` and `AlertContext.js` were only *consumed*, not changed, and `theme.css`/`globals.css`/`Layout`/`Sidebar`/`Card` were untouched.

---

## 3. What was tested

- ✅ `npx eslint` on all six changed JS files (`buildErrorAlert`, `diagnosticsLog`, `report`, `alertBus`, `roles`, `TopbarAlerts`) — clean, no warnings/errors.
- ✅ `npm run check:borders` — passes (the new `.app-alert__ref` rules add no borders; only text/opacity/`user-select`).
- ✅ Role-gate reasoning — `canViewDiagnostics` normalises via `hasAnyRole` (lower-cases both sides), so the uppercase `DEV` role minted by dev-login matches `dev`; managers/admins and presentation demo users (who carry `DEV_FULL_ACCESS_ROLES`, not `dev`) correctly fail the gate.
- ✅ Passthrough audit — `referenceCode` is additive on `showAlert`; existing typed callers that never set it emit `referenceCode: null` and render no ref row, so behaviour is unchanged for non-error toasts.

**Not yet done (recommend before Phase 4 sign-off):**
- [ ] Manual smoke: as a **non-diagnostic** user, fire `reportError(...)` and confirm the toast shows the friendly message + reference code but **no** "Copy for Dev" row; then as a **`dev`** login confirm the dev row returns and the copied `devInfo` contains the matching `Reference:` line.
- [ ] Confirm in dev tools that `window.__HNP_DIAGNOSTICS__.get("ERR-…")` returns the full `devInfo` for a staff-quoted code.
- [ ] Ratify with the team that the strict `dev` role is the intended diagnostic gate (vs a wider "approved diagnostic" group) — the decision is centralised in `canViewDiagnostics`, so widening is a one-line change.

---

## 4. What should be done next (no later-phase work started here)

- **Phase 4 exit (met):** technical detail is role-gated (dev row hidden for non-diagnostic staff) and every error is traceable by code (shown to staff, logged against `devInfo` for developers). Remaining P4 gate: ratify the diagnostic role choice above.
- **Phase 5 (next — NOT started):** the API/DB choke point — a typed `ApiError` from `src/lib/api/client.js`, failure-shape → friendly-key mapping, and wrapping `src/lib/database/*` helpers so callers `reportError` consistently. Deliberately untouched here to keep Phase 4 low-risk and independently shippable.

**Remaining risks / considerations (documented, not regressions):**
- The trace log is **client-side and in-memory** (bounded to 50 entries, cleared on reload) — a live tracing aid, not persistence/audit. A durable sink (server log keyed by reference code) is a future concern, not part of P4.
- The gate is **strict `dev`**: no manager/admin sees `devInfo`. If support workflows need a wider "diagnostic" audience, widen `canViewDiagnostics` (single edit) once the role group is ratified.
- A de-dup-suppressed duplicate error is **not** re-logged (same message inside the 3.5s window) — intended; the first occurrence already carries the reference code and log entry.
- Reference codes are **display/correlation identifiers**, not secrets and not guaranteed globally unique across sessions — they exist to tie a staff-quoted code to a local trace entry, nothing more.

---

*Phase 4 only. Phase 5 (API/DB choke point) and later phases were not started or modified. Any later-phase work must re-run the CLAUDE.md pre-flight and stop-and-confirm on global changes.*
