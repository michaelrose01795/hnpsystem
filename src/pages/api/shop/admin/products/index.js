// file location: src/pages/api/shop/admin/products/index.js
// Staff product CRUD: list + create.
//   GET   /api/shop/admin/products
//   POST  /api/shop/admin/products  body = product row

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { listAllProducts, upsertProduct } from "@/lib/database/shop";

const ROLES = ["owner", "admin", "admin manager", "general manager", "sales"];

const actor = (s) => s?.user?.username || s?.user?.name || s?.user?.email || "Staff User";

async function handler(req, res, session) {
  if (req.method === "GET") {
    const data = await listAllProducts();
    return res.status(200).json({ success: true, data });
  }
  if (req.method === "POST") {
    const row = req.body || {};
    if (!row.id || !row.name || !row.slug || row.price_pence == null) {
      return res.status(400).json({
        success: false,
        message: "Required: id, name, slug, price_pence",
      });
    }
    const result = await upsertProduct(row, actor(session));
    if (!result.ok) return res.status(500).json({ success: false, message: result.error });
    return res.status(201).json({ success: true, data: result.data });
  }
  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ success: false, message: "Method Not Allowed" });
}

export default withRoleGuard(handler, { allow: ROLES });
