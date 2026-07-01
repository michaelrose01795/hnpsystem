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

**All planned phases are delivered.** The feature is production-ready: capture, analysis,
investigation, version pinning, the developer Support Centre, and the hardening layer are all
in place, tested, and privacy-verified end to end.

**Verification (current):** `npx vitest run src/lib/support/` → **196 pass** (21 files) — Phase 7
adds `rateLimit.test.js`, `healthChecks.test.js`, and the `privacyRegression.test.js` suite.
`check:borders` / `check:layers` / `check:encoding` pass. `uk:check` clean for all support
files (only pre-existing `.agents/skills/**` hits remain). `eslint` clean on all changed files.
Playwright: `e2e/workflows/support-centre.spec.js` covers permission gating, the triage
workflow, health-endpoint gating, and an end-to-end privacy probe (run with a dev server + DB
via `npm run test:workflows`).

## Outstanding work

- **None blocking.** All seven phases are complete. Remaining opportunities are quality-of-life
  and scale items captured in the [Future Improvements backlog](#future-improvements-backlog)
  (server-side stats, user-picker assignment, perceptual screenshot hashing, cross-release
  regression auto-reopen, React-rendered component tests, a shared/persistent rate-limit store,
  and full performance/accessibility audit passes). None are required for production use; each
  needs its own scoped phase before implementation.

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

## Manual actions outstanding

- **Apply the migration** — run `src/lib/database/schema/support/000_support.sql` in the
  Supabase SQL editor (repo applies SQL manually). Idempotent; adds the Phase 6 columns
  `support_reports.duplicate_of` (+ self-FK / index) and `support_report_comments.author_username`
  via `ADD COLUMN IF NOT EXISTS`, and (Phase 7) seeds the `support_report` **retention policy row**
  — guarded on `retention_policies` existing, so it's a no-op where the compliance module isn't
  applied. Safe to re-run.
- **Schedule retention** — run `npm run retention:dry-run` to preview, then
  `npm run retention:apply` on a cron (e.g. Vercel Cron / a scheduled job) so reports +
  screenshots older than 180 days are cleaned automatically. Requires
  `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL`.
- **Wire the health check into uptime monitoring** — point an authenticated dev probe at
  `GET /api/support/health` (503 on any subsystem failure, including the sanitiser canary).
- **CI: stamp the section-map hash** — have the build run the section-source-map generator and
  capture its `SECTION_MAP_HASH=…` output into `NEXT_PUBLIC_SECTION_MAP_HASH` so
  `verifySectionMap` can report `match`/`drift` in production. (Vercel already injects
  `VERCEL_GIT_*`, so commit/ref/env/url populate automatically.)

## Future Improvements backlog

Ideas surfaced but **deliberately out of scope** — do not implement without a dedicated phase.

- **Shared / distributed rate-limit store**: replace the process-local sliding window with a
  Redis or DB-backed counter for strict cross-instance enforcement (current limiter is
  per-instance; see Known limitations).
- **Machine-readable retention period**: read the delete window from a numeric policy column
  instead of the fixed 180-day constant in the handler.
- **React-rendered component tests (jsdom / RTL)**: a rendering harness for the reporter modal,
  screenshot redactor, and crash→recovery screen (currently Playwright-only for rendered flows).
- **Formal performance + accessibility + resilience QA pass**: a dedicated phase for a
  Lighthouse/axe audit, keyboard-navigation matrix, mobile/tablet verification, and an
  offline / interrupted-upload / concurrent-edit resilience matrix (reviewed informally in
  Phase 7, not exhaustively audited).
- **Bundle-size deep-dive**: measure and trim the Support Centre / investigation bundles beyond
  the existing lazy-loading of the reporter modal.
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
- **User-picker assignment**: assign to any user via the users directory (name search), not just
  assign-to-me; resolve `assigned_to` → username in the list/detail.
- **Server-side / materialised stats**: move the dashboard aggregation to SQL (or a periodic
  materialised view) so it scales beyond the windowed in-JS fold.
- **Bulk triage**: multi-select in the queue to change status/severity/assignee for many reports
  at once (with one audit entry per report).
- **Server-synced saved views + shared team views** (currently local-only per device).
- **In-app source viewer / editor deep-links** (e.g. `vscode://` or a GitHub blob link at the
  captured commit) so `file:line` is truly click-to-open, honouring detected code drift.
- **Regression auto-reopen**: when a `resolved` report's fingerprint reappears in a newer
  `app_version`, auto-reopen and notify — building on `versionHistory.isRegression`.
- **Two-way issue-tracker integration** (create/link/sync via the GitHub/Jira API rather than a
  prefilled new-issue URL).

---

## Standing handoff prompt

> Paste verbatim into ChatGPT, attaching **the single file** `docs/Support/help-diagnostics.md`.

```
You are reviewing an in-progress implementation of the "Help & Diagnostics" feature for the HNPSystem Next.js (Pages Router) + Supabase app. I'm attaching one file: the living system document (docs/Support/help-diagnostics.md) which contains the architecture (Part A), the current system state — module map, data flow, phase status, outstanding work, known limitations, manual actions, and the Future Improvements backlog (Part B) — and this prompt. Using ONLY that file as the source of truth, do three things and nothing else: (1) AUDIT — compare what the module map / phase table say is built against the architecture and list any sections, requirements, privacy/sanitisation rules, edge cases, columns, or constraints that are missing, partial, or deviate, ranked by risk; flag especially anything touching privacy/secret-leakage, RLS, audit, or permissions; (2) CONFIRM NEXT PHASE — state which phase is next per the phase table and call out any global-architecture file it will touch (_app.js, next.config, Layout/Sidebar/Card/theme/globals/context) that must be explicitly flagged for approval before editing; (3) WRITE THE NEXT PROMPT — produce a single ready-to-copy implementation prompt for the next phase that reuses existing repo patterns (popup, auth/role, audit, storage, dev-layout source map, styling per CLAUDE.md), keeps the feature separate from the existing Reporting/KPI system, names the exact files to create/edit, lists the tests to add, and tells the implementer to stop and flag any risky global change before making it. Keep the feature namespaced "support" throughout, remind the implementer to UPDATE docs/Support/help-diagnostics.md IN PLACE (refresh the current-state sections; never append a historical changelog or re-create the old plan/progress split), and to move any out-of-scope ideas into the Future Improvements backlog. Do not write code yourself — only the audit and the next prompt.
```
