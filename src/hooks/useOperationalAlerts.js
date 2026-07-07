// file location: src/hooks/useOperationalAlerts.js
//
// Proactive operational alerts (Phase 5.3). A thin reactive wrapper over the pure
// alert engine (src/config/topbar/operationalAlerts.js): memoises the ranked
// alert list (current-state + predictive) against the live metrics, how they're
// trending, and the user's roles. No polling of its own — it reuses the Phase 2
// snapshot + the 5.1 trend ring already flowing.

import { useMemo } from "react";
import { resolveAlerts, summariseAlerts } from "@/config/topbar/operationalAlerts";
import { WORKSPACE_LIMITS } from "@/config/topbar/workspaceConfig";

export function useOperationalAlerts({ metrics = {}, trends = null, roles = [], department = null, enabled = true } = {}) {
  const metricsKey = useMemo(() => JSON.stringify(metrics || {}), [metrics]);
  const rolesKey = Array.isArray(roles) ? roles.join("|") : "";
  const trendsKey = useMemo(
    () =>
      Object.entries(trends?.byKey || {})
        .map(([k, v]) => `${k}:${v.current ?? ""}:${v.delta ?? ""}`)
        .join("|"),
    [trends]
  );

  const alerts = useMemo(() => {
    if (!enabled) return [];
    return resolveAlerts({ metrics, trends, roles, department }, { limit: WORKSPACE_LIMITS.alerts });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, metricsKey, rolesKey, trendsKey, department]);

  const summary = useMemo(() => summariseAlerts(alerts), [alerts]);

  return { alerts, summary };
}

export default useOperationalAlerts;
