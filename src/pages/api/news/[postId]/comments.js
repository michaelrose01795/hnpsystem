// file location: src/pages/api/news/[postId]/comments.js
//
//   GET  /api/news/:postId/comments  -> the thread, nested one level deep
//   POST /api/news/:postId/comments  -> add a comment or a reply
//
// Editing and deleting a single comment lives at /api/news/comment/[commentId].

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { createComment, getComments } from "@/lib/database/newsFeed/comments";
import { getPostById } from "@/lib/database/newsFeed/posts";
import { isPostVisibleToDepartments } from "@/lib/news/constants";
import { assertIdentified, resolveViewer, toApiError } from "@/lib/news/serverViewer";

async function handler(req, res, session) {
  const viewer = resolveViewer(session, req);
  const { postId } = req.query;

  try {
    const post = await getPostById(postId, { viewerId: viewer.userId });
    if (!post) {
      return res.status(404).json({ success: false, message: "That update no longer exists." });
    }

    // Commenting follows visibility: if the post is not shared with you, its
    // thread is not either.
    const allowed =
      viewer.canSeeEverything ||
      isPostVisibleToDepartments(post.departments, viewer.departments) ||
      String(post.createdBy) === String(viewer.userId);

    if (!allowed) {
      return res.status(403).json({ success: false, message: "That update is not shared with you." });
    }

    if (req.method === "GET") {
      const comments = await getComments(post.id);
      return res.status(200).json({ success: true, data: comments });
    }

    if (req.method === "POST") {
      const userId = assertIdentified(viewer);
      const comment = await createComment({
        postId: post.id,
        userId,
        body: req.body?.body,
        parentId: req.body?.parentId || null,
      });
      return res.status(201).json({ success: true, data: comment });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error(`${req.method} /api/news/[postId]/comments error:`, error);
    const { status, message } = toApiError(error, "Failed to load the comments.");
    return res.status(status).json({ success: false, message });
  }
}

export default withRoleGuard(handler);
