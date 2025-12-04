// file location: src/pages/messages/index.js

"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";
import { appShellTheme } from "@/styles/appTheme";

const palette = appShellTheme.palette;
const radii = appShellTheme.radii;
const shadows = appShellTheme.shadows;

const cardStyle = {
  background: "var(--surface)",
  border: `1px solid ${palette.border}`,
  borderRadius: "22px",
  padding: "20px",
  boxShadow: shadows.sm,
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const SectionTitle = ({ title, subtitle, action }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "12px",
    }}
  >
    <div>
      <h3
        style={{
          margin: 0,
          fontSize: "1rem",
          color: palette.accent,
        }}
      >
        {title}
      </h3>
      {subtitle && (
        <p style={{ margin: "4px 0 0", color: palette.textMuted, fontSize: "0.85rem" }}>
          {subtitle}
        </p>
      )}
    </div>
    {action}
  </div>
);

const ComposeToggleButton = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      flex: 1,
      borderRadius: radii.lg,
      padding: "10px 12px",
      border: `1px solid ${active ? palette.accent : palette.border}`,
      backgroundColor: active ? palette.accent : "var(--surface)",
      color: active ? "var(--surface)" : palette.accent,
      fontWeight: 600,
      cursor: "pointer",
      transition: "all 0.2s ease",
    }}
  >
    {children}
  </button>
);

const Chip = ({ label, onRemove, disabled = false }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 12px",
      borderRadius: radii.pill,
      backgroundColor: palette.accentSurface,
      color: palette.accent,
      fontSize: "0.85rem",
      fontWeight: 600,
    }}
  >
    {label}
    {onRemove && (
      <button
        type="button"
        onClick={disabled ? undefined : onRemove}
        disabled={disabled}
        style={{
          border: "none",
          background: "transparent",
          color: disabled ? palette.textMuted : palette.accent,
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: "0.9rem",
        }}
      >
        ×
      </button>
    )}
  </span>
);

const AvatarBadge = ({ name }) => {
  const initial = (name || "?").trim().charAt(0)?.toUpperCase() || "?";

  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        backgroundColor: palette.accentSurface,
        color: palette.accent,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 10px rgba(var(--shadow-rgb),0.08)",
      }}
    >
      {initial}
    </div>
  );
};

const MessageBubble = ({ message, isMine }) => {
  const senderName = message.sender?.name || "Unknown";
  const timestamp = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const bubbleStyles = {
    padding: "14px 18px",
    borderRadius: isMine
      ? `${radii.lg} ${radii.sm} ${radii.lg} ${radii.lg}`
      : `${radii.sm} ${radii.lg} ${radii.lg} ${radii.lg}`,
    backgroundColor: isMine ? palette.accent : "var(--surface)",
    color: isMine ? "var(--surface)" : palette.textPrimary,
    maxWidth: "480px",
    boxShadow: isMine ? shadows.md : "0 8px 20px rgba(var(--shadow-rgb),0.08)",
    lineHeight: 1.45,
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isMine ? "flex-end" : "flex-start",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "12px",
          alignItems: "flex-start",
        }}
      >
        <AvatarBadge name={senderName} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            alignItems: isMine ? "flex-end" : "flex-start",
          }}
        >
          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: palette.accent,
            }}
          >
            {senderName}
          </span>
          <span style={{ fontSize: "0.75rem", color: palette.textMuted }}>{timestamp}</span>
          <div style={bubbleStyles}>{message.content}</div>
        </div>
      </div>
    </div>
  );
};

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.append(key, value);
  });
  return query.toString() ? `?${query.toString()}` : "";
};

