// file location: src/pages/api/ai/guide-sessions.js
//
// REST API for App Guide chat sessions.
// GET    → list all sessions for the authenticated user
// POST   → create a new session
// PATCH  → rename a session (body: { id, title })
// DELETE → delete a session (query: ?id=123)

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import {
  createSession,
  deleteSession,
  getSessionsForUser,
  updateSessionTitle,
} from "@/features/appGuide/aiChatDatabase";

async function handler(req, res, session) {
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

  // ── GET — list sessions ──────────────────────────────────────────────────
  if (req.method === "GET") {
    const result = await getSessionsForUser(userId);
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error?.message || "Failed to load sessions" });
    }
    // result.tableNotFound === true means tables don't exist yet — return empty with a flag
    return res.status(200).json({
      success: true,
      data: result.data || [],
      tableNotFound: result.tableNotFound || false,
    });
  }

  // ── POST — create session ────────────────────────────────────────────────
  if (req.method === "POST") {
    const title = String(req.body?.title || "New Chat").slice(0, 120);
    const result = await createSession(userId, title);
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error?.message || "Failed to create session" });
    }
    return res.status(200).json({ success: true, data: result.data });
  }

  // ── PATCH — rename session ───────────────────────────────────────────────
  if (req.method === "PATCH") {
    const sessionId = Number(req.body?.id);
    const title = String(req.body?.title || "").trim();

    if (!Number.isInteger(sessionId) || sessionId < 1) {
      return res.status(400).json({ success: false, message: "Valid session ID required" });
    }
    if (!title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    const result = await updateSessionTitle(sessionId, userId, title);
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error?.message || "Failed to update session" });
    }
    return res.status(200).json({ success: true, data: result.data });
  }

  // ── DELETE — delete session ──────────────────────────────────────────────
  if (req.method === "DELETE") {
    const sessionId = Number(req.query.id || req.body?.id);
    if (!Number.isInteger(sessionId) || sessionId < 1) {
      return res.status(400).json({ success: false, message: "Valid session ID required" });
    }

    const result = await deleteSession(sessionId, userId);
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error?.message || "Failed to delete session" });
    }
    return res.status(200).json({ success: true });
  }

  res.setHeader("Allow", ["GET", "POST", "PATCH", "DELETE"]);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}

// All authenticated users can manage their own AI guide sessions — no role restriction needed
export default withRoleGuard(handler);
