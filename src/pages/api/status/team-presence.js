// file location: src/pages/api/status/team-presence.js
//
// Live team-presence signal for the collaborative top-bar workspace (Phase 4.1).
// Mirrors /api/status/operational-summary exactly: any authenticated staff user
// may call it; the caller's department is derived server-side from their OWN
// roles (never trusted from the client); the response is a lean, short-cached
// payload. It carries only the raw live fact the client can't derive for free —
// which staff are currently clocked into a job — and lets the pure client
// registries merge that with the already-loaded roster.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { resolveDepartmentForRoles } from "@/lib/reporting/config/departments";
import { getWorkingStaff } from "@/lib/database/dashboard/teamPresence";

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: `Method ${req.method} not allowed` });
  }

  try {
    const roles = Array.isArray(session?.user?.roles) ? session.user.roles : [];
    const department = resolveDepartmentForRoles(roles);
    const working = await getWorkingStaff();

    // Short private cache: the bar polls infrequently and this is per-user.
    res.setHeader("Cache-Control", "private, max-age=20");
    return res.status(200).json({
      success: true,
      department: department || null,
      // Ids of everyone currently on a job + the job they're on. Small active set.
      working,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error("team-presence error:", error);
    return res.status(500).json({ success: false, message: "Failed to load presence" });
  }
}

// No `allow` list → any authenticated staff user; scoping happens client-side.
export default withRoleGuard(handler);
