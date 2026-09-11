// file location: src/pages/api/shop/parts-catalog/index.js
//
// GET /api/shop/parts-catalog -> the public, customer-facing view of the
// staff DMS Stock Catalogue (public.parts_catalog). Powers
// /website/parts-catalog.
//
// Query: ?search= &category= &sort=name|price_asc|price_desc|newest
//        &limit= &offset= &categories=1
//
// Read-only and unauthenticated by design — this is the shop front. The
// column allowlist and the sensitive-field stripping live in
// src/lib/database/partsCatalogPublic.js.

import {
  listPublicParts,
  listPublicPartCategories,
} from "@/lib/database/partsCatalogPublic";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res
      .status(405)
      .json({ success: false, message: "Method Not Allowed" });
  }

  const {
    search = "",
    category = "",
    sort = "name",
    limit = "24",
    offset = "0",
    categories,
  } = req.query;

  const wantCategories = categories === "1" || categories === "true";

  const [result, categoryList] = await Promise.all([
    listPublicParts({
      search: String(search),
      category: String(category),
      sort: String(sort),
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    }),
    wantCategories ? listPublicPartCategories() : Promise.resolve(null),
  ]);

  res.setHeader(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=300"
  );
  return res.status(200).json({
    success: true,
    data: result.items,
    total: result.total,
    ...(categoryList ? { categories: categoryList } : {}),
  });
}
