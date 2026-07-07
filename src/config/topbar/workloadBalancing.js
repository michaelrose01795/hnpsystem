// file location: src/config/topbar/workloadBalancing.js
//
// INTELLIGENT WORKLOAD BALANCING (Phase 5.2) — PURE engine. For managers and
// controllers, turns the live team presence (4.1) + department metrics (Phase 2)
// + how the load is trending (5.1) into concrete distribution suggestions:
// capacity utilisation, who to move where, when to pull in cross-department help,
// and what to redistribute — each row carrying enough context for the assistant
// panel to attach a "message" action (4.4).
//
// This is the reasoning the Phase 4.6 manager "balancing" section only hinted at:
// it is trend-aware (rebalance BEFORE the queue stacks), cross-department aware
// (finds free hands in other departments when the viewer's own is maxed), and
// reports a single utilisation headline so a manager sees the pressure at a glance.
//
// No React/window/storage/Date — deterministic and unit-testable.
//
// Returns:
//   { isEligible, utilisation: { onJobs, free, total, ratio, label, tone } | null,
//     suggestions: [{ id, label, subtitle, tone, href, memberId?, deptCode?,
//       priority }], summary }

import { isManagerRole } from "@/config/topbar/managerTools";
import { trendFor, movementLabel } from "@/config/topbar/operationalTrends";

function num(metrics, key) {
  const v = metrics?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function plural(n, one, many) {
  return n === 1 ? one : many;
}

// Controllers balance work too (workshop controller, service controller, etc.),
// so the gate is the manager tier PLUS any "controller" role.
export function canBalanceWorkload(roles = []) {
  if (isManagerRole(roles)) return true;
  return (Array.isArray(roles) ? roles : []).some((r) => String(r).toLowerCase().includes("controller"));
}

// Utilisation headline from the live technician figures, when present.
function computeUtilisation(metrics) {
  const free = metrics?.techniciansAvailable;
  const onJobs = metrics?.techniciansOnJobs;
  const total = metrics?.techniciansTotal;
  if (typeof total !== "number" || total <= 0) return null;
  const busy = typeof onJobs === "number" ? onJobs : total - (typeof free === "number" ? free : 0);
  const ratio = Math.max(0, Math.min(1, busy / total));
  const pct = Math.round(ratio * 100);
  const tone = ratio >= 0.9 ? "danger" : ratio >= 0.7 ? "warning" : "success";
  return {
    onJobs: busy,
    free: typeof free === "number" ? free : Math.max(total - busy, 0),
    total,
    ratio,
    label: `${pct}% of the team utilised`,
    tone,
  };
}

// Find free capacity in OTHER departments (cross-department help) from presence.
function crossDepartmentHelp(presence, ownDepartment) {
  const groups = presence?.departments || [];
  return groups
    .filter((g) => g.code !== ownDepartment && g.available > 0)
    .sort((a, b) => b.available - a.available)
    .map((g) => ({ code: g.code, name: g.name, available: g.available }));
}

// Build the balancing view. `myDepartment` is the viewer's own presence group
// (from buildTeamPresence) — the members actually free right now.
export function buildWorkloadBalancing({
  presence = null,
  metrics = {},
  trends = null,
  roles = [],
  department = null,
  myDepartment = null,
} = {}) {
  if (!canBalanceWorkload(roles)) {
    return { isEligible: false, utilisation: null, suggestions: [], summary: "" };
  }

  const waiting = num(metrics, "jobsWaiting");
  const overdue = num(metrics, "overdueJobs");
  const free = typeof metrics?.techniciansAvailable === "number" ? metrics.techniciansAvailable : null;
  const queueTrend = trendFor(trends, "jobsWaiting");
  const utilisation = computeUtilisation(metrics);
  const suggestions = [];

  // 1. Direct assignment when there is both work and free hands.
  if (waiting > 0 && free != null && free > 0) {
    suggestions.push({
      id: "balance:assign",
      label: `Assign ${waiting} waiting ${plural(waiting, "job", "jobs")} to ${free} free technician${free === 1 ? "" : "s"}`,
      subtitle: "Capacity available now",
      tone: "info",
      href: "/nextjobs",
      priority: 90,
    });
  }

  // 2. No local capacity but work waiting → look outward for help (cross-dept).
  if (waiting > 0 && free != null && free <= 0) {
    const help = crossDepartmentHelp(presence, department);
    if (help.length > 0) {
      const first = help[0];
      suggestions.push({
        id: `balance:borrow:${first.code}`,
        label: `Pull in help from ${first.name} (${first.available} free)`,
        subtitle: `No local capacity — ${waiting} ${plural(waiting, "job", "jobs")} waiting`,
        tone: "warning",
        deptCode: first.code,
        href: "/nextjobs",
        priority: 95,
      });
    } else {
      suggestions.push({
        id: "balance:no-capacity",
        label: `${waiting} ${plural(waiting, "job", "jobs")} waiting with no free technicians`,
        subtitle: "Rebalance or extend capacity",
        tone: "warning",
        href: "/nextjobs",
        priority: 85,
      });
    }
  }

  // 3. Predictive: queue climbing even if not yet critical → rebalance early.
  if (queueTrend.rising && queueTrend.delta >= 2 && waiting > 0) {
    suggestions.push({
      id: "balance:queue-rising",
      label: `Queue is climbing (${movementLabel(trends, "jobsWaiting")}) — rebalance early`,
      subtitle: "Trend detected",
      tone: "warning",
      href: "/nextjobs",
      priority: 88,
    });
  }

  // 4. Spare local capacity with an empty queue → offer it to a busy department.
  if (free != null && free > 0 && waiting === 0) {
    const busiest = (presence?.departments || [])
      .filter((g) => g.code !== department && g.available === 0 && g.working > 0)
      .sort((a, b) => b.working - a.working)[0];
    suggestions.push({
      id: "balance:spare",
      label: busiest
        ? `${free} free — offer help to ${busiest.name}`
        : `${free} technician${free === 1 ? "" : "s"} free — pull work forward`,
      subtitle: busiest ? "They have no spare capacity" : "Spare capacity",
      tone: "success",
      href: "/nextjobs",
      deptCode: busiest?.code,
      priority: 60,
    });
  }

  // 5. Overdue work is the clearest thing to redistribute first.
  if (overdue > 0) {
    suggestions.push({
      id: "balance:overdue",
      label: `Redistribute ${overdue} overdue ${plural(overdue, "job", "jobs")}`,
      subtitle: "Behind promised time",
      tone: "danger",
      href: "/job-cards",
      priority: 92,
    });
  }

  // 6. Name the people actually free right now (each messageable).
  const availableMembers = (myDepartment?.members || []).filter((m) => m.available && !m.isSelf);
  availableMembers.forEach((member, i) => {
    suggestions.push({
      id: `balance:free:${member.id}`,
      label: `${member.name} is free`,
      subtitle: member.roleLabel || "Available",
      tone: "success",
      memberId: member.id,
      priority: 40 - i,
    });
  });

  suggestions.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const summary = utilisation
    ? utilisation.label
    : waiting > 0
    ? `${waiting} ${plural(waiting, "job", "jobs")} waiting`
    : "Workload balanced";

  return { isEligible: true, utilisation, suggestions, summary };
}

export const __test__ = { computeUtilisation, crossDepartmentHelp };
