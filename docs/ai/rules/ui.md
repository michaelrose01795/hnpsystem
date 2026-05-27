# ui.md — UI, Tokens, Layout, Components

> Read this file **only** when the task touches styling, layout, components, or theme tokens.

---

## 1. Layer Primitives — THE LAW

Only **two** surface primitives exist:

| Component | Background | Location |
|---|---|---|
| `<LayerSurface>` | `var(--surface)` | `src/components/ui/LayerSurface.js` |
| `<LayerTheme>` | `var(--theme)` | `src/components/ui/LayerTheme.js` |

Rules:
1. Every card / section / panel routes through one of these (directly or via `<Card>`, `<Section>`, `<SectionCard>`).
2. **Strict alternation when nesting:** `LayerSurface → LayerTheme → LayerSurface → ...`. Two consecutive of either is a bug.
3. Both primitives are **borderless**.
4. Banned inline styles on cards/sections: `border`, `background`, `borderRadius`. Use the props `radius` / `padding` / `gap` instead.
5. Non-surface inline styles (flex, gap, text colour, width/height) are still fine.

---

## 2. Borders — THE LAW (Border Sweep, 2026-05-07)

Borders are **banned** everywhere except these five cases:

| Use-case | Token |
|---|---|
| Row-bottom rule inside tables/lists | `--separating-line` |
| Form inputs | `--input-ring` |
| Checkboxes & radios | `--checkbox-ring` |
| Ghost buttons | `--ghostbutton-ring` |
| Keyboard focus | `--focus-ring` (via `box-shadow`) |

**Banned tokens** (resolve to transparent / will be deleted): `--primary-border`, `--secondary-border`, `--section-card-border`, `--page-card-border`, `--nav-shell-border`, `--nav-link-border`, `--nav-link-border-active`, `--profile-card-border`, `--calendar-today-row-border`, `--hud-border`, `--hud-border-strong`, `--skeleton-border`, `--control-border`, `--input-border`.

Not affected: `border-radius`, `border-collapse`, `border-spacing`, `box-sizing: border-box`, transparent layout placeholders.

**Enforcement:** `npm run check:borders` ([tools/scripts/check-borders.js](../../../tools/scripts/check-borders.js)). Run before committing UI changes.

---

## 3. Accent & Status Tokens

Allowed accent tokens:
- `--accent-base`, `--accent-surface`, `--accent-base-hover`, `--accent-surface-hover`, `--accent-strong`

Allowed status families:
- Green → `--success*`
- Amber → `--warning*`
- Red → `--danger*`

**Deprecated marker tokens** (replace on sight — intentionally loud):
- `--accent-purple*`, `--accent-blue*`, `--accent-orange*`, `--accent-layer-*`, `--info*`

If a page shows unexpected bright purple or red, swap the deprecated token for a semantic one.

---

## 4. Token Files
- Colour / design tokens: `src/styles/theme.css`
- Layout classes: `src/styles/globals.css` (`.app-page-shell`, `.app-page-stack`, `.app-page-card`, `.app-section-card`)
- Shared control + layout APIs: `src/styles/staffglobal.css`

**Never** hardcode hex colours. **Never** add a new CSS custom property without confirming it belongs in the global token system.

---

## 5. Shared Controls — Use Before Creating

| Class | Purpose |
|---|---|
| `.app-btn` (+ variants `.app-btn--ghost` etc.) | Buttons |
| `.app-input` | Text / number / textarea / select |
| `.dropdown-api` | Single-select dropdown |
| `.multiselect-dropdown-api` | Multi-select dropdown |
| `.calendar-api` | Date picker |
| `.timepicker-api` | Time picker |
| `.searchbar-api` | Search bars |
| `.app-topbar-button`, `.app-topbar-link`, `.app-sidebar__link` | Nav controls |
| `.app-layout-section-shell`, `.app-layout-card`, `.app-layout-surface-subtle`, `.app-layout-surface-accent`, `.app-layout-stat-card`, `.app-layout-tab-row`, `.app-layout-toolbar-row` | Layout helpers |

Do **not** hardcode button, dropdown, field, badge, or table accent colours — they must inherit theme tokens so light, dark, and system-dark all stay aligned.

---

## 6. Shared Components — Use Before Recreating

| Component | Path | Use for |
|---|---|---|
| `LayerSurface` | `src/components/ui/LayerSurface.js` | Base surface |
| `LayerTheme` | `src/components/ui/LayerTheme.js` | Alternating surface |
| `Section` | `src/components/Section.js` | Titled section card |
| `Card` / `SectionCard` | `src/components/ui/Card.js` | Bare card wrapper |
| `Layout` | `src/components/Layout.js` | Global shell |
| `Sidebar` | `src/components/Sidebar.js` | Global sidebar |
| `ProtectedRoute` | `src/components/ProtectedRoute.js` | Role gate |

---

## 7. Layout Hierarchy

```
.app-page-shell
  .app-page-card
    .app-page-stack
      .app-section-card
```

Do not flatten or skip levels. Do not invent a new wrapper class if one of these fits.

---

## 8. Spacing

- Between stacked sections: `var(--page-stack-gap)`
- Inside a section card: `var(--layout-card-gap)`
- Padding: `var(--section-card-padding)` / `var(--page-card-padding)`
- Outer page padding: match the existing `padding: "8px 8px 32px"` pattern.

---

## 9. Responsive — Always Required

- Works at desktop (≥1280), tablet (768–1279), mobile (<768).
- Use `grid-template-columns: repeat(auto-fit, minmax(..., 1fr))` — not hardcoded counts.
- Use `src/hooks/useIsMobile.js` for conditional logic — no inline `window.innerWidth` checks.
- Touch targets ≥ 44×44px.

---

## 10. DevLayoutSection Instrumentation

When building or refactoring pages, wrap every major region with `DevLayoutSection` (stable `sectionKey`, correct `sectionType`, correct `parentKey`).

Minimum coverage: page shell, top toolbar, every section shell, every content card, every tab row, every data table, every stat/metric card.

If overlay outlines are missing, add `DevLayoutSection` — do not hide it with CSS.

---

## 11. One-off Styles — Restricted

Don't introduce one-off colour/spacing/layout styles when a token or class covers it. If genuinely required, add an inline comment explaining why.

---

## 12. Global Style Changes — Stop & Confirm

Changes to any of these require explicit approval first:
- `src/styles/theme.css`
- `src/styles/globals.css`
- `src/styles/staffglobal.css`
- `src/components/Layout.js`
- `src/components/Sidebar.js`
- `src/components/Section.js`, `src/components/ui/Card.js`
- `src/components/ui/LayerSurface.js`, `src/components/ui/LayerTheme.js`
- Any `src/context/*.js`

State: what file, what change, which pages are affected, why it can't be done locally.
