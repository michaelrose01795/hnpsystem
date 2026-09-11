// file location: src/hooks/useNewsAckBadge.js
//
// The News Feed sidebar badge: how many published updates the signed-in user
// still owes an acknowledgement on, plus the sentence that explains it
// ("This update needs your acknowledgement. 6 days overdue.").
//
// Refresh strategy, and why it is not the one useMessagesBadge uses:
//
//   * A message can arrive from anyone at any second, so that badge holds an
//     open Realtime channel. An update that needs acknowledging is published a
//     handful of times a week, so a second channel on every page — mounted by
//     the sidebar, i.e. the whole staff app — would cost far more than it is
//     worth.
//   * Instead the first value is seeded from /api/shell/bootstrap (so a fresh
//     boot costs no request of its own), then re-read whenever something in the app
//     records an acknowledgement (the `news:acknowledgements-changed` event
//     useNewsFeed raises), and again when a backgrounded tab comes back after
//     the value has gone stale. The last one also keeps the due-date wording
//     honest, since "2 days overdue" becomes "3 days overdue" with no data
//     change at all.
//
// `userId` gates the query the same way it does for the message badge:
// presentation mode passes null so the presenter's own outstanding
// acknowledgements are never shown against the demo role.

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchOutstandingAcks } from "@/lib/api/news";
import { getShellBootstrap, peekShellBootstrap } from "@/lib/shell/bootstrapClient";
import { logFailure } from "@/lib/utils/logFailure";

/** Raised by anything that records an acknowledgement, so the badge can drop. */
export const NEWS_ACK_CHANGED_EVENT = "news:acknowledgements-changed";

/** Fire-and-forget notifier — safe to call from the server or a test. */
export const notifyAcknowledgementsChanged = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NEWS_ACK_CHANGED_EVENT));
};

const EMPTY_SUMMARY = { count: 0, overdueCount: 0, dueAt: null, isOverdue: false };

// How old a value may be before a returning tab re-reads it.
const STALE_AFTER_MS = 5 * 60 * 1000;

const normalizeSummary = (data) => ({
  count: Number(data?.count) || 0,
  overdueCount: Number(data?.overdueCount) || 0,
  dueAt: data?.dueAt || null,
  isOverdue: Boolean(data?.isOverdue),
});

export function useNewsAckBadge(userId) {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const loadedAtRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSummary(EMPTY_SUMMARY);
      return;
    }

    try {
      const data = await fetchOutstandingAcks();
      loadedAtRef.current = Date.now();
      setSummary(normalizeSummary(data));
    } catch (error) {
      // Best-effort poll, exactly like the message badge: no session yet, or a
      // viewer the route cannot resolve, means no badge — not a runtime error
      // in the middle of the app shell.
      logFailure("❌ Failed to refresh the news acknowledgement badge:", error);
      setSummary(EMPTY_SUMMARY);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setSummary(EMPTY_SUMMARY);
      loadedAtRef.current = 0;
      return undefined;
    }

    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      void refresh();
    };

    // First value comes from the combined shell bootstrap when it is available,
    // so the badge costs no request of its own on a fresh boot — the same deal
    // useMessagesBadge gets. /api/news/outstanding-acks stays the refresh path.
    const seed = peekShellBootstrap();
    if (seed && Number(seed.userId) === Number(userId) && seed.outstandingAcks) {
      loadedAtRef.current = Date.now();
      setSummary(normalizeSummary(seed.outstandingAcks));
    } else {
      void getShellBootstrap({ userKey: userId }).then((boot) => {
        if (cancelled) return;
        if (boot && Number(boot.userId) === Number(userId) && boot.outstandingAcks) {
          loadedAtRef.current = Date.now();
          setSummary(normalizeSummary(boot.outstandingAcks));
        } else {
          run();
        }
      });
    }

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - loadedAtRef.current < STALE_AFTER_MS) return;
      run();
    };

    window.addEventListener(NEWS_ACK_CHANGED_EVENT, run);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.removeEventListener(NEWS_ACK_CHANGED_EVENT, run);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, refresh]);

  return { ...summary, refresh };
}

export default useNewsAckBadge;
