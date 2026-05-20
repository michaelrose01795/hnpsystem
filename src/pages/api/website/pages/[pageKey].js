// file location: src/pages/api/website/pages/[pageKey].js
//
// PATCH /api/website/pages/:pageKey { status: "published" | "draft" }
// Updates a page's published/draft state and stamps the editor + timestamp.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { setPageStatus, logActivity } from "@/lib/database/website";

const WRITE_ROLES = ["owner", "admin", "admin manager", "general manager", "sales"];

const actorFromSession = (session) =>
  session?.user?.username || session?.user?.name || session?.user?.email || "Staff User";

async function handler(req, res, session) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }
  const { pageKey } = req.query;
  const { status } = req.body || {};
  if (status !== "published" && status !== "draft") {
    return res.status(400).json({
      success: false,
      message: 'Body must include status: "published" | "draft".',
    });
  }
  const actor = actorFromSession(session);
  const result = await setPageStatus(pageKey, status, actor);
  if (!result.ok) {
    return res.status(500).json({ success: false, message: result.error });
  }
  await logActivity({
    actor,
    action: `Set page status to ${status === "published" ? "Published" : "Draft"}`,
    target: result.data?.name || pageKey,
    pageKey,
  });
  return res.status(200).json({ success: true, data: result.data });
}

export default withRoleGuard(handler, { allow: WRITE_ROLES });
