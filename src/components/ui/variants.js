// file location: src/components/ui/variants.js
//
// Single source of truth for the HNPSystem design system's approved UI
// families and their variants. Every shared component, the dev-overlay
// classifier, and the /dev/user-diagnostic page reads from this file.
//
// Editing rules:
//   1. Do not invent one-off variants for a single page. If a variant is
//      genuinely shared, add it here first and flag the CSS update.
//   2. Each variant's `className` must match the class defined in the
//      corresponding file under src/styles/families/.
//   3. Keep `description` short (one sentence) and `usage` practical —
//      the showcase surfaces both directly.
//   4. Mark `status: "custom-only"` when a family intentionally has no
//      shared variants today; this prevents the showcase from flagging
//      it as missing.
//
// Statuses used by the audit tagger:
//   approved       — lives in the system, safe to consume
//   needs-review   — exists but flagged for design review
//   custom-only    — family is intentionally custom per page (not shared)
//   hardcoded      — page ships inline styles; must be migrated
//
// Colours on each family are the TRACE-MODE swatches used by the overlay
// (pink = buttons, grey = tables, etc). The everyday dev-overlay colours
// stay defined in src/lib/dev-layout/categories.js.

export const UI_FAMILIES = [
  {
    id: "button",
    label: "Buttons",
    cssFile: "src/styles/families/buttons.css",
    component: "src/components/ui/Button.js",
    traceColor: "#ec4899",
    description:
      "Primary action element. Variant + size are props on <Button>; inline colour/padding/radius/font styles are stripped on purpose.",
    variants: [
      {
        id: "primary",
        className: "app-btn app-btn--primary",
        description: "Primary brand action. One per section, max.",
        usage: "Save, Submit, Create, Confirm, Next.",
        status: "approved",
      },
      {
        id: "secondary",
        className: "app-btn app-btn--secondary",
        description: "Neutral action, lower emphasis.",
        usage: "Cancel, Back, secondary CTAs inside cards.",
        status: "approved",
      },
      {
        id: "ghost",
        className: "app-btn app-btn--ghost",
        description: "Minimal chrome, no filled background until hover.",
        usage: "Tertiary actions, icon-only buttons, toolbar items.",
        status: "approved",
      },
      {
        id: "danger",
        className: "app-btn app-btn--danger",
        description: "Destructive action. Confirms required in the handler.",
        usage: "Delete, Archive, Void. Never use for Cancel.",
        status: "approved",
      },
    ],
    sizes: [
      { id: "md", className: "", description: "Default 44px control height." },
      { id: "sm", className: "app-btn--sm", description: "40px — compact toolbars." },
      { id: "xs", className: "app-btn--xs", description: "34px — table rows, dense UIs." },
      { id: "xxs", className: "app-btn--xxs", description: "32px — leaves the control floor; secondary affordance beside a full-height control." },
    ],
    shapes: [
      { id: "default", className: "", description: "Rounded rectangle." },
      { id: "pill", className: "app-btn--pill", description: "Fully rounded, use for inline toggles." },
      { id: "icon", className: "app-btn--icon", description: "Circular single-glyph button, locked to --control-height." },
      { id: "icon-glyph-lg", className: "app-btn--icon app-btn--glyph-lg", description: "Icon button whose bare glyph (+, ×) fills the circle." },
      { id: "icon-sm", className: "app-btn--icon-sm", description: "Perfect 32px circle for a single glyph sitting beside a 44px control." },
    ],
    customOnly: [
      {
        description: "Icon-only circular buttons inside the camera HUD.",
        reason: "HUD has its own token system (--hud-*). Keep local.",
      },
    ],
  },
  {
    id: "symbol",
    label: "Symbols",
    cssFile: "src/styles/families/symbols.css",
    component: "src/components/ui/SymbolButton.js",
    traceColor: "#ec4899",
    description:
      "Icon-only action button. Every symbol in the app is registered in SYMBOLS in SymbolButton.js and rendered as an exact circle with the glyph optically centred - never a stray emoji or a one-off inline SVG. Two sizes only: 44px standing alone, 32px in a table row.",
    variants: [
      {
        id: "default",
        className: "app-symbol-btn",
        description: "Accent-tinted circle. The ONLY symbol fill - there is no tone axis.",
        usage: "Every standalone icon action, whatever it does.",
        status: "approved",
      },
    ],
    sizes: [
      { id: "md", className: "", description: "Exact 44px circle. The default everywhere a symbol stands on its own." },
      { id: "table", className: "app-symbol-btn--table", description: "Exact 32px circle (--table-action-btn-height) with a 23px glyph, so an in-row action lines up with the rest of the row instead of growing it. Applied automatically inside .app-data-table; the class is for row-lists that are not a real <table>." },
    ],
    shapes: [
      { id: "circle", className: "", description: "Always a perfect circle; the geometry is locked in the family file." },
      { id: "row", className: "app-symbol-row", description: "Wrapping strip of symbol buttons with a --space-xs gap." },
      { id: "in-button", className: "app-btn app-btn--has-symbol", description: "The same mark beside a text label. Resolved from the label by ui/Button.js through lib/ui/symbolLabels.js - no call site passes it." },
      { id: "popup-close", className: "app-popup-compact-header", description: "A popup header collapses its Close to the bare 44px symbol circle and orders it last. Owned by the popup convention in staffglobal.css." }
    ],
  },
  {
    id: "table",
    label: "Tables",
    cssFile: "src/styles/families/tables.css",
    component: null,
    traceColor: "#9ca3af",
    description:
      "Native <table> with the .app-data-table class. Rows/cells use theme tokens for borders and spacing.",
    variants: [
      {
        id: "standard",
        className: "app-data-table",
        description: "Default workshop/dashboard table.",
        usage: "Listings with mixed columns and moderate row counts.",
        status: "approved",
      },
      {
        id: "compact",
        className: "app-data-table app-data-table--compact",
        description: "Reduced row padding for dense data (parts, clocking).",
        usage: "Long scroll lists where vertical space matters.",
        status: "approved",
      },
      {
        id: "workflow",
        className: "app-data-table app-data-table--workflow",
        description: "Status-column-led table with row emphasis on active state.",
        usage: "Job status, service-board style tables.",
        status: "approved",
      },
      {
        id: "clickable",
        className: "app-data-table app-data-table--clickable",
        description: "Rows are the click target — pointer cursor plus a --secondary hover/focus tint.",
        usage: "Listings where clicking a row opens the record (stock catalogue, directories).",
        status: "approved",
      },
      {
        id: "scroll-shell",
        className: "app-table-scroll",
        description:
          "Table wrapper: no horizontal scroll, vertical scroll past --table-visible-rows (10).",
        usage: "Wrap every .app-data-table. Rendered by the DataTableShell component.",
        status: "approved",
      },
    ],
    customOnly: [
      {
        description: "Calendar / timeline grids.",
        reason: "Built on CSS grid, not <table>. Owns its own tokens.",
      },
    ],
  },
  {
    id: "tabs",
    label: "Tabs",
    cssFile: "src/styles/families/tabs.css",
    component: "src/components/ui/layout-system/TabRow.js",
    traceColor: "#facc15",
    description:
      "Tab strips. Container is .app-layout-tab-row; individual tabs sit inside with the appropriate variant class.",
    variants: [
      {
        id: "page",
        className: "app-tab app-tab--page",
        description: "Top-of-page tabs that navigate between sub-sections.",
        usage: "HR, Parts, Accounts — top tab rows inside the page card.",
        status: "approved",
      },
      {
        id: "inner",
        className: "app-tab app-tab--inner",
        description: "Secondary tabs inside a section card.",
        usage: "Sub-tabs inside a job card modal or a profile section.",
        status: "approved",
      },
      {
        id: "pill",
        className: "app-tab app-tab--pill",
        description: "Rounded pill tabs, visually lighter weight.",
        usage: "Filter tabs, status switches inside dashboards.",
        status: "approved",
      },
      {
        id: "segmented",
        className: "app-tab app-tab--segmented",
        description: "Connected segmented control (single tab block).",
        usage: "Binary or 3-option view switches (List / Grid / Calendar).",
        status: "approved",
      },
    ],
  },
  {
    id: "card",
    label: "Cards & section shells",
    cssFile: "src/styles/families/cards.css",
    component: "src/components/ui/layout-system/SectionShell.js",
    traceColor: "#22c55e",
    description:
      "Surface layers. The .app-page-shell > .app-page-card > .app-page-stack > .app-section-card hierarchy is the law.",
    variants: [
      {
        id: "page",
        className: "app-page-card",
        description: "Main page card — one per route.",
        usage: "Directly inside .app-page-shell.",
        status: "approved",
      },
      {
        id: "section",
        className: "app-section-card",
        description: "Inner section card — the workhorse.",
        usage: "Groups of fields, lists, or widgets inside a page.",
        status: "approved",
      },
      {
        id: "subtle",
        className: "app-layout-surface-subtle",
        description: "Quiet surface used for grouped background panels.",
        usage: "Metadata panels, secondary info blocks.",
        status: "approved",
      },
      {
        id: "accent",
        className: "app-layout-surface-accent",
        description: "Accent-tinted surface for profile / highlight cards.",
        usage: "Profile banner, promoted widgets.",
        status: "approved",
      },
      {
        id: "stat",
        className: "app-layout-stat-card",
        description: "Metric/KPI tile.",
        usage: "Dashboard top-row stats.",
        status: "approved",
      },
    ],
  },
  {
    id: "input",
    label: "Inputs",
    cssFile: "src/styles/families/inputs.css",
    component: "src/components/ui/InputField.js",
    traceColor: "#3b82f6",
    description:
      "Form controls. Text / textarea / select share the .app-input class; checkboxes and radios use the .app-toggle family.",
    variants: [
      {
        id: "text",
        className: "app-input",
        description: "Single-line text input.",
        usage: "Default text/email/number/date field.",
        status: "approved",
      },
      {
        id: "textarea",
        className: "app-input app-input--textarea",
        description: "Multi-line input.",
        usage: "Notes fields, long-form text.",
        status: "approved",
      },
      {
        id: "select",
        className: "app-input app-input--select",
        description: "Native <select> styled to match the control system.",
        usage: "Simple option pickers. Prefer DropdownField for searchable lists.",
        status: "approved",
      },
      {
        id: "search",
        className: "app-input app-input--search",
        description: "Search box with leading icon slot.",
        usage: "Filter bars, table search.",
        status: "approved",
      },
    ],
  },
  {
    id: "dropdown",
    label: "Dropdowns",
    cssFile: "src/styles/families/dropdowns.css",
    component: "src/components/ui/dropdownAPI/DropdownField.js",
    traceColor: "#f472b6",
    description:
      "Searchable and selectable menus. All consumers should route through DropdownField / MultiSelectDropdown.",
    variants: [
      {
        id: "field",
        className: "app-dropdown app-dropdown--field",
        description: "Full-width dropdown with label (form field mode).",
        usage: "Forms, filter bars.",
        status: "approved",
      },
      {
        id: "menu",
        className: "app-dropdown app-dropdown--menu",
        description: "Trigger-anchored contextual menu (profile menu, row actions).",
        usage: "Row action menus, avatar menus.",
        status: "approved",
      },
      {
        id: "combobox",
        className: "app-dropdown app-dropdown--combobox",
        description: "Searchable input that filters the option list.",
        usage: "Customer/vehicle pickers.",
        status: "approved",
      },
      {
        id: "error",
        className: "dropdown-api is-error",
        description: "Invalid state ring. Set via the hasError prop on DropdownField / Dropdown.",
        usage: "Form validation failures - never style the ring inline.",
        status: "approved",
      },
    ],
  },
  {
    id: "modal",
    label: "Modals & drawers",
    cssFile: "src/styles/families/modals.css",
    component: "src/components/popups/ModalPortal.js",
    traceColor: "#e879f9",
    description:
      "Layered overlays. All routes go through ModalPortal; variants control width, scroll, and transition.",
    variants: [
      {
        id: "dialog",
        className: "app-modal app-modal--dialog",
        description: "Default centered modal.",
        usage: "Forms, confirms, multi-step flows (default).",
        status: "approved",
      },
      {
        id: "drawer",
        className: "app-modal app-modal--drawer",
        description: "Slide-in panel anchored to the right edge.",
        usage: "Status sidebar, quick-view panels.",
        status: "approved",
      },
      {
        id: "sheet",
        className: "app-modal app-modal--sheet",
        description: "Bottom sheet, full-width on mobile.",
        usage: "Mobile-first secondary flows.",
        status: "approved",
      },
      {
        id: "alert",
        className: "app-modal app-modal--alert",
        description: "Small, blocking confirmation dialog.",
        usage: "Destructive or irreversible confirms only.",
        status: "approved",
      },
    ],
    customOnly: [
      {
        description: "JobCardModal.",
        reason: "Rich editor modal with its own layout grid. Keep the shell custom, standardise the chrome.",
      },
    ],
  },
  {
    id: "badge",
    label: "Badges & chips",
    cssFile: "src/styles/families/badges.css",
    component: null,
    traceColor: "#fb923c",
    description:
      "Inline status indicators, shaped as a summary tile (.app-summary-item box: --radius-sm corner, 44px tall — 32px in a data table) so they never read as buttons. Use .app-badge plus a semantic modifier — do not tint or re-size inline.",
    variants: [
      { id: "neutral", className: "app-badge app-badge--neutral", description: "Generic tag.", usage: "Filter chips, count pills.", status: "approved" },
      { id: "success", className: "app-badge app-badge--success", description: "Positive status.", usage: "Paid, Passed, Completed.", status: "approved" },
      { id: "success-strong", className: "app-badge app-badge--success-strong", description: "Filled positive status.", usage: "Emphatic success pills on dense rows.", status: "approved" },
      { id: "warning", className: "app-badge app-badge--warning", description: "Caution status.", usage: "Due soon, Requires attention.", status: "approved" },
      { id: "warning-strong", className: "app-badge app-badge--warning-strong", description: "Filled caution status.", usage: "Emphatic warning pills on dense rows.", status: "approved" },
      { id: "danger", className: "app-badge app-badge--danger", description: "Negative status.", usage: "Overdue, Failed.", status: "approved" },
      { id: "accent-soft", className: "app-badge app-badge--accent-soft", description: "Soft accent chip.", usage: "Category tags inside lists.", status: "approved" },
      { id: "accent-strong", className: "app-badge app-badge--accent-strong", description: "Filled accent chip.", usage: "Active filter, selected tag.", status: "approved" },
      { id: "count", className: "app-badge app-badge--danger-strong app-badge--count", description: "Fixed 32px circular counter.", usage: "Unread counts on sidebar nav rows. Host row takes .app-badge-slot (+ --counted while a badge is shown).", status: "approved" },
      { id: "count-control", className: "app-badge app-badge--neutral app-badge--count-control", description: "Fixed 44px circular counter (control height).", usage: "Item counts inside body content, e.g. the Parts Summary total on an order row.", status: "approved" },
    ],
  },
  {
    id: "toggle",
    label: "Toggles, checks & radios",
    cssFile: "src/styles/families/toggles.css",
    component: null,
    traceColor: "#14b8a6",
    description:
      "Binary and multi-choice controls. Wrap native <input> in .app-toggle for consistent styling.",
    variants: [
      { id: "switch", className: "app-toggle app-toggle--switch", description: "iOS-style on/off switch.", usage: "Settings, feature flags.", status: "approved" },
      { id: "checkbox", className: "app-toggle app-toggle--checkbox", description: "Styled checkbox.", usage: "Multi-select lists, optional filters.", status: "approved" },
      { id: "radio", className: "app-toggle app-toggle--radio", description: "Styled radio.", usage: "Single-choice groups.", status: "approved" },
      { id: "field", className: "app-toggle-field", description: "Label wrapper pairing a checkbox/radio with its caption.", usage: "Any checkbox or radio that has visible text beside it.", status: "approved" },
    ],
  },
  {
    id: "loader",
    label: "Loaders & skeletons",
    cssFile: "src/styles/families/loaders.css",
    component: "src/components/ui/LoadingSkeleton.js",
    traceColor: "#a78bfa",
    description:
      "Skeleton shimmer is the only approved loading pattern — no spinners. Every variant is exported from LoadingSkeleton.js.",
    variants: [
      { id: "block", className: "skeleton-block", description: "Raw shimmer block.", usage: "Use SkeletonBlock — pick width/height props.", status: "approved" },
      { id: "inline", className: "skeleton-block skeleton-block--inline", description: "Inline shimmer + label.", usage: "Filter/search progress.", status: "approved" },
      { id: "row", className: "skeleton-table__row", description: "Single table row placeholder.", usage: "SkeletonTableRow inside a table the page already renders.", status: "approved" },
      { id: "card", className: "skeleton-block skeleton-block--card", description: "Metric / card placeholder.", usage: "SkeletonMetricCard on dashboards.", status: "approved" },
      { id: "page", className: "skeleton-block skeleton-block--page", description: "Full page skeleton.", usage: "PageSkeleton during initial route load.", status: "approved" },
      { id: "chart", className: "skeleton-chart", description: "Line / trend graph placeholder — animated trace, grid and sweep.", usage: "ChartSkeleton. The only approved loading state for a graph.", status: "approved" },
      { id: "chart-bars", className: "skeleton-chart skeleton-chart__bars", description: "Bar / column graph placeholder.", usage: "ChartSkeleton variant=\"bars\".", status: "approved" },
      { id: "table", className: "skeleton-table", description: "Data table placeholder — real .app-data-table with a top-to-bottom shimmer cascade.", usage: "TableSkeleton. The only approved loading state for a table.", status: "approved" },
    ],
  },
  {
    id: "toolbar",
    label: "Toolbars & action bars",
    cssFile: "src/styles/families/toolbars.css",
    component: "src/components/ui/layout-system/FilterToolbarRow.js",
    traceColor: "#4ade80",
    description:
      "Horizontal control rows. Container is .app-layout-toolbar-row; variant adjusts density.",
    variants: [
      { id: "filter", className: "app-layout-toolbar-row app-toolbar--filter", description: "Search + filter controls.", usage: "Top of list pages.", status: "approved" },
      { id: "action", className: "app-layout-toolbar-row app-toolbar--action", description: "Primary action row.", usage: "Save/Submit bars at the foot of forms.", status: "approved" },
      { id: "header", className: "app-layout-toolbar-row app-toolbar--header", description: "Header row with title + actions.", usage: "Page headers inside section cards.", status: "approved" },
    ],
  },
  {
    id: "empty-state",
    label: "Empty states",
    cssFile: "src/styles/families/empty-states.css",
    component: null,
    traceColor: "#64748b",
    description:
      "Shown when a list/query has no results. Every empty state must use one of the two variants — no bespoke copy blocks.",
    variants: [
      { id: "inline", className: "app-empty-state app-empty-state--inline", description: "Compact inline empty state.", usage: "Inside a small section card or table body.", status: "approved" },
      { id: "page", className: "app-empty-state app-empty-state--page", description: "Full-page empty state with icon + CTA.", usage: "When a whole route returns zero results.", status: "approved" },
    ],
  },
  {
    id: "toast",
    label: "Toasts & notifications",
    cssFile: "src/styles/families/toasts.css",
    component: null,
    traceColor: "#f59e0b",
    description:
      "Transient feedback delivered through AlertContext / alertBus. Do not render toast-like elements directly inside pages.",
    variants: [
      { id: "info", className: "app-toast app-toast--info", description: "Neutral info.", usage: "Saved, Copied, Sent.", status: "approved" },
      { id: "success", className: "app-toast app-toast--success", description: "Positive outcome.", usage: "Record created, Job completed.", status: "approved" },
      { id: "warning", className: "app-toast app-toast--warning", description: "Soft warning.", usage: "Partial save, retry suggested.", status: "approved" },
      { id: "error", className: "app-toast app-toast--error", description: "Error / failure.", usage: "Save failed, request rejected.", status: "approved" },
    ],
  },
  {
    id: "error-recovery",
    label: "Error recovery",
    cssFile: "src/styles/families/error-recovery.css",
    component: "src/components/support/SupportErrorBoundary.js",
    traceColor: "#dc2626",
    description:
      "The in-app error experience: the recovery screen an error boundary renders and the pieces of it reused by the framework error pages and the report popup.",
    variants: [
      {
        id: "screen",
        className: "app-recovery",
        description:
          "The full recovery screen: centring wrapper plus __card / __badge / __title / __message / __actions / __hint.",
        usage: "Error boundaries at every level, and the 404 / 500 / _error pages via PageErrorScreen.",
        status: "approved",
      },
      {
        id: "facts",
        className: "app-recovery-facts",
        description:
          "Quotable incident facts as a dl grid — page, section, time, reference code — on 44px rows.",
        usage: "Shared by the recovery screen and /unauthorised. One fact list, not two.",
        status: "approved",
      },
      {
        id: "reference",
        className: "app-error-reference",
        description: "The short quotable error reference line shown under the recovery message.",
        usage: "The Report a problem popup, where there is no facts list to carry the code.",
        status: "approved",
      },
      {
        id: "access-denied",
        className: "app-access-denied",
        description:
          "Access-denied wrapper: reuses the recovery shell with a calm warning tone instead of the fault tone.",
        usage: "The /unauthorised screen. A permission refusal, not a fault — never the alert styling.",
        status: "approved",
      },
    ],
  },
  {
    id: "news",
    label: "News / Communication hub",
    cssFile: "src/styles/families/news.css",
    component: "src/components/NewsFeed/NewsPostCard.js",
    traceColor: "#0ea5e9",
    description:
      "The dealership communication hub: feed cards, priority and category chips, author avatars, acknowledgement banners, attachment and record-link rows, comment threads and the reach/read-rate insight blocks.",
    variants: [
      {
        id: "card",
        className: "app-news-card",
        description: "A post in the feed. Sits on the --theme rung; anything nested inside flips back to --surface.",
        usage: "The default comfortable feed row.",
        status: "approved",
      },
      {
        id: "card-compact",
        className: "app-news-card app-news-card--compact",
        description: "Denser feed row — tighter padding, two-line body clamp.",
        usage: "When the reader has chosen the compact feed view.",
        status: "approved",
      },
      {
        id: "chip",
        className: "app-news-chip",
        description: "Category / department / state chip on the accent tint.",
        usage: "Post metadata rows and filter summaries.",
        status: "approved",
      },
      {
        id: "chip-urgent",
        className: "app-news-chip app-news-chip--urgent",
        description: "Urgent priority chip. Tone is carried by tint + glyph, never by a border.",
        usage: "Urgent announcements only.",
        status: "approved",
      },
      {
        id: "avatar",
        className: "app-news-avatar",
        description: "Author avatar — photo when the user has one, monogram when they do not.",
        usage: "Bylines, comment rows and acknowledgement trackers.",
        status: "approved",
      },
      {
        id: "ack",
        className: "app-news-ack",
        description: "Acknowledgement banner with its due / overdue / done tones.",
        usage: "Posts that require a sign-off.",
        status: "approved",
      },
      {
        id: "comment",
        className: "app-news-comment",
        description: "One comment row. Carries the only allowed line — a --separating-line row rule.",
        usage: "The comment thread on a post.",
        status: "approved",
      },
      {
        id: "stat",
        className: "app-news-stat",
        description: "A single reach / engagement figure with its caption.",
        usage: "Post insights and the hub analytics panel.",
        status: "approved",
      },
      {
        id: "meter",
        className: "app-news-meter",
        description: "Read-rate meter: track plus fill, no outline.",
        usage: "Read and acknowledgement rates.",
        status: "approved",
      },
      {
        id: "section",
        className: "app-news-section",
        description:
          "A titled block inside a post — an uppercase label with a count pill above its rows.",
        usage: "\"Related records\" and \"Attachments\" in the post detail.",
        status: "approved",
      },
      {
        id: "attachment",
        className: "app-news-attachment",
        description:
          "One attachment row: file-type tag (or thumbnail), name, size. Laid out on a responsive grid by .app-news-attachments.",
        usage: "Attachments on a post card, in the detail and in the composer.",
        status: "approved",
      },
      {
        id: "record-link",
        className: "app-news-link",
        description:
          "One link to a DMS record: muted record-type tag plus the record itself. Grid-laid by .app-news-links.",
        usage: "Related records on a post card, in the detail and in the composer.",
        status: "approved",
      },
    ],
  },
  {
    id: "record",
    label: "Record",
    cssFile: "src/styles/families/records.css",
    component: "src/features/customers/hub/RecordPrimitives.js",
    traceColor: "#0ea5e9",
    description:
      "The shared vocabulary for a record screen — one entity, everything about it. Label/value fields, a field grid, the registration plate, a file card and the event timeline. Used by the customer record hub; intended for the vehicle, account and job records too.",
    variants: [
      {
        id: "field",
        className: "app-record-field",
        description: "One label-above-value pair. The label is a caption, the value carries the weight.",
        usage: "Every read-only detail on a record card — VIN, mileage, MOT due, advisor.",
        status: "approved",
      },
      {
        id: "field-grid",
        className: "app-record-grid",
        description: "Responsive auto-fit grid of record fields. `--wide` widens the minimum column.",
        usage: "The detail block of a vehicle, appointment, invoice or job card.",
        status: "approved",
      },
      {
        id: "plate",
        className: "app-record-plate",
        description: "Registration plate chip. `--theme` flips the fill when it sits on a --surface layer.",
        usage: "Anywhere a vehicle registration is the identity of the row.",
        status: "approved",
      },
      {
        id: "actions",
        className: "app-record-actions",
        description: "Wrapping action row for the buttons attached to one record.",
        usage: "Open vehicle / create job / book appointment / view history.",
        status: "approved",
      },
      {
        id: "file",
        className: "app-record-file",
        description: "Document, photo or video card with a fixed preview frame.",
        usage: "The files attached to a customer's or job's record.",
        status: "approved",
      },
      {
        id: "timeline",
        className: "app-timeline",
        description:
          "Vertical event timeline: rail, coloured dot, title/time head and meta row. The rail is a background, never a border.",
        usage: "Dealership history and customer/staff activity feeds.",
        status: "approved",
      },
    ],
  },
  {
    id: "context-menu",
    label: "Context Menu",
    cssFile: "src/styles/families/context-menu.css",
    component: "src/components/ui/GlobalContextMenu.js",
    traceColor: "#d946ef",
    description:
      "The in-app right-click menu that replaces the browser native context menu app-wide. Mounted once from _app.js; the panel is a LayerSurface and every row is a Secondary button at the 44px control floor.",
    variants: [
      {
        id: "menu",
        className: "app-context-menu",
        description: "The floating menu panel itself — fixed, clamped into the viewport, above all layout chrome.",
        usage: "Rendered by GlobalContextMenu on right-click. Never instantiate it directly.",
        status: "approved",
      },
      {
        id: "item",
        className: "app-context-menu__item",
        description: "One menu row: icon, label and keyboard-shortcut hint. Styled as .app-btn--secondary at 44px, with an 8px gap to its neighbours.",
        usage: "Every action in the right-click menu.",
        status: "approved",
      },
      {
        id: "separator",
        className: "app-context-menu__separator",
        description: "Group divider. Carries the only allowed line — a --separating-line row rule.",
        usage: "Between action groups (link / edit / page).",
        status: "approved",
      },
    ],
  },
];

export const UI_FAMILY_IDS = UI_FAMILIES.map((family) => family.id);

const FAMILY_BY_ID = new Map(UI_FAMILIES.map((family) => [family.id, family]));

export function getFamilyById(id) {
  return FAMILY_BY_ID.get(id) || null;
}

export function getTraceColor(familyId) {
  return FAMILY_BY_ID.get(familyId)?.traceColor || "#999999";
}

export const AUDIT_STATUS_OPTIONS = [
  { id: "approved", label: "Approved", description: "Using the shared system correctly." },
  { id: "needs-review", label: "Needs review", description: "Design team still has to sign this off." },
  { id: "custom-only", label: "Custom only", description: "Intentionally one-off — never standardise." },
  { id: "hardcoded", label: "Hardcoded", description: "Inline styles or magic colours — migrate." },
];

export const AUDIT_STATUS_IDS = AUDIT_STATUS_OPTIONS.map((option) => option.id);
