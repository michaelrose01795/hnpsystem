// file location: src/pages/api/mobile/jobs/[jobNumber]/index.js
// Fetch a single mobile job by job_number.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { MOBILE_TECH_ROLES, MANAGER_SCOPED_ROLES, HR_MANAGER_ROLES } from "@/lib/auth/roles";
import { getMobileJobByNumber } from "@/lib/mobile/mobileJobs";

const ALLOW = [...MOBILE_TECH_ROLES, ...MANAGER_SCOPED_ROLES, ...HR_MANAGER_ROLES, "service", "service manager"];

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: "Method not allowed" });
  }
  const { jobNumber } = req.query;
  try {
    const job = await getMobileJobByNumber(jobNumber);
    if (!job) return res.status(404).json({ message: "Mobile job not found" });
    return res.status(200).json({ job });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

export default withRoleGuard(handler, { allow: ALLOW });
