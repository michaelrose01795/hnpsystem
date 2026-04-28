# HNPSystem UI system — setup-pass reference

This document explains what was built during the **UI audit setup pass** (2026-04-21) and how to use it for the later page-by-page cleanup. Nothing in this pass restyled any page. It only put the structure, tooling, and source of truth in place.

## 1. New files

| Path | What it does | When to edit |
|---|---|---|
| [src/components/ui/variants.js](../src/components/ui/variants.js) | Single source of truth for every approved UI family, its variants, sizes, shapes, and `customOnly` exceptions. Drives the showcase page and the overlay classification popover. | Any time a new variant is proposed — add it here **first**, then the CSS. |
| [src/styles/families/index.css](../src/styles/families/index.css) | Imports every family stylesheet so they participate in the global cascade. | Only when adding a new family file. |
| [src/styles/families/buttons.css](../src/styles/families/buttons.css) | Canonical home for button styles. Holds the trace-mode outline layer. Existing `.app-btn*` rules still live in `globals.css` and will migrate here. | Any new button variant or size. |
| [src/styles/families/tables.css](../src/styles/families/tables.css) | Canonical home for tables. Adds new `compact` and `workflow` variants + trace outlines. | Any new table variant. |
| [src/styles/families/tabs.css](../src/styles/families/tabs.css) | Base `.app-tab` + `page` / `inner` / `pill` / `segmented` variants + trace outlines. | Any new tab variant. |
| [src/styles/families/cards.css](../src/styles/families/cards.css) | Canonical home for page/section/stat cards. Existing classes stay in `globals.css` for now. Adds trace outlines. | Any new card/surface variant. |
| [src/styles/families/inputs.css](../src/styles/families/inputs.css) | Variant modifiers (textarea, select, search) layered onto `.app-input` + trace outlines. | Any new input variant. |
| [src/styles/families/dropdowns.css](../src/styles/families/dropdowns.css) | Namespaces the dropdown family, trace outlines. Internals still live in `dropdownAPI/`. | Shared dropdown styling. |
| [src/styles/families/modals.css](../src/styles/families/modals.css) | Namespaces the modal family + trace outlines. | Shared modal chrome. |
| [src/styles/families/badges.css](../src/styles/families/badges.css) | Canonical home for badges. Existing classes stay in `globals.css` for now. | Any new badge variant. |
| [src/styles/families/toggles.css](../src/styles/families/toggles.css) | New `.app-toggle--switch` / `--checkbox` / `--radio` base + trace outlines. | Any new toggle variant. |
| [src/styles/families/loaders.css](../src/styles/families/loaders.css) | Trace outlines for the skeleton family. Internals still in `LoadingSkeleton.js`. | Never — only trace hooks. |
| [src/styles/families/toolbars.css](../src/styles/families/toolbars.css) | `filter` / `action` / `header` variant modifiers + trace outlines. | Any new toolbar variant. |
| [src/styles/families/empty-states.css](../src/styles/families/empty-states.css) | Base `.app-empty-state` + `inline` / `page` variants. Adopt these instead of ad-hoc “No results” text. | Adoption work only. |
| [src/styles/families/toasts.css](../src/styles/families/toasts.css) | Base `.app-toast` + `info` / `success` / `warning` / `error` variants. | Adoption work only. |
| [src/styles/features/vhc.css](../src/styles/features/vhc.css) | Feature-scoped VHC styles, migrated verbatim out of `globals.css`. | VHC-only changes. |
| [src/lib/dev-layout/auditTags.js](../src/lib/dev-layout/auditTags.js) | localStorage-backed store for the per-element classification tags. Keyed by a stable signature (route + DOM path + text hash). Exposes `buildAuditKey`, `getAuditTag`, `setAuditTag`, `clearAuditTag`, `exportAuditTagsJson`. | When the classification schema needs to change. |
| [src/pages/dev/user-diagnostic.js](../src/pages/dev/user-diagnostic.js) | Live gallery of every approved family + variant, gated by the dev-overlay role check. | Never — it renders `variants.js`. |

## 2. Edited files

