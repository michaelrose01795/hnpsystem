// file location: src/pages/api/website/sections/[section]/reorder.js
//
// POST /api/website/sections/:section/reorder
// Body: { ids: ["row-a", "row-b", "row-c"] }
// Rewrites sort_order on each row to match the array order. One round-trip.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  SECTION_TABLES,
  reorderRows,
  logActivity,
} from "@/lib/database/website";

const WRITE_ROLES = [
  "owner",
  "admin",
  "admin manager",
  "general manager",
  "sales",
];

const actorFromSession = (session) =>
  session?.user?.username || session?.user?.name || session?.user?.email || "Staff User";

async function handler(req, res, session) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }
  const { section } = req.query;
  const meta = SECTION_TABLES[section];
  if (!meta || meta.kind !== "collection") {
    return res.status(400).json({
      success: false,
      message: `Section "${section}" is not a reorderable collection.`,
    });
  }
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  if (!ids) {
    return res
      .status(400)
      .json({ success: false, message: "Body must include { ids: string[] }." });
  }
  const actor = actorFromSession(session);
  const result = await reorderRows(meta.table, ids, actor);
  if (!result.ok) {
    return res.status(500).json({ success: false, message: result.error });
  }
  await logActivity({
    actor,
    action: "Reordered collection",
    target: section,
    pageKey: null,
  });
  return res.status(200).json({ success: true });
}

export default withRoleGuard(handler, { allow: WRITE_ROLES });
