// file location: src/pages/api/parts/inventory/index.js
import {
  getPartsInventory,
  createPart,
} from "@/lib/database/parts";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const {
      search = "",
      includeInactive = "false",
      limit = "50",
      offset = "0",
    } = req.query;

    const result = await getPartsInventory({
      searchTerm: search,
      includeInactive: includeInactive === "true",
      limit: Number.parseInt(limit, 10) || 50,
      offset: Number.parseInt(offset, 10) || 0,
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to load parts inventory",
        error: result.error?.message || result.error,
      });
    }

    return res.status(200).json({
      success: true,
      parts: result.data,
      count: result.count,
    });
  }

  if (req.method === "POST") {
    const { userId, ...partData } = req.body || {};

    const result = await createPart(partData, { userId });

    if (!result.success) {
      const status =
        result.error?.code === "23505" ? 409 : 500;

      return res.status(status).json({
        success: false,
        message:
          status === 409
            ? "A part with this part number already exists"
            : "Failed to create part",
        error: result.error?.message || result.error,
      });
    }

    return res.status(201).json({
      success: true,
      part: result.data,
    });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`,
  });
}
