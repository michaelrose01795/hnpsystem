// file location: src/pages/api/tracking/next-action.js
import {
  logNextActionEvents,
  recordAutomaticMovementForStatus,
  updateTrackingLocations,
} from "@/lib/database/tracking"; // import database helper
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import { createServerTimer } from "@/lib/perf/serverTiming";

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
    status,
  } = req.body || {};

  if (!actionType) {
    return res.status(400).json({ success: false, message: "actionType is required" });
  }

  const timer = createServerTimer();

  try {
    // "job_status_change" is the automatic movement. It is now owned by the
    // action that changed the status, not by a viewer's open /tracking tab, so
    // the actor comes from the session rather than the request body — a client
    // can no longer decide who a movement is attributed to. The rule table and
    // the job lookup are resolved server-side too, so the browser only has to
    // say "this job's status became X".
    if (actionType === "job_status_change") {
      let actorId = null;
      try {
        actorId = await timer.db("session-user", () => resolveSessionUserId(session));
      } catch {
        actorId = null; // unlinked staff account — record the movement unattributed
      }

      const result = await timer.db("auto-movement", () =>
        recordAutomaticMovementForStatus({
          jobId,
          status: status || vehicleStatus,
          performedBy: actorId,
        })
      );

      timer.applyTo(res);
      if (!result.success) {
        console.error("Tracking API failed", result.error);
        return res
          .status(500)
          .json({ success: false, message: result.error?.message || "Failed to log action" });
      }
      return res.status(200).json({ success: true, data: result.data });
    }

    const result =
      actionType === "location_update"
        ? await timer.db("location-update", () =>
            updateTrackingLocations({
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
          )
        : await timer.db("next-action", () =>
            logNextActionEvents({
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
          );

    timer.applyTo(res);

    if (!result.success) {
      console.error("Tracking API failed", result.error);
      return res.status(500).json({ success: false, message: result.error?.message || "Failed to log action" });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error("Next action API error", error);
    timer.applyTo(res);
    return res.status(500).json({ success: false, message: error.message || "Unexpected error" });
  }
}

export default withRoleGuard(handler);
