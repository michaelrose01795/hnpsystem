// file location: src/pages/api/ai/guide-messages.js
//
// REST API for retrieving messages within an App Guide chat session.
// GET → returns all messages for the specified sessionId (query param)
//
// Sessions are user-scoped: users can only read their own session messages.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import { getMessagesForSession } from "@/features/appGuide/aiChatDatabase";

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  // Resolve the numeric database user ID from the session
  let userId;
  try {
    userId = await resolveSessionUserId(session);
  } catch (err) {
    return res.status(401).json({ success: false, message: err.message || "Could not resolve user" });
  }

  if (!userId) {
    return res.status(401).json({ success: false, message: "User ID could not be resolved" });
  }

  const sessionId = Number(req.query.sessionId);
  if (!Number.isInteger(sessionId) || sessionId < 1) {
    return res.status(400).json({ success: false, message: "Valid sessionId query parameter required" });
  }

  const result = await getMessagesForSession(sessionId, userId);
  if (!result.success) {
    return res.status(500).json({ success: false, message: result.error?.message || "Failed to load messages" });
  }

  return res.status(200).json({ success: true, data: result.data });
}

export default withRoleGuard(handler);
