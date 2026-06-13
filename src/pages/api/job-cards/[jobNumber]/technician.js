// file location: src/pages/api/job-cards/[jobNumber]/technician.js
// Assign or unassign the technician working a job (Scheduling dashboard →
// Technician Assignment section). POST { technicianId, technicianName } to
// assign; POST { technicianId: null } to unassign.
import { supabaseService } from "@/lib/database/supabaseClient";
import { resolveJobIdentity } from "@/lib/jobs/jobIdentity";
import {
  assignTechnicianToJob,
  unassignTechnicianFromJob,
} from "@/lib/database/jobs";
import { withRoleGuard } from "@/lib/auth/roleGuard";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { jobNumber: rawJobNumber } = req.query || {};
  if (!rawJobNumber) {
    return res.status(400).json({ success: false, error: "Job number is required" });
  }

  try {
    const identity = await resolveJobIdentity({
      client: supabaseService,
      identifier: rawJobNumber,
      select: "id, job_number",
    });
    if (!identity?.id) {
      return res.status(404).json({ success: false, error: "Job card not found" });
    }

    const { technicianId, technicianName } = req.body || {};
    const wantsUnassign =
      technicianId === null ||
      technicianId === "" ||
      typeof technicianId === "undefined";

    const result = wantsUnassign
      ? await unassignTechnicianFromJob(identity.id)
      : await assignTechnicianToJob(identity.id, technicianId, technicianName);

    if (!result?.success) {
      return res.status(400).json({
        success: false,
        error: result?.error?.message || "Failed to update technician assignment",
      });
    }

    return res.status(200).json({
      success: true,
      assignedTo: wantsUnassign ? null : Number(technicianId) || null,
    });
  } catch (error) {
    console.error("❌ /api/job-cards/[jobNumber]/technician error:", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Server error" });
  }
}

export default withRoleGuard(handler);
