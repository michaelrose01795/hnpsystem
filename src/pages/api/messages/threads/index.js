// file location: src/pages/api/messages/threads/index.js
import {
  createGroupThread,
  ensureDirectThread,
  getThreadsForUser,
} from "@/lib/database/messages";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const userId = Number(req.query.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "userId query parameter is required.",
      });
    }

    try {
      const threads = await getThreadsForUser(userId);
      return res.status(200).json({ success: true, data: threads });
    } catch (error) {
      console.error("❌ GET /api/messages/threads error:", error);
      return res
        .status(500)
        .json({ success: false, message: error.message || "Server error" });
    }
  }

  if (req.method === "POST") {
    const { type = "direct", createdBy, memberIds = [], targetUserId, title } =
      req.body || {};

    if (!createdBy) {
      return res
        .status(400)
        .json({ success: false, message: "createdBy is required" });
    }

    try {
      if (type === "direct") {
        if (!targetUserId) {
          return res.status(400).json({
            success: false,
            message: "targetUserId is required for direct threads.",
          });
        }
        const thread = await ensureDirectThread(createdBy, targetUserId);
        return res.status(201).json({ success: true, data: thread });
      }

      const thread = await createGroupThread({
        title,
        memberIds,
        createdBy,
      });
      return res.status(201).json({ success: true, data: thread });
    } catch (error) {
      console.error("❌ POST /api/messages/threads error:", error);
      return res
        .status(500)
        .json({ success: false, message: error.message || "Server error" });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
