# Phase 7 — Empty-State Standardisation (Shared `EmptyState` Primitive) (Progress)

**Part of** the [Frontend Feedback & Error System rollout](frontend-feedback-system-rollout.md) · follows [Phase 6 loading-state standardisation](frontend-feedback-phase6-loading-states.md).
**Goal (from rollout §Phase 7):** empty screens read as intentional, with a next step — a single reusable `EmptyState` component rendering the existing `.app-empty-state` classes, adopted on the highest-impact lists/tables/grids that currently render blank (or, worse, plausible mock rows). **Exit:** major lists have a proper empty state.
**Status:** ✅ Implemented (primitive shipped + highest-impact empties migrated, including the admin/users mock-data masking; broad feature adoption deliberately deferred to Phase 10).
**Last updated:** 2026-07-03.

---

## 1. What Phase 7 added

### 1.1 The canonical primitive — `src/components/ui/EmptyState.js` (new)
One component for **every** "there is nothing here" surface — empty lists, tables, dashboards, no-match search/filter, permission-denied panels, archived/offline views, and data-failed-to-load. Configurable:

| Prop | Purpose |
|---|---|
| `icon` | small decorative glyph/emoji/SVG above the title (compact states) — `aria-hidden`. |
| `illustration` | larger picture/SVG node for page-level states (illustration area). |
| `title` | short headline ("No platform users yet"). |
| `description` | one-line explanation / next step. |
| `action` | **primary** action node (e.g. a `<Button>`). |
| `secondaryAction` | optional **secondary** action node. |
| `variant` | `inline` (default compact card), `page` (tall page-level), `bare` (no own surface — embed inside an existing card/panel/table cell). |
| `role` | pass `"status"` for search/filter results so the change is announced; omit for static empties. |

- **Styling is 100% the `.app-empty-state` family** ([empty-states.css](../src/styles/families/empty-states.css)) — the component adds **no** inline colours/borders/backgrounds, so it stays clear of the border **and** layer guards.
- **Accessibility:** the icon is decorative; the title renders as a **styled paragraph, not a heading**, so dropping an empty state into an arbitrary list never breaks heading order. Search/filter states opt into `role="status"` for live announcement.
- **Responsive:** centred flex column, description capped at `46ch`, illustration `max-width:100%` — all from the family CSS.

### 1.2 CSS family extended — `src/styles/families/empty-states.css`
Added `.app-empty-state__icon`, `.app-empty-state__illustration` (+ responsive `img/svg` cap), `.app-empty-state__copy`, and the new **`.app-empty-state--bare`** variant (transparent, no radius — for embedding). Tokens only; no borders. The pre-existing `--inline` / `--page` variants are reused unchanged.

### 1.3 One implementation — `StaffEmptyState` now delegates
`StaffEmptyState` (the showcase-only primitive) was a **thin, non-standard** duplicate whose markup (`__copy` + singular `__action`) didn't even match the CSS. It now **delegates to `<EmptyState>`**, so there is a **single** implementation. Its public props are preserved (backward compatible) and it gained `icon` / `secondaryAction` / `variant` pass-through for free.

### 1.4 Highest-impact ad-hoc empties migrated (not a full sweep)
- **admin/users — the headline P7 fix (🟠 High).** Eliminated the **mock-data fallback** that silently replaced empty arrays with plausible fake users/departments/roles (masking *both* an empty roster *and* a failed fetch). `MOCK_DB_USERS` / `MOCK_DEPARTMENT_LIST` / `MOCK_ROLE_LIST` (and the now-orphan `roleCategories` import + `usingMock*` flags + `isMock` row branches) are **deleted**; each of the three sections now renders a real `<EmptyState>` when empty. `MOCK_COMPANY_PROFILE` stays — it is a legitimate input *placeholder*, not a data fallback.
- **newsfeed** — the one-off `text-center py-16` block → `<EmptyState>` (with icon + next-step copy).
- **job-cards view (jobs list)** — the search-aware empty banner text → `<EmptyState variant="bare" role="status">`, so "No jobs match your search" vs "No jobs in this status group" is now announced on filter changes and styled consistently.

