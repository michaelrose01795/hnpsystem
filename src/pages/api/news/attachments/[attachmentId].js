// file location: src/pages/api/news/attachments/[attachmentId].js
//
//   GET    /api/news/attachments/:id  -> redirect to a short-lived signed URL
//   DELETE /api/news/attachments/:id  -> remove the file and its metadata
//
// The storage bucket is private, so this guarded route is the only way to
// reach the bytes. Visibility follows the post the file is attached to.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { deleteAttachment, getAttachmentDownload } from "@/lib/database/newsFeed/attachments";
import { getPostById } from "@/lib/database/newsFeed/posts";
import { isPostVisibleToDepartments } from "@/lib/news/constants";
import { assertIdentified, resolveViewer, toApiError } from "@/lib/news/serverViewer";

async function handler(req, res, session) {
  const viewer = resolveViewer(session, req);
  const { attachmentId } = req.query;

  try {
    if (req.method === "GET") {
      const attachment = await getAttachmentDownload(attachmentId);
      if (!attachment?.signedUrl) {
        return res.status(404).json({ success: false, message: "That file is no longer available." });
      }

      // A file still parked on a composer draft has no post to inherit
      // visibility from; only the uploader's own session reaches it, and the
      // capability check above already limits that to publishers.
      if (attachment.postId) {
        const post = await getPostById(attachment.postId, { viewerId: viewer.userId });
        const allowed =
          !post ||
          viewer.canSeeEverything ||
          isPostVisibleToDepartments(post.departments, viewer.departments) ||
          String(post.createdBy) === String(viewer.userId);

        if (!allowed) {
          return res
            .status(403)
            .json({ success: false, message: "That file is not shared with you." });
        }
      } else if (!viewer.canPublish) {
        return res.status(403).json({ success: false, message: "That file is not shared with you." });
      }

      res.setHeader("Cache-Control", "private, max-age=0, no-store");
      return res.redirect(302, attachment.signedUrl);
    }

    if (req.method === "DELETE") {
      const userId = assertIdentified(viewer);
      const result = await deleteAttachment({
        attachmentId,
        userId,
        canModerate: viewer.canModerate,
      });
      return res.status(200).json({ success: true, data: result });
    }

    res.setHeader("Allow", ["GET", "DELETE"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error(`${req.method} /api/news/attachments/[attachmentId] error:`, error);
    const { status, message } = toApiError(error, "Failed to fetch the attachment.");
    return res.status(status).json({ success: false, message });
  }
}

export default withRoleGuard(handler);
