// file location: src/pages/api/messages/threads/[threadId]/actions.js
//
//   POST /api/messages/threads/:id/actions
//     body: { messageId, action, content? }
//     action: pin | unpin | task-done | task-reopen | reminder-done |
//             reminder-reopen | edit | delete
//     -> the updated message
//
// Edit and delete are limited to the sender; everything else to any member.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { applyMessageAction } from "@/lib/database/messages";
import { resolveActorId, sendError } from "@/lib/messages/serverActor";

async function handler(req, res, session) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const threadId = Number(req.query.threadId);
  if (!Number.isFinite(threadId) || threadId <= 0) {
    return res.status(400).json({ success: false, message: "A valid threadId is required." });
  }
  const actorId = resolveActorId(session, req);
  if (!actorId) {
    return res.status(401).json({ success: false, message: "Sign in to update messages." });
  }

  const { messageId, action, content } = req.body || {};
  if (!messageId || !action) {
    return res.status(400).json({ success: false, message: "messageId and action are required." });
  }

  try {
    const message = await applyMessageAction({ threadId, actorId, messageId, action, content });
    return res.status(200).json({ success: true, data: message });
  } catch (error) {
    console.error("❌ POST /api/messages/threads/[id]/actions error:", error);
    return sendError(res, error);
  }
}

export default withRoleGuard(handler);
