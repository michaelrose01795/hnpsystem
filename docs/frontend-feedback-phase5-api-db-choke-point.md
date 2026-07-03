# Phase 5 — API/DB Choke Point (Typed `ApiError` + Friendly-Key Mapping) (Progress)

**Part of** the [Frontend Feedback & Error System rollout](frontend-feedback-system-rollout.md) · follows [Phase 4 role-aware diagnostics](frontend-feedback-phase4-role-aware-diagnostics.md).
**Goal (from rollout §Phase 5):** standardise `src/lib/api/client.js` to throw a typed `ApiError` (`status`, `code`, `friendlyKey`); map failure shapes (network / permission / timeout / validation / server / not-found) → friendly keys; give the database layer a matching choke point so callers can `reportError` consistently. **Exit:** callers rarely need to hand-write a message.
**Status:** ✅ Implemented (infrastructure + API client wired; per-helper/feature migration deliberately deferred).
**Last updated:** 2026-07-03.

---

## 1. What Phase 5 added

### 1.1 Typed error + mappers — `src/lib/api/apiError.js` (new)
- **`class ApiError extends Error`** with `{ status, code, friendlyKey, payload, context, cause }`. Because it extends `Error`, every existing `catch (err)` that reads `err.message` / `err.status` / `err.payload` keeps working unchanged — `code` and `friendlyKey` are purely additive.
- **`friendlyKey`** is a catalogue key from [errorMessages.js](../src/lib/notifications/errorMessages.js) (`NETWORK`, `PERMISSION`, `TIMEOUT`, `VALIDATION`, `NOT_FOUND`, `SERVER`, `GENERIC`) — kept as plain strings (`FRIENDLY_KEYS`) to avoid a notifications ↔ api import coupling; every value exists in the catalogue.
- **Failure-shape mappers:**
  - `friendlyKeyForStatus(status)` — 401/403→PERMISSION, 404→NOT_FOUND, 408/504→TIMEOUT, 400/409/422→VALIDATION, ≥500→SERVER.
  - `friendlyKeyForSupabase(err, status)` — Postgres/PostgREST codes → tone (`42501`/`PGRST301`→PERMISSION, `PGRST116`→NOT_FOUND, `23505`/`23503`/`23502`/`23514`/`22P02`→VALIDATION, `57014`→TIMEOUT), else status/SERVER.
  - `friendlyKeyForError(err)` — network (`TypeError: Failed to fetch`)→NETWORK, abort/timeout→TIMEOUT, `.status`→status map, Supabase `.code`→code map, else GENERIC.
- **Builders:** `apiErrorFromResponse(response, payload)` (HTTP), `apiErrorFromSupabase(supabaseError, context)` (the **DB choke point**), and `toApiError(error, context)` — an **idempotent** normaliser (already-`ApiError` passes through, merging extra context; raw values are wrapped while preserving message/status/payload).

### 1.2 API client throws typed errors — `src/lib/api/client.js`
- Non-ok responses now `throw apiErrorFromResponse(response, payload)` instead of a bare `Error`. **The message, `.status`, and `.payload` are byte-for-byte the same as before** — only `code` + `friendlyKey` are added.
- `fetch` itself is now wrapped: a network drop / abort is normalised via `toApiError(networkError, { url, method })` (friendlyKey `NETWORK`/`TIMEOUT`) rather than propagating a raw `TypeError`. The original message is preserved.

### 1.3 Phase 3 helper gains the one-liner — `src/lib/notifications/report.js`
- **`reportApiError(err, context?)`** — reads the friendly key the choke point already derived (`err.friendlyKey`, falling back to `friendlyKeyForError(err)`) and delegates to `reportError(friendlyKey, err, context)`. The visible toast is the plain-English catalogue sentence; the raw `error.message` is **never** shown (it still flows into `devInfo` + the Phase 4 diagnostics log). This is the intended Phase 5 call site:

  ```js
  try { await apiRequest("/api/notes", { method: "POST", body }); }
  catch (err) { reportApiError(err, { endpoint: "notes.update", jobNumber }); }
  ```

---

## 2. Files touched

| File | Change |
|---|---|
| `src/lib/api/apiError.js` | **New.** `ApiError` class + `FRIENDLY_KEYS` + shape mappers (`friendlyKeyForStatus/Supabase/Error`) + builders (`apiErrorFromResponse`, `apiErrorFromSupabase`, `toApiError`). |
| `src/lib/api/client.js` | `apiRequest` now throws a typed `ApiError` on non-ok responses and normalises network/abort failures — message/`.status`/`.payload` preserved. |
| `src/lib/notifications/report.js` | Adds `reportApiError(err, context?)` — friendly-key-driven reporting with no hand-written message and no raw `error.message` exposure. |
| `docs/frontend-feedback-phase5-api-db-choke-point.md` | This progress note (new). |

