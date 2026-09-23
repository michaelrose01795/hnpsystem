# Staff design governance

Governance foundation for the staff (non-`/website`) design system: what is
canonical, what is tracked debt, and what stops new drift.

> **This stage is deliberately non-visual.** Nothing here changes how a single
> existing staff page renders. No cascade change, no rule moved between files,
> no token added or renamed, no shared component behaviour altered. The staff UI
> as it renders today **is** the reference — including where it is legacy or
> inconsistent. Those inconsistencies are recorded as baselined debt, not
> corrected.

`/website` is out of scope. The customer design system lives in
`src/styles/custglobal.css`, is gated by `html.website-scope`, and is untouched.

---

## 1. What is canonical

Canonical is defined by pointing at the implementation that already exists — not
by introducing a new one.

| Concern | Canonical source | Enforced by |
|---|---|---|
| Design tokens | `src/styles/theme.css` | `canonical-manifest` |
| Staff global stylesheet | `src/styles/staffglobal.css` | `canonical-manifest` |
| Shared UI families | `src/styles/families/*.css`, entry `families/index.css` | `canonical-manifest` |
| Family registry | `src/components/ui/variants.js` (`UI_FAMILIES`) | `canonical-manifest` |
| Customer design system | `src/styles/custglobal.css` | `website-isolation` |

`variants.js` is the machine-readable registry. The `canonical-manifest` rule
asserts the wiring holds — every family it declares has a real file, every file
is imported by `families/index.css`, and `_app.js` still loads the canonical
stylesheets. It asserts **wiring only**; it never asserts CSS content, so it
cannot force a rule to move or a value to change.

### Cascade

The cascade is exactly what it was: `theme.css` → `staffglobal.css` (which
imports `families/index.css` and `features/vhc.css` at the top) → `custglobal.css`
scoped to `html.website-scope`. Plain source order, no `@layer`, no precedence
change. Family rules and page rules resolve against each other today exactly as
they always have.

This matters: the family files are currently *first* in `staffglobal.css`, so a
later page rule of equal specificity wins. That is a real weakness — and it is
recorded as debt (see §3), not fixed here, because fixing it would change what
existing pages render.

### Where families physically live

Several families are registered in `variants.js` and have a family file, but
their actual rules still live in `staffglobal.css` — badges, the `.app-input`
base, `.app-data-table`, `.app-table-shell`, `.app-modal` / `.app-drawer`,
`.app-alert` / `.app-toast-stack`, `.tab-api`, `.dropdown-api`,
`.skeleton-block`, and the `.app-page-card` / `.app-section-card` hierarchy.

That split is counted by the `family-ownership` ratchet (268 declarations across
2 files). It is **not** corrected here. The ratchet's job is to stop a *third*
location appearing.

---

## 2. Known competing implementations — recorded, not consolidated

These are real duplicates. They are documented so a migration pass can act on
them later. **None of them were consolidated**, because consolidating any of
them changes what something renders.

| Duplicate | Status today |
|---|---|
| `.app-toast` vs `.app-alert` | `.app-alert` is what every shipped toast uses. `.app-toast` is defined in `families/toasts.css` but has **zero consumers** — it renders only in the `/dev/user-diagnostic` showcase via `variants.js`. Left in place. |
| Three tab systems | `TabGroup` → `.tab-api` / `.tab-api__item` (24 files) is dominant. `.app-tab--*` (`families/tabs.css`) is a second base with 2 consumers. `StaffTabs` → `.app-staff-tabs` + `.app-btn--nav` is a third, with no page consumers. All three left working. |
| `.app-empty-state` declared twice | Base in `families/empty-states.css` (`align-items: center`), re-declared in `staffglobal.css` (`align-items: flex-start`, which wins on source order). Both left in place — `flex-start` is the current appearance. |
| `.app-empty-state__title` / `__description` / `__copy` | Declared in both `families/empty-states.css` and a grouped `staffglobal.css` rule shared with `.app-modal__title` etc. The `staffglobal.css` one wins. Both left in place. |
| `.modal-panel` / `.popup-panel` / `.drawer-panel` | Named as canonical modal shells in `auditParser.js` but carry no CSS — they exist only as dev-overlay trace selectors. Left as-is. |
| No desktop heading hierarchy | `h1`/`h2` are only styled inside a `max-width: 640px` media query, so desktop headings fall through to browser UA sizes. **Left as-is** — adding defaults would restyle every unstyled heading in the app. |
| No shared form-label primitive | Every form declares label typography locally. Counted by `one-off-styling`. Left as-is. |

