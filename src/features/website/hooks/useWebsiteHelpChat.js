// file location: src/features/website/hooks/useWebsiteHelpChat.js
//
// State for the website help chat widget (components/WebsiteHelpChat.js).
//
// The chat itself is saved server-side (/api/website/help-chat), so a visitor
// can close the page and pick it up again; this device only remembers WHICH chat
// was open and when it last showed the visitor the newest message, so the
// launcher can show an unread dot after a member of staff replies.
//
// While a chat is waiting for, or talking to, the team the hook polls for new
// messages: every few seconds with the window open, slowly with it closed.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

const API = "/api/website/help-chat";
const STORAGE_KEY = "hnp-website-help-chat";
const LIVE_STATUSES = new Set(["queued", "active"]);
const POLL_OPEN_MS = 4000;
const POLL_CLOSED_MS = 20000;

const readStored = () => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
};

const writeStored = (patch) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStored(), ...patch }));
  } catch {
    // Storage blocked (private mode) — the chat still works for this page view.
  }
};

async function request(url, { method = "GET", body } = {}) {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    const error = new Error(data?.message || "Something went wrong. Please try again.");
    error.status = response.status;
    throw error;
  }
  return data;
}

const latestIncoming = (messages) =>
  [...messages].reverse().find((m) => m.author === "staff" || m.author === "system")?.createdAt || null;

export default function useWebsiteHelpChat() {
  const router = useRouter();
  const pagePath = String(router?.asPath || "/website").split(/[?#]/)[0] || "/website";

  const [open, setOpen] = useState(false);
  const [view, setView] = useState("chat");
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [signedIn, setSignedIn] = useState(false);
  const [history, setHistory] = useState({ loading: false, chats: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [seenAt, setSeenAt] = useState(null);
  const loadingRef = useRef(null);

  const applyPayload = useCallback((data) => {
    setChat(data.chat);
    setMessages(Array.isArray(data.messages) ? data.messages : []);
    setSignedIn(Boolean(data.signedIn));
    writeStored({ chatId: data.chat?.id || null });
  }, []);

  const loadChat = useCallback(
    async (chatId, { silent = false } = {}) => {
      if (!silent) setBusy(true);
      try {
        applyPayload(await request(`${API}/${chatId}`));
        return true;
      } catch (err) {
        if (err.status === 404 || err.status === 400) {
          writeStored({ chatId: null });
          setChat(null);
          setMessages([]);
        } else if (!silent) {
          setError(err.message);
        }
        return false;
      } finally {
        if (!silent) setBusy(false);
      }
    },
    [applyPayload],
  );

  const startChat = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      applyPayload(await request(API, { method: "POST", body: { pagePath } }));
      setView("chat");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [applyPayload, pagePath]);

  // Resume the chat this device last had open, so a reply from the team can
  // light the launcher on any page.
  useEffect(() => {
    const stored = readStored();
    setSeenAt(stored.seenAt || null);
    if (stored.chatId) loadingRef.current = loadChat(stored.chatId, { silent: true });
  }, [loadChat]);

  const openPanel = useCallback(async () => {
    setOpen(true);
    if (chat) return;
    if (loadingRef.current) {
      const resumed = await loadingRef.current;
      loadingRef.current = null;
      if (resumed) return;
    }
    const stored = readStored();
    if (stored.chatId && (await loadChat(stored.chatId))) return;
    await startChat();
  }, [chat, loadChat, startChat]);

  const closePanel = useCallback(() => setOpen(false), []);

  const toggle = useCallback(() => {
    if (open) closePanel();
    else openPanel();
  }, [open, openPanel, closePanel]);

  const post = useCallback(
    async (body) => {
      if (!chat) return false;
      setBusy(true);
      setError("");
      try {
        applyPayload(await request(`${API}/${chat.id}`, { method: "POST", body: { ...body, pagePath } }));
        return true;
      } catch (err) {
        setError(err.message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [applyPayload, chat, pagePath],
  );

  const send = useCallback(
    async (text) => {
      const content = String(text || "").trim();
      if (!content || !chat) return false;
      const pendingId = `pending-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: pendingId, author: "customer", content, links: [], suggestions: [], createdAt: new Date().toISOString() },
      ]);
      const ok = await post({ action: "message", content });
      if (!ok) setMessages((prev) => prev.filter((m) => m.id !== pendingId));
      return ok;
    },
    [chat, post],
  );

  const joinQueue = useCallback((contact = {}) => post({ action: "queue", ...contact }), [post]);
  const endChat = useCallback(() => post({ action: "close" }), [post]);

  const showHistory = useCallback(async () => {
    setView("history");
    setHistory((prev) => ({ ...prev, loading: true }));
    try {
      const data = await request(API);
      setHistory({ loading: false, chats: data.chats || [] });
    } catch (err) {
      setHistory({ loading: false, chats: [] });
      setError(err.message);
    }
  }, []);

  const pickChat = useCallback(
    async (chatId) => {
      setView("chat");
      if (chat?.id !== chatId) await loadChat(chatId);
    },
    [chat, loadChat],
  );

  const newChat = useCallback(() => startChat(), [startChat]);
  const backToChat = useCallback(() => setView("chat"), []);
  const clearError = useCallback(() => setError(""), []);

  // Live chats poll for the team's replies.
  const chatId = chat?.id;
  const live = Boolean(chat && LIVE_STATUSES.has(chat.status));
  useEffect(() => {
    if (!live || !chatId) return undefined;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      loadChat(chatId, { silent: true });
    }, open ? POLL_OPEN_MS : POLL_CLOSED_MS);
    return () => window.clearInterval(timer);
  }, [live, chatId, open, loadChat]);

  // Everything on screen in an open chat counts as seen.
  const incomingAt = latestIncoming(messages);
  useEffect(() => {
    if (!open || view !== "chat" || !incomingAt) return;
    setSeenAt(incomingAt);
    writeStored({ seenAt: incomingAt });
  }, [open, view, incomingAt]);

  const unread = Boolean(
    !open && live && incomingAt && (!seenAt || new Date(incomingAt).getTime() > new Date(seenAt).getTime()),
  );

  return {
    pagePath,
    open,
    view,
    chat,
    messages,
    signedIn,
    history,
    busy,
    error,
    unread,
    toggle,
    closePanel,
    send,
    joinQueue,
    endChat,
    showHistory,
    pickChat,
    newChat,
    backToChat,
    clearError,
  };
}
