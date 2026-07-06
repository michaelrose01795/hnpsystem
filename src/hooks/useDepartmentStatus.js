// file location: src/hooks/useDepartmentStatus.js
//
// Gathers real, already-loaded application data and turns it into the top bar's
// department status line via the central registry (src/config/topbar/
// departmentStatus.js). This is the ONE place that knows where live signals come
// from; the registry only decides how to phrase them, and the top bar only
// renders the resulting string — so new departments/signals never touch the
// chrome component.
//
// Data sources are deliberately cheap and side-effect-free: the staff roster
// (already in RosterContext) and the signed-in user's own state (UserContext).
// The top bar renders on every page for every role, so it must not fire heavy or
// role-guarded queries. Departments without a cheap live signal fall back to
// static contextual copy (see the registry). A dedicated lightweight operational
// summary endpoint (open jobs, appointments, queue depth) is the recommended
// Phase 2.2 enhancement.

import { useMemo } from "react";
import { useRoster } from "@/context/RosterContext";
import { useUser } from "@/context/UserContext";
import { resolveDepartmentForRoles } from "@/lib/reporting/config/departments";
import { buildDepartmentStatus } from "@/config/topbar/departmentStatus";

// Roster keys (from /api/users/roster → usersByRole) that make up each live
// headcount. Keys match the canonical role display names in roleCategories.
const HEADCOUNT_SOURCES = {
  techs: ["Techs", "Mobile Technician"],
  motTesters: ["MOT Tester"],
  valeters: ["Valet Service"],
  parts: ["Parts", "Parts Driver"],
  service: ["Service"],
};

function sumRoles(usersByRole, keys) {
  if (!usersByRole) return 0;
  return keys.reduce((total, key) => {
    const list = usersByRole[key];
    return total + (Array.isArray(list) ? list.length : 0);
  }, 0);
}

function buildHeadcount(usersByRole) {
  return Object.entries(HEADCOUNT_SOURCES).reduce((acc, [metric, keys]) => {
    acc[metric] = sumRoles(usersByRole, keys);
    return acc;
  }, {});
}

// Returns { text, isLive, department }. `text` is always a safe non-empty string.
export function useDepartmentStatus({
  userRoles = [],
  primaryRole = null,
  isPresentation = false,
} = {}) {
  const { usersByRole } = useRoster() || {};
  const { status, currentJob } = useUser() || {};

  const rolesKey = Array.isArray(userRoles) ? userRoles.join("|") : "";

  return useMemo(() => {
    const department = resolveDepartmentForRoles(userRoles);
    // In the presentation shell the real roster / user state must not leak into
    // the demo chrome, so live signals are omitted and the registry falls back
    // to static copy.
    const headcount = isPresentation ? {} : buildHeadcount(usersByRole);
    const self = isPresentation
      ? {}
      : {
          status: status || null,
          currentJobNumber: currentJob?.jobNumber || null,
        };

    const result = buildDepartmentStatus(department, {
      role: primaryRole,
      department,
      isPresentation,
      headcount,
      self,
    });
    return { ...result, department };
    // rolesKey stands in for userRoles (array identity is unstable); the other
    // deps are the live signal sources.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesKey, primaryRole, isPresentation, usersByRole, status, currentJob]);
}

export default useDepartmentStatus;
