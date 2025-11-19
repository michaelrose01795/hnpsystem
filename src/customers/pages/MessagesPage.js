// file location: src/customers/pages/MessagesPage.js

"use client";

import React, { useCallback, useEffect, useState } from "react";
import CustomerLayout from "@/customers/components/CustomerLayout";
import AppointmentTimeline from "@/customers/components/AppointmentTimeline";
import { useCustomerPortalData } from "@/customers/hooks/useCustomerPortalData";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";

const STAFF_ROLE_ALLOWLIST = new Set([
  "workshop manager",
  "service manager",
  "after sales manager",
  "service advisor",
]);

// Helper function to build query strings
const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.append(key, value);
  });
  const stringified = query.toString();
  return stringified ? `?${stringified}` : "";
};

// Helper function to format notification timestamps
const formatNotificationTimestamp = (value) => {
  if (!value) return "Unknown time";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Helper function to format message timestamps
const formatMessageTimestamp = (value) => {
  if (!value) return "Unknown time";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Helper function to parse slash command metadata
const parseSlashCommandMetadata = (text = "", customer, vehicles = []) => {
  if (!text) return null;
  const metadata = {};
  const regex = /\/([^\s]+)/gi;
  let match = null;
  while ((match = regex.exec(text)) !== null) {
    const token = (match[1] || "").toLowerCase();
    if (/^\d+$/.test(token) && !metadata.jobNumber) {
      metadata.jobNumber = token;
    }
    if (token === "customer" && customer?.id) {
      metadata.customerId = customer.id;
    }
    if (token === "vehicle" && vehicles?.[0]?.id) {
      metadata.vehicleId = vehicles[0].id;
    }
  }
  return Object.keys(metadata).length ? metadata : null;
};

export default function CustomerMessagesPage() {
  const { timeline, customer, vehicles, isLoading, error } = useCustomerPortalData();
  const { dbUserId } = useUser();

  // Composer state
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSearch, setComposerSearch] = useState("");
  const [composerResults, setComposerResults] = useState([]);
  const [composerLoading, setComposerLoading] = useState(false);
  const [composerError, setComposerError] = useState("");
  const [composerSelection, setComposerSelection] = useState([]);
  const [composerCreating, setComposerCreating] = useState(false);

  // Conversation state
  const [conversationFeedback, setConversationFeedback] = useState("");
  const [conversationError, setConversationError] = useState("");

  // System notifications state
  const [systemNotifications, setSystemNotifications] = useState([]);
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemError, setSystemError] = useState("");
  const [isSystemThreadActive, setIsSystemThreadActive] = useState(false);
  const [lastSystemViewedAt, setLastSystemViewedAt] = useState(null);

  // Threads state
  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState("");

  // Active thread and messages state
  const [activeThread, setActiveThread] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [savingMessageId, setSavingMessageId] = useState(null);

  // Helper function to check if a role matches allowlist
  const matchesAllowedRole = (role) => {
    if (!role) return false;
    return STAFF_ROLE_ALLOWLIST.has(role.toLowerCase());
  };

  // Helper function to filter threads for customer view
  const filterThreadsForCustomer = (threadRows = []) => {
    return threadRows.filter((thread) => {
      if (!thread?.members?.length) return false;
      return thread.members.some(
        (member) => matchesAllowedRole(member.profile?.role) || member.userId === customer?.id
      );
    });
  };

  // Helper function to filter composer users
  const filterComposerUsers = (users = []) => {
    return users.filter((user) => matchesAllowedRole(user.role));
  };

  // Fetch threads function - defined first as it's used by other callbacks
  const fetchThreads = useCallback(async () => {
    if (!dbUserId) return;
    setThreadsLoading(true);
    setThreadsError("");
    try {
      const response = await fetch(`/api/messages/threads${buildQuery({ userId: dbUserId })}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Unable to load conversations.");
      }
      const threadRows = Array.isArray(payload.data) ? payload.data : [];
      const sorted = [...threadRows].sort(
        (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
      );
      setThreads(filterThreadsForCustomer(sorted));
    } catch (fetchError) {
      console.error("❌ Failed to load customer threads:", fetchError);
      setThreadsError(fetchError.message || "Unable to load conversations.");
    } finally {
      setThreadsLoading(false);
    }
  }, [dbUserId, customer?.id]); // Added customer.id as dependency

  // Open thread function - now fetchThreads is defined
  const openThread = useCallback(
    async (thread) => {
      if (!dbUserId || !thread?.id) return;
      setIsSystemThreadActive(false);
      setActiveThread(thread);
      setMessagesLoading(true);
      setMessagesError("");
      try {
        const response = await fetch(
          `/api/messages/threads/${thread.id}/messages${buildQuery({ userId: dbUserId })}`
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || "Unable to load conversation.");
        }
        setThreadMessages(payload.data || []);
        await fetchThreads();
      } catch (fetchError) {
        console.error("❌ Failed to load conversation:", fetchError);
        setMessagesError(fetchError.message || "Unable to load conversation.");
      } finally {
        setMessagesLoading(false);
      }
    },
    [dbUserId, fetchThreads]
  );

  const openSystemNotificationsThread = useCallback(() => {
    setIsSystemThreadActive(true);
    setActiveThread(null);
    setThreadMessages([]);
    setMessagesLoading(false);
    setMessagesError("");
    setLastSystemViewedAt(new Date().toISOString());
  }, []);

  // Toggle composer user selection
  const toggleComposerUser = useCallback((user) => {
    setComposerSelection((prev) => {
      if (prev.some((entry) => entry.id === user.id)) {
        return prev.filter((entry) => entry.id !== user.id);
      }
      return [...prev, user];
    });
  }, []);

  // Handle create group - now fetchThreads and openThread are defined
  const handleCreateGroup = useCallback(async () => {
    if (!dbUserId) return;
    if (!composerSelection.length) {
      setConversationError("Select at least one colleague to start a group chat.");
      return;
    }
    setComposerCreating(true);
    setConversationError("");
    setConversationFeedback("");
    try {
      const response = await fetch("/api/messages/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "group",
          createdBy: dbUserId,
          memberIds: composerSelection.map((user) => user.id),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Unable to create group conversation.");
      }
      const thread = payload.data;
      setComposerOpen(false);
      setComposerSelection([]);
      setComposerSearch("");
      setConversationFeedback("Group conversation created.");
      await fetchThreads();
      if (thread?.id) {
        openThread(thread);
      }
    } catch (error) {
      console.error("❌ Failed to create group conversation:", error);
      setConversationError(error.message || "Unable to create group conversation.");
    } finally {
      setComposerCreating(false);
    }
  }, [composerSelection, dbUserId, fetchThreads, openThread]);

  // Handle send message
  const handleSendMessage = useCallback(
    async (event) => {
      event?.preventDefault();
      if (!activeThread?.id || !dbUserId || !messageDraft.trim()) return;
      setSendingMessage(true);
      setMessagesError("");
      try {
        const metadata = parseSlashCommandMetadata(messageDraft, customer, vehicles);
        const response = await fetch(`/api/messages/threads/${activeThread.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderId: dbUserId,
            content: messageDraft.trim(),
            metadata,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || "Unable to send message.");
        }
        const newMessage = payload.data;
        setThreadMessages((prev) => [...prev, newMessage]);
        setMessageDraft("");
        setActiveThread((prev) =>
          prev
            ? {
                ...prev,
                lastMessage: newMessage,
                updatedAt: newMessage.createdAt,
                hasUnread: false,
              }
            : prev
        );
        await fetchThreads();
      } catch (sendError) {
        console.error("❌ Failed to send customer message:", sendError);
        setMessagesError(sendError.message || "Unable to send message.");
      } finally {
        setSendingMessage(false);
      }
    },
    [activeThread, dbUserId, messageDraft, fetchThreads, customer, vehicles]
  );

  // Handle save message
  const handleSaveMessage = useCallback(
    async (message) => {
      if (!message?.id || typeof window === "undefined") return;
      const confirmed = window.confirm(
        "Save this message forever? It will be excluded from auto cleanup."
      );
      if (!confirmed) return;
      setSavingMessageId(message.id);
      setMessagesError("");
      try {
        const response = await fetch(`/api/messages/messages/${message.id}/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saved: true }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || "Unable to save message.");
        }
        const updated = payload.data;
        setThreadMessages((prev) =>
          (prev || []).map((entry) => (entry.id === updated.id ? updated : entry))
        );
        await fetchThreads();
      } catch (error) {
        console.error("❌ Failed to mark message as saved:", error);
        setMessagesError(error.message || "Unable to save message.");
      } finally {
        setSavingMessageId(null);
      }
    },
    [fetchThreads]
  );

  // Effect: Load composer users when composer opens
  useEffect(() => {
    if (!composerOpen || !dbUserId) {
      setComposerResults([]);
      setComposerLoading(false);
      return;
    }
    const searchTerm = composerSearch.trim();
    if (!searchTerm) {
      setComposerResults([]);
      setComposerError("");
      setComposerLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setComposerLoading(true);
    setComposerError("");

    (async () => {
      try {
        const response = await fetch(
          `/api/messages/users${buildQuery({
            q: searchTerm,
            limit: 20,
            exclude: dbUserId,
          })}`,
          { signal: controller.signal }
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || "Unable to load users.");
        }
        if (!cancelled) {
          setComposerResults(filterComposerUsers(payload.data || []));
        }
      } catch (fetchError) {
        if (cancelled || fetchError.name === "AbortError") return;
        console.error("❌ Composer search failed:", fetchError);
        setComposerError(fetchError.message || "Unable to load users.");
        setComposerResults([]);
      } finally {
        if (!cancelled) {
          setComposerLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [composerOpen, composerSearch, dbUserId]);

  // Effect: Reset composer state when closed
  useEffect(() => {
    if (!composerOpen) {
      setComposerSearch("");
      setComposerSelection([]);
    }
  }, [composerOpen]);

  // Effect: Load system notifications
  useEffect(() => {
    let cancelled = false;

    const loadSystemNotifications = async () => {
      setSystemLoading(true);
      setSystemError("");
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("notification_id, message, created_at, target_role")
          .or("target_role.ilike.%customer%,target_role.is.null")
          .order("created_at", { ascending: false })
          .limit(5);
        if (error) throw error;
        if (!cancelled) {
          setSystemNotifications(data || []);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setSystemError(
            fetchError?.message || "Unable to load system notifications."
          );
          setSystemNotifications([]);
        }
      } finally {
        if (!cancelled) {
          setSystemLoading(false);
        }
      }
    };

    loadSystemNotifications();
    const channel = supabase
      .channel("customer-system-notifications")
      .on(
        "postgres_changes",
        { schema: "public", table: "notifications", event: "INSERT" },
        (payload) => {
          const entry = payload?.new;
          if (!entry) return;
          const targetRole = (entry.target_role || "").toLowerCase();
          if (targetRole && !targetRole.includes("customer")) return;
          setSystemNotifications((prev) => {
            const next = [entry, ...prev];
            return next.slice(0, 5);
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // Effect: Load threads on mount
  useEffect(() => {
    if (!dbUserId) return;
    fetchThreads();
  }, [dbUserId, fetchThreads]);

  // Effect: Open first thread when threads load
  useEffect(() => {
    if (!threads.length || activeThread) return;
    openThread(threads[0]);
  }, [threads, activeThread, openThread]);

  // Effect: Subscribe to real-time updates (CLIENT-SIDE ONLY)
  useEffect(() => {
    if (!dbUserId || typeof window === "undefined") return undefined;

    const channel = supabase
      .channel(`customer-messaging-${dbUserId}`)
      .on("postgres_changes", { schema: "public", table: "messages", event: "INSERT" }, (payload) => {
        if (!payload?.new) return;
        fetchThreads();
        if (activeThread?.id === payload.new.thread_id && payload.new.sender_id !== dbUserId) {
          openThread(activeThread);
        }
      })
      .on(
        "postgres_changes",
        {
          schema: "public",
          table: "message_thread_members",
          event: "UPDATE",
          filter: `user_id=eq.${dbUserId}`,
        },
        () => {
          fetchThreads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dbUserId, fetchThreads, activeThread, openThread]);

  const latestSystemNotification = systemNotifications?.[0];
  const latestSystemMessage = latestSystemNotification?.message || "No system updates yet.";
  const latestSystemTimestamp = latestSystemNotification?.created_at || null;
  const latestSystemTime = latestSystemTimestamp ? new Date(latestSystemTimestamp).getTime() : 0;
  const lastViewedTime = lastSystemViewedAt ? new Date(lastSystemViewedAt).getTime() : 0;
  const hasSystemUnread =
    Boolean(systemNotifications.length) && latestSystemTime > lastViewedTime;
  const systemPreview =
    latestSystemMessage.length > 80 ? `${latestSystemMessage.slice(0, 80)}…` : latestSystemMessage;
  const systemTimestampLabel = latestSystemTimestamp
    ? formatNotificationTimestamp(latestSystemTimestamp)
    : "No updates yet";
  const composerHasSearch = Boolean(composerSearch.trim());

  return (
    <CustomerLayout pageTitle="Messages">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}
      {isLoading ? (
        <div className="rounded-2xl border border-[#ffe0e0] bg-white p-5 text-sm text-slate-500 shadow mb-4">
          Loading messages…
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-[#ffe0e0] bg-white p-5 shadow-[0_12px_34px_rgba(209,0,0,0.08)]">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[#d10000]">Message centre</p>
              <h3 className="text-xl font-semibold text-slate-900">
                Message the right person
              </h3>
            </div>
            <span className="text-xs font-semibold text-[#d10000]">
              Conversations stay linked to your job
            </span>
          </header>

          <div className="mt-4 space-y-6">
            <div className="space-y-3 rounded-2xl border border-[#ffe5e5] bg-[#fff7f7] p-4 shadow-[0_6px_16px_rgba(209,0,0,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-[#d10000]">
                    Live conversations
                  </p>
                  <h4 className="text-lg font-semibold text-slate-900">Your messages</h4>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setComposerOpen(true)}
                    disabled={composerCreating}
                    className="rounded-full border border-dashed border-[#d10000] bg-white px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#d10000] shadow disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    + New conversation
                  </button>
                  <button
                    type="button"
                    onClick={fetchThreads}
                    disabled={threadsLoading}
                    className="rounded-full border border-[#ffe5e5] bg-white px-3 py-1 text-xs font-semibold text-[#d10000] shadow hover:border-[#d10000] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {threadsLoading ? "Refreshing…" : "Refresh"}
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-500">
                System alerts stay pinned above your chats so you never miss a stock or VHC update.
              </p>
              {conversationFeedback && (
                <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {conversationFeedback}
                </p>
              )}
              {conversationError && (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {conversationError}
                </p>
              )}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={openSystemNotificationsThread}
                  className={`w-full text-left rounded-2xl border px-4 py-3 text-sm shadow-[0_6px_20px_rgba(209,0,0,0.06)] transition ${
                    isSystemThreadActive
                      ? "border-[#d10000] bg-[#fff2f2]"
                      : "border-[#ffe5e5] bg-[#fffafa]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">System notifications</p>
                      <p className="text-xs text-slate-500">{systemPreview}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasSystemUnread && (
                        <span className="rounded-full bg-[#d10000] px-3 py-1 text-[0.65rem] font-semibold text-white">
                          Unread
                        </span>
                      )}
                      <span className="rounded-full border border-[#ffe5e5] px-3 py-1 text-[0.65rem] font-semibold text-[#b91c1c]">
                        Read only
                      </span>
                    </div>
                  </div>
                  <p className="text-[0.65rem] text-slate-500">Latest {systemTimestampLabel}</p>
                </button>
                {threads.length ? (
                  <div className="space-y-3">
                    {threads.map((thread) => {
                      const isActiveThread = activeThread?.id === thread.id && !isSystemThreadActive;
                      const preview = thread.lastMessage?.content || "No messages yet.";
                      return (
                        <button
                          key={thread.id}
                          type="button"
                          onClick={() => openThread(thread)}
                          className={`w-full text-left rounded-2xl border px-4 py-3 shadow-[0_6px_20px_rgba(209,0,0,0.06)] transition ${
                            isActiveThread
                              ? "border-[#d10000] bg-[#fff2f2]"
                              : "border-[#ffe5e5] bg-[#fffafa]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">
                              {thread.title || "Conversation"}
                            </p>
                            {thread.hasUnread && (
                              <span className="rounded-full bg-[#d10000] px-3 py-1 text-xs font-semibold text-white">
                                Unread
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            {thread.lastMessage?.sender?.name || "Team"} · {preview.length > 80 ? `${preview.slice(0, 80)}…` : preview}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    No open conversations yet. Start one with the button above.
                  </p>
                )}
              </div>
            </div>

            {isSystemThreadActive ? (
              <div className="space-y-4 rounded-2xl border border-[#ffe5e5] bg-[#fffafa] p-4 shadow-[0_6px_16px_rgba(209,0,0,0.08)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-[#d10000]">System thread</p>
                    <h4 className="text-lg font-semibold text-slate-900">System notifications</h4>
                  </div>
                  <span className="rounded-full bg-[#fee2e2] px-3 py-1 text-xs font-semibold text-[#b91c1c]">
                    Read only
                  </span>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {systemLoading && (
                    <p className="text-sm text-slate-500">Loading notifications…</p>
                  )}
                  {!systemLoading && systemError && (
                    <p className="text-sm text-red-600">{systemError}</p>
                  )}
                  {!systemLoading && !systemError && systemNotifications.length === 0 && (
                    <p className="text-sm text-slate-500">No system notifications yet.</p>
                  )}
                  {!systemLoading && !systemError && systemNotifications.length > 0 && (
                    <div className="space-y-3">
                      {systemNotifications.map((note) => (
                        <article
                          key={`system-${note.notification_id}`}
                          className="space-y-1 rounded-2xl border border-[#ffe5e5] bg-white/70 px-4 py-3 text-sm"
                        >
                          <p className="text-sm text-slate-900">{note.message || "System update"}</p>
                          <p className="text-[0.65rem] text-slate-500">
                            {formatNotificationTimestamp(note.created_at)}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Only the system posts here; this thread cannot be deleted or renamed.
                </p>
              </div>
            ) : activeThread ? (
              <div className="space-y-4 rounded-2xl border border-[#ffe5e5] bg-[#ffffff] p-4 shadow-[0_6px_16px_rgba(209,0,0,0.08)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-[#d10000]">Active thread</p>
                    <h4 className="text-lg font-semibold text-slate-900">{activeThread.title}</h4>
                  </div>
                  <span className="text-xs text-slate-500">
                    {formatMessageTimestamp(threadMessages[threadMessages.length - 1]?.createdAt)}
                  </span>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto pb-2">
                  {messagesLoading && (
                    <p className="text-sm text-slate-500">Loading conversation…</p>
                  )}
                  {!messagesLoading && messagesError && (
                    <p className="text-sm text-red-600">{messagesError}</p>
                  )}
                  {!messagesLoading && !messagesError && threadMessages.length === 0 && (
                    <p className="text-sm text-slate-500">No messages yet. Start the conversation below.</p>
                  )}
                  {!messagesLoading && !messagesError && (
                    <div className="space-y-3">
                      {threadMessages.map((message) => {
                        const senderName =
                          message.sender?.name || (message.senderId === dbUserId ? "You" : "Team member");
                        const isMine = message.senderId === dbUserId;
                        return (
                          <div
                            key={message.id || `${message.senderId}-${message.createdAt}`}
                            className={`space-y-1 rounded-2xl border px-4 py-3 text-sm ${
                              isMine ? "border-[#ffd3d3] bg-[#fff2f2]" : "border-[#ffe5e5] bg-[#fffafa]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-900">{senderName}</span>
                              <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
                                {formatMessageTimestamp(message.createdAt)}
                              </span>
                            </div>
                            <p className="text-slate-700">{message.content}</p>
                            {message.metadata?.jobNumber && (
                              <p className="text-[0.65rem] text-slate-500">
                                Linked job #{message.metadata.jobNumber}
                              </p>
                            )}
                            {message.metadata?.customerId && (
                              <p className="text-[0.65rem] text-slate-500">
                                Linked customer profile
                              </p>
                            )}
                            {message.metadata?.vehicleId && (
                              <p className="text-[0.65rem] text-slate-500">
                                Linked vehicle {vehicles?.find((v) => v.id === message.metadata.vehicleId)?.reg || "(vehicle data)"}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              {message.savedForever ? (
                                <span className="rounded-full border border-[#ffe5e5] px-3 py-1 text-[0.65rem] font-semibold text-[#d10000]">
                                  Saved forever
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSaveMessage(message)}
                                  disabled={savingMessageId === message.id}
                                  className="rounded-full border border-[#ffe5e5] px-3 py-1 text-[0.65rem] font-semibold text-[#d10000] hover:border-[#d10000] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {savingMessageId === message.id ? "Saving…" : "Save forever"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <form onSubmit={handleSendMessage} className="space-y-3">
                  <label htmlFor="message-draft" className="sr-only">
                    Message
                  </label>
                  <textarea
                    id="message-draft"
                    rows={3}
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    placeholder="Type your message…"
                    className="w-full rounded-2xl border border-[#ffe5e5] bg-[#fffafa] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#d10000] focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!dbUserId || sendingMessage || !messageDraft.trim()}
                      className="rounded-full bg-[#d10000] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow hover:bg-[#b50d0d] disabled:cursor-not-allowed disabled:bg-[#f0a8a8]"
                    >
                      {sendingMessage ? "Sending…" : "Send"}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#ffe5e5] bg-[#fffafa] p-6 text-sm text-slate-500">
                Select a conversation to view messages and replies.
              </div>
            )}
          </div>
          {composerOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-2xl rounded-3xl border border-[#ffe5e5] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-[#d10000]">Compose</p>
                    <h3 className="text-xl font-semibold text-slate-900">Create a group chat</h3>
                    <p className="text-sm text-slate-500">
                      Search by name, check the people you need, and create a new thread.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setComposerOpen(false)}
                    className="rounded-full border border-[#ffe5e5] px-3 py-1 text-xs font-semibold text-[#d10000]"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <label className="text-xs font-semibold uppercase text-slate-500">Search users</label>
                  <input
                    type="search"
                    value={composerSearch}
                    onChange={(event) => setComposerSearch(event.target.value)}
                    placeholder="Find teammates by name or email"
                    className="w-full rounded-2xl border border-[#ffe5e5] bg-[#fffafa] px-4 py-3 text-sm text-slate-900 focus:border-[#d10000] focus:outline-none"
                  />
                  <div className="max-h-60 overflow-y-auto space-y-2 rounded-2xl border border-[#ffe5e5] bg-white p-3">
                    {composerLoading && (
                      <p className="text-sm text-slate-500">Searching your roster…</p>
                    )}
                    {!composerLoading && composerError && (
                      <p className="text-sm text-red-600">{composerError}</p>
                    )}
                    {!composerLoading && !composerError && !composerHasSearch && (
                      <p className="text-sm text-slate-500">Type a name to see matching users.</p>
                    )}
                    {!composerLoading && !composerError && composerHasSearch && composerResults.length === 0 && (
                      <p className="text-sm text-slate-500">No users match that search.</p>
                    )}
                    {!composerLoading && !composerError && composerResults.length > 0 && (
                      <div className="space-y-2">
                        {composerResults.map((user) => {
                          const isSelected = composerSelection.some((entry) => entry.id === user.id);
                          return (
                            <label
                              key={user.id}
                              className="flex cursor-pointer items-center justify-between rounded-2xl border border-[#f6d6d6] bg-[#fffafa] px-3 py-2 text-sm transition hover:border-[#d10000]"
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleComposerUser(user)}
                                  className="h-4 w-4 rounded border-[#d10000]"
                                />
                                <div>
                                  <p className="font-semibold text-slate-900">{user.name}</p>
                                  <p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                                    {user.role || "Team member"}
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs text-slate-500">{user.email}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    Selected {composerSelection.length} colleague
                    {composerSelection.length === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    disabled={composerCreating || composerSelection.length === 0}
                    className="rounded-full bg-[#d10000] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow hover:bg-[#b50d0d] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {composerCreating ? "Creating…" : "Create chat"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
        <AppointmentTimeline events={timeline} />
      </div>
    </CustomerLayout>
  );
}