**Files reviewed (not changed):** `src/lib/database/*.js` helpers (confirmed the `supabase.from().{ data, error }` pattern — they inspect `.error` rather than throw, so `apiErrorFromSupabase` is available for **incremental** adoption without editing any helper now), `src/lib/api/messages.js` and `src/lib/database/tracking.js` (representative `apiRequest` consumers — none read a field the change removes), `src/lib/notifications/errorMessages.js` (confirmed all friendly keys resolve), `src/lib/notifications/buildErrorAlert.js` + Phase 4 `diagnosticsLog.js` (reused verbatim by `reportError`).

**DB schema checked?** Not applicable in the column/table sense — Phase 5 maps **Postgres/PostgREST error codes** (RLS `42501`, `PGRST116`, unique/FK violations, statement-timeout `57014`), not data. No query/column names were added or changed.

**Scope:** Local to `src/lib/api/**` + one additive helper in `src/lib/notifications/report.js`. **No §7 stop-and-confirm files were modified** (no `theme.css`/`globals.css`/`Layout`/`Sidebar`/`Card`/context). No feature/page/component files were migrated.

---

## 3. What was tested

- ✅ `npx eslint src/lib/api/apiError.js src/lib/api/client.js src/lib/notifications/report.js` — clean (exit 0).
- ✅ `npm run check:borders` — passes (no UI/CSS touched).
- ✅ **Mapping smoke (14/14 pass)** — ran `apiError.js` as an ES module against asserted cases: network→NETWORK, abort→TIMEOUT, 403→PERMISSION, 404→NOT_FOUND, 400→VALIDATION, 500→SERVER, Supabase `42501`→PERMISSION / `PGRST116`→NOT_FOUND / `23505`→VALIDATION / unknown→SERVER / `null`→`null`, `toApiError` idempotency + context merge, and **backward-compat**: the 500 case preserved `.status===500`, `.payload.message`, `.message`, and `instanceof Error`.

**Not yet done (recommend before Phase 5 sign-off):**
- [ ] Manual smoke: force a real 403 and an offline `apiRequest` and confirm `reportApiError(err)` shows *"You don't have permission…"* / *"You appear to be offline…"* with the raw detail only in the (role-gated) dev row.
- [ ] Adopt `apiErrorFromSupabase` in **one** high-traffic DB helper as a reference implementation before the broader migration (Phase 6/feature work), to validate the DB choke point end-to-end.

---

## 4. Compatibility notes

- **Backward compatible throw shape.** `ApiError extends Error` and preserves `message`, `status`, and `payload`. The only observable change for existing `apiRequest` callers is that a **network/abort** failure now arrives as an `ApiError` (still `instanceof Error`, same message) instead of a raw `TypeError` — no reviewed caller branches on the error's constructor/`name`.
- **No behaviour change for non-error paths.** Success responses return the parsed payload exactly as before.
- **DB layer is opt-in.** `apiErrorFromSupabase` is provided but **no** existing `src/lib/database/*` helper was rewritten — this keeps Phase 5 low-risk and avoids the broad feature migration explicitly out of scope. Helpers can adopt it one at a time later.
- **Friendly keys are contract, copy is not.** Mappers emit catalogue **keys**; the English sentences live in `errorMessages.js`, leaving room for the future i18n noted in Phase 3.

---

## 5. What should be done next (no later-phase work started here)

- **Phase 5 exit (met at the infrastructure level):** the API client emits typed, friendly-keyed errors and a DB choke point exists; `reportApiError` means an API caller writes one line with no hand-written message. Remaining gate: adopt the DB mapper in at least one helper (above) and spot-check live.
- **Phase 6 (next — NOT started):** loading-state standardisation — one shared loading primitive (skeleton + inline spinner) and a button-busy pattern. **Flag:** if a new shared component lands, that may be a `CLAUDE.md §7` shared-component change — confirm before implementing. Deliberately untouched here.

**Remaining risks / considerations (documented, not regressions):**
- **Mapping coverage is a first cut.** The Postgres/PostgREST code table is the common set; unmapped codes fall back to `SERVER`/`GENERIC` (safe, if generic). Grow it as real failures surface during migration.
- **Network detection is string-based.** `isNetworkError` matches known `fetch`-failure messages across browsers; an exotic engine wording would fall through to `GENERIC` rather than `NETWORK` (still a friendly sentence, just less specific).
- **`context` on a pass-through `ApiError` is mutated** by `toApiError` (merge) — intentional so a re-report can enrich diagnostics, but callers should treat a caught `ApiError` as owned, not shared.
- **DB choke point is unused until adopted.** Until a helper calls `apiErrorFromSupabase`, database failures still surface however that helper currently does — Phase 5 makes the tool available, it does not retrofit callers.

---

*Phase 5 only. Phase 6 (loading-state standardisation) and later phases were not started or modified. Any later-phase work must re-run the CLAUDE.md pre-flight and stop-and-confirm on global changes.*
