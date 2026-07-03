# Phase 3 — Core Helper Layer + Message Catalogue (Progress)

**Part of** the [Frontend Feedback & Error System rollout](frontend-feedback-system-rollout.md) · follows [Phase 2 toast a11y](frontend-feedback-phase2-toast-a11y.md).
**Goal (from rollout §Phase 3):** one line to report anything correctly — a keyed plain-English message catalogue plus a `reportError` / `reportSuccess` / `reportInfo` / `reportWarning` / `withErrorToast` helper layer, all passing **explicit** toast types, with the legacy `alertBus` inference downgraded to a fallback and safe toast de-duplication.
**Status:** ✅ Implemented.
**Last updated:** 2026-07-03.

---

## 1. What Phase 3 added

### 1.1 Message catalogue — `src/lib/notifications/errorMessages.js` (new)
- Four keyed catalogues of plain-English copy: `ERROR_MESSAGES`, `SUCCESS_MESSAGES`, `INFO_MESSAGES`, `WARNING_MESSAGES` (e.g. `SAVE_FAILED`, `LOAD_FAILED`, `NETWORK`, `PERMISSION`, `SAVED`, `SAVED_LOCALLY`).
- `resolveMessage(keyOrText, kind)` turns a known **key** into its friendly sentence and passes any **literal** string straight through — so migrating a call site is a drop-in (a key is encouraged but never required).
- Keys (not sentences) are the stable contract, leaving room for future i18n; English only ships today.
- No raw stack / HTTP / DB strings ever live here — technical detail stays in `devInfo`.

### 1.2 Helper layer — `src/lib/notifications/report.js` (new)
- **`reportError(msgOrKey, err?, context?)`** — resolves a friendly error message, then emits via `buildErrorAlert(...)`, so the toast carries `type:"error"` (explicit), `autoClose:false`, and full `devInfo` (unchanged builder). `context` is dev diagnostics (endpoint, ids…); pass `allowDuplicate:true` to bypass de-dup.
- **`reportSuccess` / `reportInfo` / `reportWarning`** `(msgOrKey, options?)` — emit success/info/warning toasts with an **explicit** `type`; `options` forwards `showAlert` fields (`duration`, `autoClose`, `devInfo`) and the optional `allowDuplicate`.
- **`withErrorToast(fn, opts?)`** — runs an async `fn`, reports a friendly error toast on throw (feeding the caught error into `devInfo`), optionally a success toast, and by default swallows the error returning `undefined` (`rethrow:true` to re-throw). `opts.context` may be an object or a function of the error. Collapses the ubiquitous `try/catch → alert(err.message)` into one line.
- Return value across all helpers: the alert **id**, or **`null`** when suppressed as a duplicate.

### 1.3 Explicit types; legacy inference downgraded to fallback-only
- Every new helper passes an explicit `type`, so tone no longer depends on the message text.
- `alertBus.showAlert`'s `type` argument default changed from `"info"` → `null`, so the priority chain is now **explicit `payload.type` → explicit `type` arg → `deriveTypeFromMessage` (fallback)**. Previously the `"info"` default masked inference entirely on the 2-arg path; now inference is a genuine last-resort for untyped/legacy callers (bare `window.alert`, which has no way to pass a type).
- `deriveTypeFromMessage` itself was **left intact** and annotated as legacy fallback-only — no caller wording was changed (this is not the P5/P10 call-site migration).

### 1.4 Safe toast de-duplication
- An identical `(type, message)` reported again within a **3.5s window** is suppressed (helper returns `null`), so a failing loop or a double-clicked action can't stack the same sentence repeatedly.
- Scoped to the **new helper layer only** — existing `showAlert` / `pushAlert` / `window.alert` callers are unaffected, and **distinct** messages are never suppressed.
- `allowDuplicate:true` is available for the rare intentional re-announce. (A visible "×N" counter would require a renderer/`AlertContext` change — a §7 global touch — so it was deliberately **not** done in P3; suppression is the safe subset.)

---

## 2. Files touched

