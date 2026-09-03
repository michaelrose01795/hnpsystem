// file location: src/pages/api/news/analytics.js
//
//   GET /api/news/analytics?days=30
//
// Hub-wide reach and engagement reporting. Management / HR core / audit admins
// only — the per-post view a publisher gets lives on the post's own insights
// route.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { getHubAnalytics } from "@/lib/database/newsFeed/analytics";
import { assertCapability, resolveViewer, toApiError } from "@/lib/news/serverViewer";

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const viewer = resolveViewer(session, req);

  try {
    assertCapability(viewer, "canViewAnalytics", "You do not have access to feed analytics.");
    const data = await getHubAnalytics({ days: Number(req.query.days) || 30 });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("GET /api/news/analytics error:", error);
    const { status, message } = toApiError(error, "Failed to load feed analytics.");
    return res.status(status).json({ success: false, message });
  }
}

export default withRoleGuard(handler);
