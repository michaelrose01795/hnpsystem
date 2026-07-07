// file location: src/config/topbar/teamPresence.js
//
// LIVE TEAM PRESENCE (Phase 4.1) — PURE builder. Turns the already-loaded staff
// roster + the live "who's on a job" signal (/api/status/team-presence) + the
// current user's self-declared availability (4.2) into per-department presence
// groups the collaboration panel renders. No React/window/storage.
//
// Honest data boundary (documented in the rollout): the ONE real live signal is
// `job_clocking` open rows → "Working". Everyone else on the roster is shown as
// "Available" (on the team, not on a job). The current user can additionally
// self-declare break / road-test / training / maintenance / other (4.2), which
// wins for their own row. There is no attendance/last-seen source, so we never
// claim a colleague is "offline" — presence is framed as availability.
//
// A presence member:
//   { id, name, role, roleLabel, department, departmentName,
//     availabilityId, state, working, isSelf, jobNumber }

import {
  resolveDepartmentForRole,
  getDepartment,
  DEPARTMENTS,
} from "@/lib/reporting/config/departments";
import { formatRoleLabel } from "@/lib/auth/rolePrecedence";
import {
  resolveAvailabilityState,
  DEFAULT_AVAILABILITY_ID,
  isAvailableState,
} from "@/config/topbar/availabilityStates";

// Canonical department display order (operational first, then oversight).
const DEPARTMENT_ORDER = [
  "workshop",
  "service",
  "parts",
  "mot",
  "valeting",
  "paint",
  "accounts",
  "admin",
  "hr",
  "management",
];

function departmentRank(code) {
  const i = DEPARTMENT_ORDER.indexOf(code);
  return i === -1 ? DEPARTMENT_ORDER.length : i;
}

// Shape a raw roster user into a staff team member with a resolved department.
// Returns null for non-staff (customers) or role-less rows so callers can filter.
export function toTeamMember(user) {
  if (!user) return null;
  const id = user.id ?? user.user_id ?? null;
  if (id == null) return null;
  const role = user.role || "";
  const department = resolveDepartmentForRole(role);
  if (!department) return null; // unmapped role (e.g. "Customer") → not a teammate
  const name =
    user.name ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    "Unknown";
  return {
    id,
    name,
    role,
    roleLabel: role ? formatRoleLabel(role) : "Staff",
    department,
    departmentName: getDepartment(department)?.name || department,
  };
}

// Convert an array of raw roster users into unique staff members (deduped by id).
export function toTeamMembers(users) {
  const list = Array.isArray(users) ? users : [];
  const byId = new Map();
  for (const raw of list) {
    const member = toTeamMember(raw);
    if (member && !byId.has(member.id)) byId.set(member.id, member);
  }
  return Array.from(byId.values());
}

// Resolve one member's availability: self-declared wins for the current user;
// otherwise the live "working" signal; otherwise the roster default (available).
function resolveMemberAvailability({ isSelf, working, selfAvailabilityId }) {
  if (isSelf && selfAvailabilityId) return selfAvailabilityId;
  if (working) return "working";
  return DEFAULT_AVAILABILITY_ID;
}

// Build per-department presence groups.
//   users               : raw roster users (RosterContext.allUsers)
//   working             : [{ userId, jobNumber }] from the live endpoint
//   selfId              : current user's id
//   selfAvailabilityId  : current user's self-declared availability (or null)
//   isPresentation      : demo shell → no live presence
export function buildTeamPresence({
  users = [],
  working = [],
  selfId = null,
  selfAvailabilityId = null,
  isPresentation = false,
} = {}) {
  if (isPresentation) {
    return { departments: [], byId: new Map(), self: null, totals: emptyTotals() };
  }

  const members = toTeamMembers(users);
  const workingMap = new Map();
  (Array.isArray(working) ? working : []).forEach((w) => {
    if (w && w.userId != null) workingMap.set(w.userId, w);
  });

  const byId = new Map();
  let self = null;
  const groups = new Map();

  for (const member of members) {
    const isSelf = selfId != null && member.id === selfId;
    const workEntry = workingMap.get(member.id) || null;
    const availabilityId = resolveMemberAvailability({
      isSelf,
      working: Boolean(workEntry),
      selfAvailabilityId,
    });
    const state = resolveAvailabilityState(availabilityId);
    const presence = {
      ...member,
      availabilityId,
      state,
      working: state.working === true,
      available: state.available === true,
      isSelf,
      jobNumber: workEntry?.jobNumber || null,
    };
    byId.set(member.id, presence);
    if (isSelf) self = presence;

    if (!groups.has(member.department)) {
      groups.set(member.department, []);
    }
    groups.get(member.department).push(presence);
  }

  const departments = Array.from(groups.entries())
    .map(([code, list]) => {
      const sorted = list.slice().sort(sortMembers);
      return {
        code,
        name: getDepartment(code)?.name || code,
        members: sorted,
        total: sorted.length,
        available: sorted.filter((m) => m.available).length,
        working: sorted.filter((m) => m.working).length,
      };
    })
    .sort((a, b) => departmentRank(a.code) - departmentRank(b.code));

  return { departments, byId, self, totals: computeTotals(departments) };
}

// Sort presence rows: yourself first, then available, then working, then the
// rest — each group alphabetical. Keeps the "who can take work" answer at a glance.
function sortMembers(a, b) {
  if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
  const rankA = availabilitySortRank(a);
  const rankB = availabilitySortRank(b);
  if (rankA !== rankB) return rankA - rankB;
  return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
}

function availabilitySortRank(m) {
  if (m.available) return 0;
  if (m.working) return 1;
  return 2;
}

function emptyTotals() {
  return { total: 0, available: 0, working: 0 };
}

function computeTotals(departments) {
  return departments.reduce(
    (acc, dept) => ({
      total: acc.total + dept.total,
      available: acc.available + dept.available,
      working: acc.working + dept.working,
    }),
    emptyTotals()
  );
}

// Pull a single department group out of a built presence result (or null).
export function focusDepartment(presence, code) {
  if (!presence || !code) return null;
  return presence.departments.find((d) => d.code === code) || null;
}

// A compact one-line availability summary for a department group, e.g.
// "3 available · 2 working". Empty string when the group is empty.
export function summariseGroup(group) {
  if (!group || !group.total) return "";
  const parts = [];
  if (group.available) parts.push(`${group.available} available`);
  if (group.working) parts.push(`${group.working} working`);
  return parts.join(" · ") || `${group.total} on team`;
}

export { isAvailableState, DEPARTMENTS };
