// file location: src/pages/api/tracking/next-action.js
import { logNextActionEvents } from "@/lib/database/tracking"; // import database helper

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const {
    actionType,
    jobId,
    jobNumber,
    vehicleId,
    vehicleReg,
    keyLocation,
    vehicleLocation,
    notes,
    performedBy,
  } = req.body || {};

  if (!actionType) {
    return res.status(400).json({ success: false, message: "actionType is required" });
  }

  try {
    const result = await logNextActionEvents({
      actionType,
      jobId,
      jobNumber,
      vehicleId,
      vehicleReg,
      keyLocation,
      vehicleLocation,
      notes,
      performedBy,
    });

    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error?.message || "Failed to log action" });
    }

    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error("Next action API error", error);
    return res.status(500).json({ success: false, message: error.message || "Unexpected error" });
  }
}
