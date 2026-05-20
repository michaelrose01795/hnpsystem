// file location: src/pages/api/shop/categories/index.js
// GET /api/shop/categories  -> active categories for the public catalogue.

import { listActiveCategories } from "@/lib/database/shop";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }
  const data = await listActiveCategories();
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=300"
  );
  return res.status(200).json({ success: true, data });
}
