// file location: src/pages/api/mobile/jobs/index.js
// List mobile jobs. Mobile technicians only see their own; managers see all.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { MOBILE_TECH_ROLES, MANAGER_SCOPED_ROLES, HR_MANAGER_ROLES, normalizeRoles } from "@/lib/auth/roles";
import { listMobileJobsForTechnician } from "@/lib/mobile/mobileJobs";
import { getDatabaseClient } from "@/lib/database/client";

const ALLOW = [...MOBILE_TECH_ROLES, ...MANAGER_SCOPED_ROLES, ...HR_MANAGER_ROLES, "service", "service manager"];

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { from, to, technicianId: qTech } = req.query;
  const roles = normalizeRoles(session.user?.roles || []);
  const isMobileTech = roles.includes("mobile technician") && !roles.some((r) => MANAGER_SCOPED_ROLES.includes(r) || HR_MANAGER_ROLES.includes(r));

  // Resolve effective technician filter
  let technicianId = qTech ? Number(qTech) : null;
  if (isMobileTech) {
    // Mobile techs locked to their own jobs
    const db = getDatabaseClient();
    const email = session.user?.email;
    if (email) {
      const { data: me } = await db.from("users").select("user_id").eq("email", email).maybeSingle();
      technicianId = me?.user_id || null;
    }
  }

  try {
    const jobs = await listMobileJobsForTechnician({
      technicianId,
      fromIso: from || null,
      toIso: to || null,
    });
    return res.status(200).json({ jobs });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

export default withRoleGuard(handler, { allow: ALLOW });
