// file location: src/pages/api/search/global.js
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { searchGlobalRecords } from "@/lib/database/globalSearch";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  const { q } = req.query;
  const term = (q || "").trim();

  if (term.length < 2) {
    return res.status(200).json({ success: true, results: [] });
  }

  try {
    const results = await searchGlobalRecords(term);

    return res.status(200).json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Global search handler error:", error);
    return res.status(500).json({
      success: false,
      message: "Unexpected error performing search",
    });
  }
}

export default withRoleGuard(handler);
