// file location: src/pages/api/messages/threads/[threadId]/index.js
//
//   PATCH  /api/messages/threads/:id
//     body: { title?, status?, priority?, assignedTo?, addLinks?, removeLinks?,
//             notificationLevel? }
//     -> the refreshed thread snapshot
//
//   DELETE /api/messages/threads/:id   -> removes the conversation
//
// The client (useMessagesApi.updateThread / deleteThread) has always called
// this path; the route itself was missing, so renaming a group and removing a
// conversation never reached the server.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  deleteThreadCascade,
  renameGroupThread,
  setMemberNotificationLevel,
  updateThreadSettings,
} from "@/lib/database/messages";
import { resolveActorId, sendError } from "@/lib/messages/serverActor";

async function handler(req, res, session) {
  const threadId = Number(req.query.threadId);
  if (!Number.isFinite(threadId) || threadId <= 0) {
    return res.status(400).json({ success: false, message: "A valid threadId is required." });
  }

  const actorId = resolveActorId(session, req);
  if (!actorId) {
    return res.status(401).json({ success: false, message: "Sign in to manage conversations." });
  }

  try {
    if (req.method === "PATCH") {
      const body = req.body || {};
      let thread = null;

      if (typeof body.title === "string") {
        thread = await renameGroupThread({ threadId, actorId, title: body.title });
      }

      const settings = {};
      ["status", "priority", "assignedTo"].forEach((key) => {
        if (body[key] !== undefined) settings[key] = body[key];
      });
      if (Array.isArray(body.addLinks)) settings.addLinks = body.addLinks;
      if (Array.isArray(body.removeLinks)) settings.removeLinks = body.removeLinks;
      if (Object.keys(settings).length) {
        thread = await updateThreadSettings({ threadId, actorId, ...settings });
      }

      if (body.notificationLevel !== undefined) {
        thread = await setMemberNotificationLevel({
          threadId,
          userId: actorId,
          level: body.notificationLevel,
        });
      }

      if (!thread) {
        return res.status(400).json({ success: false, message: "Nothing to update." });
      }
      return res.status(200).json({ success: true, data: thread });
    }

    if (req.method === "DELETE") {
      await deleteThreadCascade({ threadId, actorId });
      return res.status(200).json({ success: true });
    }

    res.setHeader("Allow", ["PATCH", "DELETE"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error(`❌ ${req.method} /api/messages/threads/[id] error:`, error);
    return sendError(res, error);
  }
}

export default withRoleGuard(handler);
