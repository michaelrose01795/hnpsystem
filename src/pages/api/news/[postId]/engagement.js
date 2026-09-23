// file location: src/pages/api/news/[postId]/engagement.js
//
//   POST /api/news/:postId/engagement  { action }
//
// One route for the four things a reader does to a post, because they share an
// identical guard and an identical response shape:
//
//   read        mark as read (also sent in bulk from the feed as posts scroll in)
//   unread      put it back in the Unread filter
//   acknowledge record a required sign-off (implies read)
//   save        bookmark it
//   unsave      remove the bookmark

import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  acknowledgePost,
  markPostUnread,
  markPostsRead,
  setBookmark,
} from "@/lib/database/newsFeed/engagement";
import { markMentionsSeen } from "@/lib/database/newsFeed/mentions";
import { assertIdentified, resolveViewer, toApiError } from "@/lib/news/serverViewer";

const ACTIONS = ["read", "unread", "acknowledge", "save", "unsave"];

async function handler(req, res, session) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const viewer = resolveViewer(session, req);
  const { postId } = req.query;
  const action = String(req.body?.action || "").trim();

  if (!ACTIONS.includes(action)) {
    return res
      .status(400)
      .json({ success: false, message: `action must be one of: ${ACTIONS.join(", ")}.` });
  }

  try {
    const userId = assertIdentified(viewer);

    switch (action) {
      case "read": {
        // Opening a post also clears any mention notification it carried.
        await Promise.all([
          markPostsRead({ userId, postIds: [postId] }),
          markMentionsSeen({ userId, postId }),
        ]);
        return res.status(200).json({ success: true, data: { postId, isRead: true } });
      }
      case "unread": {
        await markPostUnread({ userId, postId });
        return res.status(200).json({ success: true, data: { postId, isRead: false } });
      }
      case "acknowledge": {
        const result = await acknowledgePost({ userId, postId });
        return res.status(200).json({ success: true, data: { ...result, isRead: true } });
      }
      case "save":
      case "unsave": {
        const result = await setBookmark({ userId, postId, saved: action === "save" });
        return res.status(200).json({ success: true, data: result });
      }
      default:
        return res.status(400).json({ success: false, message: "Unknown action." });
    }
  } catch (error) {
    console.error("POST /api/news/[postId]/engagement error:", error);
    const { status, message } = toApiError(error, "Failed to update the post.");
    return res.status(status).json({ success: false, message });
  }
}

export default withRoleGuard(handler);
