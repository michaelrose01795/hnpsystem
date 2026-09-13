# Customer (/website) design governance

`src/styles/custglobal.css` is the design system for **everything rendered under
`html.website-scope`**: the marketing page, stock, shop, parts catalogue,
valuation, login and profile. This document is the customer counterpart of
[staff-design-governance.md](staff-design-governance.md), and the rules are
summarised in CLAUDE.md §3.0c.

It is enforced by `npm run check:website`
([tools/scripts/check-website-design.js](../../tools/scripts/check-website-design.js)),
which runs in `predev` and `prebuild`.

---

## 1. What is canonical

| Concern | Source | Edited by |
|---|---|---|
| Stylesheet | `src/styles/custglobal.css` | hand |
| Registry: families, showcase sections, token purposes, contrast pairs, exemptions | `src/config/websiteDesignSystem.json` | hand |
| Showcase | `/website/dev`: `src/pages/website/dev.js` + `src/features/website/showcase/` | hand |
| Manifest the showcase renders | `src/config/websiteDesign.generated.json` | **generated**, never edit |
| Recorded debt | `tools/design-baselines/website-design.json` | `check:website:update` / `--accept-new` only |

Nothing else may define how customer UI looks. CSS modules, inline visual
styles and raw colours in customer JS are tracked as debt, and the counts may
only fall.

Customer code (`src/pages/website/`, `src/features/website/`) is excluded
from the staff control guard (`check-staff-controls.js`). Raw `<button>` and
`<input>` are the canonical customer controls, so the staff `Button` /
`.app-input` contract does not apply; this check governs them instead.

### How a change cascades

```
token block (dark)  ──►  light theme block re-points the same names
        │
        ▼
@family rules read var(--token)  ──►  every /website route
        │
        ▼
check:website regenerates the manifest  ──►  /website/dev swatches, token table
```

Swatches on `/website/dev` paint `var(--token)`, never a copied value. When a
token changes, the pages and the showcase change together, and the showcase
cannot show a colour the site does not use.

---

## 2. The stylesheet layout

Every rule lives under an `@family <id>` comment. A family may reopen further
down the file: the dropdown light fills sit late on purpose, for specificity.

| Family | Showcase section | What it is |
|---|---|---|
| `foundation` | Foundation | Token block, theme insulation, page wash, layout guards, scrollbar |
| `controls` | Controls | Raw `<button>` (secondary), `.app-btn` (primary), inputs, textarea, radio, file, raw `<select>`, form rhythm |
| `select` | Selects & Dropdowns | `WebsiteNativeSelect` trigger and menu |
| `dropdown` | Selects & Dropdowns | The staff Dropdown API as it renders under the customer scope |
| `pickers` | Date & Time Pickers | `WebsiteNativeDateTimeInput`, calendar, time picker, Calendar API opt-outs |
| `banner` | Controls | `.website-banner` |
| `showcase` | Reference | `.website-dev-*`: the showcase's own chrome |
| `theme` | Foundation | The `data-website-theme="light"` flip |
| `marketing` | Marketing Page | `.ws-*` page: nav, hero, typography, cards, grids, reviews, team, contact, footer |
| `stock` | Vehicle Stock | Available stock and vehicle detail |
| `shop` | Shop, Basket & Checkout | Teaser, product tiles, basket drawer, cart, checkout |
| `parts` | Parts Catalogue | Catalogue controls, basket notices, product detail |
| `preview` | Marketing Page | Live Preview editor outlines |
| `auth` | Sign-in & Account Forms | `/website/login` |
| `valuation` | Valuation Wizard | `/website/valuation` |
| `help` | Help & Advice | Help cards and the More info popup |
| `dev-overlay` | Reference | Website skin for the staff dev layout overlay (tooling) |

---

## 3. Rules

### Hard: any hit fails the build

1. **scope-anchor.** Every selector starts with `html.website-scope`.
2. **family-blocks.** Every rule sits under a registered `@family` marker. The
   marker must start a comment line; prose that mentions a family is ignored.
   Every registered family has at least one block.
3. **defined-tokens.** Every `var(--x)` resolves to a token declared in
   custglobal.css. A staff token is never read directly: if a staff-named
   convention is needed (`--separating-line`, `--font-family-mono`), it is
   re-declared in the token block. The only inherited staff token is
   `--font-family`, on purpose. Runtime tokens set from JS (the swatch
   variable) are registered with the file that sets them.
4. **theme-parity.** The light blocks re-point only tokens the base blocks
   declare, and no token is declared twice for the same theme.
