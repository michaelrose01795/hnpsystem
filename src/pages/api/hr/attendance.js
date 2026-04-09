// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/api/hr/attendance.js
import { getHrAttendanceSnapshot } from "@/lib/database/hr";
import { withRoleGuard } from "@/lib/auth/roleGuard"; // Role-based access control wrapper.
import { HR_CORE_ROLES } from "@/lib/auth/roles"; // Allowed roles for HR endpoints.

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const data = await getHrAttendanceSnapshot();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ /api/hr/attendance error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load attendance data",
      error: error.message,
    });
  }
}

export default withRoleGuard(handler, { allow: HR_CORE_ROLES }); // Protect route with HR role check.
