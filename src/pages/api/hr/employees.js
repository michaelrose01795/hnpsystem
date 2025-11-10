// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/api/hr/employees.js
import { getEmployeeDirectory } from "@/lib/database/hr";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const data = await getEmployeeDirectory();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ /api/hr/employees error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load employee directory",
      error: error.message,
    });
  }
}
