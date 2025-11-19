// ✅ Imports converted to use absolute alias "@/"
// file location: src/customers/pages/MessagesPage.js
import React, { useCallback, useEffect, useState } from "react";
import CustomerLayout from "@/customers/components/CustomerLayout";
import AppointmentTimeline from "@/customers/components/AppointmentTimeline";
import { useCustomerPortalData } from "@/customers/hooks/useCustomerPortalData";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.append(key, value);
  });
  const stringified = query.toString();
  return stringified ? `?${stringified}` : "";
};

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

const formatMessageTimestamp = (value) => {
  if (!value) return "Unknown time";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

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

  const [searchTerm, setSearchTerm] = useState("");
  const [directoryResults, setDirectoryResults] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [conversationFeedback, setConversationFeedback] = useState("");
  const [conversationError, setConversationError] = useState("");
  const [startingConversationId, setStartingConversationId] = useState(null);
  const [systemNotifications, setSystemNotifications] = useState([]);
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemError, setSystemError] = useState("");
  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState("");
  const [activeThread, setActiveThread] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [savingMessageId, setSavingMessageId] = useState(null);

  useEffect(() => {
    const trimmedSearch = searchTerm.trim();
    if (!trimmedSearch) {
      setDirectoryResults([]);
      setDirectoryError("");
      setDirectoryLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setDirectoryLoading(true);
    setDirectoryError("");

    (async () => {
      try {
        const response = await fetch(
          `/api/messages/users${buildQuery({ q: trimmedSearch, limit: 8 })}`,
          { signal: controller.signal }
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || "Unable to load team matching that name.");
        }
        if (!cancelled) {
          setDirectoryResults(payload.data || []);
        }
      } catch (fetchError) {
        if (cancelled || fetchError.name === "AbortError") {
          return;
        }
        console.error("❌ Customer message search failed:", fetchError);
        setDirectoryError(fetchError.message || "Failed to load team members.");
        setDirectoryResults([]);
      } finally {
        if (!cancelled) {
          setDirectoryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [searchTerm]);

  useEffect(() => {
    let cancelled = false;

    const loadSystemNotifications = async () => {
      setSystemLoading(true);
      setSystemError("");
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("notification_id, message, created_at")
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
    return () => {
      cancelled = true;
    };
  }, []);

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
      setThreads(sorted);
    } catch (fetchError) {
      console.error("❌ Failed to load customer threads:", fetchError);
      setThreadsError(fetchError.message || "Unable to load conversations.");
    } finally {
      setThreadsLoading(false);
    }
  }, [dbUserId]);

  const openThread = useCallback(
    async (thread) => {
      if (!dbUserId || !thread?.id) return;
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

  useEffect(() => {
    if (!dbUserId) return;
    fetchThreads();
  }, [dbUserId, fetchThreads]);

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

  useEffect(() => {
    if (!threads.length || activeThread) return;
    openThread(threads[0]);
  }, [threads, activeThread, openThread]);

  useEffect(() => {
    if (!dbUserId) return undefined;

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

  const handleStartConversation = useCallback(
    async (targetUser) => {
      if (!dbUserId || !targetUser?.id) return;
      setConversationError("");
      setConversationFeedback("");
      setStartingConversationId(targetUser.id);
      try {
        const response = await fetch("/api/messages/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "direct",
            createdBy: dbUserId,
            targetUserId: targetUser.id,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || "Unable to start conversation right now.");
        }
        setConversationFeedback(
          `Conversation opened with ${targetUser.name || targetUser.email || "that team member"}.`
        );
        await fetchThreads();
      } catch (startError) {
        console.error("❌ Failed to start customer conversation:", startError);
        setConversationError(startError.message || "Unable to start conversation.");
      } finally {
        setStartingConversationId(null);
      }
    },
    [dbUserId, fetchThreads]
  );

  const hasSearchTerm = Boolean(searchTerm.trim());

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
            <div className="rounded-2xl border border-dashed border-[#ffe5e5] bg-[#fffafa] p-4 shadow-[0_6px_16px_rgba(209,0,0,0.1)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-[#d10000]">
                    Pinned thread
                  </p>
                  <h4 className="text-lg font-semibold text-slate-900">System notifications</h4>
                  <p className="text-xs text-slate-500">
                    Stock updates, approved work, VHC progress, and consumables alerts.
                  </p>
                </div>
                <span className="rounded-full bg-[#fee2e2] px-3 py-1 text-xs font-semibold text-[#b91c1c]">
                  Read only
                </span>
              </div>
              <div className="mt-3 space-y-3">
                {systemLoading && (
                  <p className="text-sm text-slate-500">Fetching system updates…</p>
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
                        <p className="text-xs text-slate-500">
                          {formatNotificationTimestamp(note.created_at)}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Only the system posts here; this thread cannot be deleted or renamed.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="message-search"
                  className="text-xs font-semibold uppercase text-slate-500"
                >
                  Search by name or email
                </label>
                <input
                  id="message-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Start typing to find someone to message…"
                  className="w-full rounded-2xl border border-[#ffe5e5] bg-[#fffafa] px-4 py-3 text-sm text-slate-900 focus:border-[#d10000] focus:outline-none"
                />
              </div>

              {hasSearchTerm ? (
                <div className="space-y-3">
                  {directoryLoading && (
                    <p className="text-sm text-slate-500">Searching your team…</p>
                  )}
                  {!directoryLoading && directoryError && (
                    <p className="text-sm text-red-600">{directoryError}</p>
                  )}
                  {!directoryLoading && !directoryError && directoryResults.length === 0 && (
                    <p className="text-sm text-slate-500">
                      No team members match that search.
                    </p>
                  )}
                  {!directoryLoading && !directoryError && directoryResults.length > 0 && (
                    <div className="space-y-3">
                      {directoryResults.map((result) => (
                        <div
                          key={result.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ffe5e5] bg-[#fffafa] px-4 py-4 text-sm shadow-[0_6px_20px_rgba(209,0,0,0.06)]"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{result.name}</p>
                            <p className="text-xs text-slate-500">
                              {result.role || "Team member"} &middot; {result.email || "No email"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartConversation(result)}
                            disabled={!dbUserId || startingConversationId === result.id}
                            className="rounded-full bg-[#d10000] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#b50d0d] disabled:cursor-not-allowed disabled:bg-[#f0a8a8]"
                          >
                            {startingConversationId === result.id ? "Starting…" : "Start conversation"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Search for a team member before you start a new conversation.
                </p>
              )}

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
              {hasSearchTerm && !dbUserId && !conversationFeedback && !conversationError && (
                <p className="text-xs text-slate-500">
                  We are linking your account so you can start conversations—give us a moment.
                </p>
              )}
            </div>

            <div className="space-y-3 rounded-2xl border border-[#ffe5e5] bg-[#fff7f7] p-4 shadow-[0_6px_16px_rgba(209,0,0,0.08)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-[#d10000]">
                    Live conversations
                  </p>
                  <h4 className="text-lg font-semibold text-slate-900">Your messages</h4>
                </div>
                <button
                  type="button"
                  onClick={fetchThreads}
                  disabled={threadsLoading}
                  className="rounded-full border border-[#ffe5e5] bg-white px-3 py-1 text-xs font-semibold text-[#d10000] shadow hover:border-[#d10000] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {threadsLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>
              <div className="space-y-3">
                {threadsLoading && (
                  <p className="text-sm text-slate-500">Loading conversations…</p>
                )}
                {!threadsLoading && threadsError && (
                  <p className="text-sm text-red-600">{threadsError}</p>
                )}
                {!threadsLoading && !threadsError && threads.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Start a conversation to see it here. Conversations automatically bump when new
                    updates arrive.
                  </p>
                )}
                {!threadsLoading && !threadsError && threads.length > 0 && (
                  <div className="space-y-3">
                    {threads.map((thread) => {
                      const isActiveThread = activeThread?.id === thread.id;
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
                )}
              </div>
            </div>

            {activeThread && (
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
                    <p className="text-sm text-slate-500">
                      No messages yet. Once you send or receive one it will appear here.
                    </p>
                  )}
                  {!messagesLoading &&
                    !messagesError &&
                    threadMessages.map((message) => {
                      const senderName =
                        message.sender?.name ||
                        (message.senderId === dbUserId ? "You" : "Team member");
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
                              Linked vehicle{" "}
                              {vehicles?.find((v) => v.id === message.metadata.vehicleId)?.reg ||
                                "(vehicle data)"}
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
            )}
          </div>
        </section>
        <AppointmentTimeline events={timeline} />
      </div>
    </CustomerLayout>
  );
}