| File | Change |
|---|---|
| `src/lib/notifications/errorMessages.js` | **New.** Keyed plain-English catalogues (error/success/info/warning) + `resolveMessage()`. |
| `src/lib/notifications/report.js` | **New.** `reportError` / `reportSuccess` / `reportInfo` / `reportWarning` / `withErrorToast`; window-based de-duplication. |
| `src/lib/notifications/alertBus.js` | `showAlert` `type` default `"info"` → `null` (explicit type now always wins; inference is a true fallback); comment on `deriveTypeFromMessage` marking it legacy fallback-only. **No wording/behaviour change for existing typed callers.** |
| `docs/frontend-feedback-phase3-helper-layer.md` | This progress note (new). |

**Files reviewed (not changed):** `src/lib/notifications/buildErrorAlert.js` (reused verbatim — still the `devInfo` builder), `src/context/AlertContext.js` (unchanged — the store; P3 does not touch it), `src/components/TopbarAlerts.js` (renderer; consumes explicit `type` already, no change needed), all `showAlert`/`pushAlert` call sites (confirmed every current caller passes an explicit `type` or a `buildErrorAlert(...)` payload, so the default-arg change is inert for them).

**DB schema checked?** No — this phase is a presentation/reporting helper layer; no data access involved.

**Scope:** Local to `src/lib/notifications/**` plus one **inert default-argument change** in `alertBus.js`. **No §7 global-context / layout / theme / shared-card files were modified** (in particular `AlertContext.js` was left untouched — the P2 timer move already lives there and needed no further change).

---

## 3. What was tested

- ✅ `npx eslint src/lib/notifications/report.js src/lib/notifications/errorMessages.js src/lib/notifications/alertBus.js` — clean, no warnings/errors.
- ✅ `npm run check:borders` — passes (no UI/CSS changed; helper layer is pure JS).
- ✅ Caller audit — grep for `showAlert(`/`pushAlert(` confirmed **no** current caller relies on the removed `"info"` default (every one passes an explicit `type` arg or a `buildErrorAlert(...)` payload), so changing the default arg is behaviourally inert for existing code.
- ✅ De-dup reasoning — signatures are pruned by age before each check, so a surviving signature is by definition inside the window; distinct `(type,message)` pairs are never collapsed.

**Not yet done (recommend before Phase 3 sign-off):**
- [ ] Manual smoke: from `/dev/user-diagnostic#toast` (or a scratch call), fire `reportError`/`reportSuccess`/`reportInfo`/`reportWarning` and confirm each shows the correct tone/icon and that a rapid duplicate is suppressed within ~3.5s.
- [ ] Confirm the **message-key catalogue targets** with the team (Phase 1 exit gate G) — the keys here are a first cut and should be ratified before the P10 sweep hard-codes them across features.

---

## 4. What should be done next (no later-phase work started here)

- **Phase 3 exit:** the standard reporting API now exists and is documented (this note + inline JSDoc). Remaining P3 gate: ratify the catalogue keys.
- **Phase 4 (next):** role-gate the `TopbarAlerts` "Copy for Dev" / `Dev info available` row on a client-side developer/diagnostic role derived from `UserContext` + `roles.js` (no hardcoded strings), and attach a short **reference code** to every error. **Not started here** — the dev row and `devInfo` pipeline were left exactly as Phase 2 left them so Phase 4 only needs to add the gate. The rollout's P4 decision (confirm the developer role group in `roles.js`) is still open.
- **Later (P5/P10):** migrate call sites off raw `error.message` and bespoke toasts onto these helpers — e.g. the goods-in bespoke `setToast` and the ~150 `alert(err.message)` sinks flagged in the [Phase 1 audit](frontend-feedback-audit-phase1.md). P3 deliberately built the layer without migrating callers, to keep this phase low-risk and independently shippable.

**Remaining risks / considerations (documented, not regressions):**
- The `alertBus` default-arg change is inert for **today's** callers but does mean any *future* untyped `showAlert("…")` call would infer its tone rather than defaulting to `info` — intended, and the reason new code should use the `report*` helpers instead.
- De-dup is a **fixed 3.5s window** with no visual counter; if a screen legitimately needs to re-announce identical copy inside that window it must pass `allowDuplicate:true`.
- Catalogue coverage is intentionally small (common cases only); P5/P10 will grow it as real call sites are migrated.

---

*Phase 3 only. Phase 4 (role-aware diagnostics) and later phases were not started or modified. Any later-phase work must re-run the CLAUDE.md pre-flight and stop-and-confirm on global changes.*