---

## 3. Tracked debt (baselined, not corrected)

`tools/design-baselines/design-governance.json`. Per-file counts, captured
against the current tree.

| Ratchet | Foundation pass | After migration pass 1 | What it is |
|---|---|---|---|
| `family-ownership` | 268 | **196** | Family classes declared outside their family file |
| `important-budget` | 486 | 462 | `!important` declarations across staff stylesheets |
| `undefined-tokens` | 187 | **0** | `var(--x)` where `--x` is defined nowhere |
| `raw-colours` | 423 | **63** | Hex literals in staff UI code |
| `one-off-styling` | 11,950 | 11,843 | Inline styles setting a governed visual property |

§7 records what migration pass 1 changed and what it deliberately left.

### On `undefined-tokens` — resolved in migration pass 1

*(Historical. All 187 are now resolved; see §7.1.)*

187 references resolved to nothing. Some appear in CLAUDE.md's own token table.
The most-referenced: `--text-body-xs` (64), `--txt-bright` / `--txt-mute` /
`--txt-soft` (VHC customer view), `--font-mono` (19), `--accentMain` (8),
`--accent` (9), `--text-secondary` (6), plus a typo (`--surfaceest`).

They are **not** defined here. Defining one would change what those elements
render — `var(--text-body-xs, 0.76rem)` currently uses its fallback, and a real
definition could differ. Each needs to be resolved at the call site by someone
who can confirm the intended appearance.

### On `one-off-styling`

Counts inline `style={{ … }}` objects setting: `background*`, `color`, `border*`,
`boxShadow`, `font*`, `letterSpacing`, `textTransform`, `padding*`. Layout-only
keys (`display`, `flex`, `gap`, `grid`, `width`, `position`, `overflow`,
`zIndex`, …) are **not** counted — per-instance layout is legitimate, a
competing visual implementation is not.

---

## 4. Enforcement

```
npm run check:design          # enforce (runs in predev / prebuild)
npm run check:design:list     # full hit list, grouped by rule and file
npm run check:design:update   # lock in an improvement
```

Three hard rules and five ratchets:

| Rule | Kind | Catches |
|---|---|---|
| `canonical-manifest` | hard | A canonical stylesheet unwired, a family file unregistered in `variants.js`, or a registered family whose file is missing/unimported |
| `website-isolation` | hard | Staff CSS styling `html.website-scope`, `custglobal.css` styling `html.staff-scope`, either importing the other |
| `check-coverage` | hard | Another design check narrowing its `SEARCH_ROOTS` |
| `family-ownership` | ratchet | A family class declared in a new location |
| `important-budget` | ratchet | New `!important` |
| `undefined-tokens` | ratchet | New reference to a token that does not exist |
| `raw-colours` | ratchet | New hex literal |
| `one-off-styling` | ratchet | New inline visual styling |

**A file with no baseline entry is held to zero.** A new file that ships a hex
colour or an inline `background` fails immediately, while every existing file
keeps exactly the styling it has. `--update` refuses to raise a count or add an
entry; `--accept-new` is required for a deliberate re-baseline.

### Coverage widened