5. **token-registry.** Every declared token has a registry entry with a `group`
   and a `purpose`, and no entry goes stale.
6. **showcase-sections.** Every registered section renders
   `<ShowcaseSection id="…">`.
7. **showcase-coverage.** Every class the stylesheet declares appears in the
   showcase markup: its own files, or a customer / ui component it imports.
   Class names written as JSX text (inside `<code>`) do not count. Only two
   families are exempt: `showcase` (it is the page) and `dev-overlay` (tooling
   anchored on the overlay's own attributes). Each exemption carries a reason in
   the registry.
8. **focus-visible-only.** `var(--focus-ring)` appears only in rules where
   every comma-separated selector is a `:focus-visible` or `:focus-within`
   selector (a bare `:focus` outside `:not(…)` fails). A rule whose subject is
   a text field (`input`, `textarea`, `select`, other than
   `type="radio|checkbox|submit|button|reset|image"`) never reads the ring.
   See §4 *Focus*.
9. **native-controls.** Customer code (`src/pages/website/`,
   `src/features/website/`, showcase included) renders no raw `<select>` and
   no `<input type="date|time|datetime-local">`. Only `WebsiteNativeSelect.js`
   and `WebsiteNativeDateTimeInput.js` may. Comments are ignored. See §4
   *Native controls*.
10. **showcase-inline-style.** In `src/pages/website/dev.js` and
    `src/features/website/showcase/**`, every `style={{…}}` key must be a
    runtime custom property registered in `runtimeTokens` (for example
    `"--website-dev-swatch"`). Layout-only keys fail too: the showcase is the
    stylesheet's reference, so its layout lives in `.website-dev-*` classes.
11. **staff-scope-leak.** No selector in `staffglobal.css`, `theme.css` or
    `families/*.css` mentions `website-scope` in any form (exclusions inside
    `:not(…)` are fine), and no custglobal.css selector mentions
    `staff-scope`. This is stricter than the staff checker's
    `html.website-scope` test, and it reports `file:line`.

### Ratchet: may only go down

| Ratchet | Keyed by | Counts |
|---|---|---|
| `raw-colours` | family | Hex / `rgb()` / `white` / `black` in rule declarations (token definitions excluded) |
| `important` | family | `!important` outside token definitions |
| `dead-classes` | family | Declared classes no customer code renders |
| `undeclared-classes` | file | `className` tokens in customer code with no rule |
| `inline-visual` | file | `style={{}}` setting background, colour, padding, font or radius keys |
| `js-raw-colours` | file | Colour literals in customer JS |
| `js-undefined-tokens` | file | `var(--x)` in customer JS with no custglobal definition |
| `contrast` | theme + pair | Registry text/fill pairs below their floor |
| `control-metric-literals` | family | On rules targeting a control (`button`, `[role="button"]`, `input`, `select`, `textarea`, `.app-btn`, or a class ending `-btn`, `-button`, `-close`, `-qty`, `-toggle`, `-option`, `-phone`, `-account`, `-link`, `-tab`, `-chip`, `-filter`, `__trigger`, `__control`, `__nav`, `__day`, with an optional `--modifier`): `height`, `min-height`, `max-height`, `font-size`, `font-weight`, `letter-spacing` and `border-radius` values that are literals rather than `var(--…)`. `0`, `auto`, `inherit`, `none`, `normal` and `100%` are allowed, plus `50%` on radii |
| `radius-literals` | family | Any `border-radius` (or corner longhand) with a non-zero px/rem/em literal. `var()`, `0`, `50%` and `inherit` are allowed. Read a `--website-radius-*` token |
| `js-staff-classes` | file | Customer code using staff-only UI: `app-input`, `app-btn--primary/--secondary/--ghost`, `app-section-card`, `app-page-card`, `popup-card`, `app-modal__*`, or imports of `@/components/ui/Button`, `LayerSurface`, `LayerTheme`, `@/components/popups/*`, or the staff `DropdownField` (direct, or from the `dropdownAPI` barrel) |

For every ratchet, `var(…)` is removed (fallback included) before the checker
looks for literals. Custom-property declarations are never counted.

**New ratchets.** A ratchet with no entry at all in the baseline file fails
with *"has no baseline yet"*, plus a note that this is expected. The
design-system owner records its existing debt once with `--accept-new`, after
the hard rules pass. From then on it behaves like every other ratchet.
`--update` never adds keys.

Contrast pairs are defined in the registry (`contrast`). The checker resolves
the real token values for both themes, composites translucent layers over the
opaque page base, and compares the result with the WCAG ratio floor.

---

## 4. Working in the system

**Change a colour.** Edit the token in the foundation block, and the light
theme block if it differs in light. Do not touch the rules.

**Need a new colour.** Add a token to the foundation block (and re-point it in
the light block if needed), register it in `websiteDesignSystem.json`, and read
it from the rule. It appears in the showcase token table on the next
`npm run dev`.

**Component looks wrong in light mode.** Give the value a token and re-point it.
Do not add `[data-website-theme="light"] .component { … }`. The rules left in
the light block are the things a custom property cannot carry: SVG data-URI
glyph colours, `color-scheme` and browser filters.

**New class.** Declare it inside the right `@family` block **and** render it in
the matching `src/features/website/showcase/sections/*Showcase.js` in the same
change. Prefer importing the real component when it has no side effects
(`VehicleCard`, `ProductCard`, `WebsiteNativeSelect`). Surfaces that lock scroll
or grab focus (the Help popup) are rendered as static markup, and
`position: fixed` surfaces go inside a `<Stage>`.

**New family.** Register it (with a `section`), open an `@family` block, and
either add it to an existing section or add a section with its own
`<ShowcaseSection id>` and an entry in `SECTION_COMPONENTS` in `dev.js`.

**Focus.** The focus ring (`--focus-ring`) is only for keyboard focus on
things you press: buttons, links, tabs, chips, day cells, checkboxes and
radios. Paint it in a `:focus-visible` rule, or `:focus-within` for a
composite, and never in a plain `:focus` rule. Mouse users should not see it.
Text inputs, textareas and selects show focus through the control material
(fill / ring colour) and never get a ring. The product owner does not want a
halo round a field. (Hard rule 8.)

**Native controls.** Choices and dates go through the customer wrappers:
`WebsiteNativeSelect` for any select, and `WebsiteNativeDateTimeInput` for
date, time and datetime. They keep a real native element for form value and
accessibility, and draw the customer trigger, menu and picker. A raw
`<select>` or `<input type="date">` shows the browser's own chrome. That breaks
the dark theme and the control rhythm, so it fails the build, in the showcase
too. The showcase demonstrates the wrappers rather than the raw elements.
(Hard rule 9.) Staff controls (`DropdownField`, `Button`, `.app-input`) are
never the answer under `html.website-scope` (ratchet `js-staff-classes`).

**Paid down debt.** Run `npm run check:website:update` to lower the baseline.
`--accept-new` re-baselines from scratch. It is for deliberate migrations only,
never for getting a failing build through.

**See everything.** `npm run check:website:list` prints every hit with its
line number.

---

## 5. Introduction pass (2026-09-13)

What changed, and why nothing a customer sees moved:

- **Tokens added.** Page base, wash colours, scrollbar track, overlay shadow,
  specular, scrim, photo ink, placeholders, option / selected-row states, day
  states, success / warning ink and the Live Preview outline colour now each
  exist once per theme. The brand aliases, focus ring and scrollbar thumb read
  `--accentMain` / `--accentMainRgb`, so a brand change reaches them.
- **Literals swapped for tokens only where the values were identical.** Where
  an old light-only rule existed, the light block now re-points a token
  instead, and the rule was deleted. Two light values were consolidated with a
  0.01 alpha difference: the Dropdown API description ink (0.55 → 0.54).
- **Staff leaks closed.** `--separating-line`, `--font-family-mono` and
  `--success-base` were being read from the staff theme. The first two are
  pinned in custglobal. The last is `--website-success-ink`. On the light-only
  public pages the values are identical. On dark (profile, showcase) the row
  separator is now brand red rather than the staff dark accent.
- **Unmatched fallbacks removed.** `var(--txt-bright, #fff)` style fallbacks
  never applied, because the tokens are always defined, and they hid literals
  from review.
- **Showcase rebuilt.** `/website/dev` went from about 80 of 464 classes to all
  of them, in sections that mirror the real pages, plus a generated token /
  family / contrast reference. It opens on light, matching the public site.

Debt recorded at introduction (see the baseline file for per-key counts):
raw-colours 45, important 7, dead-classes 9, undeclared-classes 13,
inline-visual 60 (40 in `src/pages/website/profile.js`), js-raw-colours 30,
js-undefined-tokens 1, contrast 2:

- dark `--accentText` on the page: 3.11:1.
- light low-stock warning ink on a glass card: 2.74:1.
