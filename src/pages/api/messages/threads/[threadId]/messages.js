// file location: src/pages/api/messages/threads/[threadId]/messages.js
import {
  getThreadMessages,
  markThreadRead,
  sendThreadMessage,
} from "@/lib/database/messages";

export default async function handler(req, res) {
  const threadIdRaw = req.query.threadId;
  const threadId = Number(threadIdRaw);

  if (!Number.isFinite(threadId) || threadId <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "A valid threadId is required." });
  }

  if (req.method === "GET") {
    const { limit = 50, before, userId } = req.query;
    const parsedLimit = Number(limit) > 0 ? Number(limit) : 50;

    try {
      const messages = await getThreadMessages(threadId, parsedLimit, before);
      if (userId) {
        const parsedUserId = Number(userId);
        if (Number.isFinite(parsedUserId) && parsedUserId > 0) {
          await markThreadRead({ threadId, userId: parsedUserId });
        }
      }
      return res.status(200).json({ success: true, data: messages });
    } catch (error) {
      console.error("❌ GET /api/messages/threads/[id]/messages error:", error);
      return res
        .status(500)
        .json({ success: false, message: error.message || "Server error" });
    }
  }

  if (req.method === "POST") {
    const { senderId, content } = req.body || {};
    if (!senderId || !content) {
      return res.status(400).json({
        success: false,
        message: "senderId and content are required.",
      });
    }

    try {
      const message = await sendThreadMessage({
        threadId,
        senderId,
        content,
      });
      return res.status(201).json({ success: true, data: message });
    } catch (error) {
      console.error("❌ POST /api/messages/threads/[id]/messages error:", error);
      return res
        .status(500)
        .json({ success: false, message: error.message || "Server error" });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
