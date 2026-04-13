// file location: src/features/appGuide/aiChatDatabase.js
//
// Supabase database layer for the App Guide AI chat feature.
// Manages chat sessions and messages for the in-app assistant.
//
// Required Supabase tables (run in your Supabase SQL editor):
//
//   CREATE TABLE ai_guide_sessions (
//     id            BIGSERIAL PRIMARY KEY,
//     user_id       INTEGER NOT NULL,
//     title         TEXT NOT NULL DEFAULT 'New Chat',
//     created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//     updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
//   );
//
//   CREATE TABLE ai_guide_messages (
//     id            BIGSERIAL PRIMARY KEY,
//     session_id    BIGINT NOT NULL REFERENCES ai_guide_sessions(id) ON DELETE CASCADE,
//     role          TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
//     content       TEXT NOT NULL,
//     sources       JSONB NOT NULL DEFAULT '[]',
//     created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
//   );
//
//   CREATE INDEX idx_ai_guide_sessions_user_id ON ai_guide_sessions(user_id);
//   CREATE INDEX idx_ai_guide_messages_session_id ON ai_guide_messages(session_id);

import { supabase } from "@/lib/supabaseClient";

const SESSIONS_TABLE = "ai_guide_sessions";
const MESSAGES_TABLE = "ai_guide_messages";

// ─────────────────────────────────────────────────────────────────────────────
// Schema check helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect whether a Supabase error is the "table not found in schema cache" error.
 * This happens when the ai_guide_sessions / ai_guide_messages tables have not
 * been created in Supabase yet.
 *
 * Returns true → caller should degrade gracefully rather than hard-fail.
 */
