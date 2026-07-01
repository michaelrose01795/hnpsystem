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

## 7. Dev-only viewer — **Phase 6 (pending)**

Role-gated `/dev/support-reports` (+ `[id]`) via `ProtectedRoute` + `DEV_FULL_ACCESS_ROLES`:
list with filters; detail with screenshot (signed URL), full diagnostics, clickable
code-ownership `file:line`, the investigation + `codeState`/`versionHistory`, copy-dev-bundle,
and triage actions (status/severity/assign/comment) — all audit-logged.

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
| Schema / migration | `src/lib/database/schema/support/000_support.sql` (+ `schemaReference.sql`) | `support_reports` + `support_report_comments`; RLS, no policies; idempotent. |
| Privacy scrubber | `src/lib/support/sanitise.js` | Single source of truth; key-name + value-pattern redaction; 256 KB cap. |
| DB helper | `src/lib/database/support.js` | CRUD; `listRecentReportFingerprints` (fingerprint + `app_version`/`commit_sha` only). |
| Private storage | `src/lib/storage/supportMediaBucketService.js` | `public:false` bucket; short-TTL signed URLs; MIME/size validation. |
| Capture core | `src/lib/support/diagnostics.js` | Ring buffers + `installBrowserCapture` + `captureDiagnostics`. |
| Capture provider | `src/context/SupportReportContext.js` | Mounted in `_app.js`; owns the store; stamps `build`. |
| **Build / code-state** | `src/lib/support/buildInfo.js` | `readBuildInfo` / `verifySectionMap` / `detectCodeDrift` / `describeBuild`. |
| **Build exposure** | `next.config.mjs`, `src/lib/dev-layout/sectionSourceMap.js`, `tools/scripts/generate-dev-layout-section-source-map.js` | `NEXT_PUBLIC_*` env + `generateBuildId`; `getSectionSourceMapHash()`; generator emits map hash. |
| Analysis engine | `src/lib/support/diagnosticAnalysis.js`, `actionSummary.js` | Incidents/trigger/probable cause; enriched description. |
| Diagnostic registry | `src/lib/support/diagnosticRegistry.js`, `providers/{uiStateProvider,devMetadataProvider,index}.js` | Extension point + built-ins. |
| Investigation engine | `src/lib/support/investigation.js`, `incidentClustering.js`, `investigationRegistry.js`, `investigationCache.js` | Dev-only; server-side at ingest; `codeState` + `versionHistory`. |
| Submit helpers | `src/lib/support/reportSubmission.js` | Pure; re-sanitise, identity-from-session, column derivation, screenshot decode. |
| API route | `src/pages/api/support/reports.js` | Authenticated `POST`; upload; investigation; audit. |
| UI | `src/components/support/{SupportControl,SupportReportModal,SupportScreenshotField}.js` | "?" button + popup + multi-screenshot redact/annotate. |
| Error boundary | `src/components/support/SupportErrorBoundary.js`, `src/lib/support/errorBoundaryDiagnostics.js` | Shell-mounted; recovery screen. |
| Draft persistence | `src/lib/support/supportDraft.js` | Local-only; never leaves the device. |

## Data flow

1. **Idle capture** — provider maintains ring buffers; records route changes + clicks; window
   listeners catch errors/rejections; fetch wrapper logs non-2xx (no bodies).
2. **Open popup** — `captureDiagnostics()` assembles route + device + allowlisted session/flags
   + `build` (with section-map hash) + provider fragments + buffers, **sanitises**, attaches
   `analysis`. Description auto-fills from it (editable).
3. **Submit** — client POSTs `{ description, category, diagnostics, screenshots[] }`.
4. **Ingest** (`reports.js`): decode/validate screenshots → `buildReportInsert` (re-sanitise,
   identity-from-session, derive columns incl. build) → build the **investigation** with prior
   fingerprints + live `currentBuild` → embed `investigation`+`fingerprint` if within cap →
   persist via helper (3rd sanitise) → upload screenshots to private bucket → `writeAuditLog`.
5. **Response** — only `{ id, screenshotCount }`. The investigation stays server-side/RLS-locked.

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
| **5** | **Version / code-state pinning + drift + version range** | ✅ **Done** |
| 6 | Dev viewer, triage & audit | ⬜ Pending |
| 7 | Hardening (rate limit, retention, RLS review, E2E + privacy regression) | ⬜ Pending |

