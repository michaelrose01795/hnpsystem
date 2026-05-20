// file location: src/pages/api/shop/admin/categories/[id].js
// Staff category CRUD per id.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { upsertCategory, deleteCategory } from "@/lib/database/shop";

const ROLES = ["owner", "admin", "admin manager", "general manager", "sales"];

const actor = (s) => s?.user?.username || s?.user?.name || s?.user?.email || "Staff User";

async function handler(req, res, session) {
  const { id } = req.query;
  if (req.method === "PATCH") {
    const row = { ...(req.body || {}), id };
    const result = await upsertCategory(row, actor(session));
    if (!result.ok) return res.status(500).json({ success: false, message: result.error });
    return res.status(200).json({ success: true, data: result.data });
  }
  if (req.method === "DELETE") {
    const result = await deleteCategory(id);
    if (!result.ok) return res.status(500).json({ success: false, message: result.error });
    return res.status(200).json({ success: true });
  }
  res.setHeader("Allow", "PATCH, DELETE");
  return res.status(405).json({ success: false, message: "Method Not Allowed" });
}

export default withRoleGuard(handler, { allow: ROLES });
