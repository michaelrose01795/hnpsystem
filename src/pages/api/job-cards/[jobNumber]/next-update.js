// file location: src/pages/api/job-cards/[jobNumber]/next-update.js
// Set (or clear) the customer "next update due" time for a job
// (Scheduling dashboard → Customer Updates section).
// POST { nextUpdateDue: ISO string | null }.
import { supabaseService } from "@/lib/database/supabaseClient";
import { resolveJobIdentity } from "@/lib/jobs/jobIdentity";
import { setJobNextUpdateDue } from "@/lib/database/jobs";
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

    const { nextUpdateDue } = req.body || {};
    let normalized = null;
    if (nextUpdateDue) {
      const parsed = new Date(nextUpdateDue);
      if (Number.isNaN(parsed.getTime())) {
        return res
          .status(400)
          .json({ success: false, error: "nextUpdateDue is not a valid date" });
      }
      normalized = parsed.toISOString();
    }

    const result = await setJobNextUpdateDue(identity.id, normalized);
    if (!result?.success) {
      return res.status(400).json({
        success: false,
        error: result?.error?.message || "Failed to set next update time",
      });
    }

    return res.status(200).json({ success: true, nextUpdateDue: normalized });
  } catch (error) {
    console.error("❌ /api/job-cards/[jobNumber]/next-update error:", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Server error" });
  }
}

export default withRoleGuard(handler);
