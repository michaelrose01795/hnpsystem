// file location: src/pages/api/news/[postId]/insights.js
//
//   GET /api/news/:postId/insights
//     -> { analytics, acknowledgements, revisions }
//
// The management view of one post. Analytics and the acknowledgement tracker
// need the tracking capability; the edit history does not — anyone who can see
// a post is entitled to see that it was changed and what it used to say.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { getPostAnalytics } from "@/lib/database/newsFeed/analytics";
import { getAcknowledgementTracking } from "@/lib/database/newsFeed/engagement";
import { getPostById, getPostRevisions } from "@/lib/database/newsFeed/posts";
import { isPostVisibleToDepartments } from "@/lib/news/constants";
import { resolveViewer, toApiError } from "@/lib/news/serverViewer";

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const viewer = resolveViewer(session, req);
  const { postId } = req.query;

  try {
    const post = await getPostById(postId, { viewerId: viewer.userId });
    if (!post) {
      return res.status(404).json({ success: false, message: "That update no longer exists." });
    }

    const visible =
      viewer.canSeeEverything ||
      isPostVisibleToDepartments(post.departments, viewer.departments) ||
      String(post.createdBy) === String(viewer.userId);

    if (!visible) {
      return res.status(403).json({ success: false, message: "That update is not shared with you." });
    }

    const isOwner = String(post.createdBy) === String(viewer.userId);
    const canTrack = viewer.canTrackAcknowledgements || isOwner;

    const [revisions, analytics, acknowledgements] = await Promise.all([
      getPostRevisions(post.id),
      canTrack ? getPostAnalytics(post.id) : Promise.resolve(null),
      canTrack && post.requiresAck
        ? getAcknowledgementTracking(post.id)
        : Promise.resolve(null),
    ]);

    return res.status(200).json({
      success: true,
      data: { revisions, analytics, acknowledgements, canTrack },
    });
  } catch (error) {
    console.error("GET /api/news/[postId]/insights error:", error);
    const { status, message } = toApiError(error, "Failed to load the post insights.");
    return res.status(status).json({ success: false, message });
  }
}

export default withRoleGuard(handler);
