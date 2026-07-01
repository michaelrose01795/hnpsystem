# Help & Diagnostics — Progress Log & ChatGPT Handoff

> **Purpose:** the living companion to [help-diagnostics-system-plan.md](help-diagnostics-system-plan.md).
> After **every** implementation phase this file is updated, then handed back to ChatGPT together
> with the plan so it can (1) audit what was built against the plan, (2) flag any missed/!
> deferred sections, and (3) write the next phase's implementation prompt.
>
> **The ritual (run every phase):**
> 1. Implement the current phase.
> 2. Update the "Phase status" + "Changelog" below.
> 3. Paste the [Standing handoff prompt](#standing-handoff-prompt) into ChatGPT along with this file
>    and the plan file.
> 4. ChatGPT returns: a gap audit + the next ready-to-copy implementation prompt.
> 5. Repeat.

---

## Phase status

| Phase | Title | Status | Notes |
|---|---|---|---|
| 1 | Foundation & data model | ✅ Done | SQL migration, sanitiser (+tests), DB helper, private storage bucket. |
| 2 | Capture runtime | ✅ Done | Capture lib + context provider + tests done. `_app.js` provider mount applied (flagged + approved). |
| 3 | UI: "?" control + popup + POST route | ✅ Done | Text-only "?" in StaffTopbar, lazy modal, screenshot capture+redact, authenticated POST route, audit log. |
| 4 | Error boundaries | ✅ Done | App-wide `SupportErrorBoundary` (shell-mounted, flagged + approved), render-error + recovery-timeline capture into the diagnostics provider, recovery screen (retry / reload / pre-filled report), reusable for nested page boundaries. |
| 5 | Version / code-state pinning | ⏳ Next | Needs `next.config` env exposure. |
| 6 | Dev viewer, triage & audit | ⬜ Pending | |
| 7 | Hardening (rate limit, retention, RLS review, E2E) | ⬜ Pending | |

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

---

### Phase 2 — Capture runtime (built; `_app.js` mount awaiting approval)

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
- Docs relocated to `docs/Support/` (plan + progress) per user request; user scratchpad `docs/Support/1st`
  left untouched.

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
  `buildEnrichedDescription`; added a read-only **“Diagnostic assistant” panel**
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
- `docs/Support/help-diagnostics-system-plan.md` — new **§6a** documenting the
  analysis engine + the provider extension points and their privacy contract.

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
- `docs/Support/help-diagnostics-system-plan.md` — new **§6b** documenting the
  investigation engine, clustering, the investigation extension interface, the
  cache, and the ingest wiring.

**Verification**
- `npx vitest run src/lib/support/` → **125/125** pass (all support phases + passes).
- `npm run check:borders` / `check:layers` / `check:encoding` → all pass.
- `npx eslint` on all changed files → 0 errors, 0 warnings.

**Privacy**
- The investigation reads only already-sanitised data, is re-scrubbed with the
  rest of the diagnostics blob, and lives solely in the RLS-locked `diagnostics`
  column — reporters never receive it (POST returns only `{ id, screenshotCount }`).
  `listRecentReportFingerprints` never selects the full diagnostics blob.

**Deviations / notes**
- No reporter-facing UI was added for the investigation (correct — it is
  developer-only); a dev viewer to render it is **Phase 6**. The engine + storage +
  extension points are complete and tested now.
- Screenshot clustering uses an exact content hash (djb2 over the data URL), not a
  perceptual hash — identical images cluster; near-duplicates do not (a perceptual
  hash would need an image-processing dependency we deliberately avoid).

---

## Standing handoff prompt

> Paste this verbatim into ChatGPT, attaching **both** `docs/Support/help-diagnostics-system-plan.md`
> and `docs/Support/help-diagnostics-progress.md`. Re-use it unchanged every phase.

```
You are reviewing an in-progress implementation of the "Help & Diagnostics" feature for the HNPSystem Next.js (Pages Router) + Supabase app. I'm attaching two files: the full plan (help-diagnostics-system-plan.md) and the progress log (help-diagnostics-progress.md). Using ONLY those two files as the source of truth, do three things and nothing else: (1) AUDIT — compare what the progress log says is built against the plan and list any sections, requirements, privacy/sanitisation rules, edge cases, columns, or constraints that were missed, partially done, silently deferred, or deviate from the plan, ranked by risk; flag especially anything touching privacy/secret-leakage, RLS, audit, or permissions; (2) CONFIRM NEXT PHASE — state which phase is next per the progress table and call out any global-architecture file it will touch (e.g. _app.js, next.config, Layout/Sidebar/Card/theme/globals/context) that must be explicitly flagged for approval before editing; (3) WRITE THE NEXT PROMPT — produce a single ready-to-copy implementation prompt for the next phase that reuses existing repo patterns (popup, auth/role, audit, storage, dev-layout source map, styling per CLAUDE.md), keeps the feature separate from the existing Reporting/KPI system, names the exact files to create/edit, lists the tests to add, and tells the implementer to stop and flag any risky global change before making it. Keep the feature namespaced "support" throughout. Do not write code yourself — only the audit and the next prompt.
```
