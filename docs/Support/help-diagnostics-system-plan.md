# Help & Diagnostics System — Phased Rollout Plan

> **Status:** Plan for implementation (hand-off to ChatGPT / implementer).
> **Author context:** Repo-aware plan generated from inspection of HNPSystem.
> **Read [CLAUDE.md](../../CLAUDE.md) in full before writing any code.** Every UI surface in this
> feature must obey the Layer/Border laws, token system, and DB/auth rules in that file.

---

## 0. Naming — avoid the collision

The repo already has a large **"Reporting" platform** (KPI/analytics — see `docs/Report System/` and
`src/lib/database/reporting/`). **Do not** call this feature "reports" or "reporting." Use a distinct
namespace throughout:

- Feature name: **Help & Diagnostics** (user-facing: "Help / Report a problem").
- Code namespace: `support` (DB table `support_reports`, lib `src/lib/support/`, API `src/pages/api/support/`).
- Dev viewer route: `/dev/support-reports`.

This keeps it cleanly separated from the existing reporting/KPI code and docs.

---

## 1. What we're building (one sentence)

A user-friendly **"?"** control in the app toolbar that opens a report-style popup where a user can
attach a screenshot and describe what happened, while the system **privately** captures a rich
developer-only diagnostic bundle (route, role, device, console errors, recent actions, failed
requests, component/code ownership, build/commit, feature flags, sanitised auth/session state) tied
to the exact code state — surfaced only to admins/devs in a dedicated viewer.

---

## 2. Repo assets we will reuse (do NOT rebuild these)

| Need | Existing asset | Path |
|---|---|---|
| Toolbar mount point | Right column of the topbar (presentational) | `src/components/layout/StaffTopbar.js` (right column ~lines 336–381) |
| App shell / state owner | StaffLayout (owns viewport, sidebar, mode state) | `src/components/layout/StaffLayout.js` |
| Modal base | `PopupModal` + `ModalPortal` (portal, backdrop, scroll-lock, z-index 9999) | `src/components/popups/popupStyleApi.js`, `src/components/popups/ModalPortal.js` |
| Form-popup reference | `NextActionPrompt` (button → form popup, local state, Esc) | `src/components/popups/NextActionPrompt.js` |
| Confirmation UI | `ConfirmationDialog` | `src/components/popups/ConfirmationDialog.js` |
| Toast / acknowledgement | `AlertContext` + `TopbarAlerts` (pub/sub, dismiss, copy-dev-info) | `src/context/AlertContext.js`, `src/components/TopbarAlerts.js` |
| Session + roles | `useUser()` → `{ user, roles, dbUserId, ... }` | `src/context/UserContext.js` |
| **Code ownership map** | `DEV_LAYOUT_SECTION_SOURCE_MAP` + `findDevLayoutSectionSources(key)` | `src/lib/dev-layout/sectionSourceMap.js` (data: `sectionSourceMap.generated.js`) |
| Stable element signature | `buildAuditKey` (route + sectionKey + DOM path + text hash) | `src/lib/dev-layout/auditTags.js` |
| Dev overlay context | `DevLayoutOverlayContext` / `DevLayoutOverlay` | `src/components/dev-layout-overlay/DevLayoutOverlay.js` |
| API wrapper | `createHandler({ allowedRoles, methods })` + `withRoleGuard` | `src/lib/api/createHandler.js`, `src/lib/auth/roleGuard.js` |
| DB clients | `supabaseService` (service-role, server) / `supabaseClient` (anon) | `src/lib/database/supabaseClient.js` |
| **Append-only audit** | `writeAuditLog(...)` — hash-chained, redacts passwords/NI/card numbers | `src/lib/audit/auditLog.js` |
| Storage pattern | `ensureBucket` + service-role upload, then metadata row | `src/lib/storage/storageService.js`, `vhcMediaBucketService.js` |
| Roles / dev gate | `DEV_FULL_ACCESS_ROLES`, `hasAnyRole`, `isAdminManagerRole` | `src/lib/auth/roles.js`, `roleGuard.js` |

**Key insight:** the `data-dev-section-key` / `sectionKey` convention already used across the app
gives us **code ownership for free** — resolve the nearest section key from the clicked/visible DOM
and look up the exact `file:line` via `findDevLayoutSectionSources`.

