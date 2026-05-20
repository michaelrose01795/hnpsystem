// file location: src/pages/api/shop/products/index.js
// GET /api/shop/products  -> published products for the public catalogue.
// Staff product CRUD lives at /api/shop/admin/products.

import { listPublishedProducts } from "@/lib/database/shop";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }
  const data = await listPublishedProducts();
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=300"
  );
  return res.status(200).json({ success: true, data });
}
