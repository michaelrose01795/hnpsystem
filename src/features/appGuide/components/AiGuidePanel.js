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
//   - Follow-up question chips
//   - Role-aware — answers reflect the user's own access level

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useConfirmation } from "@/context/ConfirmationContext";
import { getEntryByRoute } from "@/features/appGuide/queryEngine";
import styles from "./AiGuidePanel.module.css";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import LayerTheme from "@/components/ui/LayerTheme";
import SearchBar from "@/components/ui/searchBarAPI/SearchBar";
import StatusMessage from "@/components/ui/StatusMessage";
import PopupModal from "@/components/popups/popupStyleApi";

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

// Match the Share Note popup geometry while retaining the canonical popup shell.
const HISTORY_POPUP_CARD_STYLE = {
  width: "min(100%, 520px)",
  maxWidth: "520px",
  padding: "var(--page-card-padding)",
  overflow: "hidden",
  boxSizing: "border-box",
};

function titleFromRoute(route) {
  const path = String(route || "").split("?")[0].split("#")[0];
  const parts = path
    .split("/")
    .filter(Boolean)
    .filter((part) => !/^\[.+\]$/.test(part))
    .filter((part) => !/^\d+$/.test(part));
  const lastParts = parts.slice(-2);
  if (lastParts.length === 0) return "Current Page";
  return lastParts
    .join(" ")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

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

    // Compact numbered step — answers commonly use **1**Step text.
    const compactNumberedMatch = line.match(/^\*\*(\d+)\*\*\s*(.*)$/);
    if (compactNumberedMatch) {
      elements.push(
        <div key={key++} className={styles.mdStep}>
          <span className={styles.mdStepNum}>{compactNumberedMatch[1]}</span>
          <span className={styles.mdStepText}>{renderInline(compactNumberedMatch[2], key++)}</span>
        </div>
      );
      continue;
    }

    // Section heading — a line that is entirely bold
    const headingMatch = line.match(/^\*\*(.+)\*\*$/);
    if (headingMatch) {
      elements.push(
        <div key={key++} className={styles.mdHeading}>
          {headingMatch[1]}
        </div>
      );
      continue;
    }

    // Numbered list item — rendered as a numbered step row
    const numberedMatch = line.match(/^(\d+)\.\s*(.*)$/);
    if (numberedMatch) {
      elements.push(
        <div key={key++} className={styles.mdStep}>
          <span className={styles.mdStepNum}>{numberedMatch[1]}</span>
          <span className={styles.mdStepText}>{renderInline(numberedMatch[2], key++)}</span>
        </div>
      );
      continue;
    }

    // Bullet list item
    if (line.startsWith("• ") || line.startsWith("- ")) {
      elements.push(
        <div key={key++} className={styles.mdBullet}>
          <span className={styles.mdBulletDot} aria-hidden="true">•</span>
          <span className={styles.mdStepText}>{renderInline(line.slice(2), key++)}</span>
        </div>
      );
      continue;
    }

    // Empty line → spacing
    if (!line.trim()) {
      elements.push(<div key={key++} className={styles.mdSpacer} aria-hidden="true" />);
      continue;
    }

    // Normal paragraph line
    elements.push(<div key={key++} className={styles.mdParagraph}>{renderInline(line, key++)}</div>);
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

    // Asterisk italic: *text* (after bold has already been handled).
    const starItalicMatch = remaining.match(/^(.*?)\*([^*]+?)\*(.*)/s);
    if (starItalicMatch) {
      if (starItalicMatch[1]) parts.push(<React.Fragment key={partKey++}>{starItalicMatch[1]}</React.Fragment>);
      parts.push(<em key={partKey++}>{starItalicMatch[2]}</em>);
      remaining = starItalicMatch[3];
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

function formatSessionDate(isoString) {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString([], {
      day: "numeric",
      month: "short",
      year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    });
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
  return { sessions: Array.isArray(json.data) ? json.data : [], tableNotFound: json.tableNotFound || false };
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

async function updateSessionTitleApi(sessionId, title) {
  const res = await fetch("/api/ai/guide-sessions", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: sessionId, title }),
  });
  if (!res.ok) throw new Error("Failed to update session title");
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

async function sendQuery(message, sessionId, conversationHistory, currentPage) {
  const res = await fetch("/api/ai/guide-query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId, conversationHistory, currentPage }),
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

function SessionBarSkeleton() {
  return (
    <>
      <SkeletonKeyframes />
      <div className={styles.sessionLoadingTitle}>
        <SkeletonBlock width="100%" height="44px" borderRadius="6px" />
      </div>
      <SkeletonBlock width="44px" height="44px" borderRadius="50%" />
    </>
  );
}

function MessagesSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
      <SkeletonKeyframes />
      <div style={{ alignSelf: "flex-start", width: "72%" }}>
        <SkeletonBlock width="100%" height="44px" borderRadius="8px" />
      </div>
      <div style={{ alignSelf: "flex-end", width: "54%" }}>
        <SkeletonBlock width="100%" height="28px" borderRadius="8px" />
      </div>
      <div style={{ alignSelf: "flex-start", width: "82%" }}>
        <SkeletonBlock width="100%" height="56px" borderRadius="8px" />
      </div>
      <div style={{ alignSelf: "flex-end", width: "60%" }}>
        <SkeletonBlock width="100%" height="28px" borderRadius="8px" />
      </div>
    </div>
  );
}

function HistoryIcon() {
  return (
    <svg
      className={styles.historyIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function DeleteChatIcon() {
  return (
    <svg
      className={styles.historyDeleteIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="m6 7 1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

/**
 * AiGuidePanel renders inside the Floating Notes body when the AI tab is active.
 *
 * Props:
 *   userId    — numeric database user ID (from useUser() → dbUserId)
 *   userRoles — string[] of the user's roles (for contextual awareness in the UI)
 */
export default function AiGuidePanel({ userId, userRoles }) {
  const router = useRouter();
  // ── Session state ──────────────────────────────────────────────────────
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [isTitleSaving, setIsTitleSaving] = useState(false);
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
  const titleInputRef = useRef(null);
  const titleSaveRef = useRef(false);
  const cancelTitleEditRef = useRef(false);
  const historyButtonRef = useRef(null);

  const currentPage = useMemo(() => {
    const route = router?.asPath || router?.pathname || "";
    const entry = getEntryByRoute(route);
    const fallbackTitle = titleFromRoute(router?.pathname || route);
    return {
      route,
      pathname: router?.pathname || "",
      title: entry?.title || fallbackTitle,
      entryId: entry?.id || "",
    };
  }, [router?.asPath, router?.pathname]);

  const currentSession = useMemo(
    () => sessions.find((session) => session.id === currentSessionId) || null,
    [currentSessionId, sessions]
  );

  const currentSessionTitle = currentSession?.title || "New conversation";
  const filteredHistorySessions = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter((session) => String(session.title || "Untitled chat").toLowerCase().includes(query));
  }, [historySearch, sessions]);

  const starterQuestions = useMemo(() => {
    if (!currentPage.title) {
      return [
        "What can I do on this page?",
        "How do I use this screen?",
        ...STARTER_QUESTIONS.slice(0, 4),
      ];
    }

    return [
      `What can I do on ${currentPage.title}?`,
      `How do I use ${currentPage.title}?`,
      `Who can access ${currentPage.title}?`,
      `Where does ${currentPage.title} fit in the workflow?`,
      "How do slash commands work in Floating Notes?",
    ];
  }, [currentPage.title]);

  useEffect(() => {
    if (!isEditingTitle) setTitleDraft(currentSessionTitle);
  }, [currentSessionTitle, isEditingTitle]);

  useEffect(() => {
    if (!isHistoryOpen) return;
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      setIsHistoryOpen(false);
      setHistorySearch("");
      requestAnimationFrame(() => historyButtonRef.current?.focus());
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isHistoryOpen]);

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
    const messageList = messagesEndRef.current?.parentElement;
    if (!messageList) return;
    messageList.scrollTo({ top: messageList.scrollHeight, behavior: "smooth" });
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
      const result = await sendQuery(text, currentSessionId, conversationHistory, currentPage);

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

      // Keep a manually edited title stable. Only a newly created session is
      // auto-titled from its first question; later messages update recency.
      if (result.sessionId) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === result.sessionId
              ? {
                  ...s,
                  ...(result.sessionId !== currentSessionId ? { title: text.slice(0, 60) } : {}),
                  updatedAt: new Date().toISOString(),
                }
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
  }, [isSending, messages, currentSessionId, currentPage]);

  // ─────────────────────────────────────────────────────────────────────
  // Handle input submission
  // ─────────────────────────────────────────────────────────────────────

  // Collapse the auto-grown textarea back to its single 44px row.
  const resetInputHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = "";
      inputRef.current.style.overflowY = "";
    }
  };

  const handleInputKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const text = inputValue.trim();
      if (text) {
        setInputValue("");
        resetInputHeight();
        sendMessage(text);
      }
    }
  };

  const handleSendClick = () => {
    const text = inputValue.trim();
    if (text) {
      setInputValue("");
      resetInputHeight();
      sendMessage(text);
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // Start a new chat
  // ─────────────────────────────────────────────────────────────────────

  // The title field is always mounted, so "editing" simply means focused. The
  // flag stops the effect below from overwriting the draft mid-type.
  const startEditingSessionTitle = () => {
    setIsHistoryOpen(false);
    setHistorySearch("");
    setIsEditingTitle(true);
    titleInputRef.current?.select();
  };

  const saveSessionTitle = async () => {
    if (titleSaveRef.current) return;

    const nextTitle = titleDraft.trim().replace(/\s+/g, " ").slice(0, 120);
    if (!nextTitle) {
      setTitleDraft(currentSessionTitle);
      setIsEditingTitle(false);
      return;
    }
    if (currentSessionId && nextTitle === currentSessionTitle) {
      setIsEditingTitle(false);
      return;
    }

    titleSaveRef.current = true;
    setIsTitleSaving(true);
    setSessionsError("");
    try {
      if (currentSessionId) {
        const updatedSession = await updateSessionTitleApi(currentSessionId, nextTitle);
        setSessions((previous) => previous.map((session) => (
          session.id === currentSessionId
            ? { ...session, ...updatedSession, title: updatedSession?.title || nextTitle }
            : session
        )));
      } else {
        const createdSession = await createNewSession(nextTitle);
        setSessions((previous) => [createdSession, ...previous]);
        setCurrentSessionId(createdSession.id);
      }
      setTitleDraft(nextTitle);
      setIsEditingTitle(false);
    } catch (error) {
      setSessionsError(error.message || "Failed to update the conversation title");
    } finally {
      titleSaveRef.current = false;
      setIsTitleSaving(false);
    }
  };

  const handleTitleBlur = () => {
    if (cancelTitleEditRef.current) {
      cancelTitleEditRef.current = false;
      return;
    }
    saveSessionTitle();
  };

  const handleTitleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      // The field stays mounted now, so cancel by reverting the draft and
      // blurring — the flag stops that blur from saving.
      cancelTitleEditRef.current = true;
      setTitleDraft(currentSessionTitle);
      setIsEditingTitle(false);
      event.currentTarget.blur();
    }
  };

  const closeHistory = () => {
    setIsHistoryOpen(false);
    setHistorySearch("");
    requestAnimationFrame(() => historyButtonRef.current?.focus());
  };

  const toggleHistory = () => {
    if (isHistoryOpen) {
      closeHistory();
      return;
    }
    setHistorySearch("");
    setIsHistoryOpen(true);
  };

  const handleNewChat = async () => {
    setIsHistoryOpen(false);
    setHistorySearch("");
    setIsEditingTitle(false);
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

  const handleDeleteSession = async (sessionId) => {
    if (!sessionId) return;
    const sessionToDelete = sessions.find((session) => session.id === sessionId);
    const confirmed = await confirm({
      title: "Delete chat session",
      message: `Delete "${sessionToDelete?.title || "Untitled chat"}"? This cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;

    try {
      await deleteSessionApi(sessionId);
      const remainingSessions = sessions.filter((session) => session.id !== sessionId);
      setSessions(remainingSessions);
      if (sessionId === currentSessionId) {
        setCurrentSessionId(remainingSessions[0]?.id || null);
        setMessages([]);
        setLatestSuggestedQuestions([]);
      }
    } catch (err) {
      setSessionsError(err.message || "Failed to delete session");
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // Switch to a session selected from the history popup.
  // ─────────────────────────────────────────────────────────────────────

  const handleSessionChange = useCallback((sessionId) => {
    const selectedId = Number(sessionId);
    if (Number.isInteger(selectedId) && selectedId > 0) {
      setCurrentSessionId(selectedId);
      setIsHistoryOpen(false);
      setHistorySearch("");
    } else {
      setCurrentSessionId(null);
      setMessages([]);
    }
  }, []);

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
    // The box starts at a single 44px row, then grows by ONE line-height
    // per extra wrapped line (not a full 44px). It stops growing after
    // 3 lines and scrolls internally beyond that.
    const el = event.target;
    const FIRST_ROW = 44;
    const MAX_LINES = 3;
    const cs = window.getComputedStyle(el);
    const lineHeight = parseFloat(cs.lineHeight) || 22;
    const vPadding = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    el.style.height = "auto";
    const textHeight = el.scrollHeight - vPadding;
    const rawLines = Math.max(1, Math.round(textHeight / lineHeight));
    const lines = Math.min(MAX_LINES, rawLines);
    el.style.height = `${FIRST_ROW + (lines - 1) * lineHeight}px`;
    // Only show a scrollbar once the text exceeds the 3rd line — while
    // it is still growing (lines 1-3) the box is sized to fit exactly.
    el.style.overflowY = rawLines > MAX_LINES ? "auto" : "hidden";
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
          <SessionBarSkeleton />
        ) : (
          <>
            {/* The title is always a real text box — the canonical InputField,
                so it carries the staffglobal .app-input treatment (height,
                padding, radius, fill, focus ring) in every state. It used to
                render as a bare heading button until clicked, which is why it
                did not look like a field. Edits still save on blur / Enter and
                revert on Escape. */}
            <InputField
              ref={titleInputRef}
              type="text"
              className={styles.sessionTitleField}
              style={{ minWidth: 0 }}
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onFocus={startEditingSessionTitle}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              maxLength={120}
              placeholder="Conversation title"
              aria-label="Conversation title"
              title="Edit conversation title"
              disabled={isTitleSaving}
            />

            <button
              ref={historyButtonRef}
              type="button"
              className={`app-btn app-btn--secondary ${styles.historyButton}`}
              onClick={toggleHistory}
              title="Chat history"
              aria-label="Open chat history"
              aria-haspopup="dialog"
              aria-expanded={isHistoryOpen}
            >
              <HistoryIcon />
            </button>
          </>
        )}

        {/* New chat button */}
        <button
          type="button"
          className={`app-btn app-btn--secondary ${styles.newChatButton}`}
          onClick={handleNewChat}
          disabled={isSending}
          aria-label="Start a new chat"
        >
          <span aria-hidden="true">+</span>
          <span className={styles.newChatLabel}>New</span>
        </button>
      </div>

      {isHistoryOpen && (
        <PopupModal
          isOpen
          onClose={closeHistory}
          ariaLabel="Chat history"
          cardStyle={HISTORY_POPUP_CARD_STYLE}
        >
          <div className={styles.historyPopupContent}>
            <header className="app-popup-compact-header">
              <h3>Chat history</h3>
              <div className="app-popup-compact-header__actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={closeHistory}
                >
                  Close
                </Button>
              </div>
            </header>

            {sessionsError && <StatusMessage tone="danger">{sessionsError}</StatusMessage>}

            <div className={`app-layout-toolbar-row ${styles.historyToolbar}`}>
              <SearchBar
                type="search"
                className={styles.historySearch}
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                onClear={() => setHistorySearch("")}
                placeholder="Search conversations"
                ariaLabel="Search conversations"
              />
              <span className={`app-badge app-badge--accent-soft ${styles.historyCount}`} aria-live="polite">
                {sessions.length} {sessions.length === 1 ? "conversation" : "conversations"}
              </span>
            </div>

            <LayerTheme
              className={`${styles.historyList} themed-scrollbar`}
              radius="var(--radius-sm)"
              padding="0"
              gap="0"
              role="list"
              aria-label="Conversations"
            >
              {filteredHistorySessions.length === 0 ? (
                <EmptyState
                  variant="bare"
                  role="status"
                  title={historySearch ? "No matching conversations" : "No saved conversations"}
                  description={historySearch ? "Try a different conversation title." : "Start a new chat and it will appear here automatically."}
                />
              ) : filteredHistorySessions.map((session) => (
                <div
                  key={session.id}
                  className={`${styles.historyRow} ${session.id === currentSessionId ? styles.historyRowActive : ""}`}
                  role="listitem"
                >
                  <button
                    type="button"
                    className={`app-btn ${styles.historySessionButton}`}
                    onClick={() => handleSessionChange(session.id)}
                    aria-current={session.id === currentSessionId ? "true" : undefined}
                  >
                    <span className={styles.historyTitle}>{session.title || "Untitled chat"}</span>
                    <span className={styles.historyMeta}>
                      <time
                        className={styles.historyDate}
                        dateTime={session.updatedAt || session.createdAt || undefined}
                      >
                        {formatSessionDate(session.updatedAt || session.createdAt)}
                      </time>
                      {session.id === currentSessionId && <span className={styles.historyCurrent}>Current</span>}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="secondary"
                    className={styles.historyDeleteButton}
                    onClick={() => handleDeleteSession(session.id)}
                    title="Delete chat"
                    aria-label={`Delete ${session.title || "Untitled"} chat`}
                  >
                    <DeleteChatIcon />
                  </Button>
                </div>
              ))}
            </LayerTheme>
          </div>
        </PopupModal>
      )}

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
      <div
        className={styles.messages}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        tabIndex={0}
      >
        {/* Loading state */}
        {messagesLoading && <MessagesSkeleton />}

        {/* Empty state — show starter chips */}
        {!messagesLoading && !hasMessages && !isSending && (
          <div className={styles.emptyChat}>
            <h4>App Guide</h4>
            <p>Ask me anything about the HNP System — pages, features, roles, or how-tos.</p>
            <div className={styles.emptySuggestions}>
              {starterQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={`app-btn app-btn--secondary ${styles.suggestionChip}`}
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
              <article
                key={msg.id || index}
                className={`${styles.messageBubble} ${isUser ? styles.messageUser : styles.messageAssistant}`}
              >
                <div className={styles.messageMeta}>
                  <span className={styles.messageAuthor}>{isUser ? "You" : "App Guide"}</span>
                  <time className={styles.messageTime} dateTime={msg.createdAt || undefined}>
                    {formatTime(msg.createdAt)}
                  </time>
                </div>

                {/* Message content */}
                {isUser ? (
                  <div className={styles.bubbleContent}>{msg.content}</div>
                ) : (
                  <LayerTheme
                    className={styles.bubbleContent}
                    radius="var(--radius-sm)"
                    padding="var(--space-3) var(--space-4)"
                    gap="var(--space-sm)"
                  >
                    {renderMarkdown(msg.content)}
                  </LayerTheme>
                )}

                {/* Follow-up suggestions after the last assistant message */}
                {isLastAssistant && latestSuggestedQuestions.length > 0 && (
                  <div className={styles.followUpRow} aria-label="Suggested follow-up questions">
                    {latestSuggestedQuestions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        className={`app-btn app-btn--secondary ${styles.followUpChip}`}
                        onClick={() => handleSuggestionClick(q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

              </article>
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
            className={`app-input ${styles.input}`}
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
          className={`app-btn app-btn--primary ${styles.sendButton}`}
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
