# Staff Responsive Contract

Companion to [staff-design-governance.md](staff-design-governance.md). Covers how
staff UI behaves below desktop width, and what enforces it.

Enforced by `npm run test:responsive`.

---

## 1. The breakpoint scale

Canonical source: [src/styles/breakpoints.js](../../src/styles/breakpoints.js).

| Name | Width | Meaning |
|---|---|---|
| `PHONE_FLOOR` | 375 | Hard minimum. iPhone SE. Everything must work here. |
| `PHONE` | 480 | Large phone / small phone landscape. |
| `MOBILE` | 640 | The phone-to-tablet boundary — the definition of "is mobile". `useIsMobile`'s default. |
| `TABLET` | 768 | Tablet portrait. |
| `DESKTOP` | 1024 | Tablet landscape / small desktop. |
| `WIDE` | 1280 | Full desktop. |

New media queries use one of these six widths. Before this scale, `staffglobal.css`
carried 50+ media blocks across 16 different widths, so two components could
disagree about where "mobile" starts by 100px — a card would collapse while the
toolbar above it had not, and the row blew out sideways.

**CSS cannot read a custom property inside a media condition**, so these are not
theme.css tokens. They are literals in CSS and the module above in JS.

Use `pointer: coarse`, not a width, for anything about **fingertips** (touch
targets, hover affordances). A 1024px tablet is touch-operated and matches no
max-width phone rule.

---

## 2. The app never scrolls sideways

`staffglobal.css` sets `overflow-x: clip` on `html`, `overflow-x: hidden` on
`body`, and caps every `div` at `max-width: 100%`. Horizontal panning is
impossible by construction.

**This is a constraint, not a guarantee of fitting.** Over-wide content is
silently *clipped* instead — a button past the right edge cannot be reached at
all, and nothing indicates it exists. That, not scrolling, is the phone failure
mode here, and it is what the gate measures.

Consequence for new work: never "solve" a narrow layout by letting it overflow.
It will not scroll; it will disappear.

---

## 3. Tables become cards on a phone

A data table cannot be made readable at 375px as a table, and sideways scroll is
off the table (see §2 — scrollbar chrome is hidden app-wide, so a sideways scroll
hides columns behind an invisible scrollbar).

Below `MOBILE`, each row becomes a label/value card:

- CSS: `.app-data-table--stack` in [families/tables.css](../../src/styles/families/tables.css)
- DOM: [src/lib/ui/tableStacking.js](../../src/lib/ui/tableStacking.js), applied to
  **every** table by [GlobalTableShells](../../src/components/App/GlobalTableShells.js)

Each cell needs its own column heading, which CSS cannot supply — a stylesheet
cannot read `thead` text into a `tbody` cell. `tableStacking` stamps it on as
`data-label`, colSpan-aware, and the CSS renders it with `attr()`.

Opt out with `data-app-table-stack="off"` on the table or any ancestor
(`DataTableShell` accepts `stack={false}`). Do so for a table that is already
narrow, or one laid out as a grid/matrix rather than a list of records — turning
each row into a card there loses the comparison the table exists to make.

Per-cell control:

| Attribute | Effect |
|---|---|
| `data-label="..."` | Override the heading (use where the visible heading is an icon) |
| `data-label=""` | No label — drops the label gutter (actions, checkbox columns) |
| `data-table-cell="block"` | Label above the value instead of beside it (long free text) |

A stacked table **drops its desktop chrome classes** (`.app-table-shell` and
friends). That class sets `min-width: max-content`, which on its own guarantees
clipping at the floor, plus `!important` paddings the stacked rules could not
override without adding `!important` of their own.

---

## 4. Touch targets

44px minimum (CLAUDE.md §3.6), under `pointer: coarse`.

Three shared controls carried nearly all the violations, and all three are
token-driven — so the floor is applied by rebinding tokens in `staffglobal.css`,
lifting every instance without touching a component:

| Control | Desktop | Token |
|---|---|---|
| `.app-table-action-btn` | 32px | `--table-action-btn-height` |
| `.app-news-link` | 32px | `--table-action-btn-height` |
| `.tab-api__item` | 35px | `--tab-api-height` |

Mouse users keep the denser controls — desktop density is unchanged.

WCAG 2.5.8 exempts a link whose size is constrained by the line-height of the
sentence around it. The gate honours that: a `display: inline` anchor with text
siblings is not flagged. An inline anchor that is the only thing in its container
is a control wearing a link, and still counts.

---

## 5. Inputs must be >= 16px on a phone

iOS Safari **zooms the whole page** when a text-entry control smaller than 16px
receives focus, and does not zoom back out. `--control-font-size` is `0.92rem`
(~14.7px), so every field in the app triggered it.

[families/inputs.css](../../src/styles/families/inputs.css) lifts text-entry
controls to `max(16px, var(--control-font-size))` below `MOBILE`. Buttons and tabs
are deliberately excluded — they never trigger the zoom, and lifting them would
change type density for no benefit.

**Do not set a font-size under 16px on an input, textarea or select.**