const parseSlashCommandMetadata = (text = "", thread = null) => {
  if (!text) return null;
  const metadata = {};
  const tokens = text.match(/\/[^\s]+/g) || [];
  for (const raw of tokens) {
    const token = raw.replace("/", "").trim();
    if (!token) continue;
    if (/^\d+$/.test(token) && !metadata.jobNumber) {
      metadata.jobNumber = token;
      continue;
    }
    if (token.toLowerCase() === "customer" && !metadata.customerId) {
      const customerMember = (thread?.members || []).find((member) =>
        member.profile?.role?.toLowerCase().includes("customer")
      );
      if (customerMember) {
        metadata.customerId = customerMember.userId;
      }
    }
    if (token.toLowerCase() === "vehicle" && !metadata.vehicleId) {
      const vehicleReference = thread?.lastMessage?.metadata?.vehicleId;
      if (vehicleReference) {
        metadata.vehicleId = vehicleReference;
      }
    }
  }
  return Object.keys(metadata).length ? metadata : null;
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

function MessagesPage() {
  const { dbUserId, user } = useUser();

  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [directory, setDirectory] = useState([]);
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [systemNotifications, setSystemNotifications] = useState([]);
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemError, setSystemError] = useState("");
  const [activeSystemView, setActiveSystemView] = useState(false);
  const [lastSystemViewedAt, setLastSystemViewedAt] = useState(null);

  const [composeMode, setComposeMode] = useState("direct");
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [composeError, setComposeError] = useState("");

  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [groupSearchResults, setGroupSearchResults] = useState([]);
  const [groupSearchLoading, setGroupSearchLoading] = useState(false);
  const [groupManageError, setGroupManageError] = useState("");
  const [groupManageBusy, setGroupManageBusy] = useState(false);
  const [conversationError, setConversationError] = useState("");

  const scrollerRef = useRef(null);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  const isGroupLeader = useMemo(() => {
    if (!activeThread || activeThread.type !== "group" || !dbUserId) return false;
    return activeThread.members.some(
      (member) => member.userId === dbUserId && member.role === "leader"
    );
  }, [activeThread, dbUserId]);

  const directoryHasSearch = Boolean(directorySearch.trim());

  const latestSystemNotification = systemNotifications?.[0];
  const latestSystemMessage = latestSystemNotification?.message || "No system updates yet.";
  const latestSystemTimestamp = latestSystemNotification?.created_at || null;
  const latestSystemTime = latestSystemTimestamp ? new Date(latestSystemTimestamp).getTime() : 0;
  const lastSystemTime = lastSystemViewedAt ? new Date(lastSystemViewedAt).getTime() : 0;
  const hasSystemUnread =
    Boolean(systemNotifications.length) && latestSystemTime > lastSystemTime;
  const systemPreview =
    latestSystemMessage.length > 80 ? `${latestSystemMessage.slice(0, 80)}…` : latestSystemMessage;
  const systemTimestampLabel = latestSystemTimestamp
    ? formatNotificationTimestamp(latestSystemTimestamp)
    : "No updates yet";
  const isSystemThreadActive = activeSystemView;

  const mergeThread = useCallback((nextThread) => {
    if (!nextThread) return;
    setThreads((prev) => {
      const idx = prev.findIndex((thread) => thread.id === nextThread.id);
      if (idx === -1) {
        return [nextThread, ...prev].sort(
          (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
        );
      }
      const copy = [...prev];
      copy[idx] = nextThread;
      return copy.sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      );
    });
  }, []);

  const fetchThreads = useCallback(async () => {
    if (!dbUserId) return;
    setLoadingThreads(true);
    try {
      const response = await fetch(
        `/api/messages/threads${buildQuery({ userId: dbUserId })}`
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to load threads");
      setThreads(payload.data || []);
    } catch (error) {
      console.error("❌ Failed to load threads:", error);
    } finally {
      setLoadingThreads(false);
    }
  }, [dbUserId]);

  const fetchDirectory = useCallback(
    async (searchTerm = "") => {
      if (!dbUserId) return;
      const trimmedTerm = searchTerm.trim();
      if (!trimmedTerm) {
        setDirectory([]);
        setDirectoryLoading(false);
        return;
      }
      setDirectoryLoading(true);
      try {
        const response = await fetch(
          `/api/messages/users${buildQuery({
            q: trimmedTerm,
            exclude: dbUserId,
          })}`
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Failed to load users");
        setDirectory(payload.data || []);
      } catch (error) {
        console.error("❌ Failed to load directory:", error);
      } finally {
        setDirectoryLoading(false);
      }
    },
    [dbUserId]
  );

  const openThread = useCallback(
    async (threadId) => {
      if (!threadId || !dbUserId) return;
      setActiveSystemView(false);
      setActiveThreadId(threadId);
      setLoadingMessages(true);
      setConversationError("");
      try {
        const response = await fetch(
          `/api/messages/threads/${threadId}/messages${buildQuery({
            userId: dbUserId,
          })}`
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Failed to load messages");
        setMessages(payload.data || []);
        setConversationError("");
      } catch (error) {
        console.error("❌ Failed to load conversation:", error);
        setConversationError(error.message || "Unable to load conversation.");
      } finally {
        setLoadingMessages(false);
      }
    },
    [dbUserId]
  );

  const openSystemNotificationsThread = useCallback(() => {
    setActiveSystemView(true);
    setActiveThreadId(null);
    setMessages([]);
    setLoadingMessages(false);
    setConversationError("");
    setLastSystemViewedAt(new Date().toISOString());
  }, []);

  const startDirectThread = useCallback(
    async (targetUserId) => {
      if (!dbUserId || !targetUserId) return;
      setComposeError("");
      try {
        const response = await fetch("/api/messages/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "direct",
            createdBy: dbUserId,
            targetUserId,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Unable to start chat");
        const thread = payload.data;
        if (!thread) throw new Error("Thread could not be created.");
        mergeThread(thread);
        await fetchThreads();
        await openThread(thread.id);
      } catch (error) {
        console.error("❌ Failed to start direct chat:", error);
        setComposeError(error.message || "Unable to start chat");
      }
    },
    [dbUserId, fetchThreads, mergeThread, openThread]
  );

  const handleCreateGroup = useCallback(async () => {
    if (!dbUserId) return;
    if (selectedRecipients.length === 0) {
      setComposeError("Select at least one colleague for the group.");
      return;
    }

    setComposeError("");
    try {
      const response = await fetch("/api/messages/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "group",
          createdBy: dbUserId,
          title: groupName,
          memberIds: selectedRecipients.map((user) => user.id),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to create group");
      const thread = payload.data;
      if (!thread) throw new Error("Group thread was not created.");
      setSelectedRecipients([]);
      setGroupName("");
      setComposeMode("direct");
      mergeThread(thread);
      await fetchThreads();
      await openThread(thread.id);
    } catch (error) {
      console.error("❌ Failed to create group:", error);
      setComposeError(error.message || "Unable to create group");
    }
  }, [
    dbUserId,
    fetchThreads,
    groupName,
    mergeThread,
    openThread,
    selectedRecipients,
  ]);

  const handleSendMessage = useCallback(
    async (event) => {
      event?.preventDefault();
      if (!messageDraft.trim() || !activeThreadId || !dbUserId) return;
      setSending(true);
      setConversationError("");
      try {
        const metadata = parseSlashCommandMetadata(messageDraft, activeThread);
        const response = await fetch(`/api/messages/threads/${activeThreadId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderId: dbUserId,
            content: messageDraft.trim(),
            metadata,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Unable to send message");
        const newMessage = payload.data;
        if (!newMessage) throw new Error("Message payload missing.");
        setMessageDraft("");
        setMessages((prev) => [...prev, newMessage]);
        await fetchThreads();
        await openThread(activeThreadId);
      } catch (error) {
        console.error("❌ Failed to send message:", error);
        setConversationError(error.message || "Unable to send message.");
      } finally {
        setSending(false);
      }
    },
    [activeThreadId, dbUserId, fetchThreads, messageDraft, openThread, activeThread]
  );

  useEffect(() => {
    if (!dbUserId) return;
    fetchThreads();
  }, [dbUserId, fetchThreads]);

  useEffect(() => {
    if (!dbUserId) return;
    const trimmed = directorySearch.trim();
    if (!trimmed) {
      setDirectory([]);
      return;
    }
    const handle = setTimeout(() => {
      fetchDirectory(trimmed);
    }, 350);
    return () => clearTimeout(handle);
  }, [dbUserId, directorySearch, fetchDirectory]);

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
          setSystemError(fetchError?.message || "Unable to load system notifications.");
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
      .channel("admin-system-notifications")
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

  useEffect(() => {
    if (!dbUserId || typeof window === "undefined") return undefined;

    const channel = supabase
      .channel(`messages-refresh-${dbUserId}`)
      .on("postgres_changes", { schema: "public", table: "messages", event: "INSERT" }, (payload) => {
        if (!payload?.new) return;
        fetchThreads();
        if (activeThread && activeThread.id === payload.new.thread_id && payload.new.sender_id !== dbUserId) {
          openThread(activeThread.id);
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

  useEffect(() => {
    if (!threads.length) {
      setActiveThreadId(null);
      setMessages([]);
      return;
    }
    if (!activeThreadId) {
      openThread(threads[0].id);
    }
  }, [threads, activeThreadId, openThread]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    setGroupSearchTerm("");
    setGroupSearchResults([]);
    setGroupManageError("");
  }, [activeThreadId]);

  useEffect(() => {
    if (
      !isGroupLeader ||
      !activeThread ||
      activeThread.type !== "group" ||
      !groupSearchTerm.trim() ||
      groupSearchTerm.trim().length < 2
    ) {
      setGroupSearchResults([]);
      setGroupSearchLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setGroupSearchLoading(true);
    const excludeIds = [
      ...new Set([
        ...(activeThread?.members || []).map((member) => member.userId),
        dbUserId,
      ]),
    ].join(",");

    fetch(
      `/api/messages/users${buildQuery({
        q: groupSearchTerm,
        exclude: excludeIds,
      })}`,
      { signal: controller.signal }
    )
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Unable to search users");
        if (!cancelled) setGroupSearchResults(payload.data || []);
      })
      .catch((error) => {
        if (cancelled || error.name === "AbortError") return;
        console.error("❌ Group search failed:", error);
        setGroupSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setGroupSearchLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeThread, dbUserId, groupSearchTerm, isGroupLeader]);

  const handleDirectoryUser = (userEntry) => {
    if (composeMode === "direct") {
      startDirectThread(userEntry.id);
      return;
    }

    setSelectedRecipients((prev) => {
      const exists = prev.some((user) => user.id === userEntry.id);
      if (exists) {
        return prev.filter((user) => user.id !== userEntry.id);
      }
      return [...prev, userEntry];
    });
  };

  const isRecipientSelected = (userEntry) =>
    selectedRecipients.some((user) => user.id === userEntry.id);

  const handleAddMemberToGroup = useCallback(
    async (userId) => {
      if (!activeThreadId || !dbUserId || !userId) return;
      setGroupManageBusy(true);
      setGroupManageError("");
      try {
        const response = await fetch(
          `/api/messages/threads/${activeThreadId}/members`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actorId: dbUserId, userIds: [userId] }),
          }
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Unable to add member");
        if (payload.data) {
          mergeThread(payload.data);
          setGroupSearchTerm("");
          setGroupSearchResults([]);
        }
      } catch (error) {
        console.error("❌ Failed to add member:", error);
        setGroupManageError(error.message || "Unable to add member.");
      } finally {
        setGroupManageBusy(false);
      }
    },
    [activeThreadId, dbUserId, mergeThread]
  );

  const handleRemoveMemberFromGroup = useCallback(
    async (userId) => {
      if (!activeThreadId || !dbUserId || !userId) return;
      setGroupManageBusy(true);
      setGroupManageError("");
      try {
        const response = await fetch(
          `/api/messages/threads/${activeThreadId}/members`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actorId: dbUserId, userIds: [userId] }),
          }
        );
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.message || "Unable to remove member");
        if (payload.data) {
          mergeThread(payload.data);
        }
      } catch (error) {
        console.error("❌ Failed to remove member:", error);
        setGroupManageError(error.message || "Unable to remove member.");
      } finally {
        setGroupManageBusy(false);
      }
    },
    [activeThreadId, dbUserId, mergeThread]
  );

  const canSend = Boolean(
    messageDraft.trim() && activeThread && !loadingMessages && !sending
  );

  if (!user) {
    return (
      <Layout>
        <div style={{ padding: "40px", textAlign: "center" }}>
          <h2>Please log in to access internal messages.</h2>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          minHeight: "calc(100vh - 180px)",
        }}
      >
        <div style={{ ...cardStyle, flexDirection: "row", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, color: palette.textMuted }}>
              Chat with any colleague, launch focused group threads, and keep every job
              discussion inside H&P.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchThreads}
            style={{
              border: "none",
              borderRadius: radii.pill,
              padding: "12px 20px",
              backgroundColor: palette.accent,
              color: "var(--surface)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "360px minmax(0, 1fr)",
            gap: "20px",
            minHeight: "520px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={cardStyle}>
              <SectionTitle
                title="Start a Conversation"
                subtitle={
                  composeMode === "direct"
                    ? "Pick someone from the list to open a direct thread."
                    : "Select colleagues and give the group a name."
                }
              />

              <div style={{ display: "flex", gap: "10px" }}>
                <ComposeToggleButton
                  active={composeMode === "direct"}
                  onClick={() => {
                    setComposeMode("direct");
                    setSelectedRecipients([]);
                    setComposeError("");
                  }}
                >
                  Direct
                </ComposeToggleButton>
                <ComposeToggleButton
                  active={composeMode === "group"}
                  onClick={() => {
                    setComposeMode("group");
                    setComposeError("");
                  }}
                >
                  Group
                </ComposeToggleButton>
              </div>

              <input
                type="search"
                placeholder="Search everyone..."
                value={directorySearch}
                onChange={(event) => setDirectorySearch(event.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: radii.lg,
                  border: "1px solid var(--search-surface-muted)",
                  backgroundColor: "var(--search-surface)",
                  color: "var(--search-text)",
                }}
              />

              <div
                style={{
                  maxHeight: "220px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {directoryLoading && (
                  <p style={{ color: palette.textMuted, margin: 0 }}>Loading colleagues…</p>
                )}
                {!directoryLoading && !directoryHasSearch && (
                  <p style={{ margin: 0, color: palette.textMuted }}>
                    Search to reveal colleagues.
                  </p>
                )}
                {!directoryLoading && directoryHasSearch && directory.length === 0 && (
                  <p style={{ margin: 0, color: palette.textMuted }}>
                    No colleagues found.
                  </p>
                )}
                {!directoryLoading && directoryHasSearch && directory.length > 0 && (
                  <>
                    {directory.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => handleDirectoryUser(entry)}
                        style={{
                          textAlign: "left",
                          borderRadius: "16px",
                          border: `1px solid ${
                            composeMode === "group" && isRecipientSelected(entry)
                              ? palette.accent
                              : palette.border
                          }`,
                          padding: "12px 14px",
                          backgroundColor:
                            composeMode === "group" && isRecipientSelected(entry)
                              ? palette.accentSurface
                              : "var(--surface)",
                          cursor: "pointer",
                        }}
                      >
                        <strong style={{ display: "block", fontSize: "0.95rem" }}>
                          {entry.name}
                        </strong>
                        <span style={{ fontSize: "0.8rem", color: palette.textMuted }}>
                          {entry.role || "Team member"}
                        </span>
                        <span
                          style={{
                            marginTop: "6px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            color: palette.accent,
                            fontWeight: 600,
                            fontSize: "0.8rem",
                          }}
                        >
                          {composeMode === "direct" ? "Start chat" : "Toggle in group"}
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>

              {composeMode === "group" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {selectedRecipients.length ? (
                      selectedRecipients.map((entry) => (
                        <Chip
                          key={entry.id}
                          label={entry.name}
                          onRemove={() =>
                            setSelectedRecipients((prev) =>
                              prev.filter((user) => user.id !== entry.id)
                            )
                          }
                        />
                      ))
                    ) : (
                      <span style={{ color: palette.textMuted, fontSize: "0.85rem" }}>
                        Pick at least one person for the group.
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Group name (optional)"
                    value={groupName}
                    onChange={(event) => setGroupName(event.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: radii.lg,
                      border: `1px solid ${palette.border}`,
                      backgroundColor: "var(--surface)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    disabled={!selectedRecipients.length}
                    style={{
                      border: "none",
                      borderRadius: radii.pill,
                      padding: "12px 18px",
                      backgroundColor: selectedRecipients.length
                        ? palette.accent
                        : "var(--info-surface)",
                      color: selectedRecipients.length ? "var(--surface)" : "var(--info)",
                      fontWeight: 600,
                      cursor: selectedRecipients.length ? "pointer" : "not-allowed",
                    }}
                  >
                    Create Group
                  </button>
                </div>
              )}

              {composeError && (
                <p style={{ color: "var(--danger)", margin: 0, fontSize: "0.85rem" }}>
                  {composeError}
                </p>
              )}
            </div>

            <div style={{ ...cardStyle, flex: 1, minHeight: 0 }}>
              <SectionTitle
                title="Threads"
                subtitle="Open conversations you're part of."
                action={
                  <span style={{ fontSize: "0.8rem", color: palette.textMuted }}>
                    {threads.length} active
                  </span>
                }
              />

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {loadingThreads && (
                  <p style={{ color: palette.textMuted }}>Loading threads…</p>
                )}
                {!loadingThreads && (
                  <>
                    <button
                      type="button"
                      onClick={openSystemNotificationsThread}
                      style={{
                        borderRadius: "18px",
                        border: `1px solid ${
                          isSystemThreadActive ? palette.accent : palette.border
                        }`,
                        backgroundColor:
                          isSystemThreadActive ? palette.accentSurface : "var(--surface)",
                        padding: "14px 16px",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <strong style={{ display: "block", fontSize: "0.95rem" }}>
                        System notifications
                      </strong>
                      <span style={{ fontSize: "0.85rem", color: palette.textMuted }}>
                        {systemLoading ? "Loading updates…" : systemPreview}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: palette.textMuted }}>
                        Latest {systemTimestampLabel}
                      </span>
                      <div style={{ marginTop: "6px", display: "flex", gap: "8px" }}>
                        {hasSystemUnread && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "4px 10px",
                              borderRadius: radii.pill,
                              backgroundColor: palette.accent,
                              color: "var(--surface)",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                            }}
                          >
                            Unread
                          </span>
                        )}
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "4px 10px",
                            borderRadius: radii.pill,
                            border: `1px solid ${palette.border}`,
                            fontSize: "0.75rem",
                            color: palette.textMuted,
                          }}
                        >
                          Read only
                        </span>
                      </div>
                    </button>
                    {threads.length ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {threads.map((thread) => (
                          <button
                            key={thread.id}
                            type="button"
                            onClick={() => openThread(thread.id)}
                            style={{
                              borderRadius: "18px",
                              border: `1px solid ${
                                activeThreadId === thread.id ? palette.accent : palette.border
                              }`,
                              backgroundColor:
                                activeThreadId === thread.id ? palette.accentSurface : "var(--surface)",
                              padding: "14px 16px",
                              textAlign: "left",
                              cursor: "pointer",
                            }}
                          >
                            <strong style={{ display: "block", fontSize: "0.95rem" }}>
                              {thread.title}
                            </strong>
                            {thread.lastMessage ? (
                              <span
                                style={{
                                  display: "block",
                                  marginTop: "4px",
                                  fontSize: "0.85rem",
                                  color: palette.textMuted,
                                }}
                              >
                                {thread.lastMessage.sender?.name || "Someone"}: {" "}
                                {thread.lastMessage.content.length > 64
                                  ? `${thread.lastMessage.content.slice(0, 64)}…`
                                  : thread.lastMessage.content}
                              </span>
                            ) : (
                              <span style={{ fontSize: "0.8rem", color: palette.textMuted }}>
                                No messages yet
                              </span>
                            )}
                            {thread.hasUnread && (
                              <span
                                style={{
                                  marginTop: "6px",
                                  display: "inline-flex",
                                  padding: "4px 10px",
                                  borderRadius: radii.pill,
                                  backgroundColor: palette.accent,
                                  color: "var(--surface)",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                }}
                              >
                                Unread
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: palette.textMuted, margin: 0 }}>
                        No conversations yet. Start one above.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle, flex: 1, minHeight: 0 }}>
            {activeSystemView ? (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, color: palette.accent }}>System notifications</h3>
                    <p style={{ margin: "4px 0 0", color: palette.textMuted }}>
                      {systemLoading ? "Loading updates…" : systemPreview}
                    </p>
                  </div>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: radii.pill,
                      backgroundColor: "var(--danger-surface)",
                      color: "var(--danger)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    Read only
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    maxHeight: "360px",
                    overflowY: "auto",
                    paddingRight: "4px",
                  }}
                >
                  {systemLoading && (
                    <p style={{ color: palette.textMuted, margin: 0 }}>Loading system updates…</p>
                  )}
                  {!systemLoading && systemError && (
                    <p style={{ color: "var(--danger)", margin: 0 }}>{systemError}</p>
                  )}
                  {!systemLoading && !systemError && systemNotifications.length === 0 && (
                    <p style={{ color: palette.textMuted, margin: 0 }}>No system notifications yet.</p>
                  )}
                  {!systemLoading && !systemError && systemNotifications.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {systemNotifications.map((note) => (
                        <article
                          key={`system-${note.notification_id}`}
                          style={{
                            borderRadius: "14px",
                            border: `1px solid ${palette.border}`,
                            padding: "12px",
                            backgroundColor: "var(--surface)",
                            boxShadow: shadows.sm,
                          }}
                        >
                          <p style={{ margin: 0, color: palette.textPrimary }}>{note.message || "System update"}</p>
                          <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: palette.textMuted }}>
                            {formatNotificationTimestamp(note.created_at)}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
                <p style={{ fontSize: "0.75rem", color: palette.textMuted, margin: 0 }}>
                  Only the system posts here; this thread cannot be deleted or renamed.
                </p>
              </>
            ) : activeThread ? (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "16px",
                    borderBottom: `1px solid ${palette.border}`,
                    paddingBottom: "12px",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, color: palette.accent }}>{activeThread.title}</h3>
                    <p style={{ margin: "4px 0 0", color: palette.textMuted }}>
                      {activeThread.members.length} participants
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <strong style={{ fontSize: "0.85rem", color: palette.textMuted }}>
                    Participants
                  </strong>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                    }}
                  >
                    {activeThread.members.map((member) => {
                      const label = `${member.profile?.name || "Unknown"}${
                        member.role === "leader" ? " • Leader" : ""
                      }`;
                      const canRemove =
                        isGroupLeader &&
                        member.userId !== dbUserId &&
                        activeThread.type === "group";
                      return (
                        <Chip
                          key={member.userId}
                          label={label}
                          onRemove={
                            canRemove
                              ? () => !groupManageBusy && handleRemoveMemberFromGroup(member.userId)
                              : undefined
                          }
                          disabled={groupManageBusy}
                        />
                      );
                    })}
                  </div>
                  {activeThread.type === "group" && (
                    <span style={{ fontSize: "0.75rem", color: palette.textMuted }}>
                      Group leaders can add or remove teammates to keep the chat focused.
                    </span>
                  )}
                </div>

                {activeThread.type === "group" && isGroupLeader && (
                  <div
                    style={{
                      marginTop: "12px",
                      border: "1px dashed var(--search-surface-muted)",
                      borderRadius: "16px",
                      padding: "12px",
                      backgroundColor: "var(--search-surface)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <strong style={{ fontSize: "0.85rem", color: palette.accent }}>
                      Manage group members
                    </strong>
                    <input
                      type="search"
                      value={groupSearchTerm}
                      onChange={(event) => setGroupSearchTerm(event.target.value)}
                      placeholder="Search colleagues to add (min 2 letters)…"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: radii.lg,
                        border: "1px solid var(--search-surface-muted)",
                        backgroundColor: "var(--search-surface)",
                        color: "var(--search-text)",
                      }}
                    />
                    {groupSearchTerm.trim().length > 0 && groupSearchTerm.trim().length < 2 && (
                      <p style={{ margin: 0, fontSize: "0.75rem", color: palette.textMuted }}>
                        Keep typing at least 2 letters to search.
                      </p>
                    )}
                    {groupSearchLoading && (
                      <p style={{ margin: 0, fontSize: "0.8rem", color: palette.textMuted }}>
                        Looking up colleagues…
                      </p>
                    )}
                    {!groupSearchLoading && groupSearchResults.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          maxHeight: "160px",
                          overflowY: "auto",
                        }}
                      >
                        {groupSearchResults.map((entry) => (
                          <div
                            key={entry.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              border: `1px solid ${palette.border}`,
                              borderRadius: "12px",
                              padding: "8px 12px",
                              backgroundColor: "var(--surface)",
                            }}
                          >
                            <div>
                              <strong style={{ fontSize: "0.9rem", color: palette.textPrimary }}>
                                {entry.name}
                              </strong>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: "0.75rem",
                                  color: palette.textMuted,
                                }}
                              >
                                {entry.role || "Team member"}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={groupManageBusy}
                              onClick={() => handleAddMemberToGroup(entry.id)}
                              style={{
                                border: "none",
                                borderRadius: radii.pill,
                                padding: "8px 14px",
                                backgroundColor: groupManageBusy ? "var(--info-surface)" : palette.accent,
                                color: groupManageBusy ? "var(--info)" : "var(--surface)",
                                fontWeight: 600,
                                cursor: groupManageBusy ? "not-allowed" : "pointer",
                              }}
                            >
                              Add
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {!groupSearchLoading &&
                      groupSearchTerm.trim().length >= 2 &&
                      groupSearchResults.length === 0 && (
                        <p style={{ margin: 0, fontSize: "0.8rem", color: palette.textMuted }}>
                          No colleagues match that search.
                        </p>
                      )}
                    {groupManageError && (
                      <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--danger)" }}>
                        {groupManageError}
                      </p>
                    )}
                  </div>
                )}

                <div
                  ref={scrollerRef}
                  style={{
                    marginTop: "16px",
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    paddingRight: "6px",
                  }}
                >
                  {loadingMessages && (
                    <p style={{ color: palette.textMuted }}>Loading conversation…</p>
                  )}
                  {!loadingMessages && messages.length === 0 && (
                    <p style={{ color: palette.textMuted }}>No messages yet.</p>
                  )}
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isMine={message.senderId === dbUserId}
                    />
                  ))}
                </div>

                <form
                  onSubmit={handleSendMessage}
                  style={{
                    marginTop: "16px",
                    borderTop: `1px solid ${palette.border}`,
                    paddingTop: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <textarea
                    rows={3}
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    placeholder="Write an internal update…"
                    style={{
                      width: "100%",
                      borderRadius: radii.lg,
                      border: `1px solid ${palette.border}`,
                      padding: "12px 14px",
                      resize: "none",
                      backgroundColor: "var(--surface)",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                    <button
                      type="submit"
                      disabled={!canSend}
                      style={{
                        border: "none",
                        borderRadius: radii.pill,
                        padding: "12px 20px",
                        backgroundColor: canSend ? palette.accent : "var(--info-surface)",
                        color: canSend ? "var(--surface)" : "var(--info)",
                        fontWeight: 600,
                        cursor: canSend ? "pointer" : "not-allowed",
                      }}
                    >
                      {sending ? "Sending…" : "Send"}
                    </button>
                  </div>
                  {conversationError && (
                    <p style={{ color: "var(--danger)", margin: 0, fontSize: "0.85rem" }}>
                      {conversationError}
                    </p>
                  )}
                </form>
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: palette.textMuted,
                  textAlign: "center",
                }}
              >
                Select or start a conversation to begin messaging.
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default MessagesPage;