### Gaps to fill
- **No global error boundary** — only `job-cards/[jobNumber].js` and its UI file have `componentDidCatch`. Add an app-level boundary (Phase 4).
- **No commit/version env exposed** — app deploys on Vercel but `VERCEL_GIT_COMMIT_SHA` is not surfaced to the client yet (Phase 5).
- **No centralised logging** — logging is ad-hoc `console.error`. Add a thin client-side ring buffer, not a logging framework.
- **No external error tracking** (no Sentry). This feature is the in-house substitute.

---

## 3. Data model

All new tables follow repo conventions (`schemaReference.sql`): `snake_case`, UUID PK via
`gen_random_uuid()`, `created_at`/`updated_at` as `timestamp with time zone DEFAULT now()`, status as
`text` with a `CHECK` constraint, FKs named `{table}_{col}_fkey`.

### 3.1 `support_reports` (built in Phase 1 — see `src/lib/database/schema/support/000_support.sql`)
Columns: `id`, `title`, `description`, `category`, `screenshot_path`, `reporter_user_id`,
`reporter_username`, `reporter_roles[]`, `status`, `severity`, `assigned_to`, `route`, `section_key`,
`source_file`, `source_line`, `app_version`, `commit_sha`, `commit_ref`, `build_id`, `diagnostics`
(jsonb), `created_at`, `updated_at`. RLS enabled with **no permissive policies** — service-role only.

### 3.2 `support_report_comments` (triage thread — used from Phase 6, table created in Phase 1)

### 3.3 `diagnostics` JSONB shape (private — never shown to reporter)
```jsonc
{
  "captured_at": "…",
  "route": { "asPath": "…", "pathname": "…", "query": {…} },
  "code_ownership": { "section_key": "…", "file": "…", "line": 710 },
  "device": { "ua": "…", "platform": "…", "viewport": {"w":…,"h":…}, "dpr":…, "isMobile":…, "online":…, "lang":"en-GB" },
  "session": { "authStatus": "authenticated", "roles": ["…"], "dbUserId": 42, "isDevLogin": false },
  "feature_flags": { "NEXT_PUBLIC_DEV_AUTH_BYPASS": false, "presentationMode": false },
  "build": { "version":"…", "commit_sha":"…", "commit_ref":"…", "build_id":"…" },
  "console_errors": [ { "level":"error", "msg":"…", "ts":… } ],
  "failed_requests": [ { "method":"GET", "url":"…", "status":500, "ms":…, "ts":… } ],
  "recent_actions": [ { "type":"route_change", "from":"…", "to":"…", "ts":… } ],
  "unhandled_errors": [ { "message":"…", "stack":"…", "componentStack":"…", "ts":… } ]
}
```

> **Audit linkage:** status changes / assignment / viewing a private bundle call `writeAuditLog({ …, entityType:'support_report', … })`. No new audit table — reuse the hash-chained one.

---

## 4. Privacy & sanitisation rules (THE most important section)

The reporter must **never** see the diagnostics blob; the blob must **never** contain secrets/PII.

1. **Two-tier payload.** `userVisible` (title/description/category/screenshot) vs `diagnostics`
   (everything else), scrubbed both client- and server-side (defence in depth).
2. **Allowlist for session/flags.** Only copy `roles`, `dbUserId`, `authStatus`, `isDevLogin`, and
   explicitly-allowlisted `NEXT_PUBLIC_*` flags. Never tokens/cookies/secrets/`process.env`.
3. **Redaction pass** over every kept string: JWTs, Bearer headers, prefixed keys (`sk_`,
   `service_role`), emails (masked), NI numbers, card numbers, secret query params, Authorization.
   (Implemented in `src/lib/support/sanitise.js`.)
4. **Request bodies are NOT captured** — only method, scrubbed URL, status, duration.
5. **Screenshot is user-initiated only** — no silent capture; user previews + can redact before send.
6. **Server-side re-scrub on ingest**; reject payloads over the 256 KB cap.
7. **Storage isolation** — private `support-reports` bucket, short-TTL signed URLs for admins only.
8. **Retention** — add to `tools/scripts/run-retention.js` (Phase 7).
9. **RLS** — no permissive policies; all access via role-guarded API routes using the service-role key.

---

## 5. UI / UX flow

