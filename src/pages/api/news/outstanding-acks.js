// file location: src/pages/api/news/outstanding-acks.js
//
//   GET /api/news/outstanding-acks -> how many published updates the signed-in
//   viewer still owes an acknowledgement on, and the due date being chased
//   hardest.
//
// This is the news-feed counterpart of /api/messages/unread-count: the sidebar
// badge needs one small number, so it gets one small route rather than pulling
// the whole feed (posts, attachments, links, comment counts) down and counting
// it in the browser.
//
// Audience filtering is the same rule GET /api/news applies, so the badge can
// never chase an update the viewer would not be shown in the feed itself.
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { getOutstandingAckSummary } from "@/lib/database/newsFeed/engagement";
import { resolveViewer, toApiError } from "@/lib/news/serverViewer";

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const viewer = resolveViewer(session, req);

  // An unidentified viewer (a dev-bypass or unlinked session) has no
  // acknowledgement record to chase. That is an empty badge, not an error.
  if (!viewer.userId) {
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({
      success: true,
      data: { count: 0, overdueCount: 0, dueAt: null, isOverdue: false },
    });
  }

  try {
    const summary = await getOutstandingAckSummary(viewer.userId, {
      viewerDepartments: viewer.departments,
      canSeeEverything: viewer.canSeeEverything,
    });

    // Per-user and session-bound: never store it anywhere shared.
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({ success: true, data: summary });
  } catch (error) {
    console.error("GET /api/news/outstanding-acks error:", error);
    const { status, message } = toApiError(
      error,
      "Failed to load your outstanding acknowledgements."
    );
    return res.status(status).json({ success: false, message });
  }
}

export default withRoleGuard(handler);
