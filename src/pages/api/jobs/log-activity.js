// file location: src/pages/api/jobs/log-activity.js
// Generic logging endpoint used by client code (health check editor, parts add
// flows, file rename/delete UIs) to record an entry on the Job Tracker. The
// authenticated user is captured server-side from the session so client cannot
// spoof another user's identity.
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { logJobActivity, resolveJobIdByNumber } from "@/lib/database/jobActivity";

async function handler(req, res, session) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const {
    jobId: rawJobId,
    jobNumber,
    category,
    action,
    summary,
    targetType,
    targetId,
    payload,
  } = req.body || {};

  if (!category || !action || !summary) {
    return res
      .status(400)
      .json({ success: false, message: "category, action and summary are required" });
  }

  let jobId = Number(rawJobId);
  if (!Number.isFinite(jobId) || jobId <= 0) {
    jobId = await resolveJobIdByNumber(jobNumber);
  }
  if (!jobId) {
    return res.status(404).json({ success: false, message: "Job not found" });
  }

  const performedBy = session?.user?.user_id || session?.user?.id || null;

  const result = await logJobActivity({
    jobId,
    category,
    action,
    summary,
    targetType,
    targetId,
    payload,
    performedBy,
  });
  if (!result.success) {
    return res.status(500).json({ success: false, message: result.error || "Log failed" });
  }
  return res.status(200).json({ success: true });
}

export default withRoleGuard(handler);