CLAUDE.md §3 compliant (LayerSurface/LayerTheme, no surface borders, tokens, responsive, 44px).
"?" control in `StaffTopbar.js` right column → `SupportReportModal` (built on `PopupModal`, modelled
on `NextActionPrompt`): category chooser → title/description → optional screenshot capture + redact →
transparency disclosure of *categories* sent → submit. Acknowledge via `AlertContext`. Diagnostics
snapshot is taken the moment the popup opens.

---

## 6. Diagnostic capture mechanics (client runtime) — **Phase 2**

A `SupportDiagnosticsProvider` mounted high in `_app.js` maintains capped ring buffers:
- Console errors/warns (patch, preserve originals, call through).
- Unhandled errors (`window` `error` / `unhandledrejection`).
- Failed requests (wrap `fetch`, non-2xx only; method/URL/status/ms; no bodies).
- Recent actions (router events + nearest `[data-dev-section-key]` on click).
- Device/session/flags read on demand; code ownership via `findDevLayoutSectionSources`.

Screenshot (Phase 3): prefer `getDisplayMedia`; cap dimensions/size.

---

## 6a. Diagnostic assistant + extension points — **(pre-Phase-5 intelligence pass)**

Two pure, node-testable layers sit on top of the Phase 2 capture so the popup can
reason about a snapshot, and so **future features can contribute diagnostics
without touching the popup or capture core**.

### Analysis engine — `src/lib/support/diagnosticAnalysis.js`
`analyseDiagnostics(snapshot)` (pure; reads only the already-sanitised snapshot,
so it adds **no new privacy surface**) returns:
- `incidents[]` — console errors / failed requests / render exceptions grouped by
  time-proximity (`INCIDENT_GAP_MS`) into one incident; each has a `trigger` (the
  earliest event), `cascade` flag (different errors followed the trigger), and
  `duplicateCount`.
- `primaryIncidentId` — most-severe / largest / most-recent incident.
- `duplicates[]` — identical-signature events seen more than once (signatures
  collapse digits/uuids so "the same error" groups).
- `probableCause` — `{ summary, confidence (0–0.95), evidence[] }`, a heuristic
  score from trigger kind + cascade + duplicates.
- `affected` — `{ page, pathname, route, sectionKey, component, codeOwnership }`
  (component name parsed from the first component stack in the incident).
- `timeline[]` — merged actions + errors in time order, with the single trigger
  flagged (`isTrigger`).
- `counts` — console/request/error/action totals.

`buildEnrichedDescription(snapshot, analysis?)` writes the popup's pre-filled
description (probable cause + confidence + affected + a marked-trigger timeline),
replacing the old bare action list. It is attached to every captured snapshot as
`snapshot.analysis` inside `captureDiagnostics()`.

### Extension registry — `src/lib/support/diagnosticRegistry.js`
The extension point for **any** feature to add its own diagnostics:

```js
import { registerDiagnosticProvider } from "@/lib/support/diagnosticRegistry";
registerDiagnosticProvider({
  id: "jobcard",            // unique; re-registering replaces
  label: "Job card state",
  devOnly: false,           // true → only collected when capture context isDev
  collect({ doc, win, store, snapshot, isDev }) {
    // MUST be synchronous, side-effect-free, defensive (never throw — a throw is
    // swallowed so one bad provider can't break a report), and return a plain
    // JSON-able object of NAMES/booleans, never secrets or raw user values.
    return { activeJobNumber: doc?.querySelector?.("[data-job-number]")?.textContent };
  },
});
```

At capture, `SupportReportContext` calls `collectProviderDiagnostics({ win, doc,
store, isDev })` and the results are merged into the snapshot under
`providers.<id>` (then sanitised with everything else). Built-ins live in
`src/lib/support/providers/` and register via `registerBuiltinDiagnosticProviders()`
on provider mount:
- **`ui-state`** — active tab, modal state, filter selections, and form-field
  *identity + filled boolean* (NEVER values). Excludes the support popup itself.
- **`dev-metadata`** (`devOnly`) — performance timing, memory pressure, network
  quality, repeated API failures, recent route churn.

**Privacy:** providers follow the "names/booleans, not values" rule; everything
they return is still run through the shared sanitiser, and the size cap + server
re-sanitisation apply unchanged.

