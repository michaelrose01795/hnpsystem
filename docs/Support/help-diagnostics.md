# Help & Diagnostics — Living Handoff (Plan · Progress · ChatGPT Handoff)

> **This is the single source of truth for the Help & Diagnostics ("support") feature.**
> It replaces the former two-file split (`help-diagnostics-system-plan.md` +
> `help-diagnostics-progress.md`). There is now **one** living document: the full plan, the
> phase table, the changelog, manual actions, deviations, next-phase guidance and the standing
> ChatGPT handoff prompt all live here. **Read [CLAUDE.md](../../CLAUDE.md) in full before
> writing any code.** Every UI surface in this feature must obey the Layer/Border laws, token
> system, and DB/auth rules in that file.

### The ritual (run every phase — update THIS file only)

1. Implement the current phase.
2. Update, **in this file**: the [Phase status](#phase-status) table, append a [Changelog](#changelog)
   entry (files created/edited, verification, deviations, manual actions, audit notes), and refresh
   [Next-phase guidance](#next-phase-guidance).
3. Paste the [Standing handoff prompt](#standing-handoff-prompt) into ChatGPT, attaching **this one
   file** (`docs/Support/help-diagnostics.md`).
4. ChatGPT returns a gap audit + the next ready-to-copy implementation prompt.
5. Repeat. **Never** re-create the old plan/progress split — future phase updates append here only.

---

# PART A — Feature plan

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
Columns: `id`, `title`, `description`, `category`, `screenshot_path`, `screenshot_paths` (text[]),
`reporter_user_id`, `reporter_username`, `reporter_roles[]`, `status`, `severity`, `assigned_to`,
`route`, `section_key`, `source_file`, `source_line`, `app_version`, `commit_sha`, `commit_ref`,
`build_id`, `diagnostics` (jsonb), `created_at`, `updated_at`. RLS enabled with **no permissive
policies** — service-role only.

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
  "unhandled_errors": [ { "message":"…", "stack":"…", "componentStack":"…", "ts":… } ],
  "providers": { "<id>": {…} },
  "analysis": {…},
  "attachments": [ { "order":0, "hash":"…", "annotation":"…" } ],
  "investigation": {…},
  "fingerprint": "…"
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

## 6b. Investigation engine (developer-only) — **(pre-Phase-5 investigation pass)**

A senior-developer-style investigation built on top of the analysis engine. It is
**developer-only**: it is computed **server-side at report ingest** and stored
**inside the RLS-locked `diagnostics` blob** (never returned to reporters, never
shown in the reporter popup). It reads only already-sanitised data, so it adds no
new privacy surface.

### `src/lib/support/investigation.js` — `buildInvestigation(snapshot, opts)`
Deterministic (inject `now`); returns:
- `explanation` — plain-English "what most likely happened".
- `sequence` — the exact ordered events (analysis timeline) with the trigger flagged.
- `rootCauses[]` — candidate causes ranked by confidence (probable cause + each
  5xx/network request + each render error), de-duplicated.
- `incident` — the primary grouped incident (from the analysis engine).
- `ownership` — `{ primary: "api"|"frontend", api[], database[], frontend[] }`
  (API routes from failed requests; DB tables guessed from `/api/<resource>`).
- `severity` (critical/high/medium/low), `priority` (P1–P4), `userImpact`,
  `regressionRisk`, `fixComplexity` (trivial/small/medium/large),
  `reproducibleConfidence` (0–0.95), `affectedModules[]`.
- `debuggingOrder[]`, `inspectFirst { files, components, apiRoutes, dbTables }`.
- `similarIncidents[]` + `repeatedFailures` (via clustering, below).
- `manualTests[]`, `regressionTests[]` — recommended tests to add after the fix.
- `summary` — a GitHub / issue-tracker-ready markdown block.
- `fingerprint` — the incident fingerprint (also stored at `diagnostics.fingerprint`).
- `providers` — fragments from investigation providers (below).

### `src/lib/support/incidentClustering.js` — multi-signal duplicate detection
Clusters incidents across **route, section, component, error signatures, request
signatures, screenshot hashes, and behaviour** — not just description text.
`buildFingerprint(snapshot)`, `similarity(a,b)` (weighted, with reasons),
`findSimilarReports(fp, priorReports)`, `repeatedFailures(fp, priorReports)`, and
`stableHash` (djb2). Screenshot hashes come from `diagnostics.attachments[].hash`
(computed server-side from the image bytes in `reportSubmission`).

### `src/lib/support/investigationRegistry.js` — investigation extension point
Separate from the diagnostic registry. Any module registers an **investigation
provider** to enrich investigations without touching the support core:

```js
import { registerInvestigationProvider } from "@/lib/support/investigationRegistry";
registerInvestigationProvider({
  id: "jobcard",
  investigate({ snapshot, analysis, priorReports, fingerprint, affected }) {
    // synchronous, defensive (never throw), JSON-able, dev hints only.
    return { suggestedTables: ["job_cards"], notes: ["Check status transitions"] };
  },
});
```
Fragments appear under `investigation.providers.<id>`.

### `src/lib/support/investigationCache.js` — avoid duplicate analysis
`investigationKey(snapshot, priorReports)` (stable hash) + `getOrBuildInvestigation`
memoise results (bounded LRU-ish store); the key changes when the diagnostics OR
the prior-report set changes, so new similar incidents invalidate stale results.

### Ingest wiring
`POST /api/support/reports` fetches `listRecentReportFingerprints(50)` (selects only
the JSON `fingerprint` subfield — never full diagnostics), builds the investigation
via the cache, and embeds `investigation` + `fingerprint` into the diagnostics blob
**only if still within the 256 KB cap** (else the report is saved without it). The
POST response never includes the investigation.

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

## 16. Hard constraints (do not violate)

- Obey **CLAUDE.md** in full: LayerSurface/LayerTheme, no surface borders, tokens only, responsive +
  44px, UK English. Run `check:borders`/`check:layers`/`uk:check`.
- No raw Supabase in pages/components — all queries in `src/lib/database/support.js`.
- Never expose service-role key, tokens, cookies, or non-allowlisted env to the client/bundle.
- No silent screen capture — screenshots are explicit, user-previewed, user-redactable.
- Reuse existing popup/alert/audit/storage/role infrastructure — no Sentry, no new logging framework.
- Flag any change to global files (`_app.js`, `Layout`, `Sidebar`, `Section`, `Card`, `theme.css`,
  `globals.css`, context providers, `next.config`) per CLAUDE.md §7 before proceeding.

---

# PART B — Progress

## Phase status

| Phase | Title | Status | Notes |
|---|---|---|---|
| 1 | Foundation & data model | ✅ Done | SQL migration, sanitiser (+tests), DB helper, private storage bucket. |
| 2 | Capture runtime | ✅ Done | Capture lib + context provider + tests done. `_app.js` provider mount applied (flagged + approved). |
| 3 | UI: "?" control + popup + POST route | ✅ Done | Text-only "?" in StaffTopbar, lazy modal, screenshot capture+redact, authenticated POST route, audit log. |
| 4 | Error boundaries | ✅ Done | App-wide `SupportErrorBoundary` (shell-mounted, flagged + approved), render-error + recovery-timeline capture, recovery screen (retry / reload / pre-filled report), reusable for nested boundaries. |
| — | Popup polish (pre-Phase 5) | ✅ Done | Canonical `DropdownField`, auto-filled description, local draft persistence, multi-screenshot gallery + annotations. |
| — | Diagnostic assistant + extensions (pre-Phase 5) | ✅ Done | Analysis engine, diagnostic provider registry + built-ins, assistant panel in popup. |
| — | Investigation engine (pre-Phase 5) | ✅ Done | Developer-only server-side investigation, multi-signal clustering, investigation registry + cache, ingest wiring. |
| 5 | Version / code-state pinning | ⏳ Next | Needs `next.config` env exposure (flagged global). **Do not start until this doc consolidation is complete.** |
| 6 | Dev viewer, triage & audit | ⬜ Pending | |
| 7 | Hardening (rate limit, retention, RLS review, E2E) | ⬜ Pending | |

---

## Manual actions outstanding

- **Apply the support migration in Supabase.** Run `src/lib/database/schema/support/000_support.sql`
  in the Supabase SQL editor (repo applies SQL manually; no auto-runner). It is idempotent and now
  also adds the `screenshot_paths text[]` column via `ALTER TABLE … ADD COLUMN IF NOT EXISTS` — safe
  to re-run. The private `support-reports` bucket is auto-ensured on first upload, but the table
  itself is created only by this migration.

---

## Changelog

### Phase 1 — Foundation & data model (complete)

**Created**
- `src/lib/database/schema/support/000_support.sql` — idempotent migration: `support_reports` +
  `support_report_comments`; **RLS enabled, no permissive policies** (service-role-only access so
  the private `diagnostics` blob can never reach a client key).
- `src/lib/support/sanitise.js` — single-source-of-truth privacy scrubber (pure, client+server):
  key-name redaction, value-pattern scrubbing (JWT/Bearer/Stripe-key/NINO/card/email), secret
  query-param stripping, 256 KB size cap.
- `src/lib/support/sanitise.test.js` — 15 Vitest cases (all passing).
- `src/lib/database/support.js` — CRUD helper (`createSupportReport`, `setSupportReportScreenshot`,
  `listSupportReports`, `getSupportReport`, `updateSupportReport`); re-sanitises + size-caps
  server-side; prefers service-role client.
- `src/lib/storage/supportMediaBucketService.js` — **private** bucket (`public:false`), short-TTL
  signed URLs for admins, MIME + size validation.

**Edited**
- `src/lib/database/schema/schemaReference.sql` — mirrored canonical table defs.

**Verification**
- `npx vitest run src/lib/support/sanitise.test.js` → 15/15 pass.
- `npx eslint` on all new files → 0 errors, 0 warnings.

**Manual action outstanding**
- Apply `src/lib/database/schema/support/000_support.sql` in the Supabase SQL editor (repo applies
  SQL manually; no auto-runner).

**Deviations from plan**
- None. Comments table created early (plan put it in Phase 6) so the FK is stable — harmless, RLS-locked.

**Audit notes**
- No audit writes yet (create is wired in Phase 3). RLS-with-no-policies confirmed as the sole
  access gate for the private blob.

---

### Phase 2 — Capture runtime (complete; `_app.js` mount flagged + approved)

**Created**
- `src/lib/support/diagnostics.js` — pure, dependency-injected capture core: `createRingBuffer`,
  `createDiagnosticsStore`, `recordConsole/recordError/recordFailedRequest/recordAction` (each scrubs
  at record time via the shared sanitiser), `resolveCodeOwnership` (via `findDevLayoutSectionSources`),
  `snapshotDevice`, `captureDiagnostics` (assembles + re-sanitises + applies session/flag allowlists),
  and `installBrowserCapture` (the only browser-touching part: console patch, `window` error/rejection
  listeners, `fetch` wrap for non-2xx/no-body, click→nearest `data-dev-section-key`). All wrappers
  **call through** to existing handlers so they coexist with the console/fetch/nav diagnostics already
  in `_app.js`, and restore only if not re-patched on top.
- `src/context/SupportReportContext.js` — `SupportDiagnosticsProvider` + `useSupportReport()`:
  owns one store for its lifetime, installs capture on mount, records `route_change` actions via
  `router.events`, and exposes `openSupportReport()` / `closeSupportReport()` / `captureDiagnostics()`
  / `isOpen` / `prefill` / `snapshot`. Reads session via `useUser` + `useSession`; flags via
  `isPresentationMode()` + `NEXT_PUBLIC_*`. No UI yet (Phase 3 consumes the open state).
- `src/lib/support/diagnostics.test.js` — 15 Vitest cases (buffers/cap, record scrubbing, URL
  reduction, action labels, code-ownership resolution against the real generated map, capture
  assembly + allowlist enforcement + no-secret-leak, device snapshot injection).

**Edited**
- `src/pages/_app.js` — **flagged global change, approved and applied**: added the
  `SupportDiagnosticsProvider` import and wrapped `<AppWrapper>` with it inside `<RosterProvider>`
  (sits under Session + User providers). Additive; SSR-safe; capture wrappers call through to existing
  handlers. Capture is now live app-wide (still no visible UI until Phase 3).

**Verification**
- `npx vitest run src/lib/support/` → 29/29 pass (Phase 1 + Phase 2).
- `npx eslint` on the new files and `_app.js` → 0 errors, 0 warnings.

**Deviations from plan**
- Capture core is split into a pure lib (`diagnostics.js`) + a thin React provider so the logic is
  node-testable without jsdom. Plan implied one provider file; this is a cleaner, behaviour-identical split.
- Docs relocated to `docs/Support/` per user request; user scratchpad `docs/Support/1st` left untouched.

**Audit notes**
- None (capture is client-side and writes no rows).

---

### Phase 3 — UI: "?" control + popup + POST route (complete)

**Created**
- `src/lib/support/reportSubmission.js` — pure, server-side submit helpers (no I/O,
  no next-auth) so the route boundary is unit-testable: `SUPPORT_CATEGORIES`
  catalogue (value+label), `buildReportInsert({ body, session })` (validates,
  **re-sanitises diagnostics server-side**, enforces the size cap, takes reporter
  identity from the **session not the client**, derives `route`/`section_key`/
  `source_file`/`source_line`/`app_version`/commit columns from the sanitised
  blob), and `decodeScreenshot(dataUrl)` (validates image MIME + size cap, returns
  an upload buffer or `file:null`).
- `src/lib/support/reportSubmission.test.js` — 16 Vitest cases: validation,
  identity-from-session (ignores attacker-supplied reporter fields), **secret
  redaction of a planted JWT / Stripe key / password / token query-param**, column
  derivation, and screenshot decode (valid/none/non-image/non-data-url/oversize).
- `src/pages/api/support/reports.js` — authenticated `POST` via
  `createHandler({ allowedRoles: [] })` (any signed-in user; 401 otherwise).
  Decodes+validates the screenshot first (clean 400, no orphan row), assembles via
  `buildReportInsert`, persists **only through `src/lib/database/support.js`**,
  uploads the screenshot to the **private `support-reports` bucket** then attaches
  the path (upload failure does not fail the already-saved report), and writes the
  append-only `writeAuditLog({ action: "support_report_create", entityType:
  "support_report", … })`. `bodyParser` raised to 8 MB for the base64 screenshot.
- `src/components/support/SupportControl.js` — the text-only **"?"** button
  (44×44 touch target, ghost button) that calls `openSupportReport()` and
  **lazy-loads** the modal via `next/dynamic({ ssr:false })`.
- `src/components/support/SupportReportModal.js` — built on the shared `PopupModal`,
  modelled on `NextActionPrompt`. Category select + optional title + required
  description + screenshot field + **transparency disclosure of the data
  *categories* attached** (never values). Submits the Phase 2 `snapshot` as
  `diagnostics`; success/error surfaced via `AlertContext` (`pushAlert`) + inline
  `app-status-message`.
- `src/components/support/SupportScreenshotField.js` — explicit, **user-previewed +
  user-redactable** capture: `getDisplayMedia` grabs one frame (capped to 1600px),
  shown on a canvas; the user drags black redaction boxes, and only the
  **flattened** PNG (redactions baked in) is emitted. Graceful when capture is
  unsupported/cancelled. No silent capture.

**Edited**
- `src/components/layout/StaffTopbar.js` — rendered `<SupportControl />` in the
  right column next to `<NextActionPrompt />`, hidden when `presentationShell`.
  StaffTopbar is **not** a CLAUDE.md §7 flagged-global file; the plan (§2)
  designates this right column as the mount point, so no approval gate was needed.

**Verification**
- `npx vitest run src/lib/support/` → 44/44 pass (Phase 1+2+3).
- `npm run check:borders` / `check:layers` / `check:encoding` → all pass.
- `npx eslint` on all Phase 3 files → 0 errors, 0 warnings.
- `npm run uk:check` → no violations in any Phase 3 file (remaining hits are
  pre-existing `.agents/skills/**` docs, untouched).

**Deviations from plan**
- **UI test is logic-level, not React-rendered.** The repo has no jsdom /
  @testing-library and Vitest runs in the `node` environment; adding a DOM test
  runner is an out-of-scope global dependency change. The privacy-critical and
  submit-flow logic is covered via the pure `reportSubmission` helpers instead. The
  plan already assigns the rendered submit-flow + privacy-regression E2E to
  Playwright in **Phase 7 (§14)** — deferring the browser-rendered UI test there is
  consistent, not a silent drop.
- Reporter identity (`reporter_user_id`/`username`/`roles`) is taken from the
  NextAuth session server-side and **overrides** anything the client sends — a
  hardening choice beyond the plan's wording.

**Audit notes**
- `support_report_create` written on every successful POST via the append-only,
  hash-chained `writeAuditLog` (entityType `support_report`). No new audit table.

**Manual action outstanding**
- Phase 1's `000_support.sql` must be applied in Supabase (table + private bucket
  are auto-ensured on first upload, but the table is created by that migration).

---

### Phase 4 — Error boundaries (complete)

**Created**
- `src/lib/support/errorBoundaryDiagnostics.js` — pure, node-testable helpers for
  the boundary: `BOUNDARY_EVENTS` (caught/retry/reload/report), `errorMessage`,
  `topComponentFromStack` (names the failing component from a React component
  stack), `buildBoundaryReportPrefill` (bug-category title + description for the
  pre-filled report), `buildBoundaryEvent` (typed/clamped timeline event matching
  `recordAction`'s generic shape). No window/document access; records nothing
  itself — only builds plain objects the boundary feeds into the existing store.
- `src/lib/support/errorBoundaryDiagnostics.test.js` — 12 Vitest cases: helper
  behaviour (message/stack parsing, prefill title clamp + component naming, event
  clamping) **plus diagnostics integration**: a recorded render error surfaces in
  `unhandled_errors` with its component stack and **scrubbed stack** (planted
  `sk_live_…` redacted), and recovery attempts surface in `recent_actions` in
  order **without duplication** (one caught error → exactly one error entry).
- `src/components/support/SupportErrorBoundary.js` — the boundary. Inner class
  (`getDerivedStateFromError` / `componentDidCatch`) modelled on the existing
  `JobCardErrorBoundary`, plus a functional wrapper that wires the Phase 2
  context. Catches React render errors + component stacks; feeds them to the
  shared store via `recordRenderError`; records each recovery attempt
  (`recordDiagnosticEvent`). Renders a borderless `LayerSurface` recovery screen
  (CLAUDE.md §3) with **Try again / Reload app / Report a problem** (44px touch
  targets); "Report" opens the Phase 3 popup **pre-filled** with the error
  context. Auto-resets on route change (`resetKey`). Reusable: accepts a custom
  `fallback` render-prop and can wrap individual page subtrees for nested
  boundaries. `hostSupportModal` lets the shell boundary host the report popup
  when the StaffTopbar (its normal host) is unmounted — nested boundaries leave
  it false so there is no duplicate modal.

**Edited**
- `src/context/SupportReportContext.js` — exposed two additive context methods
  used only by the boundary: `recordRenderError({ error, componentStack })`
  (records the render error into the shared store **and** mirrors it onto the
  action timeline tagged with the last section key) and `recordDiagnosticEvent`
  (records a recovery attempt). The boundary adds **no window listeners** —
  runtime exceptions + unhandled promise rejections are already captured by
  Phase 2's `installBrowserCapture`, so re-listening would double-record them.
- `src/pages/_app.js` — **flagged global change (CLAUDE.md §7 — application
  shell), approved per the Phase 4 task**: wrapped `<AppWrapper>` with
  `<SupportErrorBoundary hostSupportModal>` **inside** the existing
  `<SupportDiagnosticsProvider>` (so the boundary reads the diagnostics context).
  Additive; no provider order changes.

**Verification**
- `npx vitest run src/lib/support/` → 56/56 pass (Phase 1+2+3+4).
- `npm run check:borders` / `check:layers` / `check:encoding` → all pass.
- `npx eslint` on all Phase 4 files (+ `_app.js`, context) → 0 errors, 0 warnings.

**Deviations from plan**
- **Boundary test is logic-level, not React-rendered** — same rationale as Phase
  3 (no jsdom / React DOM runner in the repo; the rendered crash→recovery→report
  flow is assigned to Playwright in Phase 7). The privacy-critical and
  capture-integration logic is covered via the pure `errorBoundaryDiagnostics`
  helpers replayed against the real diagnostics store.
- Runtime exceptions + unhandled rejections are **not** re-captured by the
  boundary (they are already captured app-wide in Phase 2); the boundary's unique
  contribution is the React render error + component stack + recovery timeline.

**Audit notes**
- None new. A report submitted from the recovery screen goes through the Phase 3
  POST and so writes the standard `support_report_create` audit entry.

---

### Popup polish (pre-Phase 5, complete)

A round of UX/usefulness improvements to the Phase 3 report popup, done **before**
starting Phase 5 (version pinning). No version/code-state pinning was started.

**Created**
- `src/lib/support/actionSummary.js` (+ `.test.js`, 7 cases) — pure
  `describeAction` + `buildDescriptionDraft(snapshot)`: turns the last 10 captured
  actions (plus page + detected error / failed-request counts) into a plain-English
  description draft. Reads only the already-sanitised snapshot — no new privacy
  surface. Tested for per-type phrasing, the last-10 cap, and empty snapshots.
- `src/lib/support/supportDraft.js` (+ `.test.js`, 8 cases) — pure, storage-injected
  draft persistence (`loadDraft` / `saveDraft` / `clearDraft` / `normaliseDraft` /
  `isDraftEmpty`). Caps description (5000) + screenshot count (6); drops screenshots
  rather than throwing on a storage-quota error; ignores corrupt JSON. Nothing
  leaves the device.

**Edited**
- `src/components/support/SupportReportModal.js` — (1) category now uses the
  **canonical shared `DropdownField`** (no raw `<select>`); (2) **optional Title
  field removed**; (3) the required `*` sits **inline** with "What happened?";
  (4) the description **auto-fills** from `buildDescriptionDraft` and stays fully
  editable (user edits are never clobbered by the auto-fill); (5) **Clear** button
  resets the draft + screenshots; (6) the draft is **auto-saved** on every change
  and cleared only on Send report / Clear; (7) submits `screenshots` (array);
  (8) hides itself (`visibility:hidden`, stays mounted) while a capture runs.
- `src/components/support/SupportScreenshotField.js` — rebuilt as a multi-image
  gallery (`SupportScreenshotsField`): **auto-starts** a capture on open, a
  **"+ Add another"** control captures extra shots (capped at 6), the popup is
  **hidden during each capture** so it's never in the shot, and per-shot
  **drag-to-redact** is preserved (only the flattened PNG is emitted). Restored
  draft images show as static previews. Graceful fallback when capture is
  unsupported or auto-start is blocked.
- `src/lib/support/reportSubmission.js` (+ tests, 5 new cases) — added
  `decodeScreenshots(array)` (keeps single `decodeScreenshot`); validates every
  entry, fails the whole batch on any bad/oversized image (no half-attached
  report), caps at `MAX_SCREENSHOTS = 6`. Re-sanitisation + identity-from-session
  unchanged.
- `src/lib/database/support.js` — `createSupportReport` now accepts
  `screenshotPaths[]` (first → legacy `screenshot_path`, full list →
  `screenshot_paths`); added `setSupportReportScreenshots`; both list/detail column
  sets include `screenshot_paths`.
- `src/pages/api/support/reports.js` — accepts `screenshots[]` (legacy single
  `screenshot` still tolerated), uploads each to the private bucket independently
  (failures simply omitted), attaches the path list, audit `diff.screenshot_count`.
- `src/lib/database/schema/support/000_support.sql` + `schemaReference.sql` — added
  `screenshot_paths text[]` (with an idempotent `ALTER TABLE … ADD COLUMN IF NOT
  EXISTS` for already-created tables).
- `CLAUDE.md` §3.4 + new **§3.4a "Dropdowns — THE LAW"** — documents the reusable
  rule: every dropdown must be the shared `DropdownField` (never a raw `<select>`).

**Verification**
- `npx vitest run src/lib/support/` → 75/75 pass.
- `npm run check:borders` / `check:layers` / `check:encoding` → all pass.
- `npx eslint` on all changed files → 0 errors, 0 warnings.

**Privacy**
- All record-time + capture-time + server-side (×3) sanitisation, screenshot
  redaction, and the size cap are unchanged. The auto-filled description is built
  only from the already-sanitised snapshot; the local draft never leaves the
  device.

**Audit notes**
- POST audit entry now carries `diff.screenshot_count`. Still the single
  `support_report_create` action per submission.

**Manual action outstanding**
- Apply the updated `000_support.sql` in Supabase — it now adds the
  `screenshot_paths text[]` column (idempotent; safe to re-run).

---

### Diagnostic assistant + extension system (pre-Phase 5, complete)

Turned the popup into an intelligent assistant and made the diagnostics system
extensible. Still **before** Phase 5 (no version/code-state pinning started).

**Created**
- `src/lib/support/diagnosticAnalysis.js` (+ `.test.js`, 10 cases) — pure
  `analyseDiagnostics(snapshot)`: groups related console errors / failed requests /
  render exceptions into **incidents** by time-proximity, finds the **trigger**
  (earliest event), detects **duplicates** (signature collapses ids/numbers) and
  **cascades**, estimates a **probable cause + confidence (0–0.95) + evidence**,
  and resolves the **affected page / pathname / route / section key / component /
  code owner**. `buildEnrichedDescription()` writes the meaningful description
  draft (cause + affected + marked-trigger timeline). Reads only sanitised fields.
- `src/lib/support/diagnosticRegistry.js` (+ `.test.js`, 9 cases) — the
  **extension point**: `registerDiagnosticProvider` / `getDiagnosticProviders` /
  `clearDiagnosticProviders` / `collectProviderDiagnostics`. Providers are
  `{ id, label, devOnly, collect(context) }`; faulty providers are swallowed,
  `devOnly` ones run only when `isDev`, empties are dropped. Future features
  register a provider — no popup/capture changes needed.
- `src/lib/support/providers/{uiStateProvider,devMetadataProvider,index}.js`
  (+ `providers.test.js`, 6 cases) — built-ins. **ui-state**: active tab, modal
  state, filter selections, and form-field *identity + filled boolean* (NEVER the
  typed value; the support popup is excluded). **dev-metadata** (`devOnly`):
  performance timing, memory pressure, network quality, repeated API failures,
  recent route churn. `registerBuiltinDiagnosticProviders()` wires both.

**Edited**
- `src/lib/support/diagnostics.js` — `captureDiagnostics` now accepts
  `context.providers` (merged into the bundle pre-sanitise) and attaches
  `snapshot.analysis = analyseDiagnostics(sanitised)` (derived from sanitised data
  only).
- `src/context/SupportReportContext.js` — registers the built-in providers on
  mount and, at capture, runs `collectProviderDiagnostics({ win, doc, store,
  isDev })` (isDev = devLogin or NEXT_PUBLIC_DEV_AUTH_BYPASS), passing the result
  through to the snapshot.
- `src/components/support/SupportReportModal.js` — auto-fill now uses
  `buildEnrichedDescription`; added a read-only **"Diagnostic assistant" panel**
  (probable cause + confidence badge + likely component/file), shown only at ≥30%
  confidence. Screenshots are now `{ src, annotation }`.
- `src/components/support/SupportScreenshotField.js` — per-image **annotation**
  field, **↑/↓ reorder**, **Remove**, **duplicate detection** (identical PNG →
  skipped with a notice), and capture now uses the stream's **intrinsic
  device-pixel dimensions** (correct across browser zoom + multi-monitor; the user
  picks the surface in the browser picker).
- `src/lib/support/supportDraft.js` (+ tests updated) — draft `screenshots` are
  now `{ src, annotation }` (legacy bare data-URLs coerced); annotation capped.
  The draft already survives refresh/crash and clears only on Send / Clear.
- `src/lib/support/reportSubmission.js` (+ tests, +4 cases) — `decodeScreenshots`
  reads `{ src }` entries; per-image **annotations are embedded (scrubbed) into
  `diagnostics.attachments` by order** so the admin viewer can pair
  `screenshot_paths[i]` with `attachments[i].annotation`. Helpers
  `screenshotEntries/Src/Annotation` exported.
- (Documentation) The analysis engine + provider extension points and their
  privacy contract are documented in **§6a** of this file.

**Verification**
- `npx vitest run src/lib/support/` → **101/101** pass (Phase 1–4 + both pre-5 passes).
- `npm run check:borders` / `check:layers` / `check:encoding` → all pass.
- `npx eslint` on all changed files → 0 errors, 0 warnings.

**Privacy**
- The analysis + providers read only already-sanitised / non-value data
  (form-field *identity*, not values), everything they emit is re-run through the
  shared sanitiser, the 256 KB cap + ×3 server re-sanitisation are unchanged, and
  screenshot redaction/dedup still bake before send. Local draft never leaves the
  device.

**Audit notes**
- No change to audit surface (still one `support_report_create` per submit).

**Deviations / notes**
- Per-component render-frequency is approximated by recent route churn (true
  per-component counts would need render instrumentation we deliberately avoid).
- Multi-screenshot persistence uses the `screenshot_paths text[]` column
  (confirmed re-added to the migration); annotations live in
  `diagnostics.attachments` aligned by order.

---

### Investigation engine (developer-only, pre-Phase 5, complete)

Evolved the popup from an intelligent report generator into a full **investigation
engine**. Developer-only, computed **server-side at ingest** and stored inside the
**RLS-locked `diagnostics` blob** — never returned to reporters, never shown in the
popup. Still **before** Phase 5 (no version/code-state pinning started).

**Created**
- `src/lib/support/investigation.js` (+ `.test.js`, 11 cases) —
  `buildInvestigation(snapshot, { priorReports, now, analysis })`: plain-English
  explanation, ordered event **sequence**, **root causes ranked by confidence**,
  primary **incident**, suspected **database/API/frontend ownership** (API routes
  from failed requests, DB tables guessed from `/api/<resource>`), **severity**
  (critical→low), **priority** (P1–P4), **user impact**, **regression risk**,
  **fix complexity**, **reproducible confidence**, **affected modules**,
  **debugging order**, **inspect-first** files/components/API routes/DB tables,
  **similar incidents** + **repeated failures**, recommended **manual tests** and
  **automated regression tests**, and a **GitHub-ready summary**. Deterministic
  (injected `now`); reads only sanitised data.
- `src/lib/support/incidentClustering.js` (+ `.test.js`, 9 cases) — multi-signal
  duplicate detection that clusters across **route, section, component, error
  signatures, request signatures, screenshot hashes, behaviour** (not text):
  `buildFingerprint`, `similarity` (weighted, with reasons), `findSimilarReports`,
  `repeatedFailures`, `stableHash` (djb2).
- `src/lib/support/investigationRegistry.js` (+ `.test.js`, 5 cases) — the
  **investigation** extension point (separate from the diagnostic registry):
  `registerInvestigationProvider` / `collectInvestigationProviders`. Faulty
  providers swallowed; empties dropped; fragments merged under
  `investigation.providers.<id>`. Future modules enrich investigations without
  touching the core.
- `src/lib/support/investigationCache.js` (+ `.test.js`, 4 cases) —
  `investigationKey` + `getOrBuildInvestigation` memoise results (bounded store);
  the key changes when diagnostics OR the prior-report set change, so a new
  similar incident invalidates a stale result.

**Edited**
- `src/lib/support/diagnosticAnalysis.js` — exported `normaliseSignature` for
  reuse by the clustering + investigation layers.
- `src/lib/support/reportSubmission.js` (+ tests updated) — every screenshot now
  contributes an `attachments[]` entry `{ order, hash, annotation? }`; the
  `hash` (stable image-bytes hash) feeds cross-report clustering.
- `src/lib/database/support.js` — added `listRecentReportFingerprints(limit)`
  which selects **only** the JSON `fingerprint` subfield (never full diagnostics),
  best-effort (returns [] on error so ingest is never blocked).
- `src/pages/api/support/reports.js` — at ingest, fetches prior fingerprints,
  builds the investigation via the cache, and embeds `investigation` +
  `fingerprint` into the diagnostics blob **only when still within the 256 KB
  cap** (else the report is saved without it). The POST response never includes
  the investigation.
- (Documentation) The investigation engine, clustering, the investigation
  extension interface, the cache, and the ingest wiring are documented in **§6b**
  of this file.

**Verification**
- `npx vitest run src/lib/support/` → **125/125** pass (all support phases + passes).
- `npm run check:borders` / `check:layers` / `check:encoding` → all pass.
- `npx eslint` on all changed files → 0 errors, 0 warnings.

**Privacy**
- The investigation reads only already-sanitised data, is re-scrubbed with the
  rest of the diagnostics blob, and lives solely in the RLS-locked `diagnostics`
  column — reporters never receive it (POST returns only `{ id, screenshotCount }`).
  `listRecentReportFingerprints` never selects the full diagnostics blob.

**Audit notes**
- No new audit surface. Bundle-view / triage audit lands with the Phase 6 viewer.

**Deviations / notes**
- No reporter-facing UI was added for the investigation (correct — it is
  developer-only); a dev viewer to render it is **Phase 6**. The engine + storage +
  extension points are complete and tested now.
- Screenshot clustering uses an exact content hash (djb2 over the data URL), not a
  perceptual hash — identical images cluster; near-duplicates do not (a perceptual
  hash would need an image-processing dependency we deliberately avoid).

---

### Documentation consolidation (pre-Phase 5, complete)

Merged the former two-file handoff (`help-diagnostics-system-plan.md` +
`help-diagnostics-progress.md`) into this single living document
(`docs/Support/help-diagnostics.md`). Explicitly done **before** starting Phase 5,
which remains not started.

**Created**
- `docs/Support/help-diagnostics.md` — this file. Full plan (Part A, §0–16),
  phase table, consolidated manual actions, per-phase changelog with audit notes
  and deviations, next-phase guidance, and the single-file standing handoff prompt.

**Edited**
- `src/lib/database/schema/support/000_support.sql`,
  `src/lib/support/sanitise.js`,
  `src/lib/support/providers/index.js` — doc-reference comments repointed from the
  old plan filename to `docs/Support/help-diagnostics.md`. No behaviour change.

**Removed**
- `docs/Support/help-diagnostics-system-plan.md` and
  `docs/Support/help-diagnostics-progress.md` — superseded by this file. The
  user's `docs/Support/1st` scratchpad is untouched.

**Verification**
- Repo search confirms no remaining code/doc references to the two old filenames
  (outside the user's `1st` scratchpad).

**Privacy / audit**
- Documentation-only; no code behaviour, no privacy surface, no audit change.

---

## Next-phase guidance

**Next up: Phase 5 — Version / code-state pinning.** Do not start until this
documentation consolidation is confirmed complete (it now is; Phase 5 may begin on
the next pass).

- **Flagged global file (CLAUDE.md §7):** `next.config.*` — exposing
  `NEXT_PUBLIC_COMMIT_SHA` / `NEXT_PUBLIC_COMMIT_REF` / `NEXT_PUBLIC_APP_VERSION`
  and surfacing Next's `buildId`. **Stop and flag for approval before editing
  `next.config`.**
- Stamp every report with `app_version` / `commit_sha` / `commit_ref` / `build_id`
  (columns already exist from Phase 1). Source values from the exposed
  `NEXT_PUBLIC_*` env + `buildId`; keep `section_key` (durable) + resolved
  `file:line` (snapshot) as already captured.
- Ensure the dev-layout source-map generator runs in the build so code-ownership
  resolution stays accurate against the deployed commit.
- Optionally store a content hash to detect drift between the captured `file:line`
  and the deployed source.
- Add Vitest coverage for build stamping (values flow from env → `buildReportInsert`
  columns). Keep everything namespaced `support`; keep the feature separate from the
  existing Reporting/KPI platform.

---

## Standing handoff prompt

> Paste this verbatim into ChatGPT, attaching **the single file**
> `docs/Support/help-diagnostics.md`. Re-use it unchanged every phase.

```
You are reviewing an in-progress implementation of the "Help & Diagnostics" feature for the HNPSystem Next.js (Pages Router) + Supabase app. I'm attaching one file: the living handoff document (docs/Support/help-diagnostics.md) which contains the full plan (Part A), the phase status table, the per-phase changelog, manual actions, deviations, audit notes, next-phase guidance, and this prompt. Using ONLY that file as the source of truth, do three things and nothing else: (1) AUDIT — compare what the changelog says is built against the plan and list any sections, requirements, privacy/sanitisation rules, edge cases, columns, or constraints that were missed, partially done, silently deferred, or deviate from the plan, ranked by risk; flag especially anything touching privacy/secret-leakage, RLS, audit, or permissions; (2) CONFIRM NEXT PHASE — state which phase is next per the phase table and call out any global-architecture file it will touch (e.g. _app.js, next.config, Layout/Sidebar/Card/theme/globals/context) that must be explicitly flagged for approval before editing; (3) WRITE THE NEXT PROMPT — produce a single ready-to-copy implementation prompt for the next phase that reuses existing repo patterns (popup, auth/role, audit, storage, dev-layout source map, styling per CLAUDE.md), keeps the feature separate from the existing Reporting/KPI system, names the exact files to create/edit, lists the tests to add, and tells the implementer to stop and flag any risky global change before making it. Keep the feature namespaced "support" throughout, and remind the implementer that all phase updates go into the single docs/Support/help-diagnostics.md file (never re-create the old plan/progress split). Do not write code yourself — only the audit and the next prompt.
```
