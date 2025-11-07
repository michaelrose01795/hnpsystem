// file location: src/pages/api/messages/threads/[threadId]/members.js
import { updateGroupMembers } from "@/lib/database/messages";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  const threadIdRaw = req.query.threadId;
  const threadId = Number(threadIdRaw);

  if (!Number.isFinite(threadId) || threadId <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "A valid threadId is required." });
  }

  const { actorId, userIds = [] } = req.body || {};
  const parsedActorId = Number(actorId);

  if (!Number.isFinite(parsedActorId) || parsedActorId <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "actorId is required." });
  }

  if (!Array.isArray(userIds) || !userIds.length) {
    return res.status(400).json({
      success: false,
      message: "userIds array is required.",
    });
  }

  try {
    const thread =
      req.method === "DELETE"
        ? await updateGroupMembers({
            threadId,
            actorId: parsedActorId,
            removeUserIds: userIds,
          })
        : await updateGroupMembers({
            threadId,
            actorId: parsedActorId,
            addUserIds: userIds,
          });

    return res.status(200).json({ success: true, data: thread });
  } catch (error) {
    console.error("❌ /api/messages/threads/[id]/members error:", error);
    const status =
      error.message?.includes("leader") || error.message?.includes("group")
        ? 403
        : 500;
    return res
      .status(status)
      .json({ success: false, message: error.message || "Server error" });
  }
}
