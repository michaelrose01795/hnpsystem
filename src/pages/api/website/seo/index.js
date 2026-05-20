// file location: src/pages/api/website/seo/index.js
// GET /api/website/seo  -> array of every page's SEO entry.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { getSeoEntries } from "@/lib/database/website";

const WRITE_ROLES = ["owner", "admin", "admin manager", "general manager", "sales"];

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }
  const data = await getSeoEntries();
  return res.status(200).json({ success: true, data });
}

export default withRoleGuard(handler, { allow: WRITE_ROLES });