`check-staff-controls.js` scanned only `src/components/popups`,
`src/components/page-ui` and `src/pages`. It now scans all of `src/components`,
`src/features` and `src/pages`, so shared feature UI (VHC, HR, job cards,
invoices, support, reporting) is governed. Tracked legacy controls went from 401
across 60 files to **942 across 193 files** — the same code, an honest number.
`check-dropdowns.js` gained an explicit coverage contract. `check-coverage`
fails if either scope is narrowed again.

Full check set, all wired into `predev` and `prebuild`: `check:borders`,
`check:layers`, `check:dropdowns`, `check:staff-controls`, `check:text-contrast`,
`check:design`.

---

## 5. Rules for new work

These apply to **new** code. They do not require touching existing pages.

1. Use a shared component: `Button`, `DropdownField`, `InputField`, `TabGroup`,
   `LayerSurface` / `LayerTheme`, `EmptyState`, `PopupModal`.
2. If no component fits, use the canonical class from the family registered in
   `variants.js`.
3. If the family lacks the variant you need, add it to the family file **and**
   register it in `variants.js`. Do not style it locally.
4. Colour, spacing, radius, type size and control height come from tokens that
   already exist in `theme.css`. No hex literals, no magic pixels, no `var()`
   pointing at a token that is not defined.
5. No inline `style={{ background / color / padding / border / font … }}`.
   Layout-only inline styles are fine.
6. Do not add `!important`. The budget only goes down.
7. Do not restyle an existing page while doing unrelated work.
8. HNPSystem branding and the existing spacing / radius / density scales stay as
   they are. This is not Apple HIG and does not adopt Apple measurements.

Approved dealership-density decisions are unchanged and stay where they are —
32px data-table rows and row actions (`--table-row-height`,
`--table-action-btn-height`), the sidebar module rail, the portrait sidebar
close tab, and the topbar action wrap.

---

## 6. What the foundation stage deliberately did not do

*(Historical — describes the foundation pass. Migration pass 1 (§7) has since
acted on several of these.)*

- No cascade layers, no precedence changes.
- No CSS moved between files.
- No tokens added, renamed, aliased or removed.
- No shared component behaviour changed.
- No heading, label or spacing defaults introduced.
- No competing implementation consolidated.
- No page migrated.

The 158 implementation groups in
[`docs/Not following staffglobal.css setting.md`](../Not%20following%20staffglobal.css%20setting.md)
remain outstanding, alongside the debt in §3. This stage makes the rules
explicit and the drift detectable, so those migrations can happen deliberately —
each one owning its own visual review.

---

## 7. Migration pass 1 — broken tokens, dropdowns, raw colours, compact buttons

Where §1–§6 record the *foundation* stage (rules made explicit, nothing moved),
this section records the first stage that actually migrated code onto the
canonical system. The staff UI as it rendered before the pass remains the visual
reference; every place this pass deliberately changed what renders is listed
below so it can be reviewed rather than discovered.

### 7.1 `undefined-tokens`: 187 → 0

Every `var(--x)` in staff code now points at a token that exists.

**Repaired with no visual change** — the declaration already computed to nothing,
or the fallback was dead:

| Was | Now | Why it is a no-op |
|---|---|---|
| `var(--surfaceMutedToken, var(--surfaceMuted))`, `var(--surface-2, var(--surface))`, `var(--accent-dark, var(--accent-purple))`, `var(--text-secondary, var(--text-1))`, `var(--system, var(--surface))`, `var(--accentText, var(--accent))`, `var(--accentMain, var(--primary))` | the defined half | The first token is defined, so the fallback was unreachable |
| `box-shadow: … rgba(var(--shadow-rgb), …)` (5 sites) | `var(--shadow-sm/md/lg)` | The invalid `var()` made the whole declaration compute to `none`, which is what every `--shadow-*` token already resolves to |
| `border: 1px solid var(--accent-border)` (Tyre/Brake diagrams) | declaration removed | Invalid `var()` → `border-style: none`, so nothing was painted |
| `gap: var(--space-2xs)` (2 rules) | declaration removed | Invalid `var()` → `gap: normal` → `0` |

