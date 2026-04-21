// file location: src/lib/dev-layout/categories.js
//
// Central registry for every Dev Overlay category. This is the single source
// of truth used by:
//   - DevLayoutOverlayContext       → filter state shape + defaults
//   - DevOverlayControlPanel        → rendered toggle list
//   - DevLayoutOverlay              → fallback detection + per-category
//                                     visibility thresholds and colours
//   - globals.css                   → category-gated outline rules
//   - src/styles/families/*.css     → trace-mode outline colours
//   - src/components/ui/variants.js → classification family IDs
//
// The `family` field links a dev-overlay category to the matching UI family
// in variants.js. The classification popover reads this mapping to pre-fill
// the family dropdown when a user tags an element.
//
// To add a new category, add a single entry below. Nothing else is required
// for the filter UI to pick it up.

export const DEV_OVERLAY_CATEGORIES = [
  {
    id: "page-shell",
    family: "card",
    label: "Page shells",
    description: "Outer page wrappers and main surfaces",
    color: "#00e5ff",
    sectionTypes: ["page-shell"],
    fallbackSelectors: [
      ".app-layout-page-shell",
      ".app-page-shell",
      ".app-page-card",
    ],
    fallbackType: "page-shell",
    minWidth: 200,
    minHeight: 60,
    includeByDefault: true,
  },
  {
    id: "section",
    family: "card",
    label: "Sections & cards",
    description: "Section cards, content cards, structural wrappers",
    color: "var(--accent-base)",
    sectionTypes: ["section-shell", "content-card"],
    fallbackSelectors: [
      ".app-section-card",
      ".app-layout-section-shell",
      ".app-layout-card",
      ".app-layout-surface-subtle",
      ".app-layout-surface-accent",
      ".customer-portal-card",
    ],
    fallbackType: "content-card",
    minWidth: 110,
    minHeight: 30,
    includeByDefault: true,
  },
  {
    id: "stat-card",
    family: "card",
    label: "Stat cards",
    description: "KPI, metric and stat tiles",
    color: "#facc15",
    sectionTypes: ["stat-card"],
    fallbackSelectors: [
      ".app-layout-stat-card",
      "[class*='stat-card']",
      "[class*='metric-card']",
    ],
    fallbackType: "stat-card",
    minWidth: 96,
    minHeight: 30,
    includeByDefault: true,
  },
  {
    id: "toolbar",
    family: "toolbar",
    label: "Toolbars & filters",
    description: "Action bars, filter strips, control rows",
    color: "#4ade80",
    sectionTypes: ["toolbar", "filter-row"],
    fallbackSelectors: [".app-toolbar-row", ".app-layout-toolbar-row"],
    fallbackType: "toolbar",
    minWidth: 100,
    minHeight: 24,
    includeByDefault: true,
  },
  {
    id: "tabs",
    family: "tabs",
    label: "Tabs",
    description: "Tab rows, tab containers, individual tab buttons",
    color: "#ff6b6b",
    sectionTypes: ["tab-row"],
    fallbackSelectors: [
      ".tab-scroll-row",
      ".tab-api",
      ".app-layout-tab-row",
      "[role='tablist']",
      "[role='tab']",
    ],
    fallbackType: "tab-row",
    minWidth: 60,
    minHeight: 20,
    includeByDefault: true,
  },
  {
    id: "table",
    family: "table",
    label: "Tables",
    description: "Tables, table headers, and rows",
    color: "#c084fc",
    sectionTypes: ["data-table", "table-headings", "table-rows"],
    fallbackSelectors: [".table-api", "table"],
    fallbackType: "data-table",
    minWidth: 110,
    minHeight: 24,
    includeByDefault: true,
  },
  {
    id: "button",
    family: "button",
    label: "Buttons",
    description: "Clickable buttons and action triggers",
    color: "#38bdf8",
    sectionTypes: ["button"],
    fallbackSelectors: [
      "button:not([data-dev-ignore])",
      ".app-btn",
      "[role='button']:not(button):not(a)",
    ],
    fallbackType: "button",
    minWidth: 20,
    minHeight: 16,
    includeByDefault: false,
  },
  {
    id: "input",
    family: "input",
    label: "Inputs & text fields",
    description: "Text inputs, textareas, editable fields",
    color: "#a78bfa",
    sectionTypes: ["input"],
    fallbackSelectors: [
      "input:not([type='checkbox']):not([type='radio']):not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset'])",
      "textarea",
      "[contenteditable='true']",
    ],
    fallbackType: "input",
    minWidth: 40,
    minHeight: 18,
    includeByDefault: false,
  },
  {
    id: "select",
    family: "dropdown",
    label: "Dropdowns & selects",
    description: "Native selects, comboboxes, listboxes",
    color: "#f472b6",
    sectionTypes: ["select"],
    fallbackSelectors: [
      "select",
      "[role='combobox']",
      "[role='listbox']",
    ],
    fallbackType: "select",
    minWidth: 40,
    minHeight: 18,
    includeByDefault: false,
  },
  {
    id: "toggle",
    family: "toggle",
    label: "Toggles, checks & radios",
    description: "Checkboxes, radios, and switches",
    color: "#34d399",
    sectionTypes: ["toggle"],
    fallbackSelectors: [
      "input[type='checkbox']",
      "input[type='radio']",
      "[role='switch']",
      "[role='checkbox']",
      "[role='radio']",
    ],
    fallbackType: "toggle",
    minWidth: 12,
    minHeight: 12,
    includeByDefault: false,
  },
  {
    id: "badge",
    family: "badge",
    label: "Badges & chips",
    description: "Pills, tags, status badges",
    color: "#fb923c",
    sectionTypes: ["badge"],
    fallbackSelectors: [
      ".badge",
      ".chip",
      ".pill",
      ".app-badge",
      ".app-chip",
      "[class*='badge-']",
      "[class*='-badge']",
      "[class*='chip-']",
      "[class*='-chip']",
    ],
    fallbackType: "badge",
    minWidth: 16,
    minHeight: 14,
    includeByDefault: false,
  },
  {
    id: "nav-item",
    family: null,
    label: "Navigation items",
    description: "Sidebar links, nav items",
    color: "#fde047",
    sectionTypes: ["nav-item"],
    fallbackSelectors: [
      ".app-sidebar-link",
      ".nav-item",
      "[data-nav-item]",
      "nav a",
      "aside a",
    ],
    fallbackType: "nav-item",
    minWidth: 24,
    minHeight: 18,
    includeByDefault: false,
  },
  {
    id: "modal",
    family: "modal",
    label: "Modals, popups & drawers",
    description: "Dialogs, drawers, popovers",
    color: "#e879f9",
    sectionTypes: ["floating-action", "modal", "popup", "drawer"],
    fallbackSelectors: [
      "[role='dialog']",
      "[role='alertdialog']",
      ".modal-panel",
      ".popup-panel",
      ".drawer-panel",
      ".app-modal",
      ".app-popup",
    ],
    fallbackType: "modal",
    minWidth: 120,
    minHeight: 40,
    includeByDefault: true,
  },
];