### 1.5 Showcase updated to the real thing — `src/pages/dev/user-diagnostic.js`
The "Empty State (standard pattern)" section previously rendered a **hand-rolled mock** (dashed border, ad-hoc divs). It now renders the **actual `<EmptyState>`** primitive (inline variant with primary + secondary action, and a page variant) — the canonical reference. The registry note was updated from "Proposed Global Standard" to "Global Standard (Phase 7)".

---

## 2. Files changed

| File | Change |
|---|---|
| `src/components/ui/EmptyState.js` | **New.** The canonical empty-state primitive (icon / illustration / title / description / primary + secondary action / inline·page·bare variants / optional `role`). |
| `src/styles/families/empty-states.css` | Added `__icon`, `__illustration`, `__copy`, and the `--bare` variant (tokens only, no borders). |
| `src/components/ui/index.js` | Barrel-exports `EmptyState`. |
| `src/components/ui/StaffShowcasePrimitives.js` | `StaffEmptyState` now delegates to `<EmptyState>` (single implementation; backward-compatible props). |
| `src/components/page-ui/admin/users/admin-users-ui.js` | **Removed mock-data fallback** (deleted 3 mock lists + `roleCategories` import + `usingMock*`/`isMock` branches); users / directory / roles now render `<EmptyState>` when empty. |
| `src/components/page-ui/newsfeed-ui.js` | Ad-hoc empty block → `<EmptyState>`. |
| `src/components/page-ui/job-cards/view/job-cards-view-ui.js` | Search-aware empty banner → `<EmptyState variant="bare" role="status">`. |
| `src/pages/dev/user-diagnostic.js` | Showcase now renders the real `<EmptyState>`; registry note updated. |
| `docs/frontend-feedback-phase7-empty-states.md` | This progress note (new). |

**Files reviewed (not changed):** [empty-states.css](../src/styles/families/empty-states.css) base/variant rules (reused as-is), [LayerSurface.js](../src/components/ui/LayerSurface.js) (confirmed its inline `padding`/`background` would *override* the family CSS variant padding — which is why `EmptyState` renders a plain semantic element driven by the `.app-empty-state--*` classes rather than wrapping a `LayerSurface`), [accounts-view-account-id-ui.js](../src/components/page-ui/accounts/view/accounts-view-account-id-ui.js) (its empty transactions/invoices states live *inside* `TransactionTable`/`InvoiceTable` — a table-component migration deferred to Phase 10, not a page-level edit), the many feature-local `EmptyStateMessage` / `EmptyState` variants (VHC, dev-platform, websiteManager) — intentionally **untouched** (out-of-scope local components; they migrate in Phase 10).

**DB schema checked?** Not applicable in the column/table sense — Phase 7 is a presentation layer. The admin/users change **removes** hard-coded mock data so the UI reflects the **real** query result (`dbUsers` / `departmentList` / `roleList` from the existing page logic); no query, column, or DB helper was added or changed.

