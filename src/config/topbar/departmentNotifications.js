// file location: src/config/topbar/departmentNotifications.js
//
// Adaptive role-aware notifications (Phase 2.7). A prioritised, department-
// filtered view over the same live metrics that drive insights — so the bar only
// surfaces attention items relevant to the user's department, ranked by priority.
//
// PURE. Reuses the insight renderers (departmentInsights.js) so notification and
// insight wording stay identical (and de-dupable in the rotating line).

import { DEPARTMENT_INSIGHTS } from "@/config/topbar/departmentInsights";

// Priority per insight/metric key. Urgent, action-now items are "high".
const PRIORITY = {
  overdue: "high",
  approvals: "high",
  waiting: "medium",
  partsOut: "medium",
  deliveries: "medium",
  arrivals: "low",
  idleTechs: "low",
};

const RANK = { high: 3, medium: 2, low: 1 };

// Resolve prioritised notifications for a department from live metrics.
// `minPriority` filters out anything below the given level ("only display
// information relevant to that department and priority level").
export function resolveNotifications(department, metrics = {}, { minPriority = "low" } = {}) {
  const list = DEPARTMENT_INSIGHTS[department] || [];
  const floor = RANK[minPriority] || 1;
  return list
    .map((insight) => {
      const priority = PRIORITY[insight.key] || "low";
      if (RANK[priority] < floor) return null;
      let message = null;
      try {
        message = insight.render(metrics);
      } catch {
        message = null;
      }
      if (!message) return null;
      return { key: insight.key, priority, message };
    })
    .filter(Boolean)
    .sort((a, b) => RANK[b.priority] - RANK[a.priority]);
}
