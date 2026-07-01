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

## 10b. Developer Platform intelligence — **Phase 9 (done)**

Turns the captured data into analytical developer dashboards on top of the Phase 8
substrate. **Purely additive** — no schema migration, no global-architecture change: new
pure `src/lib/dev-platform/` engines, two dev-gated API routes, four `/dev/*` dashboards, and
two `src/lib/database/support.js` helpers that reuse the **existing** columns + the derived
`diagnostics->investigation->…` JSON subfields (never the RLS-locked blob).

- **Intelligence engine** (`intelligence.js`): pure cross-report analytics over the LIGHT rows —
  `rollup` (open/regressions/drift/avg-confidence/distinct problem areas), `trendSeries` (daily
  buckets), `problemAreas` (route/section impact ranking with recency weighting), `clusterIncidents`
  (recurring fingerprint clusters), and `predictiveInsights` (areas whose volume is *rising* vs the
  prior window — surfaced before they escalate). `buildIntelligence` composes the payload.
- **Release intelligence** (`releaseIntelligence.js`): reconstructs a **deployment registry** from
  the version/commit columns Phase 5 stamps, scores per-release quality, builds a **deployment
  timeline** (with quality delta per deploy), tracks **incidents across releases**
  (`incidentVersionTimeline`), and computes **auto-reopen candidates** — a resolved/won't-fix report
  flagged as a regression → recommend reopening (patch `status → triaged`).
- **Ownership graph** (`ownershipGraph.js`): reuses the code ownership the capture engine already
  resolves for free (`source_file`/`source_line` via `data-dev-section-key` → section map) into an
  **ownership explorer** (files ranked by open+total, with clickable source refs), **module impact**
  roll-ups, a weighted **route → module dependency/impact graph**, and **affected features**.
- **Performance insights** (`performanceInsights.js`): PURE over a single sanitised snapshot (the
  exact Live Ops bundle) — `endpointStats` (failing/slow endpoints), `requestTimeline`, `perfMetrics`
  (dev-metadata timing/memory/network), and `executionFlow`. **Names + durations only, never
  request bodies** — no new capture path, no new privacy surface.
- **Issue management** (`bulkTriage.js` + `developerDirectory.js`): pure **bulk-triage validation**
  (reuses `buildTriagePatch`; de-dupes + caps ids; `duplicate_of` intentionally not bulk-settable)
  and a **searchable developer directory** built from the reporter/assignee identities already on the
  reports (the `dev` role is synthetic — no users directory to page).
- **APIs**: dev-gated `GET /api/support/intelligence` runs `buildIntelligence`/`buildReleaseIntelligence`/
  `buildOwnershipMap`/`buildDeveloperDirectory` **server-side** over `listReportsForIntelligence`
  (bounded window; audited `dev_platform_view`); dev-gated `POST /api/support/reports/bulk` applies a
  validated patch via `bulkUpdateSupportReports` and writes **one audit entry per report** (serves
  both manual bulk triage and the one-click regression auto-reopen).
- **Dashboards** (`/dev/intelligence`, `/dev/releases`, `/dev/ownership`, `/dev/performance`) via the
  Phase 8 shell + `useIntelligence` hook + `DeveloperPicker` (built on the canonical `DropdownField`).
  Intelligence + Releases + Ownership read the server aggregates; Performance profiles the **live
  session** client-side. All strictly `dev`-gated, CLAUDE.md-compliant (LayerSurface/LayerTheme,
  borderless, tokens, 44px).

**Privacy:** every engine reads only already-sanitised, dev-only derived values (the same JSON
subfields the Support Centre list already exposes) or the live sanitised snapshot. No new column, no
new store, no widening of the diagnostics surface.

## 10c. Developer Platform — Integration, Extensibility & Hardening — **Phase 10 (done)**

The final phase turns the platform into a complete engineering operations surface.
**Purely additive** — one idempotent migration (five new tables, RLS-on/no-policies)
and minimal, flagged shell edits; no `_app.js` / `next.config` / `theme` / `globals`
change. Everything reads only already-sanitised / dev-only data, so no new privacy surface.

- **Two-way GitHub integration** — a server-side, injectable-`fetch` client
  (`githubClient.js`; token from the **server-only** `SUPPORT_GITHUB_TOKEN`, never
  `NEXT_PUBLIC`) creates issues from a report, links existing issues/PRs/commits, and
  syncs their live state; links persist in `support_github_links`. Pure
  `githubCorrelation.js` builds blob/commit/compare/issue deep-links **pinned to the
  captured commit** (works with no token). Surfaced in the report detail
  (`SupportGithubPanel.js`); every action audited. "Link by URL" needs no token;
  "create"/"sync" require it and fail with a clear message when unconfigured.
- **AI-assisted investigation without external AI** — `assistedInvestigation.js` is a
  deterministic heuristic that reads the existing dev investigation and composes a
  developer summary, probable fix, affected systems, implementation suggestions,
  regression warnings and a verification checklist (+ markdown export). Rendered in the
  detail (`SupportAssistedPanel.js`). No third-party call, no data leaves the box.
- **Plugin architecture** — `pluginRegistry.js` unifies the two existing registries
  (diagnostic + investigation) and adds a third **engineering-tool** registry behind one
  `registerPlugin({ kind, id, … })` facade + a `getPluginInventory()` the `/dev/plugins`
  page renders. Future diagnostics/tools register **without touching the core**.
