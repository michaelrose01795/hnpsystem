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
import useMessagesApi from "@/hooks/api/useMessagesApi";
import { useTheme } from "@/styles/themeProvider";

const palette = appShellTheme.palette;
const radii = appShellTheme.radii;
const shadows = appShellTheme.shadows;

const cardStyle = {
  background: "var(--surface)",
  border: `1px solid ${palette.border}`,
  borderRadius: "22px",
  padding: "20px",
  boxShadow: "none",
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

const Chip = ({ label, onRemove, disabled = false, color = palette.accent }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 12px",
      borderRadius: radii.pill,
      backgroundColor: palette.accentSurface,
      color,
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
          color: disabled ? palette.textMuted : color,
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
        boxShadow: "none",
      }}
    >
      {initial}
    </div>
  );
};

const MessageBubble = ({ message, isMine, nameColor = palette.accent }) => {
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
    boxShadow: isMine ? "0 2px 8px rgba(0, 0, 0, 0.08)" : "none",
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
              color: nameColor,
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

const formatRealtimeMessage = (rawMessage, thread) => {
  const senderMember = thread?.members?.find((member) => member.userId === rawMessage.sender_id);
  const senderProfile = senderMember?.profile || null;
  return {
    id: rawMessage.message_id,
    threadId: rawMessage.thread_id,
    content: rawMessage.content,
    createdAt: rawMessage.created_at,
    senderId: rawMessage.sender_id,
    receiverId: rawMessage.receiver_id,
    sender: senderProfile
      ? { ...senderProfile }
      : { id: rawMessage.sender_id, name: "Unknown" },
    metadata: rawMessage.metadata || null,
    savedForever: Boolean(rawMessage.saved_forever),
  };
};

const sortDirectoryEntries = (entries = []) =>
  [...entries].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
  );

