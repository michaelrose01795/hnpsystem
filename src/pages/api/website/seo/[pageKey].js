// file location: src/pages/api/website/seo/[pageKey].js
// PATCH /api/website/seo/:pageKey  -> upsert SEO fields for a page.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { updateSeo, logActivity } from "@/lib/database/website";

const WRITE_ROLES = ["owner", "admin", "admin manager", "general manager", "sales"];

const actorFromSession = (session) =>
  session?.user?.username || session?.user?.name || session?.user?.email || "Staff User";

async function handler(req, res, session) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }
  const { pageKey } = req.query;
  const actor = actorFromSession(session);
  const result = await updateSeo(pageKey, req.body || {}, actor);
  if (!result.ok) {
    return res.status(500).json({ success: false, message: result.error });
  }
  await logActivity({
    actor,
    action: "Updated SEO",
    target: `${pageKey} meta details`,
    pageKey,
  });
  return res.status(200).json({ success: true, data: result.data });
}

export default withRoleGuard(handler, { allow: WRITE_ROLES });
