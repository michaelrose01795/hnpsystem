// file location: src/pages/api/mobile/jobs/[jobNumber]/redirect-to-workshop.js
// Action endpoint: transition a mobile job back to workshop queue. Preserves history.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { MOBILE_TECH_ROLES, MANAGER_SCOPED_ROLES, HR_MANAGER_ROLES } from "@/lib/auth/roles";
import { redirectMobileJobToWorkshop } from "@/lib/mobile/mobileJobs";
import { getDatabaseClient } from "@/lib/database/client";

const ALLOW = [...MOBILE_TECH_ROLES, ...MANAGER_SCOPED_ROLES, ...HR_MANAGER_ROLES];

async function handler(req, res, session) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "Method not allowed" });
  }
  const { jobNumber } = req.query;
  const { reason } = req.body || {};

  const db = getDatabaseClient();
  let userId = null;
  if (session.user?.email) {
    const { data: me } = await db.from("users").select("user_id").eq("email", session.user.email).maybeSingle();
    userId = me?.user_id || null;
  }

  try {
    const job = await redirectMobileJobToWorkshop({ jobNumber, reason, userId });
    return res.status(200).json({ job, message: `Job ${jobNumber} redirected to workshop` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

export default withRoleGuard(handler, { allow: ALLOW });
