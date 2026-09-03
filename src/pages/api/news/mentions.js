// file location: src/pages/api/news/mentions.js
//
//   GET  /api/news/mentions        -> unseen @mentions for the signed-in user
//   POST /api/news/mentions        -> { postId? } mark them seen
//
// Feeds the "Mentions" filter and the unread mention counter.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { getUnseenMentions, markMentionsSeen } from "@/lib/database/newsFeed/mentions";
import { assertIdentified, resolveViewer, toApiError } from "@/lib/news/serverViewer";

async function handler(req, res, session) {
  const viewer = resolveViewer(session, req);

  try {
    if (req.method === "GET") {
      const mentions = await getUnseenMentions(viewer.userId);
      return res.status(200).json({ success: true, data: mentions });
    }

    if (req.method === "POST") {
      const userId = assertIdentified(viewer);
      const cleared = await markMentionsSeen({ userId, postId: req.body?.postId || null });
      return res.status(200).json({ success: true, data: { cleared } });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error(`${req.method} /api/news/mentions error:`, error);
    const { status, message } = toApiError(error, "Failed to load your mentions.");
    return res.status(status).json({ success: false, message });
  }
}

export default withRoleGuard(handler);
