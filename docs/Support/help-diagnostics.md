# Help & Diagnostics — Living System Document (Architecture · Current State · Handoff)

> **Single source of truth for the Help & Diagnostics ("support") feature.**
> This is a *living* document describing the feature **as it exists now** — not an
> append-only build log. When a phase ships, **update the relevant sections in place**
> (module map, phase table, outstanding work, limitations, manual actions, backlog);
> do **not** append a new historical changelog entry and do **not** re-create the old
> `-system-plan` / `-progress` split. **Read [CLAUDE.md](../../CLAUDE.md) in full before
> writing any code** — every UI surface must obey the Layer/Border laws, token system,
> and DB/auth rules there.

### The ritual (run every phase)

1. Implement the phase.
2. **Edit this file in place**: refresh the [Module map](#module-map), the
   [Phase status](#phase-status) table, [Outstanding work](#outstanding-work),
   [Known limitations](#known-limitations), [Manual actions](#manual-actions-outstanding),
   and move any out-of-scope ideas into the [Future Improvements backlog](#future-improvements-backlog).
   Describe the **current system**, not the diff.
3. Paste the [Standing handoff prompt](#standing-handoff-prompt) into ChatGPT, attaching
   **this one file**.
4. ChatGPT returns a gap audit + the next ready-to-copy implementation prompt.

---

# PART A — Architecture

## 0. Naming — avoid the collision

The repo already has a large **"Reporting" platform** (KPI/analytics — `docs/Report System/`,
`src/lib/database/reporting/`). **Do not** call this feature "reports/reporting." Namespace
everything **`support`**: DB table `support_reports`, lib `src/lib/support/`, API
`src/pages/api/support/`, dev viewer `/dev/support-reports`.

## 1. What we're building (one sentence)

A user-friendly **"?"** control in the app toolbar that opens a report popup where a user
attaches a screenshot and describes what happened, while the system **privately** captures a
rich developer-only diagnostic bundle (route, role, device, console errors, recent actions,
failed requests, code ownership, build/commit, feature flags, sanitised session state) tied to
the **exact deployed code state** — surfaced only to admins/devs in a dedicated viewer.

## 2. Reused repo assets (do NOT rebuild)

| Need | Asset | Path |
|---|---|---|
| Toolbar mount point | Right column of the topbar | `src/components/layout/StaffTopbar.js` |
| Modal base | `PopupModal` + `ModalPortal` | `src/components/popups/popupStyleApi.js`, `ModalPortal.js` |
| Form-popup reference | `NextActionPrompt` | `src/components/popups/NextActionPrompt.js` |
| Toast / acknowledgement | `AlertContext` + `TopbarAlerts` | `src/context/AlertContext.js`, `src/components/TopbarAlerts.js` |
| Session + roles | `useUser()` | `src/context/UserContext.js` |
| Code ownership map | `findDevLayoutSectionSources(key)` | `src/lib/dev-layout/sectionSourceMap.js` (data: `sectionSourceMap.generated.js`) |
| API wrapper | `createHandler({ allowedRoles, methods })` + `withRoleGuard` | `src/lib/api/createHandler.js`, `src/lib/auth/roleGuard.js` |
| DB clients | `supabaseService` (server) / `supabaseClient` (anon) | `src/lib/database/supabaseClient.js` |
| Append-only audit | `writeAuditLog(...)` (hash-chained, redacts secrets) | `src/lib/audit/auditLog.js` |
| Storage pattern | `ensureBucket` + service-role upload | `src/lib/storage/storageService.js` |
| Roles / dev gate | `DEV_FULL_ACCESS_ROLES`, `hasAnyRole` | `src/lib/auth/roles.js`, `roleGuard.js` |

**Key insight:** the `data-dev-section-key` convention gives us **code ownership for free** —
resolve the nearest section key from the DOM and look up `file:line` via the generated map.

## 3. Data model

Tables follow repo conventions (`snake_case`, UUID PK, `created_at`/`updated_at` tz,
`text` status with `CHECK`). Canonical DDL: `src/lib/database/schema/support/000_support.sql`
(mirrored into `schemaReference.sql`).

- **`support_reports`** — `id`, `title`, `description`, `category`, `screenshot_path`,
  `screenshot_paths` (text[]), `reporter_user_id`, `reporter_username`, `reporter_roles[]`,
  `status`, `severity`, `assigned_to`, `route`, `section_key`, `source_file`, `source_line`,
  `app_version`, `commit_sha`, `commit_ref`, `build_id`, `diagnostics` (jsonb),
  `created_at`, `updated_at`. **RLS enabled with no permissive policies** — service-role only.
- **`support_report_comments`** — triage thread (created early; used from Phase 6).

**`diagnostics` JSONB (private — never shown to reporter):** `captured_at`, `route`,
`code_ownership {section_key,file,line}`, `device`, `session` (allowlisted), `feature_flags`,
`build` (see §8), `console_errors[]`, `failed_requests[]`, `recent_actions[]`,
`unhandled_errors[]`, `providers.<id>`, `analysis`, `attachments[] {order,hash,annotation}`,
`investigation` (dev-only, §6b), `fingerprint`.

## 4. Privacy & sanitisation (most important)

1. **Two-tier payload** — `userVisible` (title/description/category/screenshot) vs
   `diagnostics` (everything else), scrubbed client- **and** server-side.
2. **Allowlist for session/flags** — only `roles`, `dbUserId`, `authStatus`, `isDevLogin`, and
   allowlisted `NEXT_PUBLIC_*` flags. Never tokens/cookies/secrets/`process.env` at large.
3. **Redaction pass** over every kept string — JWTs, Bearer, prefixed keys, emails (masked),
   NI/card numbers, secret query params. (`src/lib/support/sanitise.js`.)
4. **Request bodies not captured** — only method, scrubbed URL, status, duration.
5. **Screenshots user-initiated only** — previewed + redactable before send; only the flattened
   PNG (redactions baked in) is emitted.
6. **Server re-scrub on ingest**; reject payloads over the **256 KB** cap.
7. **Storage isolation** — private `support-reports` bucket, short-TTL signed URLs for admins.
8. **Retention** — Phase 7 (`tools/scripts/run-retention.js`).
9. **RLS** — no permissive policies; all access via role-guarded API routes.

Every layer added since (analysis, providers, investigation, build/version pinning) reads
**only already-sanitised data**, is re-run through the shared sanitiser, and respects the
size cap + server re-sanitisation — so no new privacy surface is introduced.

10. **User-authored free text is scrubbed too** (Phase 7) — the reporter's own `title`
    and `description` are user-visible, but a reporter can still paste a token/PII into
    them, so `buildReportInsert` now runs the **same value scrub** (`scrubString`) over them
    before persistence. The guarantee is uniform: no kept string — captured *or* typed —
    carries a pattern-detectable secret. (An arbitrary password typed into prose has no
    detectable shape and is only redactable by secret **key name**; this residual limitation
    is documented and covered by the privacy-regression suite.)
11. **Runtime privacy canary** (Phase 7) — `/api/support/health` runs the live sanitiser over
    planted secrets on every probe, so a deploy that ships a broken sanitiser goes red
    *before* a real secret can leak.

## 5. UI / UX flow

"?" control in `StaffTopbar` → lazy `SupportReportModal` (built on `PopupModal`): category
(canonical `DropdownField`) → auto-filled-but-editable description → optional multi-screenshot
capture + per-shot redact/annotate → transparency disclosure of the *categories* sent → submit.
Acknowledge via `AlertContext`. The diagnostics snapshot is taken the moment the popup opens.
Draft auto-persists locally and clears on Send / Clear. CLAUDE.md §3 compliant.

## 6. Diagnostic capture, analysis & extension points

- **Capture** (`diagnostics.js`): capped ring buffers for console errors/warns, unhandled
  errors, failed requests (non-2xx, no bodies), recent actions (route changes + nearest
  `data-dev-section-key` on click). Device/session/flags read on demand; code ownership via the
  generated map. Browser wiring calls through to existing handlers.
- **Analysis engine** (`diagnosticAnalysis.js`): `analyseDiagnostics(snapshot)` groups events
  into time-proximate **incidents**, finds the **trigger**, detects **duplicates/cascades**,
  estimates **probable cause + confidence + evidence**, resolves **affected page/component/
  code owner**, and builds a merged **timeline**. `buildEnrichedDescription()` writes the
  popup's pre-filled description. Attached to every snapshot as `snapshot.analysis`.
- **Diagnostic registry** (`diagnosticRegistry.js`): any feature registers a synchronous,
  defensive, JSON-able provider returning **names/booleans, never values**. Built-ins in
  `src/lib/support/providers/`: `ui-state` (active tab/modal/filters, form-field identity +
  filled-boolean) and `dev-metadata` (`devOnly`: perf/memory/network/route churn). Merged into
  `snapshot.providers.<id>`, then sanitised with everything else.

## 6b. Investigation engine (developer-only)

Computed **server-side at ingest**, stored **inside the RLS-locked `diagnostics` blob**, never
returned to reporters. `buildInvestigation(snapshot, { priorReports, now, currentBuild })`
(`investigation.js`) returns: plain-English `explanation`, ordered `sequence`, ranked
`rootCauses`, primary `incident`, `ownership` (api/db/frontend), `severity`/`priority`/
`userImpact`/`regressionRisk`/`fixComplexity`/`reproducibleConfidence`, `affectedModules`,
`debuggingOrder`, `inspectFirst`, `similarIncidents` + `repeatedFailures`, `manualTests` +
`regressionTests`, a GitHub-ready `summary`, `fingerprint`, provider fragments — **plus the
Phase 5 `codeState` and `versionHistory` (see §8)**.

Supporting modules: `incidentClustering.js` (multi-signal `buildFingerprint`/`similarity`/
`findSimilarReports`/`repeatedFailures`/`versionRange`, djb2 `stableHash`),
`investigationRegistry.js` (per-module investigation providers), `investigationCache.js`
(memoises by snapshot + prior-report-set key).

## 7. Developer Support Centre — **Phase 6 (done)**

Role-gated `/dev/support-reports` (+ `[id]`) via `ProtectedRoute` + `DEV_FULL_ACCESS_ROLES`
(the API is gated the same way). A full issue-management workspace, not a bare list:

- **Workspace** (`SupportWorkspace.js`): dashboard stat cards (open / unassigned / regressions /
  critical / 24h / total — each a one-click filter), advanced filtering (search + status /
  severity / category + sort), **saved views** (presets + user views persisted locally), and an
  **impact-sorted queue** with automatic **New / Regression / Recurring / Duplicate / Drift**
  badges. Keyboard shortcuts (`/` search, `j`/`k` move, `Enter` open, `r` refresh).
- **Detail** (`SupportReportDetail.js`): triage (status / severity / assign-to-me / duplicate
  linking, all **optimistic**), the developer investigation (root causes, confidence, debugging
  order, recommended tests, issue-tracker summary), **code-state / drift + affected version
  history**, code ownership with clickable source refs + affected routes/components/API/tables,
  screenshots (signed URLs + annotations), an expandable **event timeline**, a full
  **diagnostics explorer** (device / session / flags / providers / console / requests / errors /
  privacy), **developer notes** (comments), and **activity/audit history**. Copy/export tools:
  dev bundle, markdown, and a one-click **GitHub issue** (opens when `NEXT_PUBLIC_GITHUB_REPO`
  is set, else copies).
- **Audit**: every developer action is written to the append-only, hash-chained audit log —
  `support_report_view` (private-bundle access), `support_report_update` (triage),
  `support_report_comment`.

Intelligence lives in the pure, tested `src/lib/support/adminView.js` (badges / impact sort /
duplicate grouping / view presets), `supportExport.js` (issue / bundle / markdown), and
`savedViews.js` (local persistence); data + optimistic mutations in the
`src/components/support/dev/` hooks.

## 8. Version / code-state pinning — **Phase 5 (done)**

- **`next.config.mjs`** resolves the deployed code state from Vercel's build-time git env
  (`VERCEL_GIT_COMMIT_SHA/_REF`, `VERCEL_ENV`, `VERCEL_URL`) with `NEXT_PUBLIC_*` overrides +
  safe defaults, inlines it into the client bundle via `env`
  (`NEXT_PUBLIC_APP_VERSION`, `_COMMIT_SHA`, `_COMMIT_REF`, `_BUILD_ID`, `_DEPLOY_ENV`,
  `_DEPLOY_URL`, `_DEPLOYED_AT`, `_SECTION_MAP_HASH`), and pins Next's `generateBuildId` to the
  commit. **Non-secret metadata only** — no tokens/keys/cookies.
- **`src/lib/support/buildInfo.js`** (pure, env-injected): `readBuildInfo(env, {sectionMapHash})`
  → the `build` block; `verifySectionMap(build)` (does the resolved `file:line` come from the
  deployed map?); `detectCodeDrift(capturedBuild, currentBuild)` (has the commit/map moved since
  capture?); `describeBuild(build)`.
- **Capture** (`SupportReportContext.js`) stamps every snapshot's `build` via `readBuildInfo`,
  including the runtime section-map hash from `getSectionSourceMapHash()`
  (`sectionSourceMap.js`). The generator emits `DEV_LAYOUT_SECTION_SOURCE_MAP_HASH` and prints
  `SECTION_MAP_HASH=…` for CI to feed back into `NEXT_PUBLIC_SECTION_MAP_HASH`.
- **Stamping**: `buildReportInsert` derives `app_version`/`commit_sha`/`commit_ref`/`build_id`
  columns from the sanitised `build` block (durable), alongside `section_key` +
  resolved `file:line` (snapshot).
- **Ingest** (`reports.js`) passes the server's live `currentBuild` into the investigation so
  `codeState.drift` compares captured vs deployed; `listRecentReportFingerprints` now also
  selects `app_version`/`commit_sha` so `versionRange` computes the **first** app version an
  incident appeared in and the **latest** it was reproduced on (`isRegression` when it recurs
  across releases) — the foundation for cross-release regression tracking.

## 9. Error boundaries — **Phase 4 (done)**

App-level `SupportErrorBoundary` (shell-mounted in `_app.js`) catches React render errors +
component stacks, feeds them to the shared store, records the recovery timeline, and renders a
borderless recovery screen (Try again / Reload / pre-filled Report). Reusable for nested
boundaries. Runtime exceptions + unhandled rejections are already captured by Phase 2's window
listeners, so the boundary never re-listens (no double-recording).

## 9b. Hardening — **Phase 7 (done)**

The final production-hardening pass. No new user-facing feature — it makes the existing
system abuse-resistant, self-cleaning, self-verifying, and provably private.

- **Rate limiting + abuse detection** (`rateLimit.js`): a pure sliding-window limiter keyed by
  the authenticated user id (falling back to client IP so a caller can't dodge by rotating one
  or the other). `handlePost` in `reports.js` calls it before any work: over the window cap →
  **HTTP 429 + `Retry-After`**; sustained hammering past the abuse threshold → a single
  `support_report_rate_limited` **audit entry** so an admin sees the pattern. The store is
  process-local and self-pruning; it records **no** request content (key + timestamps only).
- **Retention / cleanup** (`run-retention.js` `support_report` handler + `support.js` helpers
  `listSupportReportsForRetention` / `deleteSupportReports`): reports older than **180 days** are
  deleted (comments cascade via FK) **and** their screenshots are removed from the private
  bucket **first**, so an interrupted run never orphans storage behind a deleted row. Wired into
  the existing policy-driven runner (`retention:dry-run` / `retention:apply`); a
  `support_report` `retention_policies` row is seeded idempotently by the migration.
- **Health checks** (`healthChecks.js` + dev-gated `GET /api/support/health`): rolls up a
  **sanitiser canary** (live scrub of planted secrets — fails the deploy before a real leak),
  DB reachability via the service role, private-bucket presence + not-public, RLS invariant, and
  build/code-state pinning. `fail` → HTTP 503 for uptime probes; returns only statuses + notes.
- **RLS / permissions review**: confirmed both tables keep RLS **on with no permissive
  policies** — the anon/auth keys can't touch them; every read/write is a service-role, role-
  guarded route. The submit route is authenticated-only; list/detail/triage/comments/health are
  `DEV_FULL_ACCESS_ROLES`-gated. The health `rls` check surfaces this invariant at runtime.
- **Privacy regression suite** (`privacyRegression.test.js`): plants known secrets in every
  carrier (free-text, secret-named keys, nested objects, arrays, URLs, provider fragments,
  screenshot annotations, the typed description) and asserts **no pattern-detectable secret
  survives** either sanitisation layer. This pass also **closed a real gap** it found — the
  user-typed `title`/`description` were previously stored un-scrubbed; they now run through the
  shared value scrub (§4.10).
- **E2E** (`e2e/workflows/support-centre.spec.js`): adds health-endpoint gating + a dev status-
  roll-up assertion, and an **end-to-end privacy probe** (submit a report carrying a planted
  JWT → fetch it back via the dev detail API → assert the secret appears nowhere).

## 10. Hard constraints (do not violate)

- Obey **CLAUDE.md** in full (LayerSurface/LayerTheme, no surface borders, tokens, responsive +
  44px, UK English). Run `check:borders`/`check:layers`/`check:encoding`/`uk:check`.
- No raw Supabase in pages/components — all queries in `src/lib/database/support.js`.
- Never expose service-role key, tokens, cookies, or non-allowlisted env to the client.
- No silent screen capture — screenshots are explicit, previewed, redactable.
- Reuse existing popup/alert/audit/storage/role infra — no Sentry, no new logging framework.
- Flag any change to global files (`_app.js`, `next.config`, `Layout`, `Sidebar`, `Section`,
  `Card`, `theme.css`, `globals.css`, context providers) per CLAUDE.md §7 before proceeding.

---

# PART B — Current system state

## Module map

Everything that exists today. Tests live beside each module (`*.test.js`, Vitest `node` env).

| Concern | Module(s) | Notes |
|---|---|---|
| Schema / migration | `src/lib/database/schema/support/000_support.sql` (+ `schemaReference.sql`) | `support_reports` (+ `duplicate_of`) + `support_report_comments` (+ `author_username`); RLS, no policies; idempotent. |
| Privacy scrubber | `src/lib/support/sanitise.js` | Single source of truth; key-name + value-pattern redaction; 256 KB cap. |
| DB helper | `src/lib/database/support.js` | CRUD + list/search/sort, stats, comments, per-report audit, triage (status/severity/assign/duplicate), fingerprints, **retention list/delete (Phase 7)**. |
| Triage validation | `src/lib/support/triageValidation.js` | Pure enum/patch/list-filter validation, split out so it's testable without the Supabase client. |
| Private storage | `src/lib/storage/supportMediaBucketService.js` | `public:false` bucket; short-TTL signed URLs; MIME/size validation; delete + **health probe (`getSupportBucketStatus`, Phase 7)**. |
| Capture core | `src/lib/support/diagnostics.js` | Ring buffers + `installBrowserCapture` + `captureDiagnostics`. |
| Capture provider | `src/context/SupportReportContext.js` | Mounted in `_app.js`; owns the store; stamps `build`. |
| **Build / code-state** | `src/lib/support/buildInfo.js` | `readBuildInfo` / `verifySectionMap` / `detectCodeDrift` / `describeBuild`. |
| **Build exposure** | `next.config.mjs`, `src/lib/dev-layout/sectionSourceMap.js`, `tools/scripts/generate-dev-layout-section-source-map.js` | `NEXT_PUBLIC_*` env + `generateBuildId`; `getSectionSourceMapHash()`; generator emits map hash. |
| Analysis engine | `src/lib/support/diagnosticAnalysis.js`, `actionSummary.js` | Incidents/trigger/probable cause; enriched description. |
| Diagnostic registry | `src/lib/support/diagnosticRegistry.js`, `providers/{uiStateProvider,devMetadataProvider,index}.js` | Extension point + built-ins. |
| Investigation engine | `src/lib/support/investigation.js`, `incidentClustering.js`, `investigationRegistry.js`, `investigationCache.js` | Dev-only; server-side at ingest; `codeState` + `versionHistory`. |
| Submit helpers | `src/lib/support/reportSubmission.js` | Pure; re-sanitise, identity-from-session, column derivation, screenshot decode; **title/description value-scrub (Phase 7)**. |
| **Rate limiting** | `src/lib/support/rateLimit.js` | Pure sliding-window limiter + abuse detection; process-local self-pruning store. |
| **Health checks** | `src/lib/support/healthChecks.js`, `src/pages/api/support/health.js` | Sanitiser canary + DB/storage/RLS/build probes; dev-gated; 503 on fail. |
| **Retention runner** | `tools/scripts/run-retention.js` (`support_report` handler) | Deletes reports + private screenshots older than 180d; policy-driven; dry-run default. |
| Submit API | `src/pages/api/support/reports.js` | Authenticated `POST` (submit, **rate-limited**); **dev-gated `GET`** (Support Centre list + stats). |
| **Support Centre API** | `src/pages/api/support/reports/[id].js`, `reports/[id]/comments.js` | Dev-only `GET` detail (signed URLs + comments + audit) / `PATCH` triage / comments `GET`/`POST` — all audit-logged. |
| **Support Centre logic** | `src/lib/support/adminView.js`, `supportExport.js`, `savedViews.js` | Pure: badges / impact sort / duplicate grouping / view presets; GitHub-issue / bundle / markdown export; local saved-view persistence. |
| **Support Centre UI** | `src/pages/dev/support-reports/{index,[id]}.js`, `src/components/support/dev/*` | Workspace + detail + shared primitives (`supportDevUi.js`), data hooks (`useSupportAdmin.js`), keyboard shortcuts (`useSupportKeyboard.js`), triage panel. |
| Reporter UI | `src/components/support/{SupportControl,SupportReportModal,SupportScreenshotField}.js` | "?" button + popup + multi-screenshot redact/annotate. |
| Error boundary | `src/components/support/SupportErrorBoundary.js`, `src/lib/support/errorBoundaryDiagnostics.js` | Shell-mounted; recovery screen. |
| Draft persistence | `src/lib/support/supportDraft.js` | Local-only; never leaves the device. |
| **Dev Platform role** | `src/lib/auth/roles.js` (`DEV_PLATFORM_ROLE`/`DEV_PLATFORM_ROLES`/`hasDevPlatformAccess`) | Phase 8 strict `dev` role — absent from `roleCategories` + `DEV_FULL_ACCESS_ROLES`. |
| **Dev Platform mint** | `src/pages/api/auth/[...nextauth].js`, `src/pages/login.js`, `src/components/LoginDropdown.js` (+ `page-ui/login-ui.js`) | Synthetic "Developer" Dev-Login area → `signIn(devPlatform:"1")`; NextAuth branch mints `roles:["dev"]`, gated by `isDevAuthAllowed()`; audits `dev_platform_session`. |
| **Dev Platform shell** | `src/components/dev-platform/{DevPlatformLayout,devPlatformNav,DevHealthPill}.js` | Borderless shared shell (topbar + live health pill + nav rail) applied via per-page `getLayout` — no `_app.js` edit. |
| **Dev Platform pages** | `src/pages/dev/{index,live-ops,health,saved-views,preferences}.js` | Home tiles + live-ops feed (polls `captureDiagnostics()`) + health tiles + saved-views manager + preferences; all `ProtectedRoute`-gated to `DEV`. |
| **Search substrate** | `src/lib/dev-platform/searchEngine.js` | Pure generic `applyQuery(items,{q,searchFields,filters,matchers,sort,sorters})` reused across platform surfaces. |
| **Saved views + prefs data** | `src/lib/database/supportSavedViews.js`, `src/lib/support/savedViewValidation.js` | Service-role, owner-`owner_key`-scoped CRUD + upsert prefs; graceful degradation; pure validation/normalisation split. |
| **Saved views + prefs API** | `src/pages/api/support/saved-views/{index,[id]}.js`, `src/pages/api/support/preferences.js` | Dev-gated (`DEV_PLATFORM_ROLES`) list/create/update/delete + get/put prefs; audit-logged. |
| **Saved views + prefs UI** | `src/components/dev-platform/{useSavedViews,usePreferences}.js` | Server-sync hooks with device-local fallback; `SupportWorkspace.js` now saves views server-side (personal + shared). |
| **Dev Platform audit** | `src/lib/support/devPlatformAudit.js` | `dev_platform_session` / `dev_platform_view` / `dev_platform_action` via the shared hash-chained `writeAuditLog`. |

## Data flow

1. **Idle capture** — provider maintains ring buffers; records route changes + clicks; window
   listeners catch errors/rejections; fetch wrapper logs non-2xx (no bodies).
2. **Open popup** — `captureDiagnostics()` assembles route + device + allowlisted session/flags
   + `build` (with section-map hash) + provider fragments + buffers, **sanitises**, attaches
   `analysis`. Description auto-fills from it (editable).
3. **Submit** — client POSTs `{ description, category, diagnostics, screenshots[] }`.
   The route first applies the **rate limiter** (Phase 7): over the window → 429 + `Retry-After`;
   sustained abuse → one audit entry.
4. **Ingest** (`reports.js`): decode/validate screenshots → `buildReportInsert` (re-sanitise,
   identity-from-session, derive columns incl. build) → build the **investigation** with prior
   fingerprints + live `currentBuild` → embed `investigation`+`fingerprint` if within cap →
   persist via helper (3rd sanitise) → upload screenshots to private bucket → `writeAuditLog`.
5. **Response** — only `{ id, screenshotCount }`. The investigation stays server-side/RLS-locked.

**Developer read/triage flow (Phase 6):** the Support Centre calls the dev-gated
`GET /api/support/reports` (list light rows + investigation-derived JSON subfields + stats),
groups duplicates and impact-sorts client-side, and on a report opens
`GET /api/support/reports/[id]` (full diagnostics + signed screenshot URLs + comments + audit;
writes a `support_report_view` audit). Triage `PATCH` and comment `POST` are optimistic and each
write an audit entry. The full diagnostics blob only ever leaves the DB through these dev-gated,
service-role routes — never a client key.

**Developer Platform flow (Phase 8):** a developer signs in via the synthetic "Developer" area in
the Dev Login → NextAuth mints a `dev`-role session (gated by `isDevAuthAllowed()`) and audits
`dev_platform_session`. Every `/dev/*` page opts into `DevPlatformLayout` via `getLayout` and is
`ProtectedRoute`-gated to `DEV`; the shared `/dev/` always-allowed prefix in `routeAccess.js` lets
the authenticated `dev` session past the edge proxy + `PageAccessGuard`. **Live Ops** reads the
existing sanitised bundle by polling `useSupportReport().captureDiagnostics()` — no new capture
path, no `SupportReportContext` change. **Health** renders the re-gated `/api/support/health`
roll-up. **Saved views + preferences** are server-synced through the dev-gated
`saved-views` / `preferences` APIs (owner-scoped by session `owner_key`, so the synthetic `dev`
identity and any real numeric user both work), each mutation writing a `dev_platform_action`
audit; the client hooks fall back to the device-local store if the server/migration is absent.

## Phase status

| Phase | Title | Status |
|---|---|---|
| 1 | Foundation & data model (SQL, sanitiser, DB helper, private bucket) | ✅ Done |
| 2 | Capture runtime (buffers, provider, `_app.js` mount) | ✅ Done |
| 3 | UI: "?" control + popup + POST route | ✅ Done |
| 4 | Error boundaries | ✅ Done |
| — | Popup polish (DropdownField, auto-description, draft, multi-screenshot) | ✅ Done |
| — | Diagnostic assistant + extension registry | ✅ Done |
| — | Investigation engine (clustering, registry, cache) | ✅ Done |
| 5 | Version / code-state pinning + drift + version range | ✅ Done |
| **6** | **Developer Support Centre (workspace, detail, triage, export, audit)** | ✅ **Done** |
| **7** | **Hardening (rate limit + abuse, retention/cleanup, RLS review, health checks, privacy regression, E2E)** | ✅ **Done** |
| **8** | **Developer Platform — Foundation, Access & Live Operations** (`dev` role + strict access migration, workspace shell, live diagnostics, application health, search/filter substrate, saved workspaces, preferences) | 🚧 **Foundational core done** (palette / notification delivery / quick-actions = immediate follow-up) |
| **9** | **Developer Platform — Intelligence** (investigation & release dashboards, intelligent issue management, regression tracking, code ownership + dependency mapping, performance profiling, API/DB tracing) | ⏳ Planned |
| **10** | **Developer Platform — Integration, Extensibility & Enterprise Hardening** (deep GitHub integration, plugin architecture, full developer-action audit sweep, enterprise responsiveness/accessibility) | ⏳ Planned |

**Phases 1–7 are delivered and production-ready** — capture, analysis, investigation, version
pinning, the developer Support Centre, and the hardening layer are all in place, tested, and
privacy-verified end to end. **Phase 8's foundational core is now delivered** (the `dev` role +
strict re-gate, the `/dev` platform shell + home, the live-operations and application-health
dashboards, the shared search/filter engine, server-synced saved views + preferences, and the
platform audit baseline). The remaining Phase 8 items (command palette, notification *delivery*,
quick actions) are the **immediate Phase 8 follow-up** (see [Outstanding work](#outstanding-work));
**Phases 9–10 are still planned** and scoped in the
[Developer Platform roadmap](#developer-platform-roadmap--the-final-three-phases).

**Verification (current):** `npm run test:unit` → **290 pass** (27 files) — Phase 8 adds
`src/lib/dev-platform/searchEngine.test.js`, `src/lib/support/savedViewValidation.test.js`, and
`src/lib/auth/roles.test.js` (which asserts the `dev` role is absent from `roleCategories` and
`DEV_FULL_ACCESS_ROLES`). The one failing suite in the run — `reportingActivation.test.js` — is a
pre-existing, unrelated missing-SQL-file issue in the Reporting platform, not the support feature.
`check:borders` / `check:layers` / `check:encoding` pass. `uk:check` clean for all support +
dev-platform files (only pre-existing `.agents/skills/**` hits remain). `eslint` clean on all
changed files. Playwright: the **unauthenticated permission-gate** tests in
`e2e/workflows/support-centre.spec.js` still pass (and are now stronger — a broad staff role no
longer gets in). The **authenticated-developer** tests in that spec sign in via the shared
`e2e/.auth/user.json` (a broad dev-access staff user), which the strict re-gate now excludes — so
that auth fixture must be switched to a `dev`-role session (the `devPlatform:"1"` credential mint)
before those tests pass again. Tracked in [Manual actions](#manual-actions-outstanding).

## Developer Platform roadmap — the final three phases

Phases 1–7 built the Help & Diagnostics **reporting/support** system (the "?" reporter + the
developer Support Centre). Phases **8–10** extend it into a full internal **Developer Platform**,
gated on a new `dev` role that exists **only** inside the Dev Login and is **never** an assignable
staff role (approved: a synthetic "Developer" area in the Dev Login mints the role in code; it is
kept out of `roleCategories` and every HR role-assignment surface). The user-facing "Report a
problem" flow stays deliberately simple and open to all authenticated staff; every developer-only
surface moves behind `dev` (**strict dev-only** — managers/admins lose the Support Centre).

All remaining work — including every item previously tracked as a granular future idea — is
consolidated here into exactly **three comprehensive phases**. **Implementation order is strict:
8 → 9 → 10.**

### Phase 8 — Foundation, Access & Live Operations  🚩 *(holds the only global-architecture change)* — 🚧 *foundational core delivered*

**Goal:** stand up the platform skeleton, the new role, and the always-on observability + UX
plumbing every later surface builds on.

**Delivered this pass:** the `dev` role + strict re-gate, the `/dev` shell + home, live-ops +
health dashboards, the shared search engine, server-synced saved views + preferences, and the
audit baseline. **Still to do (immediate Phase 8 follow-up):** command palette / quick actions,
notification *delivery* (preferences are already stored), and a push/stream Live Ops upgrade.
The HR-assignment exclusion is enforced structurally (the `dev` role is never in `roleCategories`
which is the only source `EmployeesTab.js` reads) and asserted by `src/lib/auth/roles.test.js`, so
no edit to `EmployeesTab.js` / `EmployeeProfilePanel.js` was required.

**Scope (grouped):**
- **The `dev` role + Dev Login "Developer" area** — `DEV_PLATFORM_ROLE = "dev"` /
  `DEV_PLATFORM_ROLES` + `hasDevPlatformAccess()` in `roles.js`, minted by a synthetic Developer
  entry in the Dev Login (`LoginDropdown.js` / `login.js` / NextAuth credentials), gated by
  `isDevAuthAllowed()`; excluded from `roleCategories` and the HR role-assignment surfaces
  (`EmployeesTab.js` / `EmployeeProfilePanel.js`), asserted by test.
- **Strict dev-only migration** — re-gate `/dev/support-reports` (+ `[id]`) and all `api/support/*`
  developer routes from `DEV_FULL_ACCESS_ROLES` → `DEV_PLATFORM_ROLES`. The reporter POST stays
  authenticated-only; the "?" modal is untouched and stays simple.
- **Workspace shell** — a `/dev` platform home + `DevPlatformLayout` (`src/components/dev-platform/`)
  with navigation to every platform area; the Support Centre re-homes under it.
- **Live diagnostics feed + application-health dashboard** — surface the capture ring buffers live
  for `dev`, and roll up `healthChecks.js` / `/api/support/health` into status tiles with subsystem
  drill-down.
- **Searchable diagnostics + advanced filtering substrate** — the shared search/filter engine
  reused by every later dashboard.
- **Custom saved workspaces + developer/notification preferences + productivity tools** —
  server-synced saved views (upgrading local `savedViews.js`), a preferences store, notification
  preferences, and a command palette / quick actions.
- **Audit baseline** — `dev` session establishment + platform access hash-chain logged.

**Folds in (former backlog):** server-synced + shared team saved views.
**Dependencies:** none — this is the first phase.
**Flags:** the global auth change (approved above); a **new `support_saved_views` DB migration**
(flag before applying).

### Phase 9 — Intelligence: Investigation, Releases, Ownership, Performance & Tracing

**Goal:** turn captured data into analytical developer dashboards on top of the Phase 8 substrate.

**Scope (grouped):**
- **Investigation dashboards + intelligent issue management** — aggregate `investigation.js` /
  `incidentClustering.js` across reports; smart queues, bulk triage (one audit entry per report),
  user-picker assignment, duplicate/regression surfacing over `adminView.js`; server-side /
  materialised stats.
- **Release & deployment insights + regression tracking** — a deployment registry + release views
  from `buildInfo.js` / `versionHistory`; regression tracking + auto-reopen on
  `versionHistory.isRegression`; per-incident version timeline.
- **Code ownership + dependency mapping** — an ownership explorer over `sectionSourceMap.js`, a
  module dependency graph + impact mapping, in-app source references.
- **Performance profiling + API/DB tracing** — perf panels (extend `devMetadataProvider`), an API
  request timeline (no bodies), and a new query-timing diagnostic provider (names/durations only,
  sanitiser-clean).

**Folds in (former backlog):** bulk triage; user-picker assignment; server-side/materialised stats;
cross-release regression alerting / auto-reopen; in-app source-reference viewer.
**Dependencies:** requires **Phase 8** (role, shell, search/filter substrate, live data).
**Flags:** none for existing tables — flag any new store a DB/perf-tracing provider needs.

### Phase 10 — Integration, Extensibility & Enterprise Hardening

**Goal:** connect outward, make the platform extensible, and hit the enterprise quality bar.

**Scope (grouped):**
- **Deep GitHub integration** — two-way issue create/link/sync via the GitHub API (not just a
  prefilled URL), PR/commit linkage, ownership → GitHub blob deep-links at the captured commit.
- **Extensible plugin architecture** — formalise + document a plugin API extending
  `diagnosticRegistry` / `investigationRegistry` so future diagnostics register without core edits.
- **Comprehensive developer-action audit sweep** — every platform action (view, filter, export,
  triage, preference change, integration call) hash-chain logged, with a coverage test.
- **Enterprise responsiveness & usability** — a formal Lighthouse/axe pass, keyboard-navigation
  matrix, and mobile/tablet verification across every platform surface.

**Folds in (former backlog):** two-way issue-tracker integration; GitHub source deep-links; the
accessibility/responsiveness portion of the former QA pass.
**Dependencies:** requires **Phases 8 and 9** (needs all surfaces present to audit-sweep and
polish; GitHub sync builds on Phase 9 issue management).
**Flags:** any GitHub-sync persistence + token configuration (flag before applying).

**Dependency summary:** strictly sequential **8 → 9 → 10**. Phase 8 is self-contained and holds the
global change; Phase 9 depends on Phase 8's substrate; Phase 10 depends on both.

## Outstanding work

- **Phases 1–7 (the reporting/support system) have no blocking work.**
- **Phase 8 foundational core is delivered** (role + strict re-gate, `/dev` shell + home,
  live-ops + health dashboards, shared search engine, server-synced saved views + preferences,
  audit baseline). The **immediate Phase 8 follow-up** — deliberately deferred, not backlogged —
  is: a **command palette / quick actions** across the shell, and **notification *delivery*** on
  top of the already-stored notification *preferences* (`support_user_preferences`). The live-ops
  feed is currently **polled**; a push/stream upgrade is part of the same follow-up.
- The remaining program is **Phase 9** (intelligence) then **Phase 10** (integration,
  extensibility, enterprise hardening), delivered strictly in that order. Genuinely postponed
  ideas are in the [Future Improvements backlog](#future-improvements-backlog).

## Known limitations

- **Component tests are logic-level + Playwright, not React-rendered** — no jsdom/RTL in the
  repo, so the rendered crash→recovery→report flow is covered by Playwright rather than unit
  RTL tests. A jsdom/RTL harness for the reporter modal + recovery screen stays in the backlog.
- **Drift/version pinning depends on deploy env** — locally `commit_sha` is empty (defaults to
  `dev`/version), so drift returns `unknown` and `versionRange` groups by version only. Full
  fidelity requires Vercel's `VERCEL_GIT_*` (auto in prod/preview) and CI feeding the generator's
  `SECTION_MAP_HASH` into `NEXT_PUBLIC_SECTION_MAP_HASH`.
- **Source-map verification is commit-level, not line-level** — `detectCodeDrift` compares
  commit SHA + map hash, not per-`file:line` content hashes, so it flags *that* code moved, not
  *which* line moved.
- **Screenshot clustering uses an exact content hash** (djb2), not a perceptual hash — identical
  images cluster; near-duplicates do not (a perceptual hash needs an image dependency we avoid).
- **Per-component render frequency is approximated** by recent route churn (no render
  instrumentation by design).
- **Support Centre stats are folded in JS** over a bounded window (≤1000 recent rows), not a
  SQL `GROUP BY` — fine for a dev tool, not for very large tables.
- **Duplicate grouping is exact-key** (canonical fingerprint hash) in the list; fuzzy
  near-duplicate matching stays in the investigation engine's `similarIncidents`.
- **Assignment is assign-to-me / unassign** (+ raw user id) — there is no user-picker directory
  yet; the assignee shows as `User #id` when it isn't the current user.
- **Source references copy `file:line`** (no in-app source viewer / editor deep-link), and the
  one-click GitHub issue only *opens* when `NEXT_PUBLIC_GITHUB_REPO` is set (otherwise it copies).
- **The E2E triage workflow self-skips** when no reports exist (E2E may run against a stub DB).
- **Rate limiting is process-local** (Phase 7) — the sliding-window store lives in one
  serverless instance's memory, so it resets on cold start and doesn't coordinate across
  instances. Adequate for a human-scale internal dev tool + the abuse-audit signal; a shared
  store (Redis / a DB counter) is backlogged for multi-instance strict enforcement.
- **Retention window is a fixed 180 days** in the `support_report` handler (not read from the
  policy row's descriptive `retention_period` text). Changing it is a one-line code edit; a
  machine-readable period column is a future enhancement.
- **Free-text secret scrubbing is pattern-based** — a token/PII with a recognisable shape (JWT,
  Bearer, prefixed key, NINO, card, email) is stripped from the typed title/description, but an
  arbitrary password typed in prose has no detectable shape and is only redactable by secret
  **key name**. Documented and asserted by the privacy-regression suite.
- **Health `rls` check is an invariant assertion, not a live `pg_policies` query** — it reports
  that access is service-role-only by design (the tables have RLS on, no policies) rather than
  re-querying the catalogue, which would need extra grants.
- **Performance / accessibility / resilience were reviewed, not exhaustively audited** — capture
  uses capped ring buffers, the Support Centre list is windowed + lazy, and the reporter modal is
  lazy-loaded; a formal Lighthouse/axe pass + offline/interrupted-upload resilience matrix is
  backlogged as a dedicated QA phase rather than claimed here.
- **The Live Ops feed is polled, not pushed** (Phase 8) — it snapshots the existing sanitised
  `captureDiagnostics()` bundle every ~4s rather than subscribing to the ring buffers, which keeps
  `SupportReportContext` untouched and adds no new privacy surface. A push/stream upgrade is part
  of the Phase 8 follow-up.
- **Health polls are intentionally *not* audited** (Phase 8) — the health roll-up is a read-only,
  content-free status probe hit every ~30s by the shell health pill + Live Ops, so auditing it
  would flood the log. Saved-view / preference mutations and dev-session establishment *are*
  audited (`dev_platform_*`).
- **Dev Platform ownership is keyed by a text `owner_key`** (Phase 8), not a `users` FK, because
  the `dev` role is synthetic (no `users` row; key = `dev-platform`). A real numeric user carrying
  the role keys by their stringified id. Shared views are visible to all `dev` sessions but
  editable/deletable only by their owner key.
- **Dev role is env-gated in production** (Phase 8) — the synthetic "Developer" Dev-Login mint is
  refused unless `isDevAuthAllowed()` (i.e. non-production, or `ALLOW_DEV_AUTH=1`). Where it is
  off, the Support Centre + platform are unreachable *by design* (admins/managers no longer have
  access after the strict re-gate); enabling the platform in prod is a deliberate env decision.
- **Server-synced saved views/preferences degrade to device-local** (Phase 8) — if the migration
  isn't applied or the service-role client is absent, the hooks transparently fall back to the
  original `savedViews.js` local store, so the Support Centre never breaks.

## Manual actions outstanding

- **Apply the migration** — run `src/lib/database/schema/support/000_support.sql` in the
  Supabase SQL editor (repo applies SQL manually). Idempotent; adds the Phase 6 columns
  `support_reports.duplicate_of` (+ self-FK / index) and `support_report_comments.author_username`
  via `ADD COLUMN IF NOT EXISTS`, (Phase 7) seeds the `support_report` **retention policy row**
  — guarded on `retention_policies` existing — and (Phase 8) creates the **`support_saved_views`**
  and **`support_user_preferences`** tables (RLS on, no policies; `CREATE TABLE IF NOT EXISTS`).
  Until these two run, the Developer Platform saved-views/preferences hooks transparently fall
  back to the device-local store. Safe to re-run.
- **Enable the Developer Platform where you want it reachable** (Phase 8) — the synthetic
  "Developer" Dev-Login mint is gated by `isDevAuthAllowed()`, so it works automatically outside
  production and only in production when `ALLOW_DEV_AUTH=1` is set. This is the intended gate now
  that the Support Centre is strictly `dev`-only (managers/admins lost the broad access).
- **Schedule retention** — run `npm run retention:dry-run` to preview, then
  `npm run retention:apply` on a cron (e.g. Vercel Cron / a scheduled job) so reports +
  screenshots older than 180 days are cleaned automatically. Requires
  `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL`.
- **Wire the health check into uptime monitoring** — point an authenticated dev probe at
  `GET /api/support/health` (503 on any subsystem failure, including the sanitiser canary).
- **Update the E2E auth fixture to a `dev` session** (Phase 8) — the authenticated-developer tests
  in `e2e/workflows/support-centre.spec.js` rely on `e2e/.auth/user.json`, which is a broad
  dev-access staff user now excluded by the strict re-gate. Update the Playwright auth-setup to
  establish a `dev`-role session (sign in with the `devPlatform:"1"` credential, or seed a `dev`
  storage state) so the workspace/list/triage tests pass again. The permission-gate tests already
  pass unchanged.
- **CI: stamp the section-map hash** — have the build run the section-source-map generator and
  capture its `SECTION_MAP_HASH=…` output into `NEXT_PUBLIC_SECTION_MAP_HASH` so
  `verifySectionMap` can report `match`/`drift` in production. (Vercel already injects
  `VERCEL_GIT_*`, so commit/ref/env/url populate automatically.)

## Future Improvements backlog

**This backlog has been reorganised.** The previously granular future phases are consolidated into
the three comprehensive phases in the
[Developer Platform roadmap](#developer-platform-roadmap--the-final-three-phases). In-scope ideas
that used to live here have been **folded into a phase**:

- **→ Phase 8:** server-synced + shared team saved views.
- **→ Phase 9:** cross-release regression alerting / auto-reopen; bulk triage; user-picker
  assignment; server-side / materialised stats; in-app source-reference viewer.
- **→ Phase 10:** two-way issue-tracker integration; GitHub source deep-links; the accessibility /
  responsiveness portion of the former QA pass.

The items below are **intentionally postponed beyond the three-phase program** — genuine future
enhancements, not planned work. Do not implement without a dedicated phase of their own.

- **Shared / distributed rate-limit store**: replace the process-local sliding window with a Redis
  or DB-backed counter for strict cross-instance enforcement (current limiter is per-instance).
- **Machine-readable retention period**: read the delete window from a numeric policy column
  instead of the fixed 180-day constant in the handler.
- **React-rendered component tests (jsdom / RTL)**: a rendering harness for the reporter modal,
  screenshot redactor, and crash→recovery screen (currently Playwright-only for rendered flows).
- **Offline / interrupted-upload / concurrent-edit resilience matrix**: the resilience half of the
  former QA pass (the accessibility/responsiveness half is now Phase 10).
- **Bundle-size deep-dive**: measure and trim the Support Centre / platform bundles beyond the
  existing lazy-loading.
- **Commit → section-map-hash registry**: persist each deployment's map hash so historical reports
  can be verified/re-resolved against the exact map they shipped with.
- **Line-level drift + stack symbolication**: per-`file:line` content hashes to detect *which* line
  moved, and build source maps to symbolicate minified production stacks.
- **Perceptual screenshot hashing** for near-duplicate incident clustering.
- **Wire the map generator into the build script** (`prebuild`) so the shipped map is always fresh
  and its hash is always stamped (CI/tooling task).

---

## Standing handoff prompt

> Paste verbatim into ChatGPT, attaching **the single file** `docs/Support/help-diagnostics.md`.

```
You are reviewing an in-progress implementation of the "Help & Diagnostics" feature for the HNPSystem Next.js (Pages Router) + Supabase app. I'm attaching one file: the living system document (docs/Support/help-diagnostics.md) which contains the architecture (Part A), the current system state — module map, data flow, phase status, outstanding work, known limitations, manual actions, and the Future Improvements backlog (Part B) — and this prompt. Using ONLY that file as the source of truth, do three things and nothing else: (1) AUDIT — compare what the module map / phase table say is built against the architecture and list any sections, requirements, privacy/sanitisation rules, edge cases, columns, or constraints that are missing, partial, or deviate, ranked by risk; flag especially anything touching privacy/secret-leakage, RLS, audit, or permissions; (2) CONFIRM NEXT PHASE — state which phase is next per the phase table and call out any global-architecture file it will touch (_app.js, next.config, Layout/Sidebar/Card/theme/globals/context) that must be explicitly flagged for approval before editing; (3) WRITE THE NEXT PROMPT — produce a single ready-to-copy implementation prompt for the next phase that reuses existing repo patterns (popup, auth/role, audit, storage, dev-layout source map, styling per CLAUDE.md), keeps the feature separate from the existing Reporting/KPI system, names the exact files to create/edit, lists the tests to add, and tells the implementer to stop and flag any risky global change before making it. Keep the feature namespaced "support" throughout, remind the implementer to UPDATE docs/Support/help-diagnostics.md IN PLACE (refresh the current-state sections; never append a historical changelog or re-create the old plan/progress split), and to move any out-of-scope ideas into the Future Improvements backlog. Do not write code yourself — only the audit and the next prompt.
```
