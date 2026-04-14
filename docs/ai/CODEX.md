# Codex UI Rules

Use the global semantic accent tokens only:
- `--accent-base`
- `--accent-surface`
- `--accent-base-hover`
- `--accent-surface-hover`
- `--accent-strong`

Use status colors only through the semantic red/amber/green tokens already defined in the theme layer:
- `--success*`
- `--warning*`
- `--danger*`

Treat these as deprecated marker tokens and replace them when you touch a page:
- `--accent-purple*`
- `--accent-blue*`
- `--accent-orange*`
- `--accent-layer-*`
- `--info*`

Deprecated tokens are intentionally loud. If you see bright purple or bright red in the UI, replace the legacy token with a semantic accent token or a semantic status token.

Always prefer the shared page and control primitives in `src/styles/globals.css` instead of custom one-off styling:
- Layout: `.app-page-card`, `.app-section-card`, `.app-layout-section-shell`, `.app-layout-card`, `.app-layout-surface-subtle`, `.app-layout-surface-accent`, `.app-layout-stat-card`, `.app-layout-tab-row`, `.app-layout-toolbar-row`
- Buttons and links: `.app-btn`, `.app-topbar-button`, `.app-topbar-link`, `.app-sidebar__link`
- Fields: `.app-input`, `.dropdown-api`, `.multiselect-dropdown-api`, `.calendar-api`, `.timepicker-api`, `.searchbar-api`

Do not hardcode button, dropdown, field, badge, or table accent colors. They must inherit from the global theme tokens so light mode, dark mode, and system-dark all stay aligned.

For layout instrumentation, wrap every major page region with `DevLayoutSection` and give it:
- a stable `sectionKey`
- the correct `sectionType`
- the correct `parentKey`

Minimum section coverage for new pages:
- page shell
- top toolbar
- every section shell
- every content card
- every tab row
- every data table
- every stat/metric card

If a new page is missing overlay outlines, add `DevLayoutSection` coverage instead of hiding the problem with custom CSS.
