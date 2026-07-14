// file location: src/config/topbar/quickActions.js
//
// Configurable, role/department-specific top-bar quick actions (Phase 2.4).
// Centralises what used to be hardcoded SERVICE_ACTION_LINKS / PARTS_ACTION_LINKS
// inside the top-bar component, so a department's action set is edited here — the
// chrome never changes.
//
// NOTE: technician workflow controls (status dropdown, Open/No current job,
// Start Job) are NOT quick actions — they are first-class tech controls owned by
// the top bar and are unaffected by this config. This only governs the
// role-based action links/buttons in the centre strip.
//
// Resolution order:
//   1. If the workspace manifest supplies quick actions for the active
//      department (getQuickActions), those win — the manifest is the forward-
//      looking source of truth.
//   2. Otherwise fall back to capability-based defaults below (service / parts),
//      preserving the exact pre-Phase-2 behaviour.

export const SERVICE_QUICK_ACTIONS = [
  { label: "Create Job Card", href: "/new-job" },
  { label: "Appointments", href: "/job-cards/appointments" },
];

export const PARTS_QUICK_ACTIONS = [
  { label: "Delivery/Collection Planner", href: "/delivery-planner" },
  { label: "Create Order", href: "/new-order" },
  { label: "Goods In", href: "/goods-in" },
];

// De-duplicate by href, preserving order (a user with both service + parts
// access should never see the same action twice).
function dedupeByHref(actions) {
  const seen = new Set();
  return actions.filter((action) => {
    if (!action?.href || seen.has(action.href)) return false;
    seen.add(action.href);
    return true;
  });
}

// Returns the resolved quick-action list for the top-bar centre strip.
export function resolveQuickActions({
  manifestQuickActions = null,
  canUseServiceActions = false,
  hasPartsAccess = false,
} = {}) {
  if (Array.isArray(manifestQuickActions)) {
    return dedupeByHref(manifestQuickActions);
  }
  const actions = [];
  if (canUseServiceActions) actions.push(...SERVICE_QUICK_ACTIONS);
  if (hasPartsAccess) actions.push(...PARTS_QUICK_ACTIONS);
  return dedupeByHref(actions);
}
