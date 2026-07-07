// file location: src/hooks/useEscalations.js
//
// Escalation & priority workflows (Phase 4.5). A thin reactive wrapper over the
// pure escalation engine (src/config/topbar/escalations.js): it memoises the
// resolved, severity-ranked list against the live metrics + the user's roles, so
// the collaboration panel and the command palette read one consistent set of
// "needs attention now" items. No polling of its own — it reuses the Phase 2
// operational snapshot already flowing through the layout.

import { useMemo } from "react";
import { resolveEscalations } from "@/config/topbar/escalations";
import { WORKSPACE_LIMITS } from "@/config/topbar/workspaceConfig";

export function useEscalations({ metrics = {}, roles = [], department = null, enabled = true } = {}) {
  // Primitive dependency key so the memo only recomputes when a relevant metric
  // or the role set actually changes (not on every new snapshot object).
  const metricsKey = useMemo(
    () =>
      [
        "overdueJobs",
        "waitingApprovals",
        "jobsWaiting",
        "techniciansAvailable",
        "partsOutstanding",
        "pendingDeliveries",
      ]
        .map((k) => `${k}:${metrics?.[k] ?? ""}`)
        .join("|"),
    [metrics]
  );
  const rolesKey = Array.isArray(roles) ? roles.join(",") : "";

  return useMemo(() => {
    if (!enabled) return [];
    return resolveEscalations(
      { metrics, roles, department },
      { limit: WORKSPACE_LIMITS.escalations }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricsKey, rolesKey, department, enabled]);
}

export default useEscalations;
