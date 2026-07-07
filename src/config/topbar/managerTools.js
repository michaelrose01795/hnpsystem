// file location: src/config/topbar/managerTools.js
//
// MANAGER COLLABORATION TOOLS (Phase 4.6) — PURE builder. For manager-tier roles
// only, turns the team-presence result (4.1) + the live department metrics
// (Phase 2) into three collaboration sections: department monitoring, workload
// balancing and staff visibility. No React/window/storage.
//
// It answers the manager questions the rest of the workspace can't: where is the
// pressure, who is free to absorb it, and what does the whole floor look like
// right now — each row carrying enough context for the panel to attach a
// "message" action (4.4) where useful.
//
// A section: { id, title, icon, emptyText, items: [{ id, label, subtitle?,
//   tone?, href?, memberId?, deptCode? }] }

import { summariseGroup } from "@/config/topbar/teamPresence";
import { resolveKpis } from "@/config/topbar/departmentKpis";

// Broad manager gate: any management-tier role. Kept local + permissive so the
// tools show for workshop/service/parts managers, directors and owners alike.
export function isManagerRole(roles = []) {
  return (Array.isArray(roles) ? roles : []).some((r) => {
    const role = String(r).toLowerCase();
    return role.includes("manager") || role.includes("director") || role === "owner";
  });
}

const num = (metrics, key) => {
  const v = metrics?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
};

// Department monitoring — one line per department: how many are available vs
// working, toned by pressure. Gives cross-department visibility at a glance.
function monitoringSection(presence) {
  const items = (presence?.departments || []).map((group) => {
    const tone = group.available > 0 ? "success" : group.working > 0 ? "warning" : "info";
    return {
      id: `monitor:${group.code}`,
      label: group.name,
      subtitle: summariseGroup(group) || `${group.total} on team`,
      tone,
      deptCode: group.code, // panel can offer "message this team"
    };
  });
  return {
    id: "manager-monitoring",
    title: "Department monitoring",
    icon: "🖥",
    emptyText: "No team presence to monitor yet.",
    items,
  };
}

// Workload balancing — reads the viewer's own department metrics against who is
// free, and proposes the balancing move. Also lists the staff free to take work.
function balancingSection(presence, metrics, department, myDepartment) {
  const items = [];
  const waiting = num(metrics, "jobsWaiting");
  const free = typeof metrics?.techniciansAvailable === "number" ? metrics.techniciansAvailable : null;
  const overdue = num(metrics, "overdueJobs");

  if (waiting > 0 && free != null && free > 0) {
    items.push({
      id: "balance:assign",
      label: `Assign ${waiting} waiting job${waiting === 1 ? "" : "s"} to ${free} free technician${free === 1 ? "" : "s"}`,
      subtitle: "Capacity available",
      tone: "info",
      href: "/nextjobs",
    });
  } else if (waiting > 0 && free != null && free <= 0) {
    items.push({
      id: "balance:no-capacity",
      label: `${waiting} job${waiting === 1 ? "" : "s"} waiting with no free technicians`,
      subtitle: "Rebalance or pull in support",
      tone: "warning",
      href: "/nextjobs",
    });
  } else if (free != null && free > 0 && waiting === 0) {
    items.push({
      id: "balance:spare-capacity",
      label: `${free} technician${free === 1 ? "" : "s"} free — pull work forward`,
      subtitle: "Spare capacity",
      tone: "success",
      href: "/nextjobs",
    });
  }

  if (overdue > 0) {
    items.push({
      id: "balance:overdue",
      label: `${overdue} overdue job${overdue === 1 ? "" : "s"} to redistribute`,
      subtitle: "Behind promised time",
      tone: "danger",
      href: "/job-cards",
    });
  }

  // Who is actually free right now (from presence) — each messageable.
  const available = (myDepartment?.members || []).filter((m) => m.available && !m.isSelf);
  available.forEach((member) => {
    items.push({
      id: `balance:free:${member.id}`,
      label: `${member.name} is free`,
      subtitle: member.roleLabel,
      tone: "success",
      memberId: member.id,
    });
  });

  return {
    id: "manager-balancing",
    title: "Workload balancing",
    icon: "⚖️",
    emptyText: "Workload is balanced — nothing to move.",
    items,
  };
}

// Staff visibility — a compact roll-up across the whole floor plus the viewer's
// department KPI snapshot, so a manager sees headline numbers without leaving.
function visibilitySection(presence, metrics, department) {
  const items = [];
  const totals = presence?.totals || { total: 0, available: 0, working: 0 };
  if (totals.total > 0) {
    items.push({
      id: "visibility:roll-up",
      label: `${totals.total} staff on the floor`,
      subtitle: `${totals.available} available · ${totals.working} working`,
      tone: totals.available > 0 ? "success" : "info",
    });
  }
  resolveKpis(department, metrics).forEach((kpi) => {
    items.push({
      id: `visibility:kpi:${kpi.key}`,
      label: `${kpi.value} ${kpi.label}`,
      tone: "info",
    });
  });
  return {
    id: "manager-visibility",
    title: "Staff visibility",
    icon: "👥",
    emptyText: "No live staff figures yet.",
    items,
  };
}

// Build the manager sections. Returns { isManager, sections }. When the viewer is
// not a manager, sections is empty (the panel hides the block entirely).
export function buildManagerTools({
  presence = null,
  metrics = {},
  department = null,
  roles = [],
  myDepartment = null,
} = {}) {
  if (!isManagerRole(roles)) return { isManager: false, sections: [] };
  const sections = [
    monitoringSection(presence),
    balancingSection(presence, metrics, department, myDepartment),
    visibilitySection(presence, metrics, department),
  ];
  return { isManager: true, sections };
}
