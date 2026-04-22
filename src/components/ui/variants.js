// file location: src/components/ui/variants.js
//
// Single source of truth for the HNPSystem design system's approved UI
// families and their variants. Every shared component, the dev-overlay
// classifier, and the /dev/showcase page reads from this file.
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
      {
        id: "control",
        className: "app-btn app-btn--control",
        description: "Matches .app-input chrome — sits inside input rows.",
        usage: "Inline input-group actions (Clear, Apply, Copy).",
        status: "approved",
      },
      {
        id: "on-primary",
        className: "app-btn app-btn--on-primary",
        description: "Used when a button sits on top of a filled primary surface.",
        usage: "Buttons on a red hero strip or an accent-coloured banner.",
        status: "approved",
      },
    ],
    sizes: [
      { id: "md", className: "", description: "Default 44px control height." },
      { id: "sm", className: "app-btn--sm", description: "40px — compact toolbars." },
      { id: "xs", className: "app-btn--xs", description: "34px — table rows, dense UIs." },
    ],
    shapes: [
      { id: "default", className: "", description: "Rounded rectangle." },
      { id: "pill", className: "app-btn--pill", description: "Fully rounded, use for inline toggles." },
    ],
    customOnly: [
      {
        description: "Icon-only circular buttons inside the camera HUD.",
        reason: "HUD has its own token system (--hud-*). Keep local.",
      },
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
      "Inline status indicators. Use .app-badge plus a semantic modifier — do not tint inline.",
    variants: [
      { id: "neutral", className: "app-badge app-badge--neutral", description: "Generic tag.", usage: "Filter chips, count pills.", status: "approved" },
      { id: "success", className: "app-badge app-badge--success", description: "Positive status.", usage: "Paid, Passed, Completed.", status: "approved" },
      { id: "warning", className: "app-badge app-badge--warning", description: "Caution status.", usage: "Due soon, Requires attention.", status: "approved" },
      { id: "danger", className: "app-badge app-badge--danger", description: "Negative status.", usage: "Overdue, Failed.", status: "approved" },
      { id: "accent-soft", className: "app-badge app-badge--accent-soft", description: "Soft accent chip.", usage: "Category tags inside lists.", status: "approved" },
      { id: "accent-strong", className: "app-badge app-badge--accent-strong", description: "Filled accent chip.", usage: "Active filter, selected tag.", status: "approved" },
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
      { id: "row", className: "skeleton-block skeleton-block--row", description: "Table row placeholder.", usage: "SkeletonTableRow inside an <app-data-table>.", status: "approved" },
      { id: "card", className: "skeleton-block skeleton-block--card", description: "Metric / card placeholder.", usage: "SkeletonMetricCard on dashboards.", status: "approved" },
      { id: "page", className: "skeleton-block skeleton-block--page", description: "Full page skeleton.", usage: "PageSkeleton during initial route load.", status: "approved" },
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