**Repaired as genuine bug fixes** — these were dead declarations whose author
intent was unambiguous, so the corrected value now renders:

| Token | Sites | Resolved to | Visible effect |
|---|---|---|---|
| `--text-body-xs` | 64 | `--text-caption` (0.75rem) | Small copy on dev / support tooling now renders at caption size instead of inheriting |
| `--font-mono` | 19 | `--font-family-mono` | Full monospace stack instead of the bare `monospace` fallback |
| `--accentMain`, `--accent` | 14 | `--primary` / `--accentText` | Restores brand red on: a checkbox `accent-color`, an SVG stroke, two chart/progress fills, a selection ring, the tracking-map primary button fill, and five topbar panel headings — all of which previously rendered with no colour at all |
| `--txt-bright` / `--txt-soft` / `--txt-mute` / `--website-elev-1` / `--website-elev-2` | 49 | `--text-1` / `--surfaceTextMuted` / `--theme` / `--theme-hover` | The VHC customer view renders under `html.staff-scope`, so these `custglobal.css` tokens were undefined and every colour and panel background there computed to nothing |
| `--surfaceest` (typo), `--primary-surface`, `--text-small`, `--text-title`, `--control-height-md`, `--accentText-contrast` | 1 each | `--surface`, `--secondary`, `--text-body-sm`, `--text-h2`, `--control-height`, `--onAccentText` | One panel background, one badge tint, two type sizes and one 44px control floor start rendering |
| `--shadow-rgb` (appointments row hover) | 1 | `rgba(var(--text-1-rgb), 0.07)` | Restores the calendar row-hover tint, which had never rendered |

**Not "undefined" at all** — the checker now understands two legitimate patterns
instead of reporting them:

- **Runtime-defined tokens.** `--font-inter` (`_app.js`), `--portrait-sidebar-top`
  (`StaffLayout.js`), `--video-editor-max-width` / `--video-editor-aspect-ratio`
  (`VideoEditorModal.js`), `--app-card-grid-min` (`StaffCardGrid.js`) and
  `--job-tracker-phase-color` (`JobProgressTracker.js`) are set as inline custom
  properties from JS and consumed from CSS. `RUNTIME_TOKEN_SOURCES` in
  `check-design-governance.js` names the owning component for each. **The list
  may only shrink.**
- **Composed names.** `` var(`--radius-${size}`) `` builds the token name at
  runtime; the literal prefix is not a reference.
- **Prose.** Token references inside CSS comments are no longer counted
  (`theme.css` documents the ring convention using `var(--x-ring)` examples).

One new token was added: **`--media-letterbox-bg: #111111`**, identical in both
themes, for the matte behind `<video>` previews. It replaces
`var(--surface-dark, #111)` in `job-cards/[jobNumber].js` and `tech/[jobNumber].js`
and renders exactly what the dead fallback rendered.

### 7.2 Dropdowns: 36 native `<select>` → 5

CLAUDE.md §3.4a makes `DropdownField` the only staff choice control. 31 native
selects across 23 files were migrated; their ad-hoc padding / radius / background
/ font inline styles went with them.

Two additive changes to the shared components made the migration possible without
losing behaviour:

- **`hasError` on `Dropdown` / `DropdownField`**, rendering `.dropdown-api.is-error`.
  The ring lives in `families/dropdowns.css` and reproduces the
  `0 0 0 2px rgba(var(--danger-rgb), 0.12)` that form pages were setting inline.
  Registered in `variants.js` as the `error` dropdown variant. Default `false`, so
  no existing consumer changes.
- **`getDropdownProps(name)` on `useFormValidation`**, a dropdown-shaped
  `getFieldProps`: same `id` / `name` / `value` / `onChange` / `aria-describedby`
  wiring, minus the focus `ref` (which only works on a native input), plus
  `hasError`.

