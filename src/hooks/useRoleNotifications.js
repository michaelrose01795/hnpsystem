// file location: src/hooks/useRoleNotifications.js
//
// Adaptive role-aware notifications (Phase 2.7). Wraps the notification model in
// a memoised hook and exposes the prioritised items, the high-priority subset,
// a count, and the single top item — for the top bar to announce (aria-live) and
// to lead the status rotation with. Suppressed in the presentation shell.

import { useMemo } from "react";
import { resolveNotifications } from "@/config/topbar/departmentNotifications";

export function useRoleNotifications({ department = null, metrics = {}, isPresentation = false } = {}) {
  return useMemo(() => {
    if (isPresentation || !department) {
      return { items: [], high: [], count: 0, top: null };
    }
    const items = resolveNotifications(department, metrics);
    const high = items.filter((item) => item.priority === "high");
    return { items, high, count: items.length, top: items[0] || null };
  }, [department, metrics, isPresentation]);
}

export default useRoleNotifications;
