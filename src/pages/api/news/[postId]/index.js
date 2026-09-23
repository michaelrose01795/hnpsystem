// file location: src/pages/api/news/[postId]/index.js
//
//   GET    /api/news/:postId   -> one post, decorated for the viewer
//   PATCH  /api/news/:postId   -> edit (snapshots the previous wording)
//   DELETE /api/news/:postId   -> soft delete
//
// Edit and delete rights are per-post: the author keeps them, moderators have
// them everywhere. The check runs against the stored post, never against what
// the client claims.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { deletePost, getPostById, incrementViewCount, updatePost } from "@/lib/database/newsFeed/posts";
import { canDeletePost, canEditPost } from "@/lib/news/permissions";
import { resolveViewer, assertIdentified, toApiError } from "@/lib/news/serverViewer";
import { isPostVisibleToDepartments } from "@/lib/news/constants";
import { getDisplayName } from "@/lib/users/displayName";

async function handler(req, res, session) {
  const viewer = resolveViewer(session, req);
  const { postId } = req.query;

  try {
    const post = await getPostById(postId, { viewerId: viewer.userId });
    if (!post) {
      return res.status(404).json({ success: false, message: "That update no longer exists." });
    }

    if (req.method === "GET") {
      const allowed =
        viewer.canSeeEverything ||
        isPostVisibleToDepartments(post.departments, viewer.departments) ||
        String(post.createdBy) === String(viewer.userId);

      if (!allowed) {
        return res.status(403).json({ success: false, message: "That update is not shared with you." });
      }

      // A view is a soft signal for the analytics; failing to record one must
      // never fail the read.
      void incrementViewCount(post.id).catch(() => {});
      return res.status(200).json({ success: true, data: post });
    }

    if (req.method === "PATCH") {
      assertIdentified(viewer);
      if (!canEditPost(post, { userRoles: viewer.roles, userId: viewer.userId })) {
        return res
          .status(403)
          .json({ success: false, message: "You do not have permission to edit that update." });
      }

      const updated = await updatePost(post.id, req.body || {}, {
        actorId: viewer.userId,
        actorName: getDisplayName(session?.user) || session?.user?.name || "System",
      });
      return res.status(200).json({ success: true, data: updated });
    }

    if (req.method === "DELETE") {
      assertIdentified(viewer);
      if (!canDeletePost(post, { userRoles: viewer.roles, userId: viewer.userId })) {
        return res
          .status(403)
          .json({ success: false, message: "You do not have permission to delete that update." });
      }

      await deletePost(post.id);
      return res.status(200).json({ success: true, data: { id: post.id } });
    }

    res.setHeader("Allow", ["GET", "PATCH", "DELETE"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error(`${req.method} /api/news/[postId] error:`, error);
    const { status, message } = toApiError(error, "Failed to load the update.");
    return res.status(status).json({ success: false, message });
  }
}

export default withRoleGuard(handler);
