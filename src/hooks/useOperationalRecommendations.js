// file location: src/hooks/useOperationalRecommendations.js
//
// Predictive operational recommendations (Phase 5.1). A thin reactive wrapper over
// the pure recommendation engine (src/config/topbar/recommendations.js): it
// memoises the ranked, explainable list against the live workload (metrics), how
// it's trending, the user's roles/department, where they are, and their on-device
// behaviour model (5.7). No polling of its own — it reuses signals already flowing.

import { useMemo } from "react";
import { buildRecommendations } from "@/config/topbar/recommendations";
import { WORKSPACE_LIMITS } from "@/config/topbar/workspaceConfig";

export function useOperationalRecommendations({
  metrics = {},
  trends = null,
  roles = [],
  department = null,
  pathname = "",
  behaviour = null,
  enabled = true,
} = {}) {
  // Primitive keys so the memo only recomputes when something relevant changes.
  const metricsKey = useMemo(() => JSON.stringify(metrics || {}), [metrics]);
  const rolesKey = Array.isArray(roles) ? roles.join("|") : "";
  const trendsKey = useMemo(
    () =>
      Object.entries(trends?.byKey || {})
        .map(([k, v]) => `${k}:${v.current ?? ""}:${v.delta ?? ""}`)
        .join("|"),
    [trends]
  );
  const behaviourKey = useMemo(
    () => (behaviour?.topActions || []).map((a) => `${a.href}:${a.count}`).join("|"),
    [behaviour]
  );

  return useMemo(() => {
    if (!enabled) return [];
    return buildRecommendations(
      { metrics, trends, roles, department, pathname, behaviour },
      { limit: WORKSPACE_LIMITS.recommendations }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, metricsKey, rolesKey, trendsKey, behaviourKey, department, pathname]);
}

export default useOperationalRecommendations;