**Verification (current):** `npx vitest run src/lib/support/` → **141 pass** (14 files).
`check:borders` / `check:layers` / `check:encoding` pass. `uk:check` clean for all support
files (only pre-existing `.agents/skills/**` hits remain). `eslint` clean (0 errors).

## Outstanding work

- **Phase 6 — Dev viewer, triage & audit.** Build `/dev/support-reports` (+ `[id]`) as above.
  It will render the Phase 5 `codeState`/`versionHistory` and clickable `file:line`. Do **not**
  start Phase 7 (hardening) or the viewer until Phase 5 is confirmed complete (it now is).
- **Phase 7 — Hardening.** Rate-limit the POST, add retention to `run-retention.js`, RLS review,
  Playwright submit-flow + admin-gating + **privacy-regression** tests (planted-secret assertion),
  React-rendered UI tests.

## Known limitations

- **Tests are logic-level, not React-rendered** — no jsdom/RTL in the repo; the rendered
  crash→recovery→report + submit flow is assigned to Playwright in Phase 7.
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

## Manual actions outstanding

- **Apply the migration** — run `src/lib/database/schema/support/000_support.sql` in the
  Supabase SQL editor (repo applies SQL manually). Idempotent; includes the
  `screenshot_paths text[]` `ADD COLUMN IF NOT EXISTS`.
- **CI: stamp the section-map hash** — have the build run the section-source-map generator and
  capture its `SECTION_MAP_HASH=…` output into `NEXT_PUBLIC_SECTION_MAP_HASH` so
  `verifySectionMap` can report `match`/`drift` in production. (Vercel already injects
  `VERCEL_GIT_*`, so commit/ref/env/url populate automatically.)

## Future Improvements backlog

Ideas surfaced but **deliberately out of scope** — do not implement without a dedicated phase.

- **Cross-release regression alerting** (Phase 6+): when a `resolved` report's fingerprint
  reappears in a newer `app_version`, auto-reopen / flag it as a regression using the existing
  `versionHistory.isRegression` signal; surface a per-incident version timeline in the viewer.
- **Commit → section-map-hash registry**: persist each deployment's map hash so historical
  reports can be verified/re-resolved against the exact map they shipped with.
- **Line-level drift**: store a content hash per captured `file:line` to detect *which* line
  moved, and auto re-resolve `file:line` against the current commit when drift is detected.
- **Stack symbolication**: use build source maps to symbolicate minified production stacks.
- **Perceptual screenshot hashing** for near-duplicate incident clustering.
- **Wire the map generator into the build script** (`prebuild`) so the shipped map is always
  fresh and its hash is always stamped.

---

## Standing handoff prompt

> Paste verbatim into ChatGPT, attaching **the single file** `docs/Support/help-diagnostics.md`.

```
You are reviewing an in-progress implementation of the "Help & Diagnostics" feature for the HNPSystem Next.js (Pages Router) + Supabase app. I'm attaching one file: the living system document (docs/Support/help-diagnostics.md) which contains the architecture (Part A), the current system state — module map, data flow, phase status, outstanding work, known limitations, manual actions, and the Future Improvements backlog (Part B) — and this prompt. Using ONLY that file as the source of truth, do three things and nothing else: (1) AUDIT — compare what the module map / phase table say is built against the architecture and list any sections, requirements, privacy/sanitisation rules, edge cases, columns, or constraints that are missing, partial, or deviate, ranked by risk; flag especially anything touching privacy/secret-leakage, RLS, audit, or permissions; (2) CONFIRM NEXT PHASE — state which phase is next per the phase table and call out any global-architecture file it will touch (_app.js, next.config, Layout/Sidebar/Card/theme/globals/context) that must be explicitly flagged for approval before editing; (3) WRITE THE NEXT PROMPT — produce a single ready-to-copy implementation prompt for the next phase that reuses existing repo patterns (popup, auth/role, audit, storage, dev-layout source map, styling per CLAUDE.md), keeps the feature separate from the existing Reporting/KPI system, names the exact files to create/edit, lists the tests to add, and tells the implementer to stop and flag any risky global change before making it. Keep the feature namespaced "support" throughout, remind the implementer to UPDATE docs/Support/help-diagnostics.md IN PLACE (refresh the current-state sections; never append a historical changelog or re-create the old plan/progress split), and to move any out-of-scope ideas into the Future Improvements backlog. Do not write code yourself — only the audit and the next prompt.
```