Selects in a dense table row use `size="sm"`; form fields drop their arbitrary
`minHeight: 40` and take the canonical `--control-height` (44px) floor, which
§3.6 requires anyway.

**Deliberate appearance change:** a migrated control now renders as the canonical
dropdown rather than a browser-default select. That is the point of §3.4a, but it
is the largest visual delta in this pass and is the thing to look at first.

### 7.3 `raw-colours`: 423 → 63

Three separate things were conflated in the original 423.

1. **134 dead hex fallbacks removed** (`var(--defined-token, #hex)` → `var(--token)`)
   across 29 files. Provably unreachable, zero visual change. The largest single
   group was 72 in `PersonalWidgets.js`.
2. **Contexts that cannot use a custom property** are now exempt from
   `raw-colours` only — they keep their `one-off-styling` governance. Each entry
   in `RAW_COLOUR_EXEMPT` carries its reason: transactional email HTML
   (`src/pages/api/`, `supportReportEmail.js` — email clients do not support
   custom properties), WebGL/three.js materials (`src/features/3Dwebsite/` — a
   CSS variable cannot reach a shader), canvas 2D drawing surfaces
   (`VHC/photoEditor/`, `VHC/videoEditor/`, `VHC/mediaCapture/`), the
   pre-hydration theme bootstrap (`_document.js` — runs before any stylesheet
   exists) and the token source `themeRuntime.js`.
3. **Four exact substitutions.** White-on-accent text → `var(--onAccentText)`
   (which is `#ffffff` in *both* theme blocks, so like-for-like) in
   `ClockingHistorySection.js`, `RedirectToWorkshopButton.js` and
   `parts-create-order-ui.js`; and a hand-rolled `isDarkMode ? "#ffffff" : "#000000"`
   → `var(--text-1)`, which is the token that branch was duplicating.

**Why the remaining 63 were not tokenised:** the status tokens are *not*
theme-invariant — `--danger-base` is `#ef4444` in light and `#f87171` in dark,
`--primary` is `#b91c1c` / `#f87171`, and so on. Replacing a hardcoded `#ef4444`
with `var(--danger-base)` therefore changes what dark mode renders. Only eight
tokens in `theme.css` have the same literal in both blocks. Tokenising the rest
is a real improvement but it needs a dark-mode visual review, so it is left as a
deliberate follow-up rather than done blind. See §7.6.

### 7.4 Buttons

- **`.app-btn--xs` applied to 21 controls across 12 reporting files.** Every
  department's `*UtilitiesTab.js` carried an identical inline
  `{ fontSize: "0.74rem", padding: "4px 10px" }` on `.app-btn`. Because
  `.app-btn` locks `min-height` to `--control-height`, the buttons were already
  44px tall; the only visible change is the label (0.74rem → 0.82rem) and 1px of
  horizontal padding. `textDecoration: "none"` on the `<a class="app-btn">`
  export links also went — the base rule already sets it.
- **Redundant `minHeight: "44px"` removed** from five buttons in
  `SupportReportModal.js` and `SupportErrorBoundary.js`. `.app-btn` already sets
  exactly that.
- **Job-tracker phase stripe** moved from an inline `boxShadow` built from data
  to `--job-tracker-phase-color` + a rule in `staffglobal.css`. The colour is
  data; the stripe geometry is design. `width` / `justify-content` / `gap` /
  `text-align` came off with it — the `.job-tracker__group-button` rule and the
  `.app-btn` base already set them.

### 7.5 Badges and contrast

- **`.app-badge--count`** added to `families/badges.css` and registered in
  `variants.js`: the fixed 32px circular counter used by the sidebar unread
  badge, with `.app-badge-slot` / `--counted` as its container companion. This
  replaced an inline block that set width/height/padding/radius/font on
  `.app-badge`. The compound selector `.app-badge.app-badge--count` is deliberate
  — the `.app-badge` base still lives in `staffglobal.css`, which is imported
  *after* the family files, so specificity is what carries the variant, not
  source order and not `!important`.
