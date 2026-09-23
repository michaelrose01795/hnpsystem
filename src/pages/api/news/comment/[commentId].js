// file location: src/pages/api/news/comment/[commentId].js
//
//   PATCH  /api/news/comment/:commentId  -> edit your own comment
//   DELETE /api/news/comment/:commentId  -> soft-delete (yours, or any if you moderate)

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { deleteComment, updateComment } from "@/lib/database/newsFeed/comments";
import { assertIdentified, resolveViewer, toApiError } from "@/lib/news/serverViewer";

async function handler(req, res, session) {
  const viewer = resolveViewer(session, req);
  const { commentId } = req.query;

  try {
    const userId = assertIdentified(viewer);

    if (req.method === "PATCH") {
      const comment = await updateComment({ commentId, userId, body: req.body?.body });
      return res.status(200).json({ success: true, data: comment });
    }

    if (req.method === "DELETE") {
      const result = await deleteComment({
        commentId,
        userId,
        canModerate: viewer.canModerate,
      });
      return res.status(200).json({ success: true, data: result });
    }

    res.setHeader("Allow", ["PATCH", "DELETE"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error(`${req.method} /api/news/comment/[commentId] error:`, error);
    const { status, message } = toApiError(error, "Failed to update the comment.");
    return res.status(status).json({ success: false, message });
  }
}

export default withRoleGuard(handler);
