# Website builder (`/website-manager` → `/website`)

How a staff edit in the Website Manager reaches the public marketing site, and
what you have to run once before the new builder tabs work.

---

## 1. Run this first

The builder adds three tables. They are **not** applied automatically — run the
migration against Supabase before using the **Design & layout** tab:

```
supabase/migrations/20260901120000_website_builder_nav_design_layout.sql
```

| Table | Kind | What it controls |
|---|---|---|
| `website_nav` | collection | The public top-bar links (label, target, car pre-filter, order, published/draft) |
| `website_section_layout` | collection | Which blocks render on `/website`, in what order, with what heading copy and background tint |
| `website_design` | singleton | Accent colour, content width, section spacing, corner/button shape, heading font, top-bar options |

The migration is idempotent and its seed reproduces exactly the values that
were previously hard-coded in React, so applying it changes nothing visible
until someone edits something.

**Until it is applied:** `/website` falls back to the static defaults in
`src/features/website/data/siteDesign.js` and renders as before; the Design &
layout tab shows a load error instead of a form. Nothing else breaks.

---

## 2. How an edit travels

```
/website-manager  →  /api/website/sections/:section  →  website_* table
                                                              │
                          /api/website/content  ←─────────────┘
                                     │
                     useWebsiteContent()  →  WebsitePage
```

Everything goes through the **generic** section endpoints, so the three new
tables needed no new API routes — only:

- an entry in `SECTION_TABLES` (`src/lib/database/website.js`), and
- a schema in `BUILDER_SCHEMAS` (`src/features/websiteManager/editors/sectionSchemas.js`).

Add a fourth builder table the same way and it gets list, reorder, add, edit,
delete and publish/draft for free via `<CollectionManager>`.

---

## 3. Where each thing is decided

| Question | Answered by |
|---|---|
| Which blocks exist at all? | `BLOCK_RENDERERS` + `BLOCK_KEYS` in `src/features/website/WebsitePage.js` |
| Which of them render, in what order? | `website_section_layout` rows (published only), ordered by `sort_order` |
| What heading copy does a block show? | The layout row's `eyebrow` / `title` / `lead`, falling back to the block's own content record |
| What does the site look like? | `website_design` → `designToCssVars()` → CSS custom properties on `.ws-page` → the `.ws-*` rules in `custglobal.css` |
| What's in the top bar? | `website_nav` rows (published only) |

A layout row whose `id` has no renderer is skipped. The Sections tab flags
those rows with a **No renderer** badge so a hand-added row never looks
published while drawing nothing.

### Design settings are CSS custom properties

`designToCssVars()` (`src/features/website/data/siteDesign.js`) turns a
`website_design` row into the tokens `custglobal.css` already reads:
`--accentMain`, `--primary`, `--accentMainRgb`, `--ws-maxw`, `--ws-radius`,
`--ws-btn-radius`, `--ws-nav-h`, `--ws-logo-h`, `--ws-section-pad`,
`--ws-nav-position`, `--ws-heading-font`.

They are set inline on `.ws-page`. `custglobal.css` declares the same tokens
with `!important` on `html.website-scope`, but that only binds the value *on
`html`* — an inline value on the nearer `.ws-page` still wins for its own
subtree, so no `!important` was added anywhere.

Every one of those tokens has a fallback equal to the value that was hard-coded
before, so an unstyled or half-populated row degrades to the current look.

---

## 4. Live preview

Two tabs embed `/website?preview=editor` and drive it over `postMessage`
(`PREVIEW_MESSAGE_TYPES` in `useWebsitePreviewMode.js`):

- **Visual editor** — click a region in the iframe, its editor opens in the
  side pane, and every keystroke is forwarded as `hnp:content-patch` so the
  change shows before it is saved. Saving PATCHes the API and sends
  `hnp:editor-refresh` so the iframe re-reads the canonical row.
- **Design & layout → Style** — the same mechanism with `sectionKey: "design"`,
  so a colour or spacing change repaints the preview instantly.

`useWebsiteContent` applies both kinds of patch in `applyLivePatch()`; a new
section key needs a `case` there or its live preview will silently do nothing.

---

## 5. Staff-side presentation contract

The manager follows the ordinary staff page contract, not a bespoke one:

- `<Section>` cards, `LayerSurface` / `LayerTheme` alternation, `<EmptyState>`,
  `<Button>`, `DropdownField`, `.app-input`, `.app-data-table`.
- `.app-data-table` supplies its own cell padding and `--separating-line` row
  rules — do **not** reintroduce per-cell inline style objects.
- The tab strip paints its own container background, so it sits directly on the
  page stack; wrapping it in a card would stack two surfaces.
- Anything bespoke gets a `.website-manager__*` class in
  `src/styles/features/website-manager.css`. No one-off inline visual styling.
