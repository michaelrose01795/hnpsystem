// file location: src/pages/api/parts/inventory/[partId].js
import {
  getPartById,
  updatePart,
  deletePart,
} from "@/lib/database/parts";

export default async function handler(req, res) {
  const { partId } = req.query;

  if (!partId || typeof partId !== "string") {
    return res.status(400).json({
      success: false,
      message: "Part ID is required",
    });
  }

  if (req.method === "GET") {
    const result = await getPartById(partId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: "Part not found",
        error: result.error?.message || result.error,
      });
    }

    return res.status(200).json({
      success: true,
      part: result.data,
    });
  }

  if (req.method === "PATCH") {
    const { userId, ...updates } = req.body || {};

    const result = await updatePart(partId, updates, { userId });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to update part",
        error: result.error?.message || result.error,
      });
    }

    return res.status(200).json({
      success: true,
      part: result.data,
    });
  }

  if (req.method === "DELETE") {
    const result = await deletePart(partId);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete part",
        error: result.error?.message || result.error,
      });
    }

    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "PATCH", "DELETE"]);
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`,
  });
}
