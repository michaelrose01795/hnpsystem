# Layer Sweep — Handoff Prompt

**Purpose:** Paste the prompt block below into a fresh Claude Code chat (any device with access to this repo) to resume the repo-wide UI standardisation sweep agreed on 2026-05-04.

**Status when handoff was written:** Planning complete. No code changes made yet. Ready to start Phase 1.

---

## Paste this into the new chat

````
I'm resuming a planned repo-wide UI standardisation sweep. All context, rules, and the plan are in docs/layer-sweep-handoff.md — read that file first, in full, before doing anything else. Then read CLAUDE.md, src/styles/theme.css, src/styles/globals.css, src/components/ui/Card.js, src/components/Section.js, and the showcase reference at src/pages/dev/user-diagnostic.js lines 2860–2890.

After reading, confirm back to me in 3–5 bullet points:
1. The two canonical components you will create
2. The tokens that win and what gets aliased
3. The border rule
4. The phase you are about to start
5. Anything ambiguous that needs my input before you start

Do NOT begin editing until I reply "go". When I say go, start Phase 1 only and stop after Phase 1 step 5 (one reference page migrated) so I can review the look before the full sweep.
````

---

## Background — what this sweep is and why

The HNPSystem app currently has ~200 files producing card / section surfaces with inline `border`, `background`, and `borderRadius` styles, scattered across pages and components. The result is visual drift — borders appearing where they shouldn't, surface colours inconsistent between pages, mobile layout afterthoughts.

The fix: collapse all card / section surfaces in the entire app to **two and only two** primitives, matching the "Section Layers (surface / theme alternation)" pattern shown in the dev showcase.

## Audit numbers (captured 2026-05-04)

| Signal | Count |
|---|---|
| Files with inline `border:` styles | 160 |
| Files with inline `background:` styles | 181 |
| Files using `app-section-card` / `app-page-card` directly | 81 |
| Files importing `<Section>` / `<Card>` / `<SectionCard>` | 61 |

Realistically ~200 unique files to touch.

## Confirmed rules (these are locked, do not re-litigate)

