// file location: src/pages/api/news/search.js
//
//   GET /api/news/search?q=...&categories=a,b&priorities=urgent&departments=Parts
//                        &authorId=12&requiresAck=true&from=...&to=...&includeArchived=true
//
// News-specific search. Runs against the same audience rules as the feed, so a
// search can never surface a post the viewer is not entitled to read.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { searchNews } from "@/lib/database/newsFeed/search";
import { resolveViewer, toApiError } from "@/lib/news/serverViewer";

const list = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const viewer = resolveViewer(session, req);

  try {
    const results = await searchNews({
      term: req.query.q || "",
      userId: viewer.userId,
      viewerDepartments: viewer.departments,
      canSeeEverything: viewer.canSeeEverything,
      limit: Math.min(Math.max(Number(req.query.limit) || 60, 1), 200),
      filters: {
        categories: list(req.query.categories),
        priorities: list(req.query.priorities),
        departments: list(req.query.departments),
        authorId: req.query.authorId,
        requiresAck: req.query.requiresAck === "true",
        from: req.query.from || null,
        to: req.query.to || null,
        includeArchived: req.query.includeArchived === "true",
      },
    });

    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error("GET /api/news/search error:", error);
    const { status, message } = toApiError(error, "Failed to search the news feed.");
    return res.status(status).json({ success: false, message });
  }
}

export default withRoleGuard(handler);
