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

| Ratchet | Files | Hits | What it is |
|---|---|---|---|
| `family-ownership` | 2 | 268 | Family classes declared outside their family file |
| `important-budget` | 15 | 486 | `!important` declarations across staff stylesheets |
| `undefined-tokens` | 63 | 187 | `var(--x)` where `--x` is defined nowhere |
| `raw-colours` | 61 | 423 | Hex literals in staff UI code |
| `one-off-styling` | 299 | 11,950 | Inline styles setting a governed visual property |

### On `undefined-tokens`

187 references resolve to nothing. Some appear in CLAUDE.md's own token table.
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

## 6. What this stage deliberately did not do

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
