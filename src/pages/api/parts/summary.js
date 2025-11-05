// file location: src/pages/api/parts/summary.js
import { getPartsManagerSummary } from "@/lib/database/parts";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
    });
  }

  const result = await getPartsManagerSummary();

  if (!result.success) {
    return res.status(500).json({
      success: false,
      message: "Failed to load parts manager summary",
      error: result.error?.message || result.error,
    });
  }

  return res.status(200).json({
    success: true,
    summary: result.data,
  });
}
