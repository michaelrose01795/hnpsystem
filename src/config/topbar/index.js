// file location: src/config/topbar/index.js
//
// Central barrel for the top-bar workspace system (Phases 2–3). One import
// surface for every registry + tunable, so the whole productivity system is
// configured from a single, discoverable place ("centrally configurable",
// Phase 3.8). Adding a department KPI, a suggestion rule, a shortcut, a widget or
// a limit is an edit to one of these modules — never to the chrome.

// Tunables
export { WORKSPACE_LIMITS } from "@/config/topbar/workspaceConfig";

// Phase 2 — rotating status views + role notifications + quick actions.
export { resolveKpis, formatKpiLine, DEPARTMENT_KPIS } from "@/config/topbar/departmentKpis";
export { resolveInsights } from "@/config/topbar/departmentInsights";
export { resolveNotifications } from "@/config/topbar/departmentNotifications";
export { buildStatusViews } from "@/config/topbar/statusViews";
export { resolveQuickActions } from "@/config/topbar/quickActions";

// Phase 3.4 — contextual suggestions.
export { resolveSuggestions } from "@/config/topbar/contextualSuggestions";

// Phase 3.5 — keyboard shortcuts.
export {
  SHORTCUTS,
  getShortcut,
  formatCombo,
  matchShortcut,
  shortcutsByCategory,
} from "@/config/topbar/keyboardShortcuts";

// Phase 3.6 — productivity widgets.
export { resolveWidgets, WIDGET_IDS, WIDGET_META } from "@/config/topbar/productivityWidgets";

// Phase 3.7 — personalisation preferences.
export {
  defaultPreferences,
  mergePreferences,
  applyQuickActionPrefs,
} from "@/lib/topbar/workspacePreferences";
