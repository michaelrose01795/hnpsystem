// file location: src/pages/api/news/index.js
//
//   GET  /api/news            -> the feed for the signed-in viewer, already
//                                audience-filtered, sorted and decorated.
//   POST /api/news            -> publish (or save as a draft / schedule) a post.
//
// Audience filtering happens on the server: a post targeted at HR is never
// sent to a browser signed in as a technician.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { createPost, getFeed } from "@/lib/database/newsFeed/posts";
import { getPreferences } from "@/lib/database/newsFeed/preferences";
import { getDisplayName } from "@/lib/users/displayName";
import {
  assertCapability,
  assertIdentified,
  resolveViewer,
  toApiError,
} from "@/lib/news/serverViewer";

async function handler(req, res, session) {
  const viewer = resolveViewer(session, req);

  if (req.method === "GET") {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
      const [posts, preferences] = await Promise.all([
        getFeed({
          userId: viewer.userId,
          viewerDepartments: viewer.departments,
          canSeeEverything: viewer.canSeeEverything,
          includeArchived: req.query.includeArchived === "true",
          limit,
        }),
        getPreferences(viewer.userId),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          posts,
          preferences,
          viewer: {
            userId: viewer.userId,
            departments: viewer.departments,
            canPublish: viewer.canPublish,
            canPin: viewer.canPin,
            canModerate: viewer.canModerate,
            canTrackAcknowledgements: viewer.canTrackAcknowledgements,
            canViewAnalytics: viewer.canViewAnalytics,
          },
        },
      });
    } catch (error) {
      console.error("GET /api/news error:", error);
      const { status, message } = toApiError(error, "Failed to load the news feed.");
      return res.status(status).json({ success: false, message });
    }
  }

  if (req.method === "POST") {
    try {
      assertIdentified(viewer);
      assertCapability(viewer, "canPublish", "You do not have permission to publish updates.");

      const post = await createPost(req.body || {}, {
        actorId: viewer.userId,
        actorName: getDisplayName(session?.user) || session?.user?.name || "System",
      });

      return res.status(201).json({ success: true, data: post });
    } catch (error) {
      console.error("POST /api/news error:", error);
      const { status, message } = toApiError(error, "Failed to publish the update.");
      return res.status(status).json({ success: false, message });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}

export default withRoleGuard(handler);