function MessagesPage() {
  const { dbUserId, user } = useUser();
  const { isDark } = useTheme();

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
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [threadSearchTerm, setThreadSearchTerm] = useState("");
  const [threadSelectionMode, setThreadSelectionMode] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState([]);
  const [groupEditModalOpen, setGroupEditModalOpen] = useState(false);
  const [groupEditTitle, setGroupEditTitle] = useState("");
  const [groupEditBusy, setGroupEditBusy] = useState(false);
  const [groupEditError, setGroupEditError] = useState("");
  const [threadDeleteBusy, setThreadDeleteBusy] = useState(false);
  const [threadDeleteError, setThreadDeleteError] = useState("");

  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [groupSearchResults, setGroupSearchResults] = useState([]);
  const [groupSearchLoading, setGroupSearchLoading] = useState(false);
  const [groupManageError, setGroupManageError] = useState("");
  const [groupManageBusy, setGroupManageBusy] = useState(false);
  const [conversationError, setConversationError] = useState("");

  const scrollerRef = useRef(null);
  const {
    listThreads,
    listThreadMessages,
    listDirectoryUsers,
    createThread: createThreadApi,
    sendMessage: sendThreadMessage,
    addMembers,
    removeMembers,
    updateThread,
    deleteThread: deleteThreadApi,
  } = useMessagesApi();

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  const isGroupChat = Boolean(activeThread && activeThread.type === "group");

  const filteredThreads = useMemo(() => {
    const term = threadSearchTerm.trim().toLowerCase();
    if (!term) return threads;
    return threads.filter((thread) => {
      const title = (thread.title || "").toLowerCase();
      const lastMessage = (thread.lastMessage?.content || "").toLowerCase();
      return title.includes(term) || lastMessage.includes(term);
    });
  }, [threadSearchTerm, threads]);

  const userNameColor = isDark ? "#a855f7" : "#dc2626";
  const systemTitleColor = userNameColor;
  const unreadBackgroundColor = isDark ? "rgba(168, 85, 247, 0.15)" : "rgba(220, 38, 38, 0.12)";

  const isGroupLeader = useMemo(() => {
    if (!activeThread || activeThread.type !== "group" || !dbUserId) return false;
    return activeThread.members.some(
      (member) => member.userId === dbUserId && member.role === "leader"
    );
  }, [activeThread, dbUserId]);

  const canEditGroup = isGroupChat && isGroupLeader;

  const groupLeaderCount = useMemo(() => {
    if (!isGroupChat || !activeThread) return 0;
    return (activeThread.members || []).filter((member) => member.role === "leader").length;
  }, [activeThread, isGroupChat]);

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
      const payload = await listThreads({ userId: dbUserId });
      setThreads(payload?.data || payload?.threads || []);
    } catch (error) {
      console.error("❌ Failed to load threads:", error);
    } finally {
      setLoadingThreads(false);
    }
  }, [dbUserId, listThreads]);

  const fetchDirectory = useCallback(
    async (searchTerm = "") => {
      if (!dbUserId) return;
      const trimmedTerm = searchTerm.trim();
      if (!trimmedTerm) {
        return;
      }
      setDirectoryLoading(true);
      try {
        const payload = await listDirectoryUsers({
          q: trimmedTerm,
          exclude: dbUserId,
          limit: 100,
        });
        setDirectory(sortDirectoryEntries(payload?.data || payload?.users || []));
      } catch (error) {
        console.error("❌ Failed to load directory:", error);
      } finally {
        setDirectoryLoading(false);
      }
    },
    [dbUserId, listDirectoryUsers]
  );

  const openThread = useCallback(
    async (threadId) => {
      if (!threadId || !dbUserId) return;
      setActiveSystemView(false);
      setActiveThreadId(threadId);
      setLoadingMessages(true);
      setConversationError("");
      try {
        const payload = await listThreadMessages(threadId, {
          userId: dbUserId,
        });
        setMessages(payload?.data || payload?.messages || []);
        setConversationError("");
        setThreads((prev) =>
          prev.map((thread) =>
            thread.id === threadId ? { ...thread, hasUnread: false } : thread
          )
        );
      } catch (error) {
        console.error("❌ Failed to load conversation:", error);
        setConversationError(error.message || "Unable to load conversation.");
      } finally {
        setLoadingMessages(false);
      }
    },
    [dbUserId, listThreadMessages, setThreads]
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
      if (!dbUserId || !targetUserId) return false;
      setComposeError("");
      try {
        const payload = await createThreadApi({
          type: "direct",
          createdBy: dbUserId,
          targetUserId,
        });
        const thread = payload?.data || payload?.thread;
        if (!thread) throw new Error("Thread could not be created.");
        mergeThread(thread);
        await fetchThreads();
        await openThread(thread.id);
        return true;
      } catch (error) {
        console.error("❌ Failed to start direct chat:", error);
        setComposeError(error.message || "Unable to start chat");
        return false;
      }
    },
    [createThreadApi, dbUserId, fetchThreads, mergeThread, openThread]
  );

  const handleCreateGroup = useCallback(async () => {
    if (!dbUserId) return false;
    if (selectedRecipients.length === 0) {
      setComposeError("Select at least one colleague for the group.");
      return false;
    }

    setComposeError("");
    try {
      const payload = await createThreadApi({
        type: "group",
        createdBy: dbUserId,
        title: groupName,
        memberIds: selectedRecipients.map((user) => user.id),
      });
      const thread = payload?.data || payload?.thread;
      if (!thread) throw new Error("Group thread was not created.");
      setSelectedRecipients([]);
      setGroupName("");
      setComposeMode("direct");
      mergeThread(thread);
      await fetchThreads();
      await openThread(thread.id);
      return true;
    } catch (error) {
      console.error("❌ Failed to create group:", error);
      setComposeError(error.message || "Unable to create group");
      return false;
    }
  }, [
    createThreadApi,
    dbUserId,
    fetchThreads,
    groupName,
    mergeThread,
    openThread,
    selectedRecipients,
  ]);

  const handleOpenNewChatModal = useCallback(() => {
    setComposeError("");
    setSelectedRecipients([]);
    setGroupName("");
    setDirectorySearch("");
    setComposeMode("direct");
    setNewChatModalOpen(true);
  }, []);

  const closeNewChatModal = useCallback(() => {
    setNewChatModalOpen(false);
    setComposeError("");
    setSelectedRecipients([]);
    setDirectorySearch("");
    setGroupName("");
    setComposeMode("direct");
  }, []);

  const handleStartChat = useCallback(async () => {
    if (composeMode === "direct") {
      const selection = selectedRecipients[0];
      if (!selection) {
        setComposeError("Select someone to chat with.");
        return;
      }
      const success = await startDirectThread(selection.id);
      if (success) {
        closeNewChatModal();
      }
      return;
    }
    const success = await handleCreateGroup();
    if (success) {
      closeNewChatModal();
    }
  }, [
    closeNewChatModal,
    composeMode,
    handleCreateGroup,
    selectedRecipients,
    startDirectThread,
  ]);

  const handleSendMessage = useCallback(
    async (event) => {
      event?.preventDefault();
      if (!messageDraft.trim() || !activeThreadId || !dbUserId) return;
      setSending(true);
      setConversationError("");
      try {
        const metadata = parseSlashCommandMetadata(messageDraft, activeThread);
        const payload = await sendThreadMessage(activeThreadId, {
          senderId: dbUserId,
          content: messageDraft.trim(),
          metadata,
        });
        const newMessage = payload?.data || payload?.message;
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
    [
      activeThread,
      activeThreadId,
      dbUserId,
      fetchThreads,
      messageDraft,
      openThread,
      sendThreadMessage,
    ]
  );

  useEffect(() => {
    if (!dbUserId) return;
    fetchThreads();
  }, [dbUserId, fetchThreads]);

  useEffect(() => {
    if (!dbUserId) return;
    const trimmed = directorySearch.trim();
    if (!trimmed) {
      return;
    }
    const handle = setTimeout(() => {
      fetchDirectory(trimmed);
    }, 350);
    return () => clearTimeout(handle);
  }, [dbUserId, directorySearch, fetchDirectory]);

  useEffect(() => {
    if (!dbUserId || !newChatModalOpen) return;
    if (directorySearch.trim()) return;
    let cancelled = false;
    setDirectoryLoading(true);
    const loadDefault = async () => {
      try {
        const payload = await listDirectoryUsers({
          limit: 100,
          exclude: dbUserId,
        });
        if (!cancelled) {
          setDirectory(sortDirectoryEntries(payload?.data || payload?.users || []));
        }
      } catch (error) {
        if (!cancelled) {
          console.error("❌ Failed to load default directory:", error);
          setDirectory([]);
        }
      } finally {
        if (!cancelled) {
          setDirectoryLoading(false);
        }
      }
    };
    loadDefault();
    return () => {
      cancelled = true;
    };
  }, [dbUserId, listDirectoryUsers, newChatModalOpen, directorySearch]);

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

    const threadIds = threads.map((thread) => thread.id).filter(Boolean);
    const channel = supabase.channel(`messages-refresh-${dbUserId}`);

    if (threadIds.length) {
      channel.on(
        "postgres_changes",
        {
          schema: "public",
          table: "messages",
          event: "INSERT",
          filter: `thread_id=in.(${threadIds.join(",")})`,
        },
        (payload) => {
          if (!payload?.new) return;
          const rawMessage = payload.new;
          fetchThreads();
          if (
            activeThread &&
            activeThread.id === rawMessage.thread_id &&
            rawMessage.sender_id !== dbUserId
          ) {
            const formatted = formatRealtimeMessage(rawMessage, activeThread);
            setMessages((prev) => {
              if (prev.some((message) => message.id === formatted.id)) {
                return prev;
              }
              return [...prev, formatted];
            });
            openThread(activeThread.id);
          }
        }
      );
    }

    channel.on(
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
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeThread, dbUserId, fetchThreads, openThread, threads]);

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
    if (!activeThread || activeThread.type !== "group") {
      setGroupEditTitle("");
      setGroupEditModalOpen(false);
      setGroupEditError("");
      setGroupEditBusy(false);
      return;
    }
    setGroupEditTitle(activeThread.title || "");
  }, [activeThread]);

  useEffect(() => {
    if (!threadSelectionMode) {
      setSelectedThreadIds([]);
      return;
    }
    setSelectedThreadIds((prev) =>
      prev.filter((threadId) => threads.some((thread) => thread.id === threadId))
    );
  }, [threadSelectionMode, threads]);

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
    setGroupSearchLoading(true);
    const excludeIds = [
      ...new Set([
        ...(activeThread?.members || []).map((member) => member.userId),
        dbUserId,
      ]),
    ].join(",");

    const runSearch = async () => {
      try {
        const payload = await listDirectoryUsers({
          q: groupSearchTerm,
          exclude: excludeIds,
        });
        if (!cancelled) {
          setGroupSearchResults(payload?.data || payload?.users || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("❌ Group search failed:", error);
          setGroupSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setGroupSearchLoading(false);
        }
      }
    };

    runSearch();

    return () => {
      cancelled = true;
    };
  }, [activeThread, dbUserId, groupSearchTerm, isGroupLeader, listDirectoryUsers]);

  const handleDirectoryUser = (userEntry) => {
    if (composeMode === "direct") {
      setSelectedRecipients((prev) => {
        if (prev[0]?.id === userEntry.id) {
          return [];
        }
        return [userEntry];
      });
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
        const payload = await addMembers(activeThreadId, {
          actorId: dbUserId,
          userIds: [userId],
        });
        if (payload?.data) {
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
    [activeThreadId, addMembers, dbUserId, mergeThread]
  );

  const handleRemoveMemberFromGroup = useCallback(
    async (userId) => {
      if (!activeThreadId || !dbUserId || !userId) return;
      setGroupManageBusy(true);
      setGroupManageError("");
      try {
        const payload = await removeMembers(activeThreadId, {
          actorId: dbUserId,
          userIds: [userId],
        });
        if (payload?.data) {
          mergeThread(payload.data);
        }
      } catch (error) {
        console.error("❌ Failed to remove member:", error);
        setGroupManageError(error.message || "Unable to remove member.");
      } finally {
        setGroupManageBusy(false);
      }
    },
    [activeThreadId, dbUserId, mergeThread, removeMembers]
  );

  const handleSaveGroupDetails = useCallback(async () => {
    if (!activeThreadId || !dbUserId) return;
    setGroupEditBusy(true);
    setGroupEditError("");
    try {
      const payload = await updateThread(activeThreadId, {
        actorId: dbUserId,
        title: groupEditTitle,
      });
      const thread = payload?.data || payload?.thread;
      if (thread) {
        mergeThread(thread);
        await fetchThreads();
      }
      setGroupEditModalOpen(false);
    } catch (error) {
      console.error("❌ Failed to update group:", error);
      setGroupEditError(error.message || "Unable to update group.");
    } finally {
      setGroupEditBusy(false);
    }
  }, [activeThreadId, dbUserId, fetchThreads, groupEditTitle, mergeThread, updateThread]);

  const openGroupEditModal = useCallback(() => {
    setGroupEditError("");
    setGroupEditBusy(false);
    setGroupEditTitle(activeThread?.title || "");
    setGroupEditModalOpen(true);
  }, [activeThread]);

  const closeGroupEditModal = useCallback(() => {
    setGroupEditModalOpen(false);
    setGroupEditError("");
    setGroupEditBusy(false);
    setGroupEditTitle(activeThread?.title || "");
  }, [activeThread]);

  const handleThreadCheckboxChange = useCallback((threadId) => {
    setSelectedThreadIds((prev) => {
      if (prev.includes(threadId)) {
        return prev.filter((id) => id !== threadId);
      }
      return [...prev, threadId];
    });
  }, []);

  const handleDeleteSelectedThreads = useCallback(async () => {
    if (!selectedThreadIds.length || !dbUserId) return;
    setThreadDeleteBusy(true);
    setThreadDeleteError("");
    try {
      await Promise.all(
        selectedThreadIds.map((threadId) =>
          deleteThreadApi(threadId, { actorId: dbUserId })
        )
      );
      setThreads((prev) => prev.filter((thread) => !selectedThreadIds.includes(thread.id)));
      if (selectedThreadIds.includes(activeThreadId)) {
        setActiveThreadId(null);
        setMessages([]);
      }
      setSelectedThreadIds([]);
      setThreadSelectionMode(false);
      fetchThreads();
    } catch (error) {
      console.error("❌ Failed to delete threads:", error);
      setThreadDeleteError(error.message || "Unable to delete selected threads.");
    } finally {
      setThreadDeleteBusy(false);
    }
  }, [
    activeThreadId,
    dbUserId,
    deleteThreadApi,
    fetchThreads,
    selectedThreadIds,
    setThreads,
    setMessages,
    setThreadSelectionMode,
  ]);

  const handleCloseSelectionMode = useCallback(() => {
    setThreadSelectionMode(false);
    setSelectedThreadIds([]);
    setThreadDeleteError("");
  }, []);

  const canSend = Boolean(
    messageDraft.trim() && activeThread && !loadingMessages && !sending
  );

  const canInitiateChat =
    composeMode === "direct"
      ? selectedRecipients.length === 1
      : selectedRecipients.length > 0;

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
            <div style={{ ...cardStyle, flex: 1, minHeight: 0 }}>
              <SectionTitle
                title={threadSelectionMode ? "Selected" : "Threads"}
                subtitle={
                  threadSelectionMode && selectedThreadIds.length
                    ? `${selectedThreadIds.length} thread(s) selected`
                    : undefined
                }
                action={
                  threadSelectionMode ? (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={handleDeleteSelectedThreads}
                        disabled={threadDeleteBusy || !selectedThreadIds.length}
                        style={{
                          borderRadius: radii.pill,
                          padding: "8px 14px",
                          border: "none",
                          backgroundColor:
                            threadDeleteBusy || !selectedThreadIds.length
                              ? "var(--search-surface)"
                              : "var(--danger)",
                          color:
                            threadDeleteBusy || !selectedThreadIds.length
                              ? palette.textMuted
                              : "var(--surface)",
                          fontWeight: 600,
                          cursor:
                            threadDeleteBusy || !selectedThreadIds.length ? "not-allowed" : "pointer",
                        }}
                      >
                        {threadDeleteBusy ? "Deleting..." : "Delete"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCloseSelectionMode}
                        style={{
                          borderRadius: radii.pill,
                          padding: "8px 14px",
                          border: `1px solid ${palette.border}`,
                          backgroundColor: "var(--surface)",
                          color: palette.accent,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Close
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={openSystemNotificationsThread}
                        style={{
                          borderRadius: radii.pill,
                          padding: "8px 14px",
                          border: `1px solid ${
                            activeSystemView ? palette.accent : palette.border
                          }`,
                          backgroundColor: activeSystemView ? palette.accentSurface : "var(--surface)",
                          color: systemTitleColor,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        System
                        {hasSystemUnread && (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              backgroundColor: palette.accent,
                              display: "inline-block",
                            }}
                          />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!threads.length) return;
                          setThreadSelectionMode(true);
                          setSelectedThreadIds([]);
                        }}
                        disabled={!threads.length}
                        style={{
                          borderRadius: radii.pill,
                          padding: "8px 14px",
                          border: `1px solid ${palette.border}`,
                          backgroundColor: "var(--surface)",
                          color: palette.accent,
                          fontWeight: 600,
                          cursor: threads.length ? "pointer" : "not-allowed",
                        }}
                      >
                        Select
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenNewChatModal}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          border: `1px solid ${palette.border}`,
                          backgroundColor: "var(--surface)",
                          color: palette.accent,
                          fontSize: "1.2rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        +
                      </button>
                    </div>
                  )
                }
              />

              {threadDeleteError && (
                <p style={{ color: "var(--danger)", margin: "4px 0 0", fontSize: "0.8rem" }}>
                  {threadDeleteError}
                </p>
              )}

              <input
                type="search"
                placeholder="Search threads..."
                value={threadSearchTerm}
                onChange={(event) => setThreadSearchTerm(event.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: radii.lg,
                  border: "1px solid var(--search-surface-muted)",
                  backgroundColor: "var(--search-surface)",
                  color: "var(--search-text)",
                }}
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
                    {filteredThreads.length ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {filteredThreads.map((thread) => (
                          <div
                            key={thread.id}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "10px",
                            }}
                          >
                            {threadSelectionMode && (
                              <input
                                type="checkbox"
                                checked={selectedThreadIds.includes(thread.id)}
                                onChange={() => handleThreadCheckboxChange(thread.id)}
                                style={{
                                  marginTop: "18px",
                                  width: "16px",
                                  height: "16px",
                                  cursor: "pointer",
                                }}
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => (threadSelectionMode ? null : openThread(thread.id))}
                              disabled={threadSelectionMode}
                              style={{
                                flex: 1,
                                borderRadius: "18px",
                                border: `1px solid ${
                                  activeThreadId === thread.id ? palette.accent : palette.border
                                }`,
                                backgroundColor:
                                  activeThreadId === thread.id
                                    ? palette.accentSurface
                                    : thread.hasUnread
                                    ? unreadBackgroundColor
                                    : "var(--surface)",
                                padding: "14px 16px",
                                textAlign: "left",
                                cursor: threadSelectionMode ? "default" : "pointer",
                              }}
                            >
                              <strong
                                style={{
                                  display: "block",
                                  fontSize: "0.95rem",
                                  color: systemTitleColor,
                                }}
                              >
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
                                  <span style={{ color: systemTitleColor, fontWeight: 600 }}>
                                    {thread.lastMessage.sender?.name || "Someone"}
                                  </span>
                                  {": "}
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
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: palette.textMuted, margin: 0 }}>
                        {threadSearchTerm.trim()
                          ? "No threads match your search."
                          : "No conversations yet. Start one above."}
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
                    <h3 style={{ margin: 0, color: systemTitleColor }}>System notifications</h3>
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
                            boxShadow: "none",
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
                    alignItems: "flex-start",
                    gap: "16px",
                    borderBottom: `1px solid ${palette.border}`,
                    paddingBottom: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <h3 style={{ margin: 0, color: systemTitleColor }}>{activeThread.title}</h3>
                  </div>
                  {isGroupChat && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                      }}
                    >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px",
                        justifyContent: "flex-end",
                      }}
                    >
                      {activeThread.members.map((member) => {
                        const label = `${member.profile?.name || "Unknown"}${
                          member.role === "leader" ? " • Leader" : ""
                        }`;
                        return <Chip key={member.userId} label={label} color={userNameColor} />;
                      })}
                    </div>
                      {canEditGroup && (
                        <button
                          type="button"
                          onClick={openGroupEditModal}
                          style={{
                            borderRadius: radii.pill,
                            padding: "8px 16px",
                            border: `1px solid ${palette.border}`,
                            backgroundColor: "var(--surface)",
                            color: palette.accent,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>

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
                      nameColor={userNameColor}
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

      {groupEditModalOpen && isGroupChat && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1100,
          }}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              backgroundColor: "var(--surface)",
              borderRadius: "20px",
              border: `1px solid ${palette.border}`,
              boxShadow: shadows.lg,
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div>
              <h3 style={{ margin: 0, color: systemTitleColor }}>Edit group chat</h3>
              <p style={{ margin: "4px 0 0", color: palette.textMuted }}>
                Rename the chat or remove people who should no longer access it.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.85rem", color: palette.textMuted }}>Group name</label>
              <input
                type="text"
                value={groupEditTitle}
                onChange={(event) => setGroupEditTitle(event.target.value)}
                placeholder="Group name"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: radii.lg,
                  border: `1px solid ${palette.border}`,
                  backgroundColor: "var(--surface)",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <strong style={{ fontSize: "0.85rem", color: palette.textMuted }}>
                Members ({activeThread.members.length})
              </strong>
              <div
                style={{
                  maxHeight: "240px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {activeThread.members.map((member) => {
                  const isSelf = member.userId === dbUserId;
                  const canRemoveMember =
                    canEditGroup &&
                    member.userId !== dbUserId &&
                    !(member.role === "leader" && groupLeaderCount <= 1);
                  return (
                    <div
                      key={member.userId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        border: `1px solid ${palette.border}`,
                        borderRadius: "12px",
                        padding: "10px 12px",
                        backgroundColor: "var(--surface)",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600, color: userNameColor }}>
                          {member.profile?.name || "Unknown"}
                          {isSelf ? " • You" : ""}
                        </span>
                        <span style={{ fontSize: "0.8rem", color: palette.textMuted }}>
                          {member.role === "leader" ? "Leader" : "Member"}
                        </span>
                      </div>
                      {canRemoveMember && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMemberFromGroup(member.userId)}
                          disabled={groupManageBusy}
                          style={{
                            borderRadius: radii.pill,
                            padding: "6px 14px",
                            border: "none",
                            backgroundColor: groupManageBusy ? "var(--info-surface)" : "var(--danger)",
                            color: "var(--surface)",
                            fontWeight: 600,
                            cursor: groupManageBusy ? "not-allowed" : "pointer",
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {isGroupLeader && (
              <div
                style={{
                  border: "1px dashed var(--search-surface-muted)",
                  borderRadius: "16px",
                  padding: "12px",
                  backgroundColor: "var(--search-surface)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  color: "var(--search-text)",
                }}
              >
                <strong style={{ fontSize: "0.85rem", color: "var(--search-text)" }}>
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
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--search-text)" }}>
                    Keep typing at least 2 letters to search.
                  </p>
                )}
                {groupSearchLoading && (
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--search-text)" }}>
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
                          <strong style={{ fontSize: "0.9rem", color: userNameColor }}>
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

            {groupEditError && (
              <p style={{ color: "var(--danger)", margin: 0, fontSize: "0.85rem" }}>{groupEditError}</p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={closeGroupEditModal}
                style={{
                  borderRadius: radii.pill,
                  padding: "10px 16px",
                  border: `1px solid ${palette.border}`,
                  backgroundColor: "var(--surface)",
                  color: palette.textMuted,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveGroupDetails}
                disabled={groupEditBusy}
                style={{
                  borderRadius: radii.pill,
                  padding: "10px 18px",
                  border: "none",
                  backgroundColor: groupEditBusy ? "var(--info-surface)" : palette.accent,
                  color: groupEditBusy ? "var(--info)" : "var(--surface)",
                  fontWeight: 600,
                  cursor: groupEditBusy ? "not-allowed" : "pointer",
                }}
              >
                {groupEditBusy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {newChatModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "min(640px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              backgroundColor: "var(--surface)",
              borderRadius: "20px",
              border: `1px solid ${palette.border}`,
              boxShadow: shadows.lg,
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div>
              <h3 style={{ margin: 0, color: systemTitleColor }}>Start New Chat</h3>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <ComposeToggleButton
                active={composeMode === "direct"}
                onClick={() => {
                  setComposeMode("direct");
                  setComposeError("");
                  setSelectedRecipients((prev) => (prev.length ? [prev[0]] : []));
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
                height: "320px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {directoryLoading && (
                <p style={{ color: palette.textMuted, margin: 0 }}>Loading colleagues…</p>
              )}
              {!directoryLoading && directory.length === 0 && (
                <p style={{ margin: 0, color: palette.textMuted }}>No colleagues found.</p>
              )}
              {!directoryLoading && directory.length > 0 && (
                <>
                  {directory.map((entry) => {
                    const selected = isRecipientSelected(entry);
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => handleDirectoryUser(entry)}
                        style={{
                          textAlign: "left",
                          borderRadius: "16px",
                          border: `1px solid ${selected ? palette.accent : palette.border}`,
                          padding: "12px 14px",
                          backgroundColor: selected ? palette.accentSurface : "var(--surface)",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "12px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "1rem",
                              fontWeight: 700,
                              color: userNameColor,
                            }}
                          >
                            {entry.name}
                          </span>
                          <span style={{ fontSize: "0.85rem", color: palette.textMuted, fontWeight: 600 }}>
                            {entry.role || "Team member"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  maxHeight: "120px",
                  overflowY: "auto",
                  paddingRight: "2px",
                }}
              >
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
                      color={userNameColor}
                    />
                  ))
                ) : (
                  <span style={{ color: palette.textMuted, fontSize: "0.85rem" }}>
                    No participants selected yet.
                  </span>
                )}
              </div>

              {composeMode === "group" && (
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
              )}
            </div>

            {composeError && (
              <p style={{ color: "var(--danger)", margin: 0, fontSize: "0.85rem" }}>
                {composeError}
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={closeNewChatModal}
                style={{
                  borderRadius: radii.pill,
                  padding: "10px 16px",
                  border: `1px solid ${palette.border}`,
                  backgroundColor: "var(--surface)",
                  color: palette.textMuted,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartChat}
                disabled={!canInitiateChat}
                style={{
                  borderRadius: radii.pill,
                  padding: "10px 18px",
                  border: "none",
                  backgroundColor: canInitiateChat ? palette.accent : "var(--info-surface)",
                  color: canInitiateChat ? "var(--surface)" : "var(--info)",
                  fontWeight: 600,
                  cursor: canInitiateChat ? "pointer" : "not-allowed",
                }}
              >
                Start Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default MessagesPage;