- **`StaffVehiclesCard.js` sticky table head** used `color: var(--text-2)` on a
  `var(--accent-strong)` fill. `--text-2` resolves to near-black in dark mode, so
  that header rendered dark-on-red. Now `var(--onAccentText)`.

### 7.6 Remaining exceptions — recorded on purpose

These are known, deliberate, and not accidental drift.

| Area | Why it is still here |
|---|---|
| **63 raw colours** | Status tokens differ between light and dark, so substitution is not like-for-like (§7.3). Also includes: 38 dev-overlay trace colours inside `staffglobal.css` (loud-on-purpose, non-product), 6 devtools `console.log` CSS strings in `_app.js`, the accent-palette fallback literals duplicated in `BrandLogo.js` / `CarImage.js` / `ProfileThemeControls.js` (consolidating them would change two of the three fallback values), the queue-planner and appointments status-dot palettes (blue/orange/indigo — no matching token exists yet), and `#7D3FFF` / `#E53935` in `parts-create-order-ui.js`. |
| **5 native `<select>`** | 4 in `stock-catalogue-ui.js`; 1 in `VhcDetailsPanel.js` which uses `<optgroup>` — `DropdownField` has no grouped-options support, so migrating it needs that capability added to the family first. |
| **885 raw controls** | 531 raw `<button>`, 286 `<input>` and 47 `<textarea>` missing `.app-input`. Concentrated in `VhcDetailsPanel.js` (71), `parts-goods-in-ui.js` (49) and `job-cards/[jobNumber].js` (43). Each needs its own visual review; this pass took only the 24 that were already using the canonical class and overriding it inline. |
| **`DevButton` in `support/dev/supportDevUi.js`** | A shared dev-tooling button that reimplements the button family with tone tints. Migrating it would restyle the whole dev support workspace in one go. |
| **`DevNotificationBell` chip button** | Dynamic `toneTint()` background; needs a chip-button variant designing before it can move. |
| **`important-budget` (462)** | Untouched. `!important` interacts with the cascade weakness in §1, so removing any of it needs the family/page ordering resolved first. |
| **`family-ownership` (196)** | Untouched as a *migration*. The count fell from 268 only because the rule was refined (below), not because rules moved. |

### 7.7 Checker refinements

The gates got more accurate; none of them got weaker.

| Check | Change |
|---|---|
| `check-design-governance` | `family-ownership` now counts only rules that declare a family's **appearance**. A page-context rule touching nothing but layout (`width`, `justify-content`, `white-space`, …) is not a competing implementation, and moving it into a family file would be wrong. This is the same governed-vs-layout split `one-off-styling` already uses, and it accounts for the 268 → 196 drop. |
| `check-design-governance` | `RAW_COLOUR_EXEMPT` split out from `VISUAL_EXEMPT`, so a file that legitimately needs colour literals still has its inline styling governed. |
| `check-design-governance` | CSS comments stripped before the `undefined-tokens` scan; `RUNTIME_TOKEN_SOURCES` and composed-name handling added (§7.1). |
| `check-staff-controls` | `VISUAL_STYLE_RE` is now tested against the `style={{ … }}` object rather than the whole opening tag — prose in a neighbouring attribute (a `data-tooltip` containing the word "background") was being reported as inline styling. |
| `check-borders` | Block comments are blanked file-wide (preserving line numbers) before the ring-misuse scan, so a multi-line comment *describing* the ring bug is no longer reported *as* the bug. |
| `check-dropdowns`, `check-staff-controls` | Migration baselines lowered to match the tree (36 → 5 selects, 940 → 885 controls). |

Baselines were re-derived from `HEAD` and re-locked, so every number above is a
real reduction rather than an accumulated `--update`.
