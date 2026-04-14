// file location: src/features/appGuide/components/AiGuidePanel.js
//
// In-app AI Guide chat panel. Displayed inside the Floating Notes widget
// when the AI tab is active.
//
// Capabilities:
//   - Ask any question about the HNP System
//   - Receive grounded answers from the internal knowledge index (no external AI)
//   - Conversational context — follow-up questions understand prior messages
//   - Session management — save, load, and delete chat sessions
//   - Markdown-style rendering (bold, code, horizontal rule)
//   - Follow-up question chips and cited sources
//   - Role-aware — answers reflect the user's own access level

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Dropdown from "@/components/ui/dropdownAPI/Dropdown";
import { useConfirmation } from "@/context/ConfirmationContext";
import styles from "./AiGuidePanel.module.css";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// Starter question chips shown when the chat is empty
const STARTER_QUESTIONS = [
  "What does this app do?",
  "How do I create a job card?",
  "What does Page Access mean?",
  "What is the difference between Status History and Workflow History?",
  "How do slash commands work in Floating Notes?",
  "Who can access the HR Manager page?",
];

// Maximum characters in the input field
const MAX_INPUT_LENGTH = 2000;

// ─────────────────────────────────────────────────────────────────────────────
// Minimal Markdown renderer
// Supports: **bold**, `code`, _italic_, --- (hr), line breaks
// Only used for assistant messages — user messages render as plain text.
// ─────────────────────────────────────────────────────────────────────────────

function renderMarkdown(text) {
  if (!text) return [];

  const lines = String(text).split("\n");
  const elements = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Horizontal rule
    if (line.trim() === "---") {
      elements.push(<hr key={key++} />);
      continue;
    }

    // Numbered list item
    const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      elements.push(
        <div key={key++} style={{ paddingLeft: "4px" }}>
          <span style={{ fontWeight: 600, marginRight: 6 }}>{numberedMatch[1]}.</span>
          {renderInline(numberedMatch[2], key++)}
        </div>
      );
      continue;
    }

    // Bullet list item
    if (line.startsWith("• ") || line.startsWith("- ")) {
      elements.push(
        <div key={key++} style={{ paddingLeft: "4px" }}>
          <span style={{ marginRight: 6 }}>•</span>
          {renderInline(line.slice(2), key++)}
        </div>
      );
      continue;
    }

    // Empty line → spacing
    if (!line.trim()) {
      elements.push(<div key={key++} style={{ height: "6px" }} />);
      continue;
    }

    // Normal paragraph line
    elements.push(<div key={key++}>{renderInline(line, key++)}</div>);
  }

  return elements;
}

/**
 * Render inline markdown within a single line.
 * Handles **bold**, `code`, _italic_, ⚠️ passthrough.
 */
