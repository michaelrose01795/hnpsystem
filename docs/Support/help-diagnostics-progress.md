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
| 4 | Error boundaries | ⏳ Next | |
| 5 | Version / code-state pinning | ⬜ Pending | Needs `next.config` env exposure. |
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

## Standing handoff prompt

> Paste this verbatim into ChatGPT, attaching **both** `docs/Support/help-diagnostics-system-plan.md`
> and `docs/Support/help-diagnostics-progress.md`. Re-use it unchanged every phase.

```
You are reviewing an in-progress implementation of the "Help & Diagnostics" feature for the HNPSystem Next.js (Pages Router) + Supabase app. I'm attaching two files: the full plan (help-diagnostics-system-plan.md) and the progress log (help-diagnostics-progress.md). Using ONLY those two files as the source of truth, do three things and nothing else: (1) AUDIT — compare what the progress log says is built against the plan and list any sections, requirements, privacy/sanitisation rules, edge cases, columns, or constraints that were missed, partially done, silently deferred, or deviate from the plan, ranked by risk; flag especially anything touching privacy/secret-leakage, RLS, audit, or permissions; (2) CONFIRM NEXT PHASE — state which phase is next per the progress table and call out any global-architecture file it will touch (e.g. _app.js, next.config, Layout/Sidebar/Card/theme/globals/context) that must be explicitly flagged for approval before editing; (3) WRITE THE NEXT PROMPT — produce a single ready-to-copy implementation prompt for the next phase that reuses existing repo patterns (popup, auth/role, audit, storage, dev-layout source map, styling per CLAUDE.md), keeps the feature separate from the existing Reporting/KPI system, names the exact files to create/edit, lists the tests to add, and tells the implementer to stop and flag any risky global change before making it. Keep the feature namespaced "support" throughout. Do not write code yourself — only the audit and the next prompt.
```