1. **Only two surface primitives exist:** `<LayerSurface>` and `<LayerTheme>`. Both render with **no border**.
2. **Tokens:** only `--surface` and `--theme` (and any other tokens shown in the user-diagnostic showcase section). Old tokens (`--surfaceMain`, `--section-card-bg`, `--page-card-bg`, etc.) get aliased to the new ones during migration so nothing breaks mid-sweep, then removed at the end.
3. **Strict alternation as you nest:** outermost is `<LayerSurface>` → next layer `<LayerTheme>` → next `<LayerSurface>` → etc.
4. **No inline `border:` / `background:` / `borderRadius:` on any card or section anywhere.** Inline styles for non-surface concerns (flex, gap, colour for text, etc.) are still fine.
5. The reference for the visual is the showcase at [src/pages/dev/user-diagnostic.js:2864-2880](../src/pages/dev/user-diagnostic.js#L2864-L2880) — but **without the borders**.

## The plan — three phases

### Phase 1 — Foundations (do first, then STOP for review)

1. Create `src/components/ui/LayerSurface.js` and `src/components/ui/LayerTheme.js`. Both borderless. Both accept `children`, `className`, `style`, and the dev-layout overlay props (`sectionKey`, `parentKey`, `sectionType`, `backgroundToken`, `widthMode`, `shell`) so they integrate with the existing DevLayoutSection wrapper used by Card.js.
2. Reconcile tokens in `src/styles/theme.css`. Make `--surface` and `--theme` canonical. Alias the old tokens (`--surfaceMain`, `--section-card-bg`, `--page-card-bg`, etc.) to them so consumers that haven't migrated yet still render. Do NOT delete the old tokens yet.
3. Update `src/components/ui/Card.js` and `src/components/Section.js` so they render via `<LayerSurface>` internally. Keep their existing public APIs (so all 60+ consumers auto-inherit the new look without code changes).
4. Update `CLAUDE.md` section 3 (Design System) to:
   - List `<LayerSurface>` and `<LayerTheme>` as the only legal surface primitives.
   - Ban inline `border:` / `background:` / `borderRadius:` in pages and components.
   - Document the strict alternation rule.
5. Migrate **one reference page** end-to-end: `src/pages/dashboard/workshop/index.js` and its UI component `src/components/page-ui/dashboard/workshop/dashboard-workshop-ui.js`. Replace every inline-styled surface div with `<LayerSurface>` / `<LayerTheme>`, alternating per the rule.
6. **STOP. Report back with a screenshot-equivalent description of the result and wait for approval.**

### Phase 2 — The sweep (only after Phase 1 approved)

Migrate every page route in this order, **batches of ~10 files, commit per batch**:

1. Remaining dashboards (service, mot, admin, after-sales, managers, accounts, parts, painting, valeting) — ~9 files
2. HR pages (hr, hr/attendance, hr/disciplinary, hr/employees, hr/leave, hr/payroll, hr/performance, hr/recruitment, hr/reports, hr/settings, hr/training, hr/manager) — ~12 files
3. Job cards (view, create, myjobs, [jobNumber], waiting, archive) — ~15 files
4. Parts (manager, create-order, deliveries, delivery-planner, goods-in, deliveries/[id], etc.) — ~12 files
5. Accounts (view, invoices, payslips, reports, transactions) and company-accounts — ~10 files
6. VHC (vhc, vhc/customer-view, vhc/customer-preview, vhc/share, plus VHC components) — ~15 files
7. Tech (tech/dashboard, tech/efficiency, tech/consumables-request) — ~3 files
8. Customer portal (customer/*, customers, customers/[slug]) — ~7 files
9. Tracking, workshop, clocking, messages, newsfeed, profile, appointments, stock-catalogue — ~10 files
10. Admin (admin/users, admin/profiles, admin/compliance/*) — ~10 files
11. Mobile (mobile/*) — ~5 files
12. Auth & misc (login, password-reset, account/security, profile/privacy, dev pages **except user-diagnostic.js — that page is the design reference, do not change its showcase section**) — ~10 files
13. Components folder sweep — every component file with inline border / background on a surface div — ~80 files
14. Popups and modals (popups/*, modal components) — ~15 files

For each batch:
- Read every file in the batch first
- Identify all surface divs (anything with `border`, `background`, `borderRadius`, or `app-section-card` / `app-page-card`)
- Replace with `<LayerSurface>` or `<LayerTheme>` honouring the alternation rule
- Leave non-surface inline styles alone (flex layout, gaps, text colour, etc.)
- Commit with message `layer-sweep: migrate <batch name>`
- Move to next batch

### Phase 3 — Lock-in (after sweep complete)

1. Add `tools/scripts/check-layers.js` — greps `src/pages` and `src/components` for inline `border:`, `background:`, `borderRadius:` on JSX elements. Allowlist the layer components themselves and the user-diagnostic showcase. Exit non-zero on any hit.
2. Add `npm run check:layers` script in `package.json`.
3. Wire into pre-commit if Husky is set up; otherwise just document running it manually.
4. Remove the deprecated token aliases from `theme.css` (now nothing references them).
5. Final report: count of files changed, list of remaining one-off styles (with justification comments).

## Files to read before starting

- `CLAUDE.md` — project rules, especially section 3 (Design System) and section 7 (Global Design Safety Rules)
- `src/styles/theme.css` — current tokens
- `src/styles/globals.css` — current `.app-section-card` / `.app-page-card` definitions
- `src/components/ui/Card.js` — current bare card
- `src/components/Section.js` — current titled section
- `src/components/dev-layout-overlay/DevLayoutSection.js` — the dev overlay wrapper that LayerSurface / LayerTheme need to support
- `src/pages/dev/user-diagnostic.js` lines 2860–2890 — the visual reference

## Things that must NOT happen

- Do not change the user-diagnostic showcase section itself — it is the canonical reference.
- Do not change the global Layout.js or Sidebar.js shell unless absolutely required (flag first per CLAUDE.md section 7).
- Do not introduce new tokens.
- Do not skip the Phase 1 stop-and-review.
- Do not commit one giant PR — batches of ~10 files per commit.
- Do not refactor surrounding logic while doing surface migration. Surface only.

## Open questions / risks to flag if you hit them

- If a page uses `border` to indicate **state** (e.g. selected row, error state) that is not a card surface — that is fine, leave it. The ban is on **card / section surface** borders, not all borders everywhere. Use judgement; ask if unsure.
- If a token alias would create a circular reference, ask before unwinding.
- If a component is genuinely not a surface (e.g. a button, a badge, an input) — leave its border alone. Layers are for cards and sections only.

---

**End of handoff.** Resume tomorrow by pasting the prompt block at the top of this file into a new chat.
