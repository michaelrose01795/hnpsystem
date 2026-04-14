// file location: src/pages/api/mobile/parts-request.js
// Thin wrapper that lets a mobile technician request parts for one of their jobs.
// Writes to the existing parts_requests table so parts department visibility is unchanged.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { MOBILE_TECH_ROLES } from "@/lib/auth/roles";
import { getDatabaseClient } from "@/lib/database/client";
import { logActivity } from "@/lib/database/activity_logs";

async function handler(req, res, session) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { jobNumber, description, quantity = 1 } = req.body || {};
  if (!jobNumber || !description) {
    return res.status(400).json({ message: "jobNumber and description are required" });
  }

  const db = getDatabaseClient();

  const { data: job, error: jobErr } = await db
    .from("jobs")
    .select("id, job_number, service_mode")
    .eq("job_number", jobNumber)
    .maybeSingle();
  if (jobErr) return res.status(500).json({ message: jobErr.message });
  if (!job) return res.status(404).json({ message: "Job not found" });

  let userId = null;
  if (session.user?.email) {
    const { data: me } = await db.from("users").select("user_id").eq("email", session.user.email).maybeSingle();
    userId = me?.user_id || null;
  }

  const { data: request, error: insertErr } = await db
    .from("parts_requests")
    .insert([{
      job_id: job.id,
      requested_by: userId,
      description,
      quantity,
      status: "pending",
      source: "mobile",
    }])
    .select("request_id, status")
    .maybeSingle();
  if (insertErr) return res.status(500).json({ message: insertErr.message });

  await logActivity({
    userId,
    action: `mobile_parts_requested:${jobNumber} ${description}`,
    tableName: "parts_requests",
    recordId: request?.request_id,
  });

  return res.status(200).json({ request, message: "Parts request submitted" });
}

export default withRoleGuard(handler, { allow: MOBILE_TECH_ROLES });