- **Intelligent notifications** — `notificationRules.js` (pure event→rule matching +
  composition) + `supportNotifications.js` (delivery/persistence) drive per-recipient
  `support_notifications` with owner-scoped subscription rules
  (`support_notification_rules`). **Live delivery over SSE** (`notifications/stream.js`)
  updates the topbar bell without polling (poll fallback if SSE is stripped).
- **Command palette + global quick actions** — `commandPalette.js` (pure fuzzy
  ranking) + `CommandPalette.js` (Ctrl/⌘-K overlay, full keyboard/ARIA) mounted in the
  platform shell; navigation commands derive from the nav model automatically.
- **Engineering knowledge centre** — `knowledgeCentre.js` links recurring incidents (by
  fingerprint) to curated write-ups (`support_knowledge_entries`) and suggests
  documenting undocumented recurring clusters; managed at `/dev/knowledge`.
- **Deployment readiness + release approvals** — `deploymentReadiness.js` scores each
  release 0–100 (open-critical / regression / drift-weighted) with a grade +
  recommendation; `/dev/readiness` gates approvals (persisted in
  `support_release_approvals`; an override of a "blocked" release is recorded honestly).
  **Productivity metrics** (`productivityMetrics.js`, `/dev/productivity`): throughput,
  resolution time, backlog age, per-developer contribution.
- **Complete developer activity/audit** — `activityAudit.js` shapes the hash-chained
  `audit_log` into a feed + a **coverage** roll-up (which expected dev actions are
  logged); `/dev/activity`. Every new mutation writes a `dev_platform_action` /
  `github_*` / `knowledge_*` / `release_approval` / `notification_rule_*` audit entry.
- **Interactive source navigation** — the assisted + GitHub panels expose clickable
  `file:line` refs and commit-pinned blob deep-links (`githubCorrelation`).
- **Enterprise polish** — all new surfaces are borderless LayerSurface/LayerTheme,
  token-only, 44px targets, keyboard-navigable (palette ↑/↓/Enter/Esc; bell
  Esc/outside-click), responsive, UK-English; dashboards lazy; SSE degrades to poll;
  server helpers degrade to empty when the migration is absent.

**Verification (Phase 10):** 220 new Vitest tests across the new
`src/lib/dev-platform/*` + `src/lib/support/notificationRules` modules (all green); a new
`e2e/workflows/dev-platform-integration.spec.js` (permission-gate + API-shape + dashboard
render). `check:borders` / `check:layers` pass on all new UI.

## 11. Access, Support hub tabs & submit notification — **Phase 11 (done)**

Makes the finished platform reachable and legible, and closes the loop to a human on every
submission. **Purely additive** — no schema change; the only global-file edit is one sidebar-config
entry (flagged + approved). Nothing reads the RLS-locked diagnostics blob, so no new privacy surface.

- **Staff-shell platform + top tabs + stats home** — the Developer Platform no longer renders a bespoke
  full-page shell. `withDevPlatformLayout` now wraps every `/dev/*` page in the normal staff `<Layout>`
  (same sidebar + topbar + page card as any staffglobal.css page — `Layout`/`Sidebar` themselves are
  untouched), and the 16 platform areas render as an **icon-less top tab group**
  (`src/components/dev-platform/DevPlatformTabs.js`) at the top of the page content instead of the old
  left nav rail / custom topbar (health pill · palette button · notification bell were retired from the
  shell). The **home** (`/dev`) is now a **live statistics dashboard**
  (`src/components/dev-platform/sections/DevOverviewStats.js`) over the incoming reports — headline
  counts (total / open / unassigned / regressions / last 24h / last 7d) + status / severity / category
  breakdowns, read from the existing dev-gated `getSupportReportStats` — not a redirect/tile grid.
- **Dev entry from the normal app** — a **Developer** sidebar section (`src/config/navigation.js`) with a
  single **Developer Platform → `/dev`** item gated `roles: ["dev"]`. It is visible *only* to the
  synthetic `dev` session (the role is absent from `roleCategories` and `DEV_FULL_ACCESS_ROLES`, so no
  staff session carries it) and asserted by `src/config/navigation.test.js`. `StaffSidebar`'s existing
  `hasAccess()` does the gating; `StaffSidebar.js` / `StaffLayout.js` are untouched. `/dev` is already in
  the dev route allow-list, so `PageAccessGuard` is unaffected.
- **Support hub with top-left tabs** — a new `/dev/support` page (`SupportHubPage`) renders
  `SupportHub` (`src/components/dev-platform/SupportHub.js`): a borderless top-left tab bar grouping the
  support areas — **Overview · Reports · Investigations · Health · Notifications · Activity · Settings** —
  driven by the pure `src/lib/dev-platform/supportSectionTabs.js` model (unit-tested). Only the active
  tab mounts (so only it fetches); the active tab is mirrored in `?tab=` (shallow, deep-linkable). Each
  tab renders the **same** component its standalone `/dev/*` page renders — the per-area views were
  extracted into `src/components/dev-platform/sections/` (`HealthSection`, `NotificationsSection`,
  `ActivitySection`, `PreferencesSection`, `InvestigationsSection`, plus the new `SupportOverviewSection`
  jump tiles), and each standalone page slimmed to a thin `ProtectedRoute` + `getLayout` wrapper (the
  same shape `dev/support-reports/index.js` already had). Reports reuses `SupportWorkspace` directly. The
  Developer Platform nav `support` entry now points at `/dev/support`; the standalone pages (incl.
  `/dev/support-reports` + `[id]` detail) remain for deep-links. `DevPlatformLayout` (the shared rail)
  is unchanged.