| Path | What changed | Why |
|---|---|---|
| [src/styles/globals.css](../src/styles/globals.css) | (a) Added `@import` for `families/index.css` + `features/vhc.css` at the top. (b) Removed the VHC block (moved to `features/vhc.css`). (c) Added "Canonical home: …" signpost comments above the `.app-btn`, `.app-input`, `.app-data-table`, `.app-badge`, `.app-layout-tab-row` blocks. | Structure + visibility. No visual regression — rules still load, just via `@import`. |
| [src/lib/dev-layout/categories.js](../src/lib/dev-layout/categories.js) | Added `family` field to each category mapping to the matching id in `variants.js`. New helpers `getFamilyForCategoryId` and `getCategoryIdForFamily`. | Lets the classifier popover pre-fill the family dropdown. |
| [src/context/DevLayoutOverlayContext.js](../src/context/DevLayoutOverlayContext.js) | Added `trace` to `MODES`. Added `soloCategory(id)` (isolates one family, suppresses the rest). Added Ctrl+Shift+T keyboard shortcut to jump into trace mode. | Tracing + solo filter for the audit flow. |
| [src/components/dev-layout-overlay/DevLayoutOverlay.js](../src/components/dev-layout-overlay/DevLayoutOverlay.js) | Added `trace` to the mode pill list. Imported `variants.js` + `auditTags.js`. Added a classification form (family / variant / status / notes) to the selected-section panel that persists to localStorage. Category pills now solo on Shift+click. Footer hint updated with the new shortcuts. | The classification UI for page-by-page tagging. |

## 3. How the system is meant to be used

### 3.1 The daily loop

1. Toggle the overlay — `Ctrl+Shift+D`.
2. Press `Ctrl+Shift+T` to jump into **trace** mode. Every component family in the viewport is outlined in its signature colour (pink buttons, grey tables, yellow tabs, blue inputs, green cards, etc).
3. `Shift+click` a category pill in the panel to **solo** it — isolate a single family across the whole page.
4. Click any highlighted element to select it in the inspector panel.
5. Fill in the **Classification** block:
   - **Family** — auto-filled from the overlay's detection.
   - **Variant** — the approved variant name from `variants.js`.
   - **Status** — `approved`, `needs-review`, `custom-only`, or `hardcoded`.
   - **Notes** — any reviewer comment.
6. Tags save to `localStorage` automatically. Nothing is sent to Supabase this pass.
7. When you want to trigger a refactor, hand the JSON blob (exportable via `exportAuditTagsJson()`) to the refactor prompt so the AI follows the tagged decisions instead of guessing.

### 3.2 The permanent rules

- `variants.js` is the **only** place to add a new variant name. Do not invent one in a page.
- Every family has exactly one canonical CSS file under `src/styles/families/` — new rules land there, not in `globals.css`.
- Trace-mode outlines live at the bottom of each family CSS file. Do not move them.
- Showcase is driven by `variants.js` — never edit the showcase file to add content.
- Audit tags live in localStorage under the key `hnp-ui-audit-tags`. Clearing site data wipes them.

### 3.3 Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+D` | Toggle overlay on/off. |
| `Ctrl+Shift+M` | Cycle mode (labels → details → inspect → trace). |
| `Ctrl+Shift+T` | Jump straight to trace mode. |
| `Ctrl+Shift+P` | Toggle the inspector panel. |
| `Shift+click` on a category pill | Solo that family. |

## 4. What was deliberately **not** done

- No existing page was restyled. No `style={{}}` instance in `src/pages/` was touched.
- No colour or accent token in `theme.css` was changed.
- The existing `.app-btn*`, `.app-input`, `.app-badge*`, `.app-data-table` rules were **not** moved out of `globals.css`. They have "Canonical home" comments pointing at the family files and will migrate during the cleanup pass when pages using them are being touched.
- Tailwind was **not** removed. Flagged for a separate follow-up.
- No Supabase table was created for audit tags.

## 5. Suggested cleanup-pass order

When you start the actual restyling:

1. **Buttons first.** Grep `style={{` for colour/padding on buttons; swap to `<Button variant="…">`. Easiest wins, huge footprint reduction.
2. **Badges next.** Same pattern — replace inline styled status pills with `.app-badge .app-badge--<status>`.
3. **Tables.** Adopt `.app-data-table--compact` / `--workflow` where row density/status differentiation matters.
4. **Inputs.** Wrap forms with `.app-input` + variant class; migrate inline `height`/`padding`/`border-radius`.
5. **Tabs.** Standardise HR tabs and feature tabs onto `.app-tab--page`/`--inner`.
6. **Cards, toolbars, empty states, toasts** — adopt as pages are touched.
7. **Modal unification** last — it's the highest-risk migration because JobCardModal and the custom popups have bespoke behaviour.

Use the showcase at `/dev/user-diagnostic` as the "done definition" for each migration.