---

## 7. Dev-only debug viewer — **Phase 6**

Role-gated `/dev/support-reports` (+ `[id]`) gated by `ProtectedRoute` + `DEV_FULL_ACCESS_ROLES`:
list with filters; detail with screenshot (signed URL), full diagnostics, clickable code-ownership
`file:line`, copy-dev-bundle, and triage actions (status/severity/assign/comment) — all audit-logged.

---

## 8. Repo-change / version tracking — **Phase 5**

Expose `NEXT_PUBLIC_COMMIT_SHA`/`_REF`/`APP_VERSION` + Next `buildId` via `next.config`; stamp every
report. Store `section_key` (durable) + resolved `file:line` (snapshot). Ensure the source-map
generator runs in build. Optionally store a content hash to detect drift.

---

## 9. Error boundaries — **Phase 4**

App-level boundary (modelled on the job-card one) that renders a friendly fallback, pushes
error+componentStack into the diagnostics buffer, and offers a pre-filled "Report this problem".

---

## 10. API & server logging — **Phase 3 (POST) + Phase 6 (admin)**

Routes under `src/pages/api/support/` via `createHandler`/`withRoleGuard`:
`POST /reports` (any auth user; re-sanitise + upload + audit), admin `GET /reports`, `GET /reports/[id]`
(+ signed URL), `PATCH /reports/[id]`. DB helper `src/lib/database/support.js` (Phase 1).
Sanitiser `src/lib/support/sanitise.js` (Phase 1). No new logging framework.

---

## 11. Audit trail & permissions

`writeAuditLog` for create / bundle-view / status-severity-assignee change / delete.
Permissions: any auth user submits; only `DEV_FULL_ACCESS_ROLES` view list/diagnostics + triage;
retention is a service-role job. Gate pages with `ProtectedRoute`, APIs with `withRoleGuard`.

---

## 12. Storage strategy — **Phase 1 done; upload wired in Phase 3**

Private `support-reports` bucket (`public:false`), path `{reportId}/screenshot-*.{ext}`, short-TTL
signed URLs, MIME + size validation. Implemented in `src/lib/storage/supportMediaBucketService.js`.

---

## 13. Performance impact

Capped ring buffers; thin fetch/console wrappers; screenshot user-initiated and capped; lazy-load the
modal; zero work when idle; no telemetry beaconing.

---

## 14. Testing approach

Vitest (`npm run test:unit`) for the sanitiser, buffers, code-ownership resolution, capture assembly,
build stamping, size-cap. Playwright (`npm run test`) for the submit flow, admin viewer gating, and a
**privacy regression test** asserting persisted rows contain none of the planted secrets. UI must pass
`check:borders` / `check:layers` / `uk:check`.

---

## 15. Phased rollout (implementation order)

1. **Foundation & data model** — ✅ done (SQL, sanitiser+tests, DB helper, private bucket).
2. **Capture runtime** — `SupportDiagnosticsProvider` + `SupportReportContext` + buffers + resolver.
3. **UI: "?" + popup + POST route.**
4. **Error boundaries.**
5. **Version / code-state pinning.**
6. **Dev viewer, triage & audit.**
7. **Hardening** (rate limit, retention, RLS review, E2E + privacy regression).

Each phase is independently shippable and leaves the app working.

---

## 16/17. Files (create / edit)

See the progress log ([help-diagnostics-progress.md](help-diagnostics-progress.md)) for the
authoritative, per-phase record of files created/edited and verification.

---

## 18. Hard constraints (do not violate)

- Obey **CLAUDE.md** in full: LayerSurface/LayerTheme, no surface borders, tokens only, responsive +
  44px, UK English. Run `check:borders`/`check:layers`/`uk:check`.
- No raw Supabase in pages/components — all queries in `src/lib/database/support.js`.
- Never expose service-role key, tokens, cookies, or non-allowlisted env to the client/bundle.
- No silent screen capture — screenshots are explicit, user-previewed, user-redactable.
- Reuse existing popup/alert/audit/storage/role infrastructure — no Sentry, no new logging framework.
- Flag any change to global files (`_app.js`, `Layout`, `Sidebar`, `Section`, `Card`, `theme.css`,
  `globals.css`, context providers, `next.config`) per CLAUDE.md §7 before proceeding.