- **Submit notification email** — when any authenticated user submits a report, the route fires a
  best-effort internal email (to a **hardcoded** `michaelrose01795@icloud.com`) built by the **pure**
  `src/lib/support/supportReportEmail.js` and sent by `src/lib/support/supportReportNotifier.js` via the
  existing `sendDmsEmail` + `renderEmailShell` house style. The email carries **only** already-sanitised
  persisted columns — report id, reporter name/role, category label, submitted time, route, section,
  `source_file:line`, severity/status, the (re-scrubbed, HTML-escaped, capped) description, screenshot
  count, and an open link to the report detail — **never** the diagnostics blob, tokens or cookies. The
  notifier **never throws** and **never blocks** report creation: it skips silently when SMTP is
  unconfigured and logs+swallows any send failure (the report is already saved). Covered by
  `src/lib/support/supportReportEmail.test.js` (payload completeness, secret-scrub, HTML-escape,
  diagnostics-never-leaks, skip-when-unconfigured, swallow-on-failure).

**Verification (Phase 11):** 18 new Vitest tests across `supportSectionTabs.test.js`,
`supportReportEmail.test.js` and `navigation.test.js` (all green run per-file — the sandbox's
multi-file worker-init flake is unchanged and unrelated). `check:borders` / `check:layers` /
`check:encoding` pass; `eslint` + `uk:check` clean on every new/changed file. The reporter "?" popup
(`SupportControl` / `SupportReportModal`) is untouched.

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
| **Dev Platform shell** | `src/components/dev-platform/{DevPlatformLayout,DevPlatformTabs,devPlatformNav}.js` | **Phase 11.1:** `withDevPlatformLayout` wraps `/dev/*` in the normal staff `<Layout>` (sidebar+topbar+page card) + an icon-less top tab group (`DevPlatformTabs`) — the old bespoke shell / nav rail / dev topbar retired. No `_app.js` / `Layout` / `Sidebar` edit. |
| **Dev Platform pages** | `src/pages/dev/{index,live-ops,health,saved-views,preferences}.js` | Home is a **live report-statistics dashboard** (`DevOverviewStats`, Phase 11.1) — not a tile grid; plus live-ops feed (polls `captureDiagnostics()`) + health tiles + saved-views manager + preferences; all `ProtectedRoute`-gated to `DEV`. |
| **Search substrate** | `src/lib/dev-platform/searchEngine.js` | Pure generic `applyQuery(items,{q,searchFields,filters,matchers,sort,sorters})` reused across platform surfaces. |
| **Saved views + prefs data** | `src/lib/database/supportSavedViews.js`, `src/lib/support/savedViewValidation.js` | Service-role, owner-`owner_key`-scoped CRUD + upsert prefs; graceful degradation; pure validation/normalisation split. |
| **Saved views + prefs API** | `src/pages/api/support/saved-views/{index,[id]}.js`, `src/pages/api/support/preferences.js` | Dev-gated (`DEV_PLATFORM_ROLES`) list/create/update/delete + get/put prefs; audit-logged. |
| **Saved views + prefs UI** | `src/components/dev-platform/{useSavedViews,usePreferences}.js` | Server-sync hooks with device-local fallback; `SupportWorkspace.js` now saves views server-side (personal + shared). |
| **Dev Platform audit** | `src/lib/support/devPlatformAudit.js` | `dev_platform_session` / `dev_platform_view` / `dev_platform_action` via the shared hash-chained `writeAuditLog`. |
| **Intelligence engines (Phase 9)** | `src/lib/dev-platform/{intelligence,releaseIntelligence,ownershipGraph,performanceInsights,bulkTriage,developerDirectory}.js` | Pure cross-report analytics + release/regression + ownership graph + perf/tracing + bulk-triage validation + developer directory. Each has a `*.test.js` beside it. |
| **Intelligence DB helpers (Phase 9)** | `src/lib/database/support.js` (`listReportsForIntelligence`, `bulkUpdateSupportReports`) | Bounded light-row window for aggregation; single-statement bulk triage returning updated ids for per-report audit. |
| **Intelligence API (Phase 9)** | `src/pages/api/support/intelligence.js`, `src/pages/api/support/reports/bulk.js` | Dev-gated `GET` server-side aggregation (audited) / dev-gated `POST` bulk triage + auto-reopen (per-report audit). |
| **Intelligence UI (Phase 9)** | `src/pages/dev/{intelligence,releases,ownership,performance}.js`, `src/components/dev-platform/{useIntelligence,DeveloperPicker}.js` | Four dashboards + data hook + searchable developer picker (canonical `DropdownField`). Nav entries in `devPlatformNav.js`. |
| **Phase 10 schema** | `src/lib/database/schema/support/000_support.sql` (Phase 10 block) | `support_github_links`, `support_notifications`, `support_notification_rules`, `support_release_approvals`, `support_knowledge_entries`; RLS on / no policies; idempotent. |
| **Phase 10 engines** | `src/lib/dev-platform/{assistedInvestigation,deploymentReadiness,productivityMetrics,knowledgeCentre,pluginRegistry,commandPalette,activityAudit,githubCorrelation,githubClient}.js`, `src/lib/support/notificationRules.js` | Pure/injectable: assisted write-up · readiness scoring · productivity metrics · knowledge derivation · plugin facade+tool registry · command palette model · audit-feed shaping+coverage · GitHub deep-links · injectable GitHub API client · notification rule matching. Each has a `*.test.js` (220 tests). |
| **Phase 10 DB helpers** | `src/lib/database/{supportGithub,supportNotifications,supportReleases,supportKnowledge,supportActivity,supportTableProbe}.js` | Service-role, owner-scoped CRUD + `deliverEvent` fan-out; audit-log read; shared graceful-degradation table probe. |
| **Phase 10 APIs** | `src/pages/api/support/{platform,activity}.js`, `reports/[id]/github.js`, `notifications/{index,rules,stream}.js`, `releases/approvals.js`, `knowledge/{index,[id]}.js` | Dev-gated aggregation (readiness/productivity/knowledge) · activity feed · two-way GitHub · notifications + rules + **SSE stream** · release approvals · knowledge CRUD. All audited (reads on the platform/activity surfaces; every mutation). |
| **Phase 10 shell + hooks** | `src/components/dev-platform/{CommandPalette,DevNotificationBell,useNotifications,usePlatformResource}.js` | Ctrl/⌘-K palette provider (mounted in `DevPlatformLayout`) + topbar bell (SSE-driven) + notifications hook (SSE + poll fallback) + generic GET hook. |
| **Phase 10 pages** | `src/pages/dev/{readiness,productivity,knowledge,notifications,activity,plugins}.js` | Deployment readiness + approvals · productivity · knowledge centre · notification history+rules · activity/audit + coverage · plugin inventory. Nav entries in `devPlatformNav.js`; all `ProtectedRoute`-gated to `DEV`. |
| **Phase 10 detail panels** | `src/components/support/dev/{SupportAssistedPanel,SupportGithubPanel}.js` | Assisted investigation + two-way GitHub / source deep-links, rendered inside `SupportReportDetail.js`. |
| **Dev sidebar entry (Phase 11)** | `src/config/navigation.js` (+ `navigation.test.js`) | "Developer" section → `Developer Platform /dev`, gated `roles:["dev"]`; visible only to the synthetic dev session. Global sidebar-config edit (flagged/approved). |
| **Support hub tab model (Phase 11)** | `src/lib/dev-platform/supportSectionTabs.js` (+ `.test.js`) | Pure ordered tab model (overview/reports/investigations/health/notifications/activity/settings) + `resolveSupportTab` for `?tab=`. |
| **Support hub UI (Phase 11)** | `src/pages/dev/support.js`, `src/components/dev-platform/SupportHub.js`, `src/components/dev-platform/sections/{SupportOverviewSection,HealthSection,NotificationsSection,ActivitySection,PreferencesSection,InvestigationsSection}.js` | `/dev/support` hub with borderless top-left tabs; per-area views extracted from the `/dev/*` pages (which slimmed to thin wrappers); Reports reuses `SupportWorkspace`. Nav `support` entry repointed in `devPlatformNav.js`. |
| **Submit notification (Phase 11)** | `src/lib/support/supportReportEmail.js` (+ `.test.js`), `src/lib/support/supportReportNotifier.js` | Pure builder (sanitised, escaped, diagnostics-free) + best-effort, never-throwing sender to a hardcoded dev inbox; wired into `api/support/reports.js` `handlePost`. Reuses `sendDmsEmail` / `renderEmailShell`. |

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
5. **Notify** (Phase 11) — best-effort `sendSupportReportNotification` fires a sanitised internal email
   (persisted columns only, never the diagnostics blob) to a developer inbox. It never throws and
   never blocks: skips when SMTP is unconfigured, logs+swallows any failure (the report is already saved).
