// file location: src/pages/api/messages/threads/[threadId]/index.js
import { deleteThreadCascade, renameGroupThread } from "@/lib/database/messages";

export default async function handler(req, res) {
  const { threadId } = req.query || {};
  if (!threadId) {
    return res
      .status(400)
      .json({ success: false, message: "threadId is required." });
  }

  if (req.method === "PATCH") {
    const { actorId, title } = req.body || {};
    if (!actorId) {
      return res
        .status(400)
        .json({ success: false, message: "actorId is required." });
    }

    try {
      const thread = await renameGroupThread({
        threadId,
        actorId,
        title,
      });
      return res.status(200).json({ success: true, data: thread });
    } catch (error) {
      console.error("❌ PATCH /api/messages/threads/[threadId] error:", error);
      return res
        .status(500)
        .json({ success: false, message: error.message || "Server error" });
    }
  }

  if (req.method === "DELETE") {
    const { actorId } = req.body || {};
    if (!actorId) {
      return res
        .status(400)
        .json({ success: false, message: "actorId is required." });
    }

    try {
      await deleteThreadCascade({ threadId, actorId });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("❌ DELETE /api/messages/threads/[threadId] error:", error);
      const status = error.message?.includes("part of this conversation") ? 403 : 500;
      return res
        .status(status)
        .json({ success: false, message: error.message || "Server error" });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
