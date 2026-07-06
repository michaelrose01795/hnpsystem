// file location: src/hooks/useContextualSuggestions.js
//
// Intelligent contextual suggestions (Phase 3.4). Feeds the live context — the
// current route, the user's roles + department, what they've recently viewed and
// the operational metrics — into the pure suggestion engine, and returns a short
// ranked list of recommended next actions for the palette and the panel.
//
// Pure inputs in, memoised list out — no storage of its own.

import { useMemo } from "react";
import { resolveSuggestions } from "@/config/topbar/contextualSuggestions";
import { WORKSPACE_LIMITS } from "@/config/topbar/workspaceConfig";

export function useContextualSuggestions({
  pathname = "",
  roles = [],
  department = null,
  recentItems = [],
  metrics = {},
  enabled = true,
  limit = WORKSPACE_LIMITS.suggestions,
} = {}) {
  // Distinct categories the user has recently touched — a cheap behavioural signal.
  const recentCategories = useMemo(() => {
    const set = new Set();
    for (const item of recentItems || []) if (item?.category) set.add(item.category);
    return set;
  }, [recentItems]);

  const rolesKey = (roles || []).join("|");
  const recentKey = Array.from(recentCategories).sort().join("|");
  const metricsKey = JSON.stringify(metrics || {});

  const suggestions = useMemo(() => {
    if (!enabled) return [];
    return resolveSuggestions(
      { pathname, roles, department, recentCategories, metrics },
      { limit }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pathname, department, rolesKey, recentKey, metricsKey, limit]);

  return suggestions;
}

export default useContextualSuggestions;
