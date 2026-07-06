// file location: src/lib/topbar/workspacePreferences.js
//
// User-level workspace personalisation (Phase 3.7) — PURE preference schema +
// validation + reducers. No React/storage/window, so it's deterministic and
// unit-testable; the hook (src/hooks/useWorkspacePreferences.js) persists it.
//
// Preferences are intentionally small and forward-compatible: unknown keys are
// dropped on merge, missing keys fall back to defaults, so a schema change never
// corrupts a stored blob.
//
// Shape:
//   {
//     widgets: { [widgetId]: boolean },   // productivity-panel widget visibility
//     widgetOrder: string[],              // productivity-panel widget order
//     hiddenQuickActions: string[],       // quick-action hrefs the user hid
//   }

import { WIDGET_IDS } from "@/config/topbar/productivityWidgets";

export function defaultPreferences() {
  return {
    widgets: WIDGET_IDS.reduce((acc, id) => ({ ...acc, [id]: true }), {}),
    widgetOrder: [...WIDGET_IDS],
    hiddenQuickActions: [],
  };
}

function asStringArray(value) {
  return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
}

// Merge a stored (possibly partial / stale) blob onto the defaults, keeping only
// known widget ids and coercing types. Never throws.
export function mergePreferences(stored) {
  const base = defaultPreferences();
  if (!stored || typeof stored !== "object") return base;

  const widgets = { ...base.widgets };
  if (stored.widgets && typeof stored.widgets === "object") {
    for (const id of WIDGET_IDS) {
      if (typeof stored.widgets[id] === "boolean") widgets[id] = stored.widgets[id];
    }
  }

  // Order: keep stored ids that are still valid, append any new/missing ids.
  const storedOrder = asStringArray(stored.widgetOrder).filter((id) => WIDGET_IDS.includes(id));
  const widgetOrder = [...storedOrder];
  for (const id of WIDGET_IDS) if (!widgetOrder.includes(id)) widgetOrder.push(id);

  return {
    widgets,
    widgetOrder,
    hiddenQuickActions: asStringArray(stored.hiddenQuickActions),
  };
}

// --- Reducers (return a NEW prefs object; never mutate) ---------------------

export function setWidgetVisible(prefs, widgetId, visible) {
  if (!WIDGET_IDS.includes(widgetId)) return prefs;
  return { ...prefs, widgets: { ...prefs.widgets, [widgetId]: Boolean(visible) } };
}

// Move a widget one slot up (-1) or down (+1) in the order.
export function moveWidget(prefs, widgetId, direction) {
  const order = [...prefs.widgetOrder];
  const from = order.indexOf(widgetId);
  if (from === -1) return prefs;
  const to = from + (direction < 0 ? -1 : 1);
  if (to < 0 || to >= order.length) return prefs;
  [order[from], order[to]] = [order[to], order[from]];
  return { ...prefs, widgetOrder: order };
}

export function toggleQuickActionHidden(prefs, href) {
  if (!href) return prefs;
  const hidden = new Set(prefs.hiddenQuickActions);
  if (hidden.has(href)) hidden.delete(href);
  else hidden.add(href);
  return { ...prefs, hiddenQuickActions: Array.from(hidden) };
}

// Apply the quick-action prefs to a resolved quick-action list (drop hidden;
// order preserved). Pure so both the bar and the palette can share it later.
export function applyQuickActionPrefs(actions, prefs) {
  const hidden = new Set(prefs?.hiddenQuickActions || []);
  return (Array.isArray(actions) ? actions : []).filter((a) => a?.href && !hidden.has(a.href));
}
