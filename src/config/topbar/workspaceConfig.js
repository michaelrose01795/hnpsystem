// file location: src/config/topbar/workspaceConfig.js
//
// Central tunables for the Phase 3 workspace productivity system. One place to
// adjust the knobs every feature shares (list caps, palette limits, how many
// recent/favourite items feed the palette). Pure constants — no logic.
//
// Keeping these here (rather than scattered `const MAX = …` in each hook) is the
// "centrally configurable" requirement of Phase 3.8: change a limit once and
// every consumer follows.

export const WORKSPACE_LIMITS = {
  // Persistence caps (how many items each per-user store keeps).
  recentActivity: 40,
  favourites: 60,
  reminders: 50,

  // How many of each feed the command palette (kept small so the list stays fast
  // and scannable).
  paletteRecent: 12,
  paletteResults: 40,

  // Productivity-panel per-widget item caps.
  panelRecent: 8,
  panelFavourites: 10,

  // Contextual suggestions returned at once.
  suggestions: 6,

  // --- Phase 4: collaborative operational workspace --------------------------
  // How often the live team-presence signal is polled (ms). Slightly tighter
  // than the 90s operational poll because presence changes more often, but still
  // light (one cheap query, focus-refreshed, aborted in-flight).
  presencePollMs: 45_000,
  // Max members shown per department group in the presence panel before "+N more".
  presencePerDepartment: 8,
  // Rolling shared-activity feed cap (per-user, in-memory for the session).
  activityFeed: 40,
  // How many activity items the panel shows at once.
  panelActivity: 10,
  // Escalations surfaced at once (panel + palette).
  escalations: 6,

  // --- Phase 5: intelligent operational assistance ---------------------------
  // How many operational metric snapshots the in-memory trend ring keeps (5.1).
  // Small: enough to see direction, cheap to hold, session-lived. At the ~90s
  // operational poll this is ~12 minutes of movement.
  trendHistory: 8,
  // Predictive recommendations surfaced at once (5.1).
  recommendations: 5,
  // Workload-balancing suggestions surfaced at once (5.2).
  workloadSuggestions: 6,
  // Proactive operational alerts surfaced at once (5.3).
  alerts: 6,
  // Auto-surfaced smart reminders shown at once (5.4).
  smartReminders: 6,
  // Workflow next-action steps surfaced for the current context (5.5).
  workflowSteps: 5,
  // Contextual guidance tips shown by the assistant (5.6).
  assistantGuidance: 3,
  // Distinct pages/actions the on-device behaviour model tracks (5.7).
  behaviourTracked: 80,
  // Personalised "you use this often" actions the behaviour model exposes (5.7).
  behaviourTopActions: 6,
  // Recency half-life (ms) for the behaviour frequency score — ~14 days, so an
  // old habit fades unless it's still used (5.7).
  behaviourHalfLifeMs: 14 * 24 * 60 * 60 * 1000,
};

export default WORKSPACE_LIMITS;
