// file location: src/pages/api/hr/attendance.js
import { getHrAttendanceSnapshot } from "../../../lib/database/hr";

export default async function handler(req, res) {
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
