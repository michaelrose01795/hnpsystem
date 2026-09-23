// file location: src/pages/api/news/[postId]/manage.js
//
//   POST /api/news/:postId/manage  { action: "pin" | "unpin" | "status", status? }
//
// Management-only transitions that are not an edit: pinning a post to the top
// of everyone's feed, and moving it between draft / scheduled / published /
// archived.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { getPostById, setPinned, setStatus } from "@/lib/database/newsFeed/posts";
import { canEditPost } from "@/lib/news/permissions";
import { assertIdentified, resolveViewer, toApiError } from "@/lib/news/serverViewer";

async function handler(req, res, session) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const viewer = resolveViewer(session, req);
  const { postId } = req.query;
  const action = String(req.body?.action || "").trim();

  try {
    assertIdentified(viewer);

    const post = await getPostById(postId, { viewerId: viewer.userId });
    if (!post) {
      return res.status(404).json({ success: false, message: "That update no longer exists." });
    }

    if (action === "pin" || action === "unpin") {
      if (!viewer.canPin) {
        return res
          .status(403)
          .json({ success: false, message: "You do not have permission to pin updates." });
      }
      const updated = await setPinned(post.id, {
        pinned: action === "pin",
        actorId: viewer.userId,
      });
      return res.status(200).json({ success: true, data: updated });
    }

    if (action === "status") {
      if (!canEditPost(post, { userRoles: viewer.roles, userId: viewer.userId })) {
        return res
          .status(403)
          .json({ success: false, message: "You do not have permission to change that update." });
      }
      const updated = await setStatus(post.id, req.body?.status, { actorId: viewer.userId });
      return res.status(200).json({ success: true, data: updated });
    }

    return res
      .status(400)
      .json({ success: false, message: "action must be one of: pin, unpin, status." });
  } catch (error) {
    console.error("POST /api/news/[postId]/manage error:", error);
    const { status, message } = toApiError(error, "Failed to update the post.");
    return res.status(status).json({ success: false, message });
  }
}

export default withRoleGuard(handler);
