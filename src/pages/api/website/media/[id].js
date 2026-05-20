// file location: src/pages/api/website/media/[id].js
// DELETE /api/website/media/:id  -> remove a media asset row.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { deleteMedia, logActivity } from "@/lib/database/website";

const WRITE_ROLES = ["owner", "admin", "admin manager", "general manager", "sales"];

const actorFromSession = (session) =>
  session?.user?.username || session?.user?.name || session?.user?.email || "Staff User";

async function handler(req, res, session) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }
  const { id } = req.query;
  const result = await deleteMedia(id);
  if (!result.ok) {
    return res.status(500).json({ success: false, message: result.error });
  }
  await logActivity({
    actor: actorFromSession(session),
    action: "Deleted media",
    target: id,
    pageKey: null,
  });
  return res.status(200).json({ success: true });
}

export default withRoleGuard(handler, { allow: WRITE_ROLES });
