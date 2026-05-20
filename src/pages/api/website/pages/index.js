// file location: src/pages/api/website/pages/index.js
//
// GET /api/website/pages
// Returns every page row (the staff Manager's "Pages Overview" list).
//
// Page-status mutation lives at /api/website/pages/[pageKey].

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { getPages } from "@/lib/database/website";

const WRITE_ROLES = ["owner", "admin", "admin manager", "general manager", "sales"];

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }
  const data = await getPages();
  return res.status(200).json({ success: true, data });
}

export default withRoleGuard(handler, { allow: WRITE_ROLES });
