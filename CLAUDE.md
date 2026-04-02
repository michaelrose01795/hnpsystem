# Claude UI Rules

Follow the repository theme system, not local page color guesses.

Allowed accent tokens:
- `--accent-base`
- `--accent-surface`
- `--accent-base-hover`
- `--accent-surface-hover`
- `--accent-strong`

Allowed status families:
- green through `--success*`
- amber through `--warning*`
- red through `--danger*`

Deprecated marker tokens:
- `--accent-purple*`
- `--accent-blue*`
- `--accent-orange*`
- `--accent-layer-*`
- `--info*`

Those deprecated tokens are intentionally bright so they are easy to spot and replace. If a page shows bright purple or bright red accents unexpectedly, move that area onto the semantic accent or status tokens.

Use the shared global control and layout APIs before adding custom styles:
- Layout shells and cards from `src/styles/globals.css`
- `.app-btn` button variants
- `.app-input`
- `.dropdown-api`
- `.multiselect-dropdown-api`
- `.calendar-api`
- `.timepicker-api`
- `.searchbar-api`

Do not hardcode colors for dropdowns, buttons, fields, cards, or tables. All of them must inherit from the global theme tokens so every selectable accent works in light, dark, and system-dark.

When building or refactoring pages, register the layout with `DevLayoutSection` so the dev overlay can outline and audit the structure. Cover:
- the page shell
- section shells
- content cards
- toolbars
- tab rows
- tables
- stat cards

Keep new work aligned with the existing shared primitives instead of creating a parallel page-specific design system.
