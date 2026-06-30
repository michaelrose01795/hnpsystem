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
| 2 | Capture runtime | ⏳ Next | Edits `_app.js` (new provider) — global change, must be flagged before doing. |
| 3 | UI: "?" control + popup + POST route | ⬜ Pending | |
| 4 | Error boundaries | ⬜ Pending | |
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

## Standing handoff prompt

> Paste this verbatim into ChatGPT, attaching **both** `docs/help-diagnostics-system-plan.md` and
> `docs/help-diagnostics-progress.md`. Re-use it unchanged every phase.

```
You are reviewing an in-progress implementation of the "Help & Diagnostics" feature for the HNPSystem Next.js (Pages Router) + Supabase app. I'm attaching two files: the full plan (help-diagnostics-system-plan.md) and the progress log (help-diagnostics-progress.md). Using ONLY those two files as the source of truth, do three things and nothing else: (1) AUDIT — compare what the progress log says is built against the plan and list any sections, requirements, privacy/sanitisation rules, edge cases, columns, or constraints that were missed, partially done, silently deferred, or deviate from the plan, ranked by risk; flag especially anything touching privacy/secret-leakage, RLS, audit, or permissions; (2) CONFIRM NEXT PHASE — state which phase is next per the progress table and call out any global-architecture file it will touch (e.g. _app.js, next.config, Layout/Sidebar/Card/theme/globals/context) that must be explicitly flagged for approval before editing; (3) WRITE THE NEXT PROMPT — produce a single ready-to-copy implementation prompt for the next phase that reuses existing repo patterns (popup, auth/role, audit, storage, dev-layout source map, styling per CLAUDE.md), keeps the feature separate from the existing Reporting/KPI system, names the exact files to create/edit, lists the tests to add, and tells the implementer to stop and flag any risky global change before making it. Keep the feature namespaced "support" throughout. Do not write code yourself — only the audit and the next prompt.
```