---

## 6. Card padding is cumulative

Padding compounds down the nesting ladder. At the floor the untreated stack was:

```
viewport                375
- app shell gutter    2 x 10 =  20
- page card padding   2 x 24 =  48
- section card        2 x 20 =  40
= usable content               267px
```

[families/cards.css](../../src/styles/families/cards.css) rebinds
`--page-card-padding` / `--section-card-padding` (and the matching radii — a 24px
radius on a 16px-padded card eats its own corners) at `MOBILE` and again at
`PHONE_FLOOR`. Because every card reads those tokens, the whole ladder follows and
no individual card needs touching.

---

## 7. The gate

```bash
npm run test:responsive                                # enforce
UPDATE_RESPONSIVE_BASELINE=1 npm run test:responsive   # re-record
```

[e2e/responsive/phone-floor.spec.js](../../e2e/responsive/phone-floor.spec.js)
loads each route at 375px **with touch emulation** (`hasTouch` / `isMobile` — the
`pointer: coarse` rules do not match under plain Desktop Chrome, so without it the
gate would measure the mouse layout and silently pass) and asserts:

1. **clipped** — no element whose content is wider than its box, where the overflow
   is hidden, there is no ellipsis signalling it, and the box does not scroll.
   Content the user can neither see nor reach.
2. **touch** — no interactive control under 44px.

Ratcheted against `phone-floor-baseline.json` in the same style as
`tools/design-baselines`. **The baseline is currently all zeros** — every recorded
route is clean, so any regression fails.

The spec asserts the route did not redirect before measuring; several routes
role-redirect to `/newsfeed` for the E2E user, and a redirect would otherwise make
the gate assert against the wrong page and pass.

---

## 8. Known gaps

- **Three pages refuse portrait outright**, via `requiresLandscape` on `Layout`
  (see `StaffLayout`'s orientation lock): `/appointments`, `/job-cards/[jobNumber]`,
  `/tech/[jobNumber]`. A phone user in portrait is told to rotate rather than shown
  the page. These are the densest screens in the app and were never migrated. They
  are the largest remaining "not usable on a phone" gap.
- **Gate coverage is 8 routes**, limited by what the E2E user's roles can reach.
  Widening it needs a fixture user with broader roles.
- Grids on the landscape-locked pages still carry fixed pixel column sets (e.g.
  `minmax(0, 1fr) 190px 90px 180px 150px`, 610px minimum). They fit in landscape
  and are unreachable in portrait, so they are not currently a defect — but they
  block ever unlocking those pages for portrait.

---

## 9. The customer site (`/website`)

`/website` is a **separate design system** — [custglobal.css](../../src/styles/custglobal.css),
gated by `html.website-scope`, with its own governance doc
([website-design-governance.md](website-design-governance.md)) and its own
static gate (`npm run check:website`). CLAUDE.md §3.0b rule 6 makes the
isolation hard: staff CSS must never style `html.website-scope`, and vice
versa. Nothing in §1–§8 above applies to it.

It has its own phone-floor gate,
[e2e/responsive/website-phone-floor.spec.js](../../e2e/responsive/website-phone-floor.spec.js),
which shares the detector in `measure.js` with the staff one and additionally
asserts the page really is running `html.website-scope` with no `staff-scope`
leaked onto it. **Every customer-facing route is at zero**; `/website/dev`
(the internal showcase, not a customer journey) is baselined.

**Editing custglobal.css requires regenerating the route CSS.** `/website`
does not load `custglobal.css` directly — `_app.js` calls
`ensureRouteScopedStylesheet("website")`, which serves a hashed, minified build
from `public/route-css/`. An edit to the source has no effect on the running
site until:

```bash
npm run css:route-scoped
```

This runs in `predev` / `prebuild`, so a normal build picks it up — but a live
dev server keeps serving the old hash, which makes a correct fix look like it
did nothing.

### Deliberate opt-outs in custglobal (do not "fix" these)

| Rule | Why |
|---|---|
| `.calendar-api__day` is exempt from the 44px floor | A square grid cell sized by its grid (renders 40×40, above the WCAG 2.5.8 AA floor). Forcing 44 breaks the square. The detector exempts it by name. |
| `--website-check-size: 18px` on radios / checkboxes | The 18px box is the *visual*; the tap target is the wrapping `<label>` (57–70px). The detector measures the label, which is what the browser routes a tap to. |
| `.website-native-datetime__field` is 1px / `opacity: 0` | A real `<input type="date">` kept invisible so the browser owns the value, while a styled button is the visible control. |
| `.website-dev-stage` / `.website-dev-frame` crop their contents | Preview viewports on the showcase. Cropping is the feature; the components they preview are checked on the routes they ship on. |

Picker **chrome** (`.calendar-api__month-year`, `.calendar-api__today-button`,
`.calendar-api__picker-cell`) is *not* exempt — those were swept into the grid-cell
opt-out by mistake and rendered 13px tall. A month cell is a row in a list of
month names, not a square day cell.
