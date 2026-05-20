// file location: src/pages/api/website/sections/[section]/[id].js
//
// Per-row CRUD for collection sections of /website content.
//
//   PATCH  /api/website/sections/:section/:id   -> upsert one row
//   DELETE /api/website/sections/:section/:id   -> delete one row
//
// Singleton sections (hero, about, etc.) reject :id calls — patch the
// singleton via /api/website/sections/:section instead.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  SECTION_TABLES,
  upsertRow,
  deleteRow,
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
  const { section, id } = req.query;
  const meta = SECTION_TABLES[section];
  if (!meta) {
    return res
      .status(404)
      .json({ success: false, message: `Unknown section "${section}"` });
  }
  if (meta.kind !== "collection") {
    return res.status(400).json({
      success: false,
      message: `Section "${section}" is a singleton — patch via /sections/${section}.`,
    });
  }

  const actor = actorFromSession(session);

  if (req.method === "PATCH") {
    const row = { ...(req.body || {}), id };
    const result = await upsertRow(meta.table, row, actor);
    if (!result.ok) {
      return res.status(500).json({ success: false, message: result.error });
    }
    await logActivity({
      actor,
      action: "Updated row",
      target: `${section}/${id}`,
      pageKey: null,
    });
    return res.status(200).json({ success: true, data: result.data });
  }

  if (req.method === "DELETE") {
    const result = await deleteRow(meta.table, id);
    if (!result.ok) {
      return res.status(500).json({ success: false, message: result.error });
    }
    await logActivity({
      actor,
      action: "Deleted row",
      target: `${section}/${id}`,
      pageKey: null,
    });
    return res.status(200).json({ success: true });
  }

  res.setHeader("Allow", "PATCH, DELETE");
  return res.status(405).json({ success: false, message: "Method Not Allowed" });
}

export default withRoleGuard(handler, { allow: WRITE_ROLES });