6. **Response** — only `{ id, screenshotCount }`. The investigation stays server-side/RLS-locked.

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

**Developer Platform intelligence flow (Phase 9):** the Intelligence / Releases / Ownership dashboards
call the dev-gated `GET /api/support/intelligence`, which reads a bounded window of light rows
(`listReportsForIntelligence`) and runs the pure `src/lib/dev-platform/` engines **server-side**,
returning ready-to-render aggregates (audited `dev_platform_view`). Bulk triage and one-click
regression auto-reopen POST to the dev-gated `/api/support/reports/bulk`, which validates one patch and
writes **one audit entry per updated report**. The Performance dashboard needs no server call — it runs
`performanceInsights.js` over the live `captureDiagnostics()` snapshot client-side (names + durations
only). No new capture path, column, or store is introduced.

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
| **8** | **Developer Platform — Foundation, Access & Live Operations** (`dev` role + strict access migration, workspace shell, live diagnostics, application health, search/filter substrate, saved workspaces, preferences) | ✅ **Done** (the deferred palette / notification *delivery* / quick-actions / SSE follow-up shipped in **Phase 10**) |
| **9** | **Developer Platform — Intelligence** (investigation & release dashboards, intelligent issue management, regression tracking, code ownership + dependency mapping, performance profiling, API tracing) | ✅ **Done** (DB query-level timing store flagged/deferred — see limitations) |
| **10** | **Developer Platform — Integration, Extensibility & Enterprise Hardening** (two-way GitHub, AI-assisted investigation, plugin architecture, notifications+rules+SSE, command palette, knowledge centre, readiness/approvals, productivity, activity/audit sweep, source nav, enterprise polish) | ✅ **Done** — see [§10c](#10c-developer-platform--integration-extensibility--hardening--phase-10-done). GitHub two-way needs `SUPPORT_GITHUB_TOKEN` to transact (manual action). |
| **11** | **Access, Support hub tabs & submit notification** (dev sidebar entry → `/dev`; `/dev/support` hub grouping the support areas into top-left tabs; best-effort sanitised email to a developer inbox on every submission) | ✅ **Done** — see [§11](#11-access-support-hub-tabs--submit-notification--phase-11-done). Email needs SMTP configured to send (skips silently otherwise). |

**Phases 1–7 are delivered and production-ready** — capture, analysis, investigation, version
pinning, the developer Support Centre, and the hardening layer are all in place, tested, and
privacy-verified end to end. **Phase 8's foundational core is now delivered** (the `dev` role +
strict re-gate, the `/dev` platform shell + home, the live-operations and application-health
dashboards, the shared search/filter engine, server-synced saved views + preferences, and the
platform audit baseline). The deferred Phase 8 items (command palette, notification *delivery*,
quick actions, SSE streaming) **shipped as part of Phase 10**.
**Phase 9 (intelligence) is delivered** — the investigation/release/ownership/performance
dashboards, intelligent bulk issue management + developer picker, cross-release regression tracking +
auto-reopen, and server-side aggregation (see [§10b](#10b-developer-platform-intelligence--phase-9-done)).
**Phase 10 (integration, extensibility & hardening) is now delivered** — two-way GitHub, AI-assisted
investigation, the plugin architecture, notifications + rules + SSE, the command palette, the
knowledge centre, deployment readiness + approvals, productivity metrics, the developer activity/audit
sweep, and interactive source navigation (see
[§10c](#10c-developer-platform--integration-extensibility--hardening--phase-10-done)). **The full
three-phase Developer Platform programme (8 → 9 → 10) is complete;** only genuinely-postponed
enhancements remain in the [Future Improvements backlog](#future-improvements-backlog).

**Verification (current):** `npm run test:unit` (`vitest run`) → **558 pass** (43 files); the one
failing suite — `reportingActivation.test.js` — is a pre-existing, unrelated missing-SQL-file issue in
the Reporting platform, not the support feature. **Phase 10 adds 220 tests** across
`src/lib/dev-platform/{assistedInvestigation,deploymentReadiness,productivityMetrics,knowledgeCentre,pluginRegistry,commandPalette,activityAudit,githubCorrelation,githubClient}.test.js`
+ `src/lib/support/notificationRules.test.js` (one real defect found + fixed: a `knowledgeCentre`
sort mutated the caller's array). *Env note:* the default Vitest **threads** pool intermittently
fails worker init in this sandbox (`Cannot read properties of undefined (reading 'config')` on every
file, untouched ones included); `vitest run --pool=forks` runs clean — a tooling/environment flake,
not a test defect.
`check:borders` / `check:layers` / `check:encoding` pass. `uk:check` clean for all support +
dev-platform files (only pre-existing `.agents/skills/**` hits remain). `eslint` clean on all
changed files. Playwright: the **unauthenticated permission-gate** tests in
`e2e/workflows/support-centre.spec.js` and the new `e2e/workflows/dev-platform-integration.spec.js`
pass; the **authenticated-developer** tests in every dev-platform spec sign in via the shared
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

### Phase 8 — Foundation, Access & Live Operations  🚩 *(holds the only global-architecture change)* — ✅ *delivered*

**Goal:** stand up the platform skeleton, the new role, and the always-on observability + UX
plumbing every later surface builds on.

**Delivered:** the `dev` role + strict re-gate, the `/dev` shell + home, live-ops +
health dashboards, the shared search engine, server-synced saved views + preferences, and the
audit baseline. The deferred follow-ups — **command palette / quick actions**, **notification
*delivery*** (on top of the stored preferences), and the **push/stream upgrade** (SSE for the
notification bell) — **shipped in [Phase 10](#10c-developer-platform--integration-extensibility--hardening--phase-10-done)**.
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

### Phase 9 — Intelligence: Investigation, Releases, Ownership, Performance & Tracing — ✅ *delivered*

**Goal:** turn captured data into analytical developer dashboards on top of the Phase 8 substrate.

**Delivered this pass** (see [§10b](#10b-developer-platform-intelligence--phase-9-done)): the six pure
`src/lib/dev-platform/` engines, the dev-gated intelligence + bulk APIs, and the four `/dev/*`
dashboards (Intelligence, Releases, Ownership, Performance) — including bulk triage, the searchable
developer picker, regression auto-reopen, server-side aggregation, and live-session performance
tracing. **No schema migration and no global-architecture change were required.** The only item that
would need a new persistence surface — cross-session **DB query-level timing** — was **flagged and
deferred** (see [Known limitations](#known-limitations) / [backlog](#future-improvements-backlog));
Phase 9 delivers request-level tracing over already-captured data instead.

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

### Phase 10 — Integration, Extensibility & Enterprise Hardening — ✅ *delivered*

**Goal:** connect outward, make the platform extensible, and hit the enterprise quality bar.
**Delivered this pass** — see [§10c](#10c-developer-platform--integration-extensibility--hardening--phase-10-done):
two-way GitHub (create/link/sync + commit-pinned deep-links), AI-assisted investigation (no external
AI), the unified plugin architecture (+ engineering-tool registry), notifications + subscription rules
+ SSE delivery, the command palette + quick actions, the knowledge centre, deployment readiness +
release approvals, productivity metrics, the developer activity/audit sweep + coverage, and interactive
source navigation. One idempotent migration (five tables) + minimal flagged shell edits; no
global-architecture file changed. The only remaining item is a **formal Lighthouse/axe audit** (the
surfaces are built to the accessibility bar — ARIA, keyboard, 44px, responsive — but a certified pass is
backlogged as a dedicated QA task); GitHub two-way needs `SUPPORT_GITHUB_TOKEN` to actually transact.

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

- **Phases 1–11 are delivered — the entire Help & Diagnostics + Developer Platform programme is
  complete.** Capture, analysis, investigation, version pinning, the Support Centre, hardening, the
  `dev` platform foundation, intelligence, the Phase 10 integration/extensibility/hardening layer, and the
  Phase 11 access + Support-hub-tabs + submit-notification layer
  are all in place, tested (558 unit tests), privacy-clean, and CLAUDE.md-compliant.
- **The deferred Phase 8 follow-ups are now closed:** the command palette + quick actions ship in the
  platform shell; notification **delivery** is live (per-recipient `support_notifications` +
  subscription rules) with **SSE streaming** (topbar bell) replacing polling where the browser
  supports it (poll fallback otherwise).
- **No blocking work remains.** What is left is deliberately postponed engineering polish, tracked in
  the [Future Improvements backlog](#future-improvements-backlog): most notably a **certified
  Lighthouse/axe accessibility + performance audit** (the surfaces are built to the bar — ARIA,
  keyboard operation, 44px targets, responsive reflow — but a formal certified pass is its own task),
  the offline/interrupted-upload resilience matrix, and a jsdom/RTL rendered-component harness.
- **Manual enablement** (not code work) is listed in [Manual actions](#manual-actions-outstanding):
  apply the Phase 10 migration, and set `SUPPORT_GITHUB_TOKEN` + `SUPPORT_GITHUB_REPO` to make the
  GitHub two-way integration transact (it degrades to link-by-URL + prefilled issues without it).

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
- **Assignment now has a searchable developer picker** (Phase 9) — but the directory is derived from
  the reporter/assignee identities already present on the reports (the `dev` role is synthetic, with
  no `users` directory to page), so a developer who has never touched the queue won't appear until they
  do. The assignee still shows as `User #id` when only a numeric id (no username) is known.
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
- **Intelligence aggregates over a bounded window folded in JS** (Phase 9) — the intelligence API
  reads ≤5000 recent light rows and the pure engines aggregate them in memory (no SQL `GROUP BY` /
  materialised view). Fine for a human-scale internal dev tool; a materialised/SQL-side rollup is
  backlogged for very large tables. Problem-area / cluster / release stats are therefore accurate over
  the window, not the full historical table.
- **Performance profiling is live-session-only** (Phase 9) — the Performance dashboard aggregates the
  current browser session's sanitised snapshot (names + durations, no bodies), like Live Ops. It does
  **not** persist a cross-session performance history, and **DB query-level timing is deliberately not
  captured** — a query-timing diagnostic provider would need a **new persistence/trace store**, which
  Phase 9 does not introduce (flagged; see backlog). API/request-level tracing over already-captured
  `failed_requests` is delivered instead.
- **Regression auto-reopen is developer-triggered, not automatic** (Phase 9) — the Releases dashboard
  surfaces every closed report that recurred on a newer build and reopens them in one click (a bulk
  `status → triaged` with per-report audit). It does not silently mutate reports on ingest; the
  developer stays in control, and every reopen is audit-logged.
- **Dependency/impact graph is report-derived, not a static import graph** (Phase 9) — the route →
  module edges are built from where reports actually landed (the resolved `source_file`), not by
  parsing the codebase's import tree. It shows *observed* impact, not *potential* impact.
- **GitHub two-way needs a server token to transact** (Phase 10) — "link by URL" and the
  commit-pinned source deep-links work with no config, but **creating** an issue and **syncing** live
  state require `SUPPORT_GITHUB_TOKEN` (+ `SUPPORT_GITHUB_REPO`, falling back to
  `NEXT_PUBLIC_GITHUB_REPO`). Unconfigured, those actions return a clear "not configured" message
  rather than failing opaquely. The token is **server-only** (never `NEXT_PUBLIC`).
- **Assisted investigation is deterministic-heuristic, not an LLM** (Phase 10) — by design (no
  external/paid AI). It composes its summary / probable fix / suggestions / checklist from the
  structured investigation signals, so it is only as rich as what was captured; it will not "reason"
  beyond the evidence. This keeps it free, deterministic (testable), and leak-proof.
- **Notification delivery is DB-persisted + SSE-streamed, not push/email** (Phase 10) — recipients get
  in-app `support_notifications`; the topbar bell updates live via a content-free SSE unread-count
  stream (poll fallback). The SSE endpoint runs a **bounded** server-side poll loop (~4 min) then the
  browser reconnects — adequate for a serverless internal tool; a true pub/sub bus and an email/Slack
  channel are backlogged. The `deliverEvent` fan-out is **wired end-to-end for release decisions**
  (a block/approve on `/dev/readiness` fires `release.blocked` / `release.approved`, which appear in the
  bell via SSE); wiring the `report.created` / `report.critical` / `report.regression` / `report.assigned`
  events into the ingest + triage paths is the remaining **incremental** step (the rules engine,
  delivery helper, subscription UI, bell, and SSE stream are all complete and tested).
- **Release approval + knowledge + GitHub-link data degrade to empty when unmigrated** (Phase 10) —
  like Phase 8's saved views, the Phase 10 helpers return empty / skip (never throw) until
  `000_support.sql`'s Phase 10 block is applied, so the dashboards render an empty state rather than
  erroring.
- **Deployment readiness + productivity aggregate the same bounded light-row window** (Phase 10) —
  folded in JS over ≤5000 recent rows (no SQL `GROUP BY`), and "time to resolve" is approximated as
  `updated_at − created_at` for terminal statuses (no dedicated `resolved_at` column). Accurate for a
  human-scale internal tool; a materialised rollup + a resolved-at column are backlogged.
- **Plugin inventory reflects the current process** (Phase 10) — `getPluginInventory()` lists what is
  registered in the running context. The `/dev/plugins` page registers the built-in diagnostic
  providers + the nav-derived tools on mount so the inventory is populated client-side; a provider that
  is only registered inside the browser capture path won't appear in a server render.
- **A certified Lighthouse/axe pass is still outstanding** (Phase 10) — every new surface is built to
  the accessibility bar (ARIA roles on the palette/bell/dialogs, full keyboard operation, 44px targets,
  responsive reflow, token-only colour) and passes `check:borders`/`check:layers`, but a formal audited
  score + a keyboard-navigation matrix remain a dedicated QA task (backlog).
- **Submit-notification recipient is hardcoded** (Phase 11) — the internal email always goes to
  `michaelrose01795@icloud.com` (a one-line constant in `supportReportEmail.js`); it is **not**
  env-configurable and does not honour the per-recipient `support_notification_rules`. It also **only
  sends when SMTP is configured** (`isSmtpConfigured()`); otherwise it skips silently and the submission
  still succeeds. A rules-driven / multi-recipient / env-configured channel is a future enhancement.
- **Support hub tabs are single-active + client-fetched** (Phase 11) — only the active tab mounts, so
  switching tabs re-fetches that area's data (no cross-tab cache); the grouping is a UI convenience over
  the same dev-gated APIs the standalone `/dev/*` pages use, which remain the canonical deep-link targets.

## Manual actions outstanding

- **Apply the migration** — run `src/lib/database/schema/support/000_support.sql` in the
  Supabase SQL editor (repo applies SQL manually). Idempotent; adds the Phase 6 columns
  `support_reports.duplicate_of` (+ self-FK / index) and `support_report_comments.author_username`
  via `ADD COLUMN IF NOT EXISTS`, (Phase 7) seeds the `support_report` **retention policy row**
  — guarded on `retention_policies` existing — and (Phase 8) creates the **`support_saved_views`**
  and **`support_user_preferences`** tables (RLS on, no policies; `CREATE TABLE IF NOT EXISTS`).
  Until these two run, the Developer Platform saved-views/preferences hooks transparently fall
  back to the device-local store. **(Phase 10)** the same file now also creates
  **`support_github_links`**, **`support_notifications`**, **`support_notification_rules`**,
  **`support_release_approvals`** and **`support_knowledge_entries`** (RLS on, no policies). Until
  they run, the GitHub-link / notifications / release-approval / knowledge surfaces degrade to empty.
  Safe to re-run.
- **Configure SMTP for the submit notification** (Phase 11) — the internal "new support report" email
  reuses the existing mailer, so it needs `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` (optional
  `SMTP_FROM` / `SMTP_COMPANY_NAME`). Without them the notifier skips silently and report submission is
  unaffected. The recipient (`michaelrose01795@icloud.com`) is a hardcoded constant in
  `src/lib/support/supportReportEmail.js` — edit there to change it.
- **Set the GitHub integration secrets to enable two-way sync** (Phase 10) — set the **server-only**
  `SUPPORT_GITHUB_TOKEN` (a fine-grained PAT / app token with `issues:write`) and `SUPPORT_GITHUB_REPO`
  = `owner/repo` (or reuse `NEXT_PUBLIC_GITHUB_REPO`). Without them, the report detail still links
  artifacts by URL and offers commit-pinned source deep-links + prefilled issues; with them, "Create
  issue" and "Sync" transact against the GitHub API. Never expose the token as `NEXT_PUBLIC_*`.
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
  pass unchanged. This now also covers the Phase 9 spec
  (`e2e/workflows/dev-platform-intelligence.spec.js`): its permission-gate + validator tests pass
  unauthenticated, but the intelligence-API-shape + dashboard-render tests need the same `dev`-role
  fixture. **(Phase 10)** the new `e2e/workflows/dev-platform-integration.spec.js` follows the same
  split — its permission-gate tests pass unauthenticated; the platform/activity/knowledge/notification/
  approval/GitHub API-shape + readiness/plugins render tests need the `dev`-role fixture.
- **CI: stamp the section-map hash** — have the build run the section-source-map generator and
  capture its `SECTION_MAP_HASH=…` output into `NEXT_PUBLIC_SECTION_MAP_HASH` so
  `verifySectionMap` can report `match`/`drift` in production. (Vercel already injects
  `VERCEL_GIT_*`, so commit/ref/env/url populate automatically.)

## Future Improvements backlog

**The three-phase Developer Platform programme (8 → 9 → 10) is complete** — every in-scope idea that
used to live here has shipped in a phase:

- **→ Phase 8 (delivered):** server-synced + shared team saved views.
- **→ Phase 9 (delivered):** cross-release regression alerting / auto-reopen; bulk triage;
  user-picker assignment; server-side stats/trend aggregation; investigation/release/ownership/
  performance dashboards.
- **→ Phase 10 (delivered):** two-way GitHub issue create/link/sync; GitHub commit-pinned source
  deep-links; the plugin architecture; notifications + subscription rules + SSE; the command palette +
  quick actions; the knowledge centre; deployment readiness + release approvals; productivity metrics;
  the developer activity/audit sweep + coverage; AI-assisted (no-external-AI) investigation.

The items below are **intentionally postponed beyond the three-phase programme** — genuine future
enhancements, not planned work. Do not implement without a dedicated phase of their own.

- **Certified Lighthouse/axe accessibility + performance audit**: a formal audited score + a
  keyboard-navigation matrix + a bundle-size deep-dive across every platform surface (the surfaces are
  *built* to the bar — ARIA, keyboard, 44px, responsive, token-only — but the certified pass is its own
  QA task).
- **True notification pub/sub + external channels**: replace the bounded SSE poll-loop with a real
  event bus (Redis/Postgres `LISTEN/NOTIFY`) and add email/Slack delivery on top of the stored
  subscription rules; wire `deliverEvent` into every remaining ingest/triage path.
- **GitHub sync depth**: webhook-driven state sync (instead of on-demand), PR/commit auto-correlation
  from the captured build, and issue-comment mirroring back into the report thread.
- **In-app source viewer / editor deep-link**: open the file at `file:line` inside the app (the
  clickable ref copies the path and links to the GitHub blob at the captured commit; an embedded viewer
  does not ship).
- **Resolved-at column + materialised intelligence rollups**: a dedicated `resolved_at` timestamp and
  a SQL `GROUP BY` / materialised view so productivity + intelligence + readiness stats stay exact on
  very large historical tables (currently a bounded in-JS window with an `updated_at` approximation).
- **Static import-graph dependency mapping**: complement the report-derived route→module graph with a
  build-time import-tree parse so *potential* (not just observed) impact is visible.

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
- **DB query-level timing provider + persisted performance trace store** (flagged out of Phase 9):
  a diagnostic provider that records query names + durations (no values) and a store that persists
  cross-session performance traces, so the Performance dashboard can chart history and slow queries
  rather than only the live session. Needs a **new store** — deliberately not introduced in Phase 9.
- **Materialised / SQL-side intelligence aggregation**: replace the bounded in-JS window fold with a
  SQL `GROUP BY` / materialised view so problem-area / cluster / release stats stay accurate across
  very large historical tables.
- **Static import-graph dependency mapping**: complement the report-derived route→module graph with a
  build-time import-tree parse so *potential* (not just observed) impact is visible.

---

## Standing handoff prompt

> Paste verbatim into ChatGPT, attaching **the single file** `docs/Support/help-diagnostics.md`.

```
You are reviewing an in-progress implementation of the "Help & Diagnostics" feature for the HNPSystem Next.js (Pages Router) + Supabase app. I'm attaching one file: the living system document (docs/Support/help-diagnostics.md) which contains the architecture (Part A), the current system state — module map, data flow, phase status, outstanding work, known limitations, manual actions, and the Future Improvements backlog (Part B) — and this prompt. Using ONLY that file as the source of truth, do three things and nothing else: (1) AUDIT — compare what the module map / phase table say is built against the architecture and list any sections, requirements, privacy/sanitisation rules, edge cases, columns, or constraints that are missing, partial, or deviate, ranked by risk; flag especially anything touching privacy/secret-leakage, RLS, audit, or permissions; (2) CONFIRM NEXT PHASE — state which phase is next per the phase table and call out any global-architecture file it will touch (_app.js, next.config, Layout/Sidebar/Card/theme/globals/context) that must be explicitly flagged for approval before editing; (3) WRITE THE NEXT PROMPT — produce a single ready-to-copy implementation prompt for the next phase that reuses existing repo patterns (popup, auth/role, audit, storage, dev-layout source map, styling per CLAUDE.md), keeps the feature separate from the existing Reporting/KPI system, names the exact files to create/edit, lists the tests to add, and tells the implementer to stop and flag any risky global change before making it. Keep the feature namespaced "support" throughout, remind the implementer to UPDATE docs/Support/help-diagnostics.md IN PLACE (refresh the current-state sections; never append a historical changelog or re-create the old plan/progress split), and to move any out-of-scope ideas into the Future Improvements backlog. Do not write code yourself — only the audit and the next prompt.
```
