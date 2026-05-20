// file location: src/pages/api/website/media/index.js
//
// GET  /api/website/media       -> list every media asset
// POST /api/website/media       -> upsert one (used by add + replace)
//
// File contents themselves are NOT handled here yet - the body just carries
// the row metadata (id, name, url, used_on, etc.). Phase 4+ will swap this
// for a Supabase Storage-backed multipart upload.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { getMedia, upsertMedia, logActivity } from "@/lib/database/website";

const WRITE_ROLES = ["owner", "admin", "admin manager", "general manager", "sales"];

const actorFromSession = (session) =>
  session?.user?.username || session?.user?.name || session?.user?.email || "Staff User";

async function handler(req, res, session) {
  if (req.method === "GET") {
    const data = await getMedia();
    return res.status(200).json({ success: true, data });
  }
  if (req.method === "POST") {
    const asset = { ...(req.body || {}), uploaded_by: actorFromSession(session) };
    if (!asset.id || !asset.url) {
      return res.status(400).json({
        success: false,
        message: "Media payload requires id and url.",
      });
    }
    const result = await upsertMedia(asset);
    if (!result.ok) {
      return res.status(500).json({ success: false, message: result.error });
    }
    await logActivity({
      actor: asset.uploaded_by,
      action: "Saved media",
      target: asset.name || asset.id,
      pageKey: null,
    });
    return res.status(201).json({ success: true, data: result.data });
  }
  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ success: false, message: "Method Not Allowed" });
}

export default withRoleGuard(handler, { allow: WRITE_ROLES });
