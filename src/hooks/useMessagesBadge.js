// file location: src/hooks/useMessagesBadge.js
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fetchMessageThreads } from "@/lib/api/messages";

export function useMessagesBadge(userId) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    try {
      const payload = await fetchMessageThreads({ userId });
      const threads = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.threads)
        ? payload.threads
        : [];
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