**Scope:** One new shared component + a CSS family extension + a barrel export + four adoption edits. **The new shared component (`EmptyState`) is flagged per `CLAUDE.md §7 / rollout §5** (P7 shared-component gate) — but it is **additive** (new file; nothing existing changes behaviour except `StaffEmptyState`, which keeps its API), lands in the `ui/` primitives folder, and is **not** one of the §7 stop-and-confirm files (`Section.js`/`Card.js`/`Layout`/`Sidebar`/context/`theme.css`/`globals.css`). `empty-states.css` is the design-system family file; additions are tokens/`currentColor` only.

---

## 3. Tests completed

- ✅ `npx eslint` on all changed files — **0 errors, 0 warnings** (the admin/users deletions removed the mock refs cleanly; no orphaned imports/vars).
- ✅ `npm run check:borders` — **passes** (no borders introduced; `EmptyState` renders no inline border/background).
- ✅ `npm run check:layers` — **passes** (no legacy card classes/tokens; `EmptyState` is a plain `.app-empty-state` element, and the `--bare` variant avoids surface-in-surface where embedded).
- ✅ `npm run check:encoding` — **passes** (emoji icons are clean UTF-8; only mojibake sequences are flagged).
- ✅ `npm run uk:check` — **no new violations in any changed file** (the tool's large existing backlog is all in `.agents/**` / docs, unrelated to this phase).
- ✅ **Mock-removal audit** — grepped `admin-users-ui.js` for `MOCK_DB_USERS` / `MOCK_DEPARTMENT_LIST` / `MOCK_ROLE_LIST` / `usingMock` / `isMock` / `roleCategories`: **zero** remaining references. `MOCK_COMPANY_PROFILE` (placeholder use) correctly retained.

**Examples migrated:** admin/users (users table + directory grid + roles table — 3 empties + mock-fallback removal), newsfeed (feed empty), job-cards view (search/filter empty), and the design-system showcase (now the live primitive). These are the reference implementations for the Phase 10 sweep.

**Not yet done (recommend before Phase 7 sign-off):**
- [ ] Manual smoke: load `/admin/users` against an **empty** dataset (and a **failing** fetch) and confirm real `EmptyState`s show — no fabricated "Amelia Hart / Owen Reed" preview rows.
- [ ] Manual smoke: filter the jobs list to no matches and confirm the search-aware `EmptyState` announces (`role="status"`).
- [ ] Screen-reader pass on one migrated empty + confirm the decorative icon is skipped and the title/description read once.

---

## 4. Remaining adoption work (deferred to Phase 10 by design)

The audit ([frontend-feedback-audit-phase1.md](frontend-feedback-audit-phase1.md) §E) sizes P7 at ~20+ ad-hoc empties. Phase 7 ships the **primitive** + the **highest-impact** migrations; the long tail is the Phase 10 feature sweep:

- **Accounts** — empty transactions/invoices tables (inside `TransactionTable`/`InvoiceTable`); payslips/payments/company-accounts status blocks.
- **Parts / goods-in / deliveries** — parts-manager panels, goods-in detail, delivery-planner one-off empty/error blocks, supplier-search "no results".
- **Messages** — conversation "No messages yet", system-notifications, directory empties.
- **Dashboards** — per-card empty branches (service/parts) — pair with the Phase 6 loading swaps.
- **VHC** — replace the per-module `EmptyStateMessage` with `<EmptyState>`.
- **Newsfeed/jobs** already done here as references.

**Adoption rule for Phase 10:** any list/table/grid that can render zero rows must return `<EmptyState>` (with `role="status"` if the emptiness follows a search/filter), and **no** feature may substitute mock/placeholder rows for real-but-empty data.

**Remaining risks / considerations (documented, not regressions):**
- **`EmptyState` is not a surface component.** It deliberately renders a plain `.app-empty-state` element (not `<LayerSurface>`) because `LayerSurface`'s inline padding would fight the family CSS. Standalone it still *looks* like a borderless surface via the `--inline`/`--page` variants; embed with `--bare` inside an existing surface to avoid a double card. This is a conscious exception, consistent with how the empty-state family was designed.
- **Copy is English-only.** Titles/descriptions are literals (matching the current app); future i18n would route these through a catalogue like the Phase 3 message keys.
- **admin/users now shows a genuinely empty screen** when the roster is empty *or* the fetch fails — which is the intended, honest behaviour. If the fetch **fails** specifically, the friendlier follow-up (a distinct "couldn't load" empty state + retry, wired to the Phase 5 typed errors) is a Phase 9/10 concern, not P7.

---

## 5. What should be done next (no later-phase work started here)

- **Phase 7 exit (met):** a single reusable `EmptyState` is the standard, styled from `.app-empty-state`, accessible and responsive; the highest-impact ad-hoc empties (admin/users incl. mock removal, newsfeed, jobs list) render it; the showcase demonstrates the real component. Remaining gate: the manual/SR smoke checks in §3.
- **Phase 8 (next — NOT started):** validation standardisation — one accessible inline field-error pattern (`aria-invalid` + `aria-describedby`, disabled/guarded submit, focus first invalid field), replacing `if (!x) alert(...)` guards on key forms (new-job, new-order, appointments, tech, payslip, admin/users). Deliberately untouched here to keep Phase 7 independently shippable.

---

*Phase 7 only. Phase 8 (validation standardisation) and later phases were not started or modified. The new `EmptyState` shared component is additive and flagged in §2; no `CLAUDE.md §7` stop-and-confirm file was modified. Any later-phase work must re-run the CLAUDE.md pre-flight and stop-and-confirm on global changes.*
