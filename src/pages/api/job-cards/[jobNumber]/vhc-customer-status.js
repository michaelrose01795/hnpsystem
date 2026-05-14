// file location: src/pages/api/job-cards/[jobNumber]/vhc-customer-status.js
import { supabaseService } from "@/lib/database/supabaseClient";
import { resolveJobIdentity } from "@/lib/jobs/jobIdentity";
import { withRoleGuard } from "@/lib/auth/roleGuard";

const LINK_EXPIRY_MS = 24 * 60 * 60 * 1000;

const isLinkExpired = (createdAt) => {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return true;
  return Date.now() - created > LINK_EXPIRY_MS;
};

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: `Method ${req.method} not allowed` });
  }

  if (!supabaseService) {
    return res.status(500).json({ success: false, message: "Service role key is not configured" });
  }

  const { jobNumber: rawJobNumber } = req.query || {};
  if (!rawJobNumber) {
    return res.status(400).json({ success: false, message: "Job number is required" });
  }

  try {
    const identity = await resolveJobIdentity({
      client: supabaseService,
      identifier: rawJobNumber,
      select: "id, job_number",
    });

    if (!identity?.id) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const { data: jobRow, error: jobError } = await supabaseService
      .from("jobs")
      .select("id, job_number, vhc_completed_at, vhc_sent_at")
      .eq("id", identity.id)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!jobRow) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const [{ data: latestLinks, error: linkError }, { data: latestSends, error: sendError }] =
      await Promise.all([
        supabaseService
          .from("job_share_links")
          .select("link_code, created_at, viewed_at")
          .eq("job_id", jobRow.id)
          .order("created_at", { ascending: false })
          .limit(1),
        supabaseService
          .from("vhc_send_history")
          .select("sent_at")
          .eq("job_id", jobRow.id)
          .order("sent_at", { ascending: false })
          .limit(1),
      ]);

    if (linkError) throw linkError;
    if (sendError) throw sendError;

    const latestLink = Array.isArray(latestLinks) ? latestLinks[0] : null;
    const latestSend = Array.isArray(latestSends) ? latestSends[0] : null;
    const sentAt = jobRow.vhc_sent_at || latestSend?.sent_at || null;
    const viewedAt =
      latestLink?.viewed_at && !isLinkExpired(latestLink.created_at)
        ? latestLink.viewed_at
        : null;

    const status = viewedAt ? "viewed" : sentAt ? "sent" : "pending";

    return res.status(200).json({
      success: true,
      status,
      label: status === "viewed" ? "Viewed" : status === "sent" ? "Sent" : "Pending",
      sentAt,
      viewedAt,
      readyAt: jobRow.vhc_completed_at || null,
      linkCreatedAt: latestLink?.created_at || null,
    });
  } catch (error) {
    console.error("Failed to load VHC customer status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load VHC customer status",
      error: error?.message || String(error),
    });
  }
}

export default withRoleGuard(handler);