function renderInline(text, baseKey) {
  // Split the text by inline markers
  const parts = [];
  let remaining = text;
  let partKey = baseKey;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
    if (boldMatch) {
      if (boldMatch[1]) parts.push(<React.Fragment key={partKey++}>{boldMatch[1]}</React.Fragment>);
      parts.push(<strong key={partKey++}>{boldMatch[2]}</strong>);
      remaining = boldMatch[3];
      continue;
    }

    // Inline code: `text`
    const codeMatch = remaining.match(/^(.*?)`(.+?)`(.*)/s);
    if (codeMatch) {
      if (codeMatch[1]) parts.push(<React.Fragment key={partKey++}>{codeMatch[1]}</React.Fragment>);
      parts.push(<code key={partKey++}>{codeMatch[2]}</code>);
      remaining = codeMatch[3];
      continue;
    }

    // Italic: _text_
    const italicMatch = remaining.match(/^(.*?)_(.+?)_(.*)/s);
    if (italicMatch) {
      if (italicMatch[1]) parts.push(<React.Fragment key={partKey++}>{italicMatch[1]}</React.Fragment>);
      parts.push(<em key={partKey++}>{italicMatch[2]}</em>);
      remaining = italicMatch[3];
      continue;
    }

    // No more inline markers — emit the rest as plain text
    parts.push(<React.Fragment key={partKey++}>{remaining}</React.Fragment>);
    break;
  }

  return parts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Timestamp formatter
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(isoString) {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch (_) {
    return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────────────────────────────────────

// Returns { sessions: [], tableNotFound: bool }
async function fetchSessions() {
  const res = await fetch("/api/ai/guide-sessions");
  if (!res.ok) throw new Error("Failed to load sessions");
  const json = await res.json();
  return { sessions: json.data || [], tableNotFound: json.tableNotFound || false };
}

async function createNewSession(title = "New Chat") {
  const res = await fetch("/api/ai/guide-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to create session");
  const json = await res.json();
  return json.data;
}

async function deleteSessionApi(sessionId) {
  const res = await fetch(`/api/ai/guide-sessions?id=${sessionId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete session");
}

async function fetchMessages(sessionId) {
  const res = await fetch(`/api/ai/guide-messages?sessionId=${sessionId}`);
  if (!res.ok) throw new Error("Failed to load messages");
  const json = await res.json();
  return json.data || [];
}

async function sendQuery(message, sessionId, conversationHistory) {
  const res = await fetch("/api/ai/guide-query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId, conversationHistory }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.message || "Query failed");
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AiGuidePanel renders inside the Floating Notes body when the AI tab is active.
 *
 * Props:
 *   userId    — numeric database user ID (from useUser() → dbUserId)
 *   userRoles — string[] of the user's roles (for contextual awareness in the UI)
 */
export default function AiGuidePanel({ userId, userRoles }) {
  // ── Session state ──────────────────────────────────────────────────────
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  // false = tables not created yet; queries still work but history won't save
  const [dbReady, setDbReady] = useState(true);

  const { confirm } = useConfirmation();

  // ── Message state ──────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // ── Sending state ──────────────────────────────────────────────────────
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");

  // ── Suggested follow-ups for the latest assistant reply ───────────────
  const [latestSuggestedQuestions, setLatestSuggestedQuestions] = useState([]);

  // ── Refs ───────────────────────────────────────────────────────────────
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // ─────────────────────────────────────────────────────────────────────
  // Load sessions on mount
  // ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    setSessionsLoading(true);
    setSessionsError("");

    fetchSessions()
      .then(({ sessions: data, tableNotFound }) => {
        if (cancelled) return;
        if (tableNotFound) {
          // Tables don't exist yet — work in no-persistence mode
          setDbReady(false);
          setSessions([]);
          return;
        }
        setDbReady(true);
        setSessions(data);
        if (data.length > 0) {
          setCurrentSessionId(data[0].id);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setSessionsError(err.message || "Could not load chat history");
      })
      .finally(() => {
        if (cancelled) return;
        setSessionsLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId]);

  // ─────────────────────────────────────────────────────────────────────
  // Load messages when session changes
  // ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentSessionId) {
      setMessages([]);
      setLatestSuggestedQuestions([]);
      return;
    }

    let cancelled = false;
    setMessagesLoading(true);

    fetchMessages(currentSessionId)
      .then((data) => {
        if (cancelled) return;
        setMessages(data);
        setLatestSuggestedQuestions([]); // clear chips when switching session
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[AiGuidePanel] load messages error:", err);
        setMessages([]);
      })
      .finally(() => {
        if (cancelled) return;
        setMessagesLoading(false);
      });

    return () => { cancelled = true; };
  }, [currentSessionId]);

  // ─────────────────────────────────────────────────────────────────────
  // Auto-scroll to bottom when messages change
  // ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  // ─────────────────────────────────────────────────────────────────────
  // Send a message
  // ─────────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (messageText) => {
    const text = String(messageText || "").trim();
    if (!text || isSending) return;
    if (text.length > MAX_INPUT_LENGTH) return;

    setSendError("");
    setLatestSuggestedQuestions([]);
    setIsSending(true);

    // Build conversation history from current messages (last 10 pairs = 20 messages)
    const conversationHistory = messages
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));

    // Optimistically add the user message to the UI
    const optimisticUserMsg = {
      id: `tmp-user-${Date.now()}`,
      role: "user",
      content: text,
      sources: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);

    try {
      const result = await sendQuery(text, currentSessionId, conversationHistory);

      // If persistence is unavailable (tables not set up) update dbReady flag
      if (result.persistenceAvailable === false) {
        setDbReady(false);
      }

      // If the query created a new session, update our session list and selection
      if (result.sessionId && result.sessionId !== currentSessionId) {
        const newSession = {
          id: result.sessionId,
          title: text.slice(0, 60),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setSessions((prev) => [newSession, ...prev]);
        setCurrentSessionId(result.sessionId);
      }

      // Replace the optimistic user message + add the assistant reply
      const assistantMsg = {
        id: `tmp-assistant-${Date.now()}`,
        role: "assistant",
        content: result.answer || "",
        sources: result.sources || [],
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => {
        // Remove the optimistic user msg (we'll reload from server on next session switch)
        // and append both confirmed messages
        const confirmedUserMsg = { ...optimisticUserMsg, id: `confirmed-user-${Date.now()}` };
        return [...prev.filter((m) => m.id !== optimisticUserMsg.id), confirmedUserMsg, assistantMsg];
      });

      // Show follow-up question chips for this reply
      setLatestSuggestedQuestions(result.suggestedQuestions || []);

      // Update session title in the sidebar list if it auto-renamed
      if (result.sessionId) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === result.sessionId
              ? { ...s, title: text.slice(0, 60), updatedAt: new Date().toISOString() }
              : s
          )
        );
      }
    } catch (err) {
      // Remove optimistic message and show error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
      setSendError(err.message || "Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  }, [isSending, messages, currentSessionId]);

  // ─────────────────────────────────────────────────────────────────────
  // Handle input submission
  // ─────────────────────────────────────────────────────────────────────

  const handleInputKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const text = inputValue.trim();
      if (text) {
        setInputValue("");
        sendMessage(text);
      }
    }
  };

  const handleSendClick = () => {
    const text = inputValue.trim();
    if (text) {
      setInputValue("");
      sendMessage(text);
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // Start a new chat
  // ─────────────────────────────────────────────────────────────────────

  const handleNewChat = async () => {
    // Just clear the UI — a session will be created on first message
    setCurrentSessionId(null);
    setMessages([]);
    setLatestSuggestedQuestions([]);
    setSendError("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // ─────────────────────────────────────────────────────────────────────
  // Delete the current session
  // ─────────────────────────────────────────────────────────────────────

  const handleDeleteSession = async () => {
    if (!currentSessionId) return;
    const confirmed = await confirm({
      title: "Delete chat session",
      message: "Delete this chat session? This cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;

    try {
      await deleteSessionApi(currentSessionId);
      setSessions((prev) => prev.filter((s) => s.id !== currentSessionId));
      // Switch to next session, or clear
      setCurrentSessionId((prev) => {
        const remaining = sessions.filter((s) => s.id !== prev);
        return remaining.length > 0 ? remaining[0].id : null;
      });
      setMessages([]);
      setLatestSuggestedQuestions([]);
    } catch (err) {
      setSendError(err.message || "Failed to delete session");
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // Switch session — called by the Dropdown onChange
  // raw is the original option object: { value: session.id, label: session.title }
  // ─────────────────────────────────────────────────────────────────────

  const handleSessionChange = useCallback((raw) => {
    const selectedId = Number(raw?.value ?? raw?.id ?? null);
    if (Number.isInteger(selectedId) && selectedId > 0) {
      setCurrentSessionId(selectedId);
    } else {
      setCurrentSessionId(null);
      setMessages([]);
    }
  }, []);

  // Build the options list for the Dropdown from the current sessions array
  const sessionOptions = useMemo(
    () => sessions.map((s) => ({ value: s.id, label: s.title || "Untitled chat" })),
    [sessions]
  );

  // ─────────────────────────────────────────────────────────────────────
  // Suggestion chip click
  // ─────────────────────────────────────────────────────────────────────

  const handleSuggestionClick = (question) => {
    sendMessage(question);
  };

  // ─────────────────────────────────────────────────────────────────────
  // Auto-resize textarea
  // ─────────────────────────────────────────────────────────────────────

  const handleInputChange = (event) => {
    setInputValue(event.target.value);
    // Auto-resize
    const el = event.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 110)}px`;
  };

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────

  const hasMessages = messages.length > 0;
  const canSend = !isSending && inputValue.trim().length > 0;

  return (
    <div className={styles.panel}>
      {/* Session selector bar — hidden when DB tables aren't ready */}
      <div className={styles.sessionBar} style={!dbReady ? { display: "none" } : undefined}>
        {sessionsLoading ? (
          <span className={styles.loadingText}>Loading history…</span>
        ) : (
          <>
            {/* Session dropdown — global Dropdown component for consistent theme */}
            <Dropdown
              options={sessionOptions}
              value={currentSessionId}
              onChange={handleSessionChange}
              placeholder="New conversation"
              size="sm"
              ariaLabel="Select chat session"
              style={{ flex: "1 1 auto", minWidth: 0 }}
              disabled={sessions.length === 0}
            />

            {/* Delete current session */}
            <button
              type="button"
              className={styles.deleteSessionButton}
              onClick={handleDeleteSession}
              disabled={!currentSessionId}
              title="Delete this chat"
              aria-label="Delete session"
            >
              ×
            </button>
          </>
        )}

        {/* New chat button */}
        <button
          type="button"
          className={styles.newChatButton}
          onClick={handleNewChat}
          disabled={isSending}
        >
          + New
        </button>
      </div>

      {sessionsError && (
        <div className={styles.errorBanner}>{sessionsError}</div>
      )}

      {/* Setup notice — shown when Supabase tables haven't been created yet */}
      {!dbReady && (
        <div className={styles.setupNotice}>
          <strong>Chat history unavailable.</strong> The AI guide is answering questions but
          conversations won't be saved. To enable history, run the SQL migration in your
          Supabase dashboard — see <code>src/features/appGuide/aiChatDatabase.js</code> for
          the exact statements.
        </div>
      )}

      {/* Message list area */}
      <div className={styles.messages} role="log" aria-live="polite" aria-label="Chat messages">
        {/* Loading state */}
        {messagesLoading && (
          <div className={styles.emptyChat}>
            <p>Loading messages…</p>
          </div>
        )}

        {/* Empty state — show starter chips */}
        {!messagesLoading && !hasMessages && !isSending && (
          <div className={styles.emptyChat}>
            <h4>App Guide</h4>
            <p>Ask me anything about the HNP System — pages, features, roles, or how-tos.</p>
            <div className={styles.emptySuggestions}>
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={styles.suggestionChip}
                  onClick={() => handleSuggestionClick(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Rendered messages */}
        {!messagesLoading &&
          messages.map((msg, index) => {
            const isUser = msg.role === "user";
            const isLast = index === messages.length - 1;
            const isLastAssistant = !isUser && isLast;

            return (
              <div
                key={msg.id || index}
                className={`${styles.messageBubble} ${isUser ? styles.messageUser : styles.messageAssistant}`}
              >
                {/* Message content */}
                <div className={styles.bubbleContent}>
                  {isUser ? (
                    // User messages: plain text
                    msg.content
                  ) : (
                    // Assistant messages: rendered markdown
                    renderMarkdown(msg.content)
                  )}
                </div>

                {/* Source citations under assistant messages */}
                {!isUser && msg.sources && msg.sources.length > 0 && (
                  <div className={styles.sources} aria-label="Sources">
                    {msg.sources.map((src) => (
                      <span
                        key={src.id}
                        className={`${styles.sourceTag} ${src.route ? styles.sourceTagLink : ""}`}
                        title={src.route ? `Navigate to ${src.route}` : src.title}
                        onClick={
                          src.route
                            ? () => {
                                window.location.href = src.route;
                              }
                            : undefined
                        }
                      >
                        {src.title}
                      </span>
                    ))}
                  </div>
                )}

                {/* Follow-up suggestions after the last assistant message */}
                {isLastAssistant && latestSuggestedQuestions.length > 0 && (
                  <div className={styles.followUpRow} aria-label="Suggested follow-up questions">
                    {latestSuggestedQuestions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        className={styles.followUpChip}
                        onClick={() => handleSuggestionClick(q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {/* Timestamp */}
                <span className={styles.messageTime}>
                  {formatTime(msg.createdAt)}
                </span>
              </div>
            );
          })}

        {/* Typing indicator while sending */}
        {isSending && (
          <div className={`${styles.messageBubble} ${styles.messageAssistant}`}>
            <div className={styles.typingIndicator} aria-label="Assistant is thinking">
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Send error */}
      {sendError && (
        <div className={styles.errorBanner} role="alert">{sendError}</div>
      )}

      {/* Input row */}
      <div className={styles.inputRow}>
        <div className={styles.inputWrap}>
          <textarea
            ref={inputRef}
            className={styles.input}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder="Ask anything about the app…"
            disabled={isSending}
            maxLength={MAX_INPUT_LENGTH}
            rows={1}
            aria-label="Type your question"
          />
        </div>
        <button
          type="button"
          className={styles.sendButton}
          onClick={handleSendClick}
          disabled={!canSend}
          aria-label="Send message"
        >
          Send
        </button>
      </div>
    </div>
  );
}