function isTableMissingError(error) {
  if (!error) return false;
  const msg = String(error.message || error.hint || "").toLowerCase();
  return (
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("relation") ||
    msg.includes("ai_guide_sessions") ||
    msg.includes("ai_guide_messages")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Session functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all chat sessions for a user, ordered by most recently updated.
 *
 * @param {number} userId
 * @returns {{ success: boolean, data?: Array, error?: { message: string } }}
 */
export async function getSessionsForUser(userId) {
  const numericUserId = Number(userId);
  if (!Number.isInteger(numericUserId)) {
    return { success: false, error: { message: "Valid user ID required" } };
  }

  const { data, error } = await supabase
    .from(SESSIONS_TABLE)
    .select("id, user_id, title, created_at, updated_at")
    .eq("user_id", numericUserId)
    .order("updated_at", { ascending: false })
    .limit(50); // cap at 50 sessions per user

  if (error) {
    if (isTableMissingError(error)) {
      // Tables not created yet — return empty list so the UI degrades gracefully
      return { success: true, data: [], tableNotFound: true };
    }
    console.error("[aiChatDatabase] getSessionsForUser error:", error);
    return { success: false, error: { message: error.message } };
  }

  return {
    success: true,
    data: (data || []).map(mapSession),
  };
}

/**
 * Create a new chat session for a user.
 *
 * @param {number} userId
 * @param {string} title - Optional session title (defaults to "New Chat")
 * @returns {{ success: boolean, data?: object, error?: { message: string } }}
 */
export async function createSession(userId, title = "New Chat") {
  const numericUserId = Number(userId);
  if (!Number.isInteger(numericUserId)) {
    return { success: false, error: { message: "Valid user ID required" } };
  }

  const { data, error } = await supabase
    .from(SESSIONS_TABLE)
    .insert([{
      user_id: numericUserId,
      title: String(title || "New Chat").slice(0, 120),
    }])
    .select("id, user_id, title, created_at, updated_at")
    .single();

  if (error) {
    if (isTableMissingError(error)) {
      return { success: false, tableNotFound: true, error: { message: "AI guide tables not set up yet. Run the SQL migration in Supabase." } };
    }
    console.error("[aiChatDatabase] createSession error:", error);
    return { success: false, error: { message: error.message } };
  }

  return { success: true, data: mapSession(data) };
}

/**
 * Update the title of a session. Only the session owner can rename it.
 *
 * @param {number} sessionId
 * @param {number} userId - Used to verify ownership
 * @param {string} title
 * @returns {{ success: boolean, data?: object, error?: { message: string } }}
 */
export async function updateSessionTitle(sessionId, userId, title) {
  const numericId = Number(sessionId);
  const numericUserId = Number(userId);

  if (!Number.isInteger(numericId) || !Number.isInteger(numericUserId)) {
    return { success: false, error: { message: "Valid IDs required" } };
  }

  const { data, error } = await supabase
    .from(SESSIONS_TABLE)
    .update({ title: String(title || "").slice(0, 120), updated_at: new Date().toISOString() })
    .eq("id", numericId)
    .eq("user_id", numericUserId) // ownership check
    .select("id, user_id, title, created_at, updated_at")
    .single();

  if (error) {
    console.error("[aiChatDatabase] updateSessionTitle error:", error);
    return { success: false, error: { message: error.message } };
  }

  return { success: true, data: mapSession(data) };
}

/**
 * Delete a chat session and all its messages (cascade delete via FK).
 * Verifies the session belongs to the requesting user.
 *
 * @param {number} sessionId
 * @param {number} userId
 * @returns {{ success: boolean, error?: { message: string } }}
 */
export async function deleteSession(sessionId, userId) {
  const numericId = Number(sessionId);
  const numericUserId = Number(userId);

  if (!Number.isInteger(numericId) || !Number.isInteger(numericUserId)) {
    return { success: false, error: { message: "Valid IDs required" } };
  }

  const { error } = await supabase
    .from(SESSIONS_TABLE)
    .delete()
    .eq("id", numericId)
    .eq("user_id", numericUserId); // ownership check prevents cross-user deletes

  if (error) {
    console.error("[aiChatDatabase] deleteSession error:", error);
    return { success: false, error: { message: error.message } };
  }

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Message functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all messages in a session, in chronological order.
 * Verifies the session belongs to the requesting user.
 *
 * @param {number} sessionId
 * @param {number} userId
 * @returns {{ success: boolean, data?: Array, error?: { message: string } }}
 */
export async function getMessagesForSession(sessionId, userId) {
  const numericId = Number(sessionId);
  const numericUserId = Number(userId);

  if (!Number.isInteger(numericId) || !Number.isInteger(numericUserId)) {
    return { success: false, error: { message: "Valid IDs required" } };
  }

  // First verify session ownership to prevent cross-user message access
  const { data: sessionCheck, error: sessionError } = await supabase
    .from(SESSIONS_TABLE)
    .select("id")
    .eq("id", numericId)
    .eq("user_id", numericUserId)
    .single();

  if (sessionError || !sessionCheck) {
    return { success: false, error: { message: "Session not found or access denied" } };
  }

  const { data, error } = await supabase
    .from(MESSAGES_TABLE)
    .select("id, session_id, role, content, sources, created_at")
    .eq("session_id", numericId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isTableMissingError(error)) {
      return { success: true, data: [], tableNotFound: true };
    }
    console.error("[aiChatDatabase] getMessagesForSession error:", error);
    return { success: false, error: { message: error.message } };
  }

  return {
    success: true,
    data: (data || []).map(mapMessage),
  };
}

/**
 * Save a pair of messages (user question + assistant answer) to a session.
 * Also updates the session's updated_at timestamp.
 *
 * @param {number} sessionId
 * @param {string} userContent - The user's question text
 * @param {string} assistantContent - The assistant's answer text
 * @param {Array} sources - Source citations from the query engine
 * @returns {{ success: boolean, data?: { userMessage, assistantMessage }, error?: { message: string } }}
 */
export async function saveMessagePair(sessionId, userContent, assistantContent, sources = []) {
  const numericId = Number(sessionId);
  if (!Number.isInteger(numericId)) {
    return { success: false, error: { message: "Valid session ID required" } };
  }

  const now = new Date().toISOString();

  // Insert both messages in one call
  const { data, error } = await supabase
    .from(MESSAGES_TABLE)
    .insert([
      {
        session_id: numericId,
        role: "user",
        content: String(userContent || "").slice(0, 4000),
        sources: [],
        created_at: now,
      },
      {
        session_id: numericId,
        role: "assistant",
        content: String(assistantContent || "").slice(0, 8000),
        sources: Array.isArray(sources) ? sources : [],
        created_at: new Date(Date.now() + 1).toISOString(), // +1ms to ensure order
      },
    ])
    .select("id, session_id, role, content, sources, created_at");

  if (error) {
    if (isTableMissingError(error)) {
      return { success: false, tableNotFound: true, error: { message: "Tables not ready" } };
    }
    console.error("[aiChatDatabase] saveMessagePair error:", error);
    return { success: false, error: { message: error.message } };
  }

  // Update the session's updated_at to reflect activity
  await supabase
    .from(SESSIONS_TABLE)
    .update({ updated_at: now })
    .eq("id", numericId);

  const messages = (data || []).map(mapMessage);
  return {
    success: true,
    data: {
      userMessage: messages.find((m) => m.role === "user") || null,
      assistantMessage: messages.find((m) => m.role === "assistant") || null,
    },
  };
}

/**
 * Rename a session based on the first user message — called automatically
 * when a session title is still the default "New Chat".
 *
 * @param {number} sessionId
 * @param {string} firstMessage
 */
export async function autoNameSession(sessionId, firstMessage) {
  const numericId = Number(sessionId);
  if (!Number.isInteger(numericId) || !firstMessage) return;

  // Create a concise title from the first message (max 60 chars)
  const title = String(firstMessage)
    .trim()
    .slice(0, 60)
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ");

  await supabase
    .from(SESSIONS_TABLE)
    .update({ title })
    .eq("id", numericId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Row mappers
// ─────────────────────────────────────────────────────────────────────────────

/** Map a raw Supabase sessions row to a clean object. */
function mapSession(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title || "New Chat",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Map a raw Supabase messages row to a clean object. */
function mapMessage(row) {
  let sources = [];
  try {
    sources = Array.isArray(row.sources) ? row.sources : JSON.parse(row.sources || "[]");
  } catch (_) {
    sources = [];
  }

  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    sources,
    createdAt: row.created_at,
  };
}
