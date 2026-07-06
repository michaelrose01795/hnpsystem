// file location: src/config/topbar/departmentInsights.js
//
// Rotating smart department insights (Phase 2.6). Turns the live metrics snapshot
// into short, actionable operational prompts (workload, arrivals, idle techs,
// overdue work, waiting approvals) tailored to the user's department. These are
// surfaced in rotation on the top bar's status line (see statusViews.js).
//
// An insight: { key, render(metrics) => string | null }. Return null when the
// insight doesn't apply (e.g. nothing overdue). Order = priority (most important
// first); the rotation shows them in this order.

import { count } from "@/config/topbar/departmentStatus";

const has = (v) => typeof v === "number" && v > 0;

// Exported so the notification model (departmentNotifications.js) can reuse the
// exact same wording per metric — keeping insights (2.6) and notifications (2.7)
// consistent and de-dupable.
export const INSIGHTS = {
  overdue: {
    key: "overdue",
    render: (m) => (has(m.overdueJobs) ? `${count(m.overdueJobs, "job")} overdue — needs chasing` : null),
  },
  approvals: {
    key: "approvals",
    render: (m) =>
      has(m.waitingApprovals) ? `${count(m.waitingApprovals, "VHC")} awaiting approval` : null,
  },
  waiting: {
    key: "waiting",
    render: (m) => (has(m.jobsWaiting) ? `${count(m.jobsWaiting, "job")} waiting to start` : null),
  },
  arrivals: {
    key: "arrivals",
    render: (m) =>
      has(m.appointmentsToday) ? `${count(m.appointmentsToday, "arrival")} booked today` : null,
  },
  idleTechs: {
    key: "idleTechs",
    render: (m) =>
      has(m.techniciansAvailable) ? `${count(m.techniciansAvailable, "technician")} free now` : null,
  },
  partsOut: {
    key: "partsOut",
    render: (m) => (has(m.partsOutstanding) ? `${count(m.partsOutstanding, "part")} still outstanding` : null),
  },
  deliveries: {
    key: "deliveries",
    render: (m) =>
      has(m.pendingDeliveries) ? `${count(m.pendingDeliveries, "delivery", "deliveries")} pending` : null,
  },
};

// Ordered insight priority per department.
export const DEPARTMENT_INSIGHTS = {
  workshop: [INSIGHTS.overdue, INSIGHTS.waiting, INSIGHTS.idleTechs, INSIGHTS.approvals],
  service: [INSIGHTS.approvals, INSIGHTS.arrivals, INSIGHTS.waiting, INSIGHTS.overdue],
  mot: [INSIGHTS.arrivals],
  valeting: [INSIGHTS.waiting],
  parts: [INSIGHTS.partsOut, INSIGHTS.deliveries],
  management: [INSIGHTS.overdue, INSIGHTS.waiting, INSIGHTS.arrivals, INSIGHTS.approvals],
};

// Resolve the applicable insight strings for a department, in priority order.
export function resolveInsights(department, metrics = {}) {
  const list = DEPARTMENT_INSIGHTS[department] || [];
  return list
    .map((insight) => {
      try {
        return insight.render(metrics);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}
