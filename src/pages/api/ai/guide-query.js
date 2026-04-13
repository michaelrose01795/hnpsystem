// file location: src/pages/api/ai/guide-query.js
//
// POST endpoint that powers the App Guide AI assistant.
// Accepts a user question and conversation history, runs the internal
// query engine (no external AI), saves the exchange, and returns the answer.
//
// Request body:
//   {
//     message:             string               — the user's question
//     sessionId:           number | null        — existing session ID, or null to create one
//     conversationHistory: Array<{role, content}> — last N messages for context (max 20)
//   }
//
// Response:
//   {
//     success:            boolean
//     answer:             string               — assistant's markdown answer
//     sessionId:          number               — session used / created
//     sources:            Array<{id, title, type, route}> — knowledge citations
//     suggestedQuestions: string[]             — follow-up question chips
//   }

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import { search } from "@/features/appGuide/queryEngine";
import {
  autoNameSession,
  createSession,
  saveMessagePair,
} from "@/features/appGuide/aiChatDatabase";

// Maximum number of history messages to pass to the query engine
const MAX_HISTORY_ITEMS = 20;

async function handler(req, res, session) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
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

  // ── Validate input ──────────────────────────────────────────────────────
  const rawMessage = String(req.body?.message || "").trim();
  if (!rawMessage) {
    return res.status(400).json({ success: false, message: "Message is required" });
  }
  if (rawMessage.length > 2000) {
    return res.status(400).json({ success: false, message: "Message is too long (max 2000 characters)" });
  }

  // Sanitise history: accept only user/assistant role messages, cap length
  const rawHistory = Array.isArray(req.body?.conversationHistory) ? req.body.conversationHistory : [];
  const conversationHistory = rawHistory
    .filter((item) => item && (item.role === "user" || item.role === "assistant") && item.content)
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => ({ role: item.role, content: String(item.content || "").slice(0, 2000) }));

  // ── Resolve or create session ───────────────────────────────────────────
  // If the DB tables don't exist yet we skip persistence entirely so the
  // assistant still answers — the user just won't get saved history.
  let sessionId = Number(req.body?.sessionId) || null;
  let isNewSession = false;
  let persistenceAvailable = true;

  if (!Number.isInteger(sessionId) || sessionId < 1) {
    const createResult = await createSession(userId, "New Chat");
    if (!createResult.success) {
      if (createResult.tableNotFound) {
        // Tables not set up yet — run in no-persistence mode
        persistenceAvailable = false;
      } else {
        return res.status(500).json({
          success: false,
          message: createResult.error?.message || "Failed to create chat session",
        });
      }
    } else {
      sessionId = createResult.data.id;
      isNewSession = true;
    }
  }

  // ── Run the query engine ────────────────────────────────────────────────
  const userRoles = Array.isArray(session?.user?.roles) ? session.user.roles : [];
  let engineResult;
  try {
    engineResult = search(rawMessage, conversationHistory, userRoles);
  } catch (engineError) {
    console.error("[guide-query] Query engine error:", engineError);
    engineResult = {
      answer: "I ran into an issue processing your question. Please try again or rephrase your question.",
      sources: [],
      suggestedQuestions: [],
    };
  }

  const { answer, sources, suggestedQuestions } = engineResult;

  // ── Persist the message pair (skip gracefully if tables not ready) ──────
  if (persistenceAvailable && sessionId) {
    const saveResult = await saveMessagePair(sessionId, rawMessage, answer, sources);
    if (!saveResult.success && !saveResult.tableNotFound) {
      console.error("[guide-query] Failed to save message pair:", saveResult.error?.message);
    }

    if (isNewSession) {
      await autoNameSession(sessionId, rawMessage);
    }
  }

  // ── Return response ─────────────────────────────────────────────────────
  return res.status(200).json({
    success: true,
    sessionId: sessionId || null,
    persistenceAvailable,
    answer,
    sources: sources || [],
    suggestedQuestions: suggestedQuestions || [],
  });
}

export default withRoleGuard(handler);
