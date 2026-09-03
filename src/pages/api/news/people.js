// file location: src/pages/api/news/people.js
//
//   GET /api/news/people?q=sam  -> staff the composer can @mention
//
// Deliberately thin: name, photo and job title only, and active staff only.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { searchMentionableUsers } from "@/lib/database/newsFeed/mentions";
import { toApiError } from "@/lib/news/serverViewer";

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const people = await searchMentionableUsers(req.query.q || "", {
      limit: Math.min(Math.max(Number(req.query.limit) || 8, 1), 25),
    });
    return res.status(200).json({ success: true, data: people });
  } catch (error) {
    console.error("GET /api/news/people error:", error);
    const { status, message } = toApiError(error, "Failed to load staff.");
    return res.status(status).json({ success: false, message });
  }
}

export default withRoleGuard(handler);
