// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/api/hr/operations.js

import { getHrOperationsSnapshot } from "@/lib/database/hr";
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { HR_CORE_ROLES, MANAGER_SCOPED_ROLES } from "@/lib/auth/roles";

const ALLOWED_ROLES = Array.from(new Set([...HR_CORE_ROLES, ...MANAGER_SCOPED_ROLES].map((role) => role.toLowerCase())));

const handler = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  try {
    const data = await getHrOperationsSnapshot();
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ /api/hr/operations error", error);
    res.status(500).json({ success: false, message: "Failed to load HR datasets", error: error.message });
  }
};

export default withRoleGuard(handler, { allow: ALLOWED_ROLES });
