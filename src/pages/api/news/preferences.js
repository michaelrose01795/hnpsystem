// file location: src/pages/api/news/preferences.js
//
//   GET /api/news/preferences  -> this user's notification + display settings
//   PUT /api/news/preferences  -> save them (partial updates are merged)

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { getPreferences, savePreferences } from "@/lib/database/newsFeed/preferences";
import { assertIdentified, resolveViewer, toApiError } from "@/lib/news/serverViewer";

async function handler(req, res, session) {
  const viewer = resolveViewer(session, req);

  try {
    if (req.method === "GET") {
      const preferences = await getPreferences(viewer.userId);
      return res.status(200).json({ success: true, data: preferences });
    }

    if (req.method === "PUT") {
      const userId = assertIdentified(viewer);
      const preferences = await savePreferences(userId, req.body || {});
      return res.status(200).json({ success: true, data: preferences });
    }

    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error(`${req.method} /api/news/preferences error:`, error);
    const { status, message } = toApiError(error, "Failed to load your preferences.");
    return res.status(status).json({ success: false, message });
  }
}

export default withRoleGuard(handler);
