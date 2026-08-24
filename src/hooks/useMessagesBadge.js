// file location: src/hooks/useMessagesBadge.js
import { useCallback, useEffect, useState } from "react";
import { getShellBootstrap, peekShellBootstrap } from "@/lib/shell/bootstrapClient";

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
      // Dedicated count endpoint. This used to call /api/messages/threads and
      // reduce the full thread list (participants, user records, message bodies)
      // down to one integer; /api/messages/unread-count applies the same unread
      // rule server-side over a single column.
      const response = await fetch(`/api/messages/unread-count${buildQuery({ userId })}`);
      if (!response.ok) {
        // No session yet, or the user can't view threads — this badge is a
        // best-effort poll, so just show no count instead of surfacing a
        // runtime error.
        setUnreadCount(0);
        return;
      }
      const payload = await response.json();
      const totalUnread = Number(payload?.data?.unreadCount) || 0;
      setUnreadCount(totalUnread);
    } catch (error) {
      console.error("❌ Failed to refresh message badge:", error);
    }
  }, [userId]);

  // First value comes from the combined shell bootstrap when it is available,
  // so the badge costs no request of its own on a fresh boot. Realtime events
  // and later refreshes use /api/messages/unread-count as before.
  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    let cancelled = false;
    const seed = peekShellBootstrap();
    if (seed && Number(seed.userId) === Number(userId) && typeof seed.unreadCount === "number") {
      setUnreadCount(seed.unreadCount);
      return;
    }
    void getShellBootstrap({ userKey: userId }).then((boot) => {
      if (cancelled) return;
      if (boot && Number(boot.userId) === Number(userId) && typeof boot.unreadCount === "number") {
        setUnreadCount(boot.unreadCount);
      } else {
        void refreshUnreadCount();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId, refreshUnreadCount]);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return undefined;
    }

    // The Supabase client is imported dynamically, and this is the reason the
    // whole application is not carrying it.
    //
    // This hook is mounted by StaffSidebar, which is mounted by StaffLayout,
    // which is mounted by Layout — the global page shell. A static import here
    // therefore put all 213 KB of @supabase/supabase-js into the first-load
    // bundle of every page that renders Layout, including 40+ routes that never
    // touch the database from the browser at all. The badge itself needs none of
    // it: its value comes from the shell bootstrap and /api/messages/unread-count.
    // Only this subscription does, and only after mount.
    //
    // Pages that genuinely use Realtime still import the client directly and are
    // unaffected — for them this resolves to the module they already have.
    let cancelled = false;
    let teardown = null;

    void (async () => {
      const { supabase } = await import("@/lib/database/supabaseClient");
      if (cancelled) return;

      // Realtime 2.111 reuses an existing channel when its topic matches. This
      // hook can be mounted by more than one shell component, and React Strict
      // Mode can start a replacement effect before async channel removal has
      // finished, so each subscription instance needs its own topic.
      const channelInstanceId =
        globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const channel = supabase
        .channel(`customer-messages-badge-${userId}-${channelInstanceId}`)
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

      teardown = () => supabase.removeChannel(channel);
    })();

    return () => {
      cancelled = true;
      // The channel may not exist yet if the effect is torn down before the
      // dynamic import settles; `cancelled` covers that case by preventing the
      // subscription from being created at all.
      if (teardown) teardown();
    };
  }, [userId, refreshUnreadCount]);

  return { unreadCount };
}
