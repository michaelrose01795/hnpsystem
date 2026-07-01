// file location: src/components/dev-platform/useNotifications.js
//
// Phase 10 — client hook for in-app notifications. Loads the developer's
// notifications + unread count, and STREAMS unread-count changes over SSE
// (/api/support/notifications/stream) so the bell updates live without every
// tab polling. If SSE is unavailable (older browser / proxy strips it) it falls
// back to a gentle poll. Marking read is optimistic. Degrades to "empty" (never
// throws) when the migration is absent — the server returns [] in that case.

import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "@/components/dev-platform/usePlatformResource";

const API = "/api/support/notifications";
const STREAM = "/api/support/notifications/stream";
const POLL_MS = 30000;

export default function useNotifications({ stream = true } = {}) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const esRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(API, { credentials: "include" });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.success) {
        setItems(body.data || []);
        setUnread(body.unread || 0);
      }
    } catch {
      /* keep last known state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live unread count via SSE, with a polling fallback.
  useEffect(() => {
    if (!stream || typeof window === "undefined" || typeof window.EventSource === "undefined") {
      const timer = setInterval(load, POLL_MS);
      return () => clearInterval(timer);
    }
    let cancelled = false;
    let pollTimer = null;
    try {
      const es = new EventSource(STREAM, { withCredentials: true });
      esRef.current = es;
      es.addEventListener("unread", (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (!cancelled && typeof data.unread === "number") {
            setUnread((prev) => {
              // When the unread count grows, refresh the list so the new item shows.
              if (data.unread > prev) load();
              return data.unread;
            });
          }
        } catch {
          /* ignore malformed frame */
        }
      });
      es.onerror = () => {
        // Browser auto-reconnects; if it can't, fall back to polling.
        if (!pollTimer) pollTimer = setInterval(load, POLL_MS);
      };
    } catch {
      pollTimer = setInterval(load, POLL_MS);
    }
    return () => {
      cancelled = true;
      if (esRef.current) esRef.current.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [stream, load]);

  const markRead = useCallback(async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
    await postJson(API, { action: "read", id });
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    setUnread(0);
    await postJson(API, { action: "read_all" });
  }, []);

  return { items, unread, loading, reload: load, markRead, markAllRead };
}
