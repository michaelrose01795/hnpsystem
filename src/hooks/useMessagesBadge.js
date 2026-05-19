// file location: src/hooks/useMessagesBadge.js
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.append(key, value);
  });
  const stringified = query.toString();
  return stringified ? `?${stringified}` : "";
};

export function useMessagesBadge(userId) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await fetch(`/api/messages/threads${buildQuery({ userId })}`);
      if (!response.ok) {
        // No session yet, or the user can't view threads — this badge is a
        // best-effort poll, so just show no count instead of surfacing a
        // runtime error.
        setUnreadCount(0);
        return;
      }
      const payload = await response.json();
      const threads = Array.isArray(payload.data) ? payload.data : [];
      const totalUnread = threads.reduce(
        (sum, thread) => sum + (thread.hasUnread ? 1 : 0),
        0
      );
      setUnreadCount(totalUnread);
    } catch (error) {
      console.error("❌ Failed to refresh message badge:", error);
    }
  }, [userId]);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return undefined;
    }

    const channel = supabase
      .channel(`customer-messages-badge-${userId}`)
      .on("postgres_changes", { schema: "public", table: "messages", event: "INSERT" }, () =>
        refreshUnreadCount()
      )
      .on(
        "postgres_changes",
        {
          schema: "public",
          table: "message_thread_members",
          event: "UPDATE",
          filter: `user_id=eq.${userId}`,
        },
        () => refreshUnreadCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refreshUnreadCount]);

  return { unreadCount };
}