// ----- Lookup maps & helpers ------------------------------------------------

const CATEGORY_BY_ID = new Map(DEV_OVERLAY_CATEGORIES.map((cat) => [cat.id, cat]));

const CATEGORY_BY_SECTION_TYPE = new Map();
DEV_OVERLAY_CATEGORIES.forEach((cat) => {
  (cat.sectionTypes || []).forEach((type) => {
    if (!CATEGORY_BY_SECTION_TYPE.has(type)) {
      CATEGORY_BY_SECTION_TYPE.set(type, cat.id);
    }
  });
});

export const DEV_OVERLAY_CATEGORY_IDS = DEV_OVERLAY_CATEGORIES.map((cat) => cat.id);

export function getCategoryById(id) {
  return CATEGORY_BY_ID.get(id) || null;
}

export function getCategoryIdForSectionType(type) {
  if (!type) return null;
  return CATEGORY_BY_SECTION_TYPE.get(type) || null;
}

export function getFamilyForCategoryId(id) {
  const cat = CATEGORY_BY_ID.get(id);
  return cat?.family || null;
}

export function getCategoryIdForFamily(familyId) {
  if (!familyId) return null;
  const hit = DEV_OVERLAY_CATEGORIES.find((cat) => cat.family === familyId);
  return hit?.id || null;
}

export function getDefaultCategoryFilters() {
  return DEV_OVERLAY_CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = Boolean(cat.includeByDefault);
    return acc;
  }, {});
}

export function normalizeCategoryFilters(raw) {
  const defaults = getDefaultCategoryFilters();
  if (!raw || typeof raw !== "object") return defaults;
  return DEV_OVERLAY_CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = raw[cat.id] === undefined ? defaults[cat.id] : Boolean(raw[cat.id]);
    return acc;
  }, {});
}

// Structured in the form used by DevLayoutOverlay.js scan:
//   { selector: "a,b,c", type: "content-card", categoryId: "section", ... }
export const DEV_OVERLAY_FALLBACK_GROUPS = DEV_OVERLAY_CATEGORIES
  .filter((cat) => (cat.fallbackSelectors || []).length > 0)
  .map((cat) => ({
    categoryId: cat.id,
    selector: cat.fallbackSelectors.join(","),
    type: cat.fallbackType || cat.sectionTypes[0] || "section-shell",
    minWidth: cat.minWidth,
    minHeight: cat.minHeight,
  }));
