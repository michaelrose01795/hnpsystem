// file location: src/pages/api/status/operational-summary.js
//
// Lightweight operational counts for the role-aware top bar (Phase 2.1 / 2.2).
// Any authenticated staff member may call it; the department is derived from the
// caller's OWN roles server-side (never trusted from the client), and only cheap
// head-count queries for that department are run (see
// src/lib/database/dashboard/topbarSummary.js).

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { resolveDepartmentForRoles } from "@/lib/reporting/config/departments";
import { getTopbarOperationalSummary } from "@/lib/database/dashboard/topbarSummary";

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: `Method ${req.method} not allowed` });
  }

  try {
    const roles = Array.isArray(session?.user?.roles) ? session.user.roles : [];
    const department = resolveDepartmentForRoles(roles);
    const metrics = department ? await getTopbarOperationalSummary(department) : {};

    // Short private cache: the bar polls infrequently and this is per-user.
    res.setHeader("Cache-Control", "private, max-age=30");
    return res.status(200).json({
      success: true,
      department: department || null,
      metrics,
    });
  } catch (error) {
    console.error("operational-summary error:", error);
    return res.status(500).json({ success: false, message: "Failed to load summary" });
  }
}

// No `allow` list → any authenticated staff user; department scoping happens in
// the handler from the caller's own roles.
export default withRoleGuard(handler);
