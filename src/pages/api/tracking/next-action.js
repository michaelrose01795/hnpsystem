// file location: src/pages/api/tracking/next-action.js
import { logNextActionEvents, updateTrackingLocations } from "@/lib/database/tracking"; // import database helper
import { withRoleGuard } from "@/lib/auth/roleGuard";

async function handler(req, res, session) {
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
    vehicleStatus,
  } = req.body || {};

  if (!actionType) {
    return res.status(400).json({ success: false, message: "actionType is required" });
  }

  try {
    // Debug logs removed after troubleshooting.
    const result =
      actionType === "location_update"
        ? await updateTrackingLocations({
            actionType,
            jobId,
            jobNumber,
            vehicleId,
            vehicleReg,
            keyLocation,
            vehicleLocation,
            notes,
            performedBy,
            vehicleStatus,
          })
        : await logNextActionEvents({
            actionType,
            jobId,
            jobNumber,
            vehicleId,
            vehicleReg,
            keyLocation,
            vehicleLocation,
            notes,
            performedBy,
            vehicleStatus,
            // "job_status_change" is the automatic movement fired from the
            // /tracking realtime subscription, which runs in every browser with
            // the page open. Without this, one status change wrote one key event
            // and one vehicle event per viewer, each credited to a different
            // member of staff. Every other actionType is an explicit user action
            // in one browser and keeps the unconditional insert.
            deduplicate: actionType === "job_status_change",
          });

    if (!result.success) {
      console.error("Tracking API failed", result.error);
      return res.status(500).json({ success: false, message: result.error?.message || "Failed to log action" });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error("Next action API error", error);
    return res.status(500).json({ success: false, message: error.message || "Unexpected error" });
  }
}

export default withRoleGuard(handler);
