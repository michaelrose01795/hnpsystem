// file location: src/pages/api/hr/dashboard.js
import { getHrDashboardSnapshot } from "../../../lib/database/hr";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const data = await getHrDashboardSnapshot();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ /api/hr/dashboard error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load HR dashboard data",
      error: error.message,
    });
  }
}
