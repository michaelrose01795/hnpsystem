// file location: src/pages/api/news/linked.js
//
//   GET /api/news/linked?recordType=job_card&recordId=24019
//
// The reverse of a post's link list: every announcement that references one
// DMS record. This is what lets a job card, a customer or a VHC show
// "mentioned in 2 announcements" without each of those pages knowing anything
// about the news schema.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { getPostsLinkedToRecord } from "@/lib/database/newsFeed/links";
import { getPostById } from "@/lib/database/newsFeed/posts";
import { isPostVisibleToDepartments } from "@/lib/news/constants";
import { resolveViewer, toApiError } from "@/lib/news/serverViewer";

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const viewer = resolveViewer(session, req);

  try {
    const links = await getPostsLinkedToRecord({
      recordType: req.query.recordType,
      recordId: req.query.recordId,
    });

    // Resolve each linked post so the caller gets a title and can honour the
    // same audience rules the feed does.
    const posts = await Promise.all(
      links.map((link) => getPostById(link.postId, { viewerId: viewer.userId }).catch(() => null))
    );

    const visible = posts
      .filter(Boolean)
      .filter(
        (post) =>
          viewer.canSeeEverything ||
          isPostVisibleToDepartments(post.departments, viewer.departments)
      )
      .map((post) => ({
        id: post.id,
        title: post.title,
        priority: post.priority,
        category: post.category,
        publishedAt: post.publishedAt,
        author: post.author,
        requiresAck: post.requiresAck,
      }));

    return res.status(200).json({ success: true, data: visible });
  } catch (error) {
    console.error("GET /api/news/linked error:", error);
    const { status, message } = toApiError(error, "Failed to load linked updates.");
    return res.status(status).json({ success: false, message });
  }
}

export default withRoleGuard(handler);
