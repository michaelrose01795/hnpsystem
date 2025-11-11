// file location: src/pages/api/tracking/snapshot.js
import { fetchTrackingSnapshot } from "@/lib/database/tracking"; // import database helper

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const result = await fetchTrackingSnapshot();
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error?.message || "Failed to load tracking" });
    }

    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error("Tracking snapshot API error", error);
    return res.status(500).json({ success: false, message: error.message || "Unexpected error" });
  }
}
