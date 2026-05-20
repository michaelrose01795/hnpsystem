// file location: src/pages/api/website/activity/index.js
// GET /api/website/activity  -> recent rows from website_activity, newest first.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { getRecentActivity } from "@/lib/database/website";

const WRITE_ROLES = ["owner", "admin", "admin manager", "general manager", "sales"];

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const data = await getRecentActivity(limit);
  return res.status(200).json({ success: true, data });
}

export default withRoleGuard(handler, { allow: WRITE_ROLES });
