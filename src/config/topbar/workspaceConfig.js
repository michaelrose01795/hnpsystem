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
};

export default WORKSPACE_LIMITS;
