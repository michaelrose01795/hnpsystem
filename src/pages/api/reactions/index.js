// file location: src/pages/api/reactions/index.js
//
// Emoji reactions for chat messages and news-feed updates.
//
//   GET  /api/reactions?targetType=message&targetIds=1&targetIds=2
//        → { [targetId]: [{ userId, name, emoji }, ...] }
//
//   POST /api/reactions  { targetType, targetId, userId, emoji }
//        → { action: "added" | "replaced" | "removed", emoji }
//
// The POST takes the caller's userId in the body, matching the convention the
// rest of the messaging routes use (see threads/[threadId]/messages.js). Writes
// need the service key, so they cannot happen from the browser directly.
import { getReactions, setReaction } from "@/lib/database/reactions";
import { withRoleGuard } from "@/lib/auth/roleGuard";

async function handler(req, res) {
  if (req.method === "GET") {
    const { targetType } = req.query;
    const rawIds = req.query.targetIds;
    const targetIds = Array.isArray(rawIds) ? rawIds : rawIds ? [rawIds] : [];

    if (!targetType) {
      return res
        .status(400)
        .json({ success: false, message: "targetType is required." });
    }

    try {
      const data = await getReactions({ targetType, targetIds });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error("❌ GET /api/reactions error:", error);
      const status = /Unknown reaction target type/i.test(error.message) ? 400 : 500;
      return res
        .status(status)
        .json({ success: false, message: error.message || "Server error" });
    }
  }

  if (req.method === "POST") {
    const { targetType, targetId, userId, emoji } = req.body || {};

    if (!targetType || !targetId || !userId || !emoji) {
      return res.status(400).json({
        success: false,
        message: "targetType, targetId, userId and emoji are required.",
      });
    }

    try {
      const data = await setReaction({ targetType, targetId, userId, emoji });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error("❌ POST /api/reactions error:", error);
      const status =
        /Unknown reaction target type|is required/i.test(error.message) ? 400 : 500;
      return res
        .status(status)
        .json({ success: false, message: error.message || "Server error" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}

export default withRoleGuard(handler);
