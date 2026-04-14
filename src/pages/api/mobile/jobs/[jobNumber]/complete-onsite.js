// file location: src/pages/api/mobile/jobs/[jobNumber]/complete-onsite.js
// Action endpoint: mark a mobile job completed on-site.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { MOBILE_TECH_ROLES, MANAGER_SCOPED_ROLES, HR_MANAGER_ROLES } from "@/lib/auth/roles";
import { completeMobileJobOnsite } from "@/lib/mobile/mobileJobs";
import { getDatabaseClient } from "@/lib/database/client";

const ALLOW = [...MOBILE_TECH_ROLES, ...MANAGER_SCOPED_ROLES, ...HR_MANAGER_ROLES];

async function handler(req, res, session) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "Method not allowed" });
  }
  const { jobNumber } = req.query;
  const { notes } = req.body || {};

  const db = getDatabaseClient();
  let userId = null;
  if (session.user?.email) {
    const { data: me } = await db.from("users").select("user_id").eq("email", session.user.email).maybeSingle();
    userId = me?.user_id || null;
  }

  try {
    const job = await completeMobileJobOnsite({ jobNumber, notes, userId });
    return res.status(200).json({ job, message: `Job ${jobNumber} marked completed on-site` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

export default withRoleGuard(handler, { allow: ALLOW });
