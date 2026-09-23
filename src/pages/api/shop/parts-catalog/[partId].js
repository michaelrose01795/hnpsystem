// file location: src/pages/api/shop/parts-catalog/[partId].js
//
// GET /api/shop/parts-catalog/:partId -> one public product plus a few
// related parts from the same category. Powers
// /website/parts-catalog/[partId].

import {
  getPublicPartById,
  listRelatedParts,
} from "@/lib/database/partsCatalogPublic";
import { isValidUuid } from "@/lib/utils/ids";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res
      .status(405)
      .json({ success: false, message: "Method Not Allowed" });
  }

  const { partId } = req.query;
  if (!isValidUuid(partId)) {
    return res.status(400).json({ success: false, message: "Invalid part id." });
  }

  const product = await getPublicPartById(partId);
  if (!product) {
    return res
      .status(404)
      .json({ success: false, message: "That part is no longer available." });
  }

  const related = await listRelatedParts(product, 4);

  res.setHeader(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=300"
  );
  return res.status(200).json({ success: true, data: product, related });
}
