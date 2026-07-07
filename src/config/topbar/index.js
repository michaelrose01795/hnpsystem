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
export { buildStatusViews, buildTopbarSections } from "@/config/topbar/statusViews";
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

// Phase 4 — collaborative operational workspace (presence, availability,
// activity, communication, escalations, manager tools, cross-department).
export {
  AVAILABILITY_STATES,
  getAvailabilityState,
  resolveAvailabilityState,
  selectableStates,
  availabilityFromLegacyStatus,
} from "@/config/topbar/availabilityStates";
export { buildTeamPresence, toTeamMembers, summariseGroup, focusDepartment } from "@/config/topbar/teamPresence";
export { deriveActivityEvents } from "@/config/topbar/departmentActivity";
export {
  messageUserHref,
  messageGroupHref,
  memberContactAction,
  departmentContactAction,
  audienceContactAction,
} from "@/config/topbar/communicationShortcuts";
export { resolveEscalations, topEscalation, SEVERITY } from "@/config/topbar/escalations";
export { buildManagerTools, isManagerRole } from "@/config/topbar/managerTools";
export { resolveCoordinationLinks } from "@/config/topbar/crossDepartment";

// Phase 5 — intelligent operational assistance (trends, recommendations,
// workload balancing, alerts, smart reminders, workflow automation, the
// assistant assembler + contextual guidance, and behaviour learning).
export { deriveTrends, trendFor, isRising, isFalling, movementLabel, TRENDED_METRICS } from "@/config/topbar/operationalTrends";
export { buildRecommendations, topRecommendation } from "@/config/topbar/recommendations";
export { buildWorkloadBalancing, canBalanceWorkload } from "@/config/topbar/workloadBalancing";
export { resolveAlerts, topAlert, summariseAlerts } from "@/config/topbar/operationalAlerts";
export { buildSmartReminders, countSmartReminders } from "@/config/topbar/smartReminders";
export { resolveWorkflow, resolveWorkflowActions } from "@/config/topbar/workflowAutomation";
export { buildAssistant, contextualGuidance } from "@/config/topbar/assistant";
export {
  emptyModel,
  normaliseModel,
  recordVisit,
  rankActions,
  scoreEntry,
  trackedCount,
  BEHAVIOUR_VERSION,
} from "@/config/topbar/behaviourModel";
