// file location: src/pages/messages/index.js
//
// /messages — the staff conversation hub.
//
// This file owns state, data and behaviour; presentation lives in
// src/components/page-ui/messages/ (messages-ui.js composes the list,
// conversation and details panels). The vocabulary — conversation types,
// statuses, priorities, slash commands — is src/lib/messages/conversationModel.js.

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { hasAllAccessRole } from "@/lib/auth/roles";
import { hasCustomerBookingRequestAccess } from "@/lib/auth/serviceActionRoles";
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { supabase } from "@/lib/database/supabaseClient";
import useMessagesApi from "@/hooks/api/useMessagesApi";
import { useMediaQuery, BREAKPOINTS } from "@/hooks/useIsMobile";
import MessagesPageUi from "@/components/page-ui/messages/messages-ui";
import { readableText } from "@/lib/messages/messageTokens";
import { logFailure } from "@/lib/utils/logFailure";
import { REACTION_TARGET_MESSAGE, subscribeToReactions } from "@/lib/database/reactions";
import { fetchReactions, saveReaction } from "@/lib/api/reactions";
import { buildAttachmentUrl } from "@/lib/api/messages";
import {
  ATTACHMENT_MAX_PER_MESSAGE,
  formatClock,
  formatListTimestamp,
  getAvailableSlashCommands,
  getPriority,
  getStatus,
  parseDraft,
} from "@/lib/messages/conversationModel";

const UNREAD_MARKER_STORAGE_KEY = "messagesUnreadMarkerDismissals";
const PINNED_THREADS_STORAGE_KEY = "messagesPinnedThreadIds";
const DETAILS_OPEN_STORAGE_KEY = "messagesDetailsOpen";
const MAX_PINNED_THREADS = 3;
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const PRESENCE_POLL_MS = 60 * 1000;

const readStorage = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStorage = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private windows / blocked storage: the setting just is not remembered.
  }
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

const sortDirectoryEntries = (entries = []) =>
  [...entries].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
  );

const memberIsCustomer = (member) =>
  String(member?.role || member?.profile?.role || "").toLowerCase().includes("customer");

const ADD_CUSTOMER_TOKEN_REGEX = /\/addcust[^\s]+/gi;

function MessagesPage() {
  const router = useRouter();
  const { dbUserId, user } = useUser();
  const userRoles = useMemo(() => user?.roles || [], [user?.roles]);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [messageReactions, setMessageReactions] = useState({});
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [conversationError, setConversationError] = useState("");
  const [composeWarning, setComposeWarning] = useState("");
  const [actionBusyId, setActionBusyId] = useState(null);

  const [directory, setDirectory] = useState([]);
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryLoading, setDirectoryLoading] = useState(false);

  const [systemNotifications, setSystemNotifications] = useState([]);
  const [bookingNotifications, setBookingNotifications] = useState([]);
  const [systemLoading, setSystemLoading] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [systemError, setSystemError] = useState("");
  const [bookingsError, setBookingsError] = useState("");
  const [activeSystemView, setActiveSystemView] = useState(false);
  const [activeBookingsView, setActiveBookingsView] = useState(false);
  const [lastSystemViewedAt, setLastSystemViewedAt] = useState(null);
  const [lastBookingsViewedAt, setLastBookingsViewedAt] = useState(null);
  const [systemUnreadCutoff, setSystemUnreadCutoff] = useState(null);
  const [bookingsUnreadCutoff, setBookingsUnreadCutoff] = useState(null);
  const [activeThreadUnreadCutoff, setActiveThreadUnreadCutoff] = useState(false);
  const [dismissedUnreadMarkers, setDismissedUnreadMarkers] = useState({});
  const [threadUnreadMarkerEl, setThreadUnreadMarkerEl] = useState(null);
  const [systemUnreadMarkerEl, setSystemUnreadMarkerEl] = useState(null);

  // New conversation popup
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [composeMode, setComposeMode] = useState("direct");
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [includeDepartment, setIncludeDepartment] = useState(true);
  const [newJobNumber, setNewJobNumber] = useState("");
  const [composeError, setComposeError] = useState("");
  const [creatingThread, setCreatingThread] = useState(false);

  // List
  const [threadSearchTerm, setThreadSearchTerm] = useState("");
  const [messageFilter, setMessageFilter] = useState("all"); // all | unread | mentions
  const [typeFilter, setTypeFilter] = useState("all");
  const [pinnedThreadIds, setPinnedThreadIds] = useState([]);
  const [threadSelectionMode, setThreadSelectionMode] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState([]);
  const [threadDeleteBusy, setThreadDeleteBusy] = useState(false);
  const [threadDeleteError, setThreadDeleteError] = useState("");

  // Conversation header / search / details
  const [customerDetail, setCustomerDetail] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState("details");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [jumpHighlightId, setJumpHighlightId] = useState(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [workingStaff, setWorkingStaff] = useState([]);

  // Group management (leaders)
  const [groupEditModalOpen, setGroupEditModalOpen] = useState(false);
  const [groupEditTitle, setGroupEditTitle] = useState("");
  const [groupEditBusy, setGroupEditBusy] = useState(false);
  const [groupEditError, setGroupEditError] = useState("");
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [groupSearchResults, setGroupSearchResults] = useState([]);
  const [groupSearchLoading, setGroupSearchLoading] = useState(false);
  const [groupManageError, setGroupManageError] = useState("");
  const [groupManageBusy, setGroupManageBusy] = useState(false);

  const [commandHelpOpen, setCommandHelpOpen] = useState(false);

  // Leave requests posted into a thread
  const [leaveDecisionBusy, setLeaveDecisionBusy] = useState(false);
  const [leaveDecisionError, setLeaveDecisionError] = useState("");
  const [leaveDeclineModal, setLeaveDeclineModal] = useState({ open: false, message: null });
  const [leaveDeclineReason, setLeaveDeclineReason] = useState("");

  // One panel at a time below the tablet breakpoint (matches messages.css).
  const isMobileView = useMediaQuery(`(max-width: ${BREAKPOINTS.TABLET - 1}px)`);
  const [mobilePanelView, setMobilePanelView] = useState("threads");

  const canSeeCustomerRequests = hasCustomerBookingRequestAccess(user?.roles);
  const handleCreateJobFromRequest = (note) => {
    if (!note?.event_id || !canSeeCustomerRequests) return;
    router.push(`/new-job?fromEvent=${encodeURIComponent(note.event_id)}`);
  };

  const scrollerRef = useRef(null);
  const composerInputRef = useRef(null);
  const messageNodesRef = useRef(new Map());
  const lastScrollKeyRef = useRef("");
  const unreadMarkerTimersRef = useRef(new Map());
  const activeUnreadMarkerKeyRef = useRef(null);
  const deepLinkProcessedRef = useRef(false);
  const collabDeepLinkRef = useRef(false);
  const mobileHistoryPushedRef = useRef(false);

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
    connectCustomer: connectCustomerApi,
    messageAction,
    resolveRecords,
    uploadAttachment,
  } = useMessagesApi();

  // ---------------------------------------------------------------------------
  // Derived thread data
  // ---------------------------------------------------------------------------
  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) || null,
    [threads, activeThreadId]
  );
  const isGroupChat = Boolean(activeThread && activeThread.type === "group");

  const availableCommands = useMemo(
    () => getAvailableSlashCommands(userRoles, { allAccess: hasAllAccessRole(userRoles.map((r) => String(r).toLowerCase())) }),
    [userRoles]
  );

  const hasThreadStarted = useCallback((thread) => {
    const content = thread?.lastMessage?.content;
    return Boolean((typeof content === "string" && content.trim()) || thread?.lastMessage?.id);
  }, []);

  // A conversation appears once it has a message (as before). Department,
  // job and announcement channels are standing rooms, so they appear as soon
  // as you are in them.
  const visibleThreads = useMemo(
    () =>
      threads.filter(
        (thread) =>
          hasThreadStarted(thread) ||
          thread.id === activeThreadId ||
          ["department", "job", "announcement"].includes(thread.conversationType)
      ),
    [threads, hasThreadStarted, activeThreadId]
  );

  const hasListFilters = Boolean(threadSearchTerm.trim()) || messageFilter !== "all" || typeFilter !== "all";

  const filteredThreads = useMemo(() => {
    const term = threadSearchTerm.trim().toLowerCase();
    let result = visibleThreads;
    if (messageFilter === "unread") result = result.filter((thread) => thread.hasUnread);
    if (messageFilter === "mentions") result = result.filter((thread) => thread.unreadMentionCount > 0);
    if (typeFilter !== "all") result = result.filter((thread) => thread.conversationType === typeFilter);
    if (!term) return result;
    return result.filter((thread) => {
      const haystack = [
        thread.title,
        thread.lastMessage?.content,
        thread.jobNumber,
        thread.department,
        ...(thread.members || []).map((member) => member.profile?.name),
        ...(thread.linkedRecords || []).map((link) => link.label),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [threadSearchTerm, visibleThreads, messageFilter, typeFilter]);

  const pinnedThreads = useMemo(
    () =>
      pinnedThreadIds
        .map((threadId) => visibleThreads.find((thread) => thread.id === threadId))
        .filter(Boolean),
    [pinnedThreadIds, visibleThreads]
  );

  const listThreadsShown = useMemo(
    () => (hasListFilters ? filteredThreads : filteredThreads.filter((thread) => !pinnedThreadIds.includes(thread.id))),
    [filteredThreads, hasListFilters, pinnedThreadIds]
  );

  const isGroupLeader = useMemo(() => {
    if (!activeThread || activeThread.type !== "group" || !dbUserId) return false;
    return activeThread.members.some((member) => member.userId === dbUserId && member.role === "leader");
  }, [activeThread, dbUserId]);

  const activeHasCustomer = Boolean(activeThread?.members?.some(memberIsCustomer));
  const canEditGroup = isGroupChat && isGroupLeader;
  const canManageMembers = canEditGroup && !activeHasCustomer;

  const groupLeaderCount = useMemo(() => {
    if (!isGroupChat || !activeThread) return 0;
    return (activeThread.members || []).filter((member) => member.role === "leader").length;
  }, [activeThread, isGroupChat]);

  // ---------------------------------------------------------------------------
  // System / bookings feeds
  // ---------------------------------------------------------------------------
  const orderedSystemNotifications = useMemo(
    () =>
      [...(systemNotifications || [])].sort(
        (a, b) => new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime()
      ),
    [systemNotifications]
  );
  const orderedBookingNotifications = useMemo(
    () =>
      [...(bookingNotifications || [])].sort(
        (a, b) => new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime()
      ),
    [bookingNotifications]
  );
  const latestSystem = orderedSystemNotifications[orderedSystemNotifications.length - 1] || null;
  const latestBooking = orderedBookingNotifications[orderedBookingNotifications.length - 1] || null;
  const latestSystemTime = latestSystem?.created_at ? new Date(latestSystem.created_at).getTime() : 0;
  const latestBookingTime = latestBooking?.created_at ? new Date(latestBooking.created_at).getTime() : 0;
  const hasSystemUnread =
    Boolean(systemNotifications.length) &&
    latestSystemTime > (lastSystemViewedAt ? new Date(lastSystemViewedAt).getTime() : 0);
  const hasBookingsUnread =
    Boolean(bookingNotifications.length) &&
    latestBookingTime > (lastBookingsViewedAt ? new Date(lastBookingsViewedAt).getTime() : 0);

  const activePseudoNotifications = activeBookingsView ? orderedBookingNotifications : orderedSystemNotifications;
  const activePseudoUnreadCutoff = activeBookingsView ? bookingsUnreadCutoff : systemUnreadCutoff;
  const activePseudoTimestamp = activeBookingsView ? latestBooking?.created_at : latestSystem?.created_at;
  const isSystemThreadActive = activeSystemView || activeBookingsView;

  // ---------------------------------------------------------------------------
  // Unread markers (unchanged behaviour: shown once, dismissed 30s after seen)
  // ---------------------------------------------------------------------------
  const activeThreadUnreadMarkerIndex = useMemo(() => {
    if (!messages.length) return -1;
    if (activeThreadUnreadCutoff === false) return -1;
    if (!activeThreadUnreadCutoff) return 0;
    const cutoffTime = new Date(activeThreadUnreadCutoff).getTime();
    if (Number.isNaN(cutoffTime)) return -1;
    return messages.findIndex(
      (message) =>
        new Date(message?.createdAt || 0).getTime() > cutoffTime && message.senderId !== dbUserId
    );
  }, [messages, activeThreadUnreadCutoff, dbUserId]);
  const systemUnreadMarkerIndex = useMemo(() => {
    if (!activePseudoNotifications.length) return -1;
    if (!activePseudoUnreadCutoff) return 0;
    const cutoffTime = new Date(activePseudoUnreadCutoff).getTime();
    if (Number.isNaN(cutoffTime)) return -1;
    return activePseudoNotifications.findIndex((note) => new Date(note?.created_at || 0).getTime() > cutoffTime);
  }, [activePseudoNotifications, activePseudoUnreadCutoff]);
  const activeThreadUnreadMarkerKey = useMemo(() => {
    if (!activeThread || activeThreadUnreadMarkerIndex < 0) return null;
    const cutoff = activeThreadUnreadCutoff === null ? "none" : String(activeThreadUnreadCutoff);
    return `thread:${activeThread.id}:${cutoff}`;
  }, [activeThread, activeThreadUnreadCutoff, activeThreadUnreadMarkerIndex]);
  const systemUnreadMarkerKey = useMemo(() => {
    if (!isSystemThreadActive || systemUnreadMarkerIndex < 0) return null;
    const cutoff = activePseudoUnreadCutoff === null ? "none" : String(activePseudoUnreadCutoff);
    return `${activeBookingsView ? "bookings" : "system"}:${cutoff}`;
  }, [activeBookingsView, activePseudoUnreadCutoff, isSystemThreadActive, systemUnreadMarkerIndex]);
  const showThreadUnreadMarker = Boolean(
    activeThreadUnreadMarkerKey && !dismissedUnreadMarkers[activeThreadUnreadMarkerKey]
  );
  const showSystemUnreadMarker = Boolean(systemUnreadMarkerKey && !dismissedUnreadMarkers[systemUnreadMarkerKey]);
  const currentUnreadMarkerKey = isSystemThreadActive
    ? showSystemUnreadMarker
      ? systemUnreadMarkerKey
      : null
    : showThreadUnreadMarker
      ? activeThreadUnreadMarkerKey
      : null;

  const dismissUnreadMarker = useCallback((markerKey) => {
    if (!markerKey) return;
    setDismissedUnreadMarkers((prev) => {
      if (prev[markerKey]) return prev;
      const next = { ...prev, [markerKey]: true };
      writeStorage(UNREAD_MARKER_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    const timerId = unreadMarkerTimersRef.current.get(markerKey);
    if (timerId) {
      window.clearTimeout(timerId);
      unreadMarkerTimersRef.current.delete(markerKey);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Local preferences
  // ---------------------------------------------------------------------------
  useEffect(() => {
    try {
      const saved = JSON.parse(readStorage(UNREAD_MARKER_STORAGE_KEY) || "null");
      if (saved && typeof saved === "object") setDismissedUnreadMarkers(saved);
    } catch {
      // Malformed storage: start fresh.
    }
    try {
      const saved = JSON.parse(readStorage(PINNED_THREADS_STORAGE_KEY) || "null");
      if (Array.isArray(saved)) {
        // Ids were strings in older builds and numbers from the API; keep both
        // comparable by normalising to numbers.
        setPinnedThreadIds(saved.map(Number).filter(Number.isFinite).slice(0, MAX_PINNED_THREADS));
      }
    } catch {
      // Malformed storage: no pins.
    }
    const savedDetails = readStorage(DETAILS_OPEN_STORAGE_KEY);
    if (savedDetails !== null) setDetailsOpen(savedDetails === "1");
    else setDetailsOpen(window.matchMedia("(min-width: 1600px)").matches);
  }, []);

  const toggleDetails = useCallback((force) => {
    setDetailsOpen((prev) => {
      const next = typeof force === "boolean" ? force : !prev;
      writeStorage(DETAILS_OPEN_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const handleTogglePinnedThread = useCallback((threadId) => {
    if (!threadId) return;
    setPinnedThreadIds((prev) => {
      const exists = prev.includes(threadId);
      if (!exists && prev.length >= MAX_PINNED_THREADS) return prev;
      const next = exists ? prev.filter((id) => id !== threadId) : [...prev, threadId];
      writeStorage(PINNED_THREADS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!threads.length) return;
    setPinnedThreadIds((prev) => {
      const next = prev.filter((threadId) => visibleThreads.some((thread) => thread.id === threadId));
      if (next.length === prev.length) return prev;
      writeStorage(PINNED_THREADS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [threads.length, visibleThreads]);

  // ---------------------------------------------------------------------------
  // Mobile back navigation (browser back returns to the list)
  // ---------------------------------------------------------------------------
  const ensureMobileConversationHistory = useCallback(() => {
    if (!isMobileView || mobileHistoryPushedRef.current) return;
    window.history.pushState({ mobileChat: true }, "");
    mobileHistoryPushedRef.current = true;
  }, [isMobileView]);

  const handleMobileBack = useCallback((calledFromPopState = false) => {
    setMobilePanelView("threads");
    setActiveThreadId(null);
    setActiveSystemView(false);
    setActiveBookingsView(false);
    setMessages([]);
    if (mobileHistoryPushedRef.current && !calledFromPopState) {
      mobileHistoryPushedRef.current = false;
      window.history.back();
    } else {
      mobileHistoryPushedRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (isMobileView) return;
    mobileHistoryPushedRef.current = false;
    setMobilePanelView("threads");
  }, [isMobileView]);

  useEffect(() => {
    if (!isMobileView) return undefined;
    const onPopState = () => {
      if (mobileHistoryPushedRef.current || activeThreadId || activeSystemView || activeBookingsView) {
        handleMobileBack(true);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [activeBookingsView, activeSystemView, activeThreadId, isMobileView, handleMobileBack]);

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------
  const mergeThread = useCallback((nextThread) => {
    if (!nextThread?.id) return;
    setThreads((prev) => {
      const idx = prev.findIndex((thread) => thread.id === nextThread.id);
      const copy = idx === -1 ? [nextThread, ...prev] : prev.map((t) => (t.id === nextThread.id ? nextThread : t));
      return copy.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    });
  }, []);

  const fetchThreads = useCallback(async () => {
    if (!dbUserId) return;
    setLoadingThreads((prev) => prev || !threads.length);
    try {
      const payload = await listThreads({ userId: dbUserId });
      setThreads(payload?.data || payload?.threads || []);
    } catch (error) {
      logFailure("❌ Failed to load threads:", error);
    } finally {
      setLoadingThreads(false);
    }
    // threads.length is only read to decide whether to show the skeleton.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbUserId, listThreads]);

  const fetchDirectory = useCallback(
    async (searchTermValue = "") => {
      if (!dbUserId) return;
      const trimmed = searchTermValue.trim();
      if (!trimmed) return;
      setDirectoryLoading(true);
      try {
        const payload = await listDirectoryUsers({ q: trimmed, exclude: dbUserId, limit: 100 });
        setDirectory(sortDirectoryEntries(payload?.data || payload?.users || []));
      } catch (error) {
        logFailure("❌ Failed to load directory:", error);
      } finally {
        setDirectoryLoading(false);
      }
    },
    [dbUserId, listDirectoryUsers]
  );

  // `silent` refreshes the open transcript in place (after sending, on a
  // realtime update) without the skeleton or resetting the unread marker.
  const openThread = useCallback(
    async (threadId, threadSnapshot = null, { silent = false } = {}) => {
      if (!threadId || !dbUserId) return;
      if (!silent) {
        ensureMobileConversationHistory();
        if (isMobileView) setMobilePanelView("conversation");
        const referenceThread = threadSnapshot || threads.find((thread) => thread.id === threadId) || null;
        const currentMember = (referenceThread?.members || []).find((member) => member.userId === dbUserId);
        setActiveThreadUnreadCutoff(referenceThread?.hasNewMessages || referenceThread?.hasUnread ? currentMember?.lastReadAt || null : false);
        setActiveSystemView(false);
        setActiveBookingsView(false);
        if (threadId !== activeThreadId) {
          setReplyTo(null);
          setEditingMessage(null);
          setPendingAttachments([]);
          setSearchOpen(false);
          setSearchTerm("");
          setComposeWarning("");
        }
        setActiveThreadId(threadId);
        setLoadingMessages(true);
        setConversationError("");
      }
      try {
        const payload = await listThreadMessages(threadId, { userId: dbUserId });
        setMessages(payload?.data || payload?.messages || []);
        if (!silent) setConversationError("");
        // In the presentation deck the thread list is fixed demo data — keep
        // the unread badges showing even after a thread is opened.
        if (!isPresentationMode()) {
          setThreads((prev) =>
            prev.map((thread) =>
              thread.id === threadId
                ? { ...thread, hasUnread: false, hasNewMessages: false, unreadCount: 0, unreadMentionCount: 0 }
                : thread
            )
          );
        }
      } catch (error) {
        logFailure("❌ Failed to load conversation:", error);
        setConversationError(error.message || "Unable to load conversation.");
      } finally {
        if (!silent) setLoadingMessages(false);
      }
    },
    [activeThreadId, dbUserId, ensureMobileConversationHistory, isMobileView, listThreadMessages, threads]
  );

  // Presentation/demo transcripts can ship pre-seeded reactions on message
  // metadata. Real conversations never set this key.
  useEffect(() => {
    if (!messages.length) return;
    setMessageReactions((prev) => {
      let changed = false;
      const next = { ...prev };
      messages.forEach((message) => {
        const seeded = message?.metadata?.reactions;
        if (Array.isArray(seeded) && seeded.length && !next[message.id]) {
          next[message.id] = seeded.map((reaction) => ({ userId: reaction.userId, emoji: reaction.emoji }));
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [messages]);

  // Reactions live in public.content_reactions.
  const refreshMessageReactions = useCallback(async (messageIds) => {
    const ids = (messageIds || []).filter(Boolean).map((id) => String(id));
    if (!ids.length) return;
    try {
      const response = await fetchReactions(REACTION_TARGET_MESSAGE, ids);
      const loaded = response?.data || {};
      setMessageReactions((prev) => {
        const next = { ...prev };
        ids.forEach((id) => {
          next[id] = loaded[id] || [];
        });
        return next;
      });
    } catch (err) {
      logFailure("Failed to load message reactions:", err);
    }
  }, []);

  const visibleMessageIdKey = useMemo(() => messages.map((message) => String(message.id)).join(","), [messages]);

  useEffect(() => {
    const ids = visibleMessageIdKey ? visibleMessageIdKey.split(",") : [];
    if (!ids.length) return undefined;
    void refreshMessageReactions(ids);
    return subscribeToReactions(REACTION_TARGET_MESSAGE, () => {
      void refreshMessageReactions(ids);
    });
  }, [visibleMessageIdKey, refreshMessageReactions]);

  // One reaction per user per message; picking the same emoji clears it.
  const handleReactToMessage = useCallback(
    async (messageId, emoji) => {
      if (!dbUserId || !messageId) return;
      const targetId = String(messageId);
      setMessageReactions((prev) => {
        const current = prev[targetId] || [];
        const mine = current.find((entry) => String(entry.userId) === String(dbUserId));
        const withoutMine = current.filter((entry) => String(entry.userId) !== String(dbUserId));
        const next = mine && mine.emoji === emoji ? withoutMine : [...withoutMine, { userId: dbUserId, emoji }];
        return { ...prev, [targetId]: next };
      });
      try {
        await saveReaction({ targetType: REACTION_TARGET_MESSAGE, targetId, userId: dbUserId, emoji });
      } catch (err) {
        logFailure("Failed to save message reaction:", err);
      } finally {
        void refreshMessageReactions([targetId]);
      }
    },
    [dbUserId, refreshMessageReactions]
  );

  const openSystemNotificationsThread = useCallback(() => {
    ensureMobileConversationHistory();
    if (isMobileView) setMobilePanelView("conversation");
    setSystemUnreadCutoff(lastSystemViewedAt || null);
    setActiveSystemView(true);
    setActiveBookingsView(false);
    setActiveThreadId(null);
    setMessages([]);
    setLoadingMessages(false);
    setConversationError("");
    setLastSystemViewedAt(new Date().toISOString());
  }, [ensureMobileConversationHistory, isMobileView, lastSystemViewedAt]);

  const openBookingsThread = useCallback(() => {
    ensureMobileConversationHistory();
    if (isMobileView) setMobilePanelView("conversation");
    setBookingsUnreadCutoff(lastBookingsViewedAt || null);
    setActiveBookingsView(true);
    setActiveSystemView(false);
    setActiveThreadId(null);
    setMessages([]);
    setLoadingMessages(false);
    setConversationError("");
    setLastBookingsViewedAt(new Date().toISOString());
  }, [ensureMobileConversationHistory, isMobileView, lastBookingsViewedAt]);

  // Customer summary for the details panel of a customer conversation.
  const activeCustomerEmail = useMemo(
    () => (activeThread?.members || []).find(memberIsCustomer)?.profile?.email || null,
    [activeThread]
  );
  useEffect(() => {
    if (!activeCustomerEmail) {
      setCustomerDetail(null);
      return undefined;
    }
    let cancelled = false;
    setCustomerDetail(null);
    fetch(`/api/messages/customer-detail?email=${encodeURIComponent(activeCustomerEmail)}`, {
      credentials: "same-origin",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!cancelled && payload?.data) setCustomerDetail(payload.data);
      })
      .catch(() => {
        if (!cancelled) setCustomerDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeCustomerEmail]);

  // Live "who is on a job" signal for presence (same source as the top bar).
  useEffect(() => {
    if (!dbUserId || isPresentationMode()) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/status/team-presence", { credentials: "include" });
        const data = res.ok ? await res.json() : null;
        if (!cancelled && Array.isArray(data?.working)) setWorkingStaff(data.working);
      } catch {
        // Presence falls back to "last seen" only.
      }
    };
    load();
    const timer = window.setInterval(load, PRESENCE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [dbUserId]);

  const presenceFor = useCallback(
    (member) => {
      if (!member) return null;
      if (memberIsCustomer(member)) {
        return {
          tone: "external",
          text: member.lastReadAt ? `Customer · read ${formatListTimestamp(member.lastReadAt)}` : "Customer · not opened yet",
        };
      }
      const working = workingStaff.find((entry) => String(entry.userId) === String(member.userId));
      if (working?.jobNumber) return { tone: "busy", text: `On job ${working.jobNumber}` };
      if (member.lastReadAt && Date.now() - new Date(member.lastReadAt).getTime() < ACTIVE_WINDOW_MS) {
        return { tone: "active", text: "Active now" };
      }
      return member.lastReadAt
        ? { tone: null, text: `Last seen ${formatListTimestamp(member.lastReadAt)}${formatListTimestamp(member.lastReadAt).includes(":") ? "" : ` ${formatClock(member.lastReadAt)}`}` }
        : { tone: null, text: "Not seen yet" };
    },
    [workingStaff]
  );

  // ---------------------------------------------------------------------------
  // Leave requests
  // ---------------------------------------------------------------------------
  const submitLeaveDecision = useCallback(
    async (message, decision, reason = "") => {
      const absenceId = message?.metadata?.leaveRequest?.absenceId;
      if (!absenceId || !activeThreadId) return;
      setLeaveDecisionBusy(true);
      setLeaveDecisionError("");
      try {
        const response = await fetch(`/api/hr/leave-requests/${absenceId}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ decision, reason, threadId: activeThreadId, messageId: message.id }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Unable to process leave request.");
        }
        if (leaveDeclineModal.open) {
          setLeaveDeclineModal({ open: false, message: null });
          setLeaveDeclineReason("");
        }
        await openThread(activeThreadId, activeThread, { silent: true });
        await fetchThreads();
      } catch (error) {
        logFailure("Failed to process leave request decision:", error);
        setLeaveDecisionError(error.message || "Unable to process leave request.");
        setConversationError(error.message || "Unable to process leave request.");
      } finally {
        setLeaveDecisionBusy(false);
      }
    },
    [activeThread, activeThreadId, fetchThreads, leaveDeclineModal.open, openThread]
  );

  const handleConfirmDeclineLeaveRequest = useCallback(async () => {
    if (!leaveDeclineReason.trim() || !leaveDeclineModal.message) {
      setLeaveDecisionError("Enter a reason before declining this leave request.");
      return;
    }
    await submitLeaveDecision(leaveDeclineModal.message, "decline", leaveDeclineReason.trim());
  }, [leaveDeclineModal.message, leaveDeclineReason, submitLeaveDecision]);

  // ---------------------------------------------------------------------------
  // Creating conversations
  // ---------------------------------------------------------------------------
  const connectCustomerToConversation = useCallback(
    async ({ threadId, customerQuery }) => {
      if (!threadId || !dbUserId) throw new Error("Select a conversation before inviting a customer.");
      if (!customerQuery) throw new Error("Customer name or email is required.");
      const payload = await connectCustomerApi({ threadId, actorId: dbUserId, customerQuery });
      const nextThread = payload?.thread || payload?.data;
      if (!nextThread?.id) throw new Error("Customer conversation could not be created.");
      mergeThread(nextThread);
      await fetchThreads();
      return { thread: nextThread, customer: payload?.customer || null };
    },
    [connectCustomerApi, dbUserId, fetchThreads, mergeThread]
  );

  const startDirectThread = useCallback(
    async (targetUserId) => {
      if (!dbUserId || !targetUserId) return false;
      setComposeError("");
      try {
        const payload = await createThreadApi({ type: "direct", createdBy: dbUserId, targetUserId });
        const thread = payload?.data || payload?.thread;
        if (!thread) throw new Error("Thread could not be created.");
        mergeThread(thread);
        await fetchThreads();
        await openThread(thread.id, thread);
        return true;
      } catch (error) {
        logFailure("❌ Failed to start direct chat:", error);
        setComposeError(error.message || "Unable to start chat");
        return false;
      }
    },
    [createThreadApi, dbUserId, fetchThreads, mergeThread, openThread]
  );

  const resetNewConversation = useCallback(() => {
    setComposeError("");
    setSelectedRecipients([]);
    setGroupName("");
    setDirectorySearch("");
    setNewDepartment("");
    setIncludeDepartment(true);
    setNewJobNumber("");
    setComposeMode("direct");
  }, []);

  const handleOpenNewChatModal = useCallback(() => {
    resetNewConversation();
    setNewChatModalOpen(true);
  }, [resetNewConversation]);

  const closeNewChatModal = useCallback(() => {
    setNewChatModalOpen(false);
    resetNewConversation();
  }, [resetNewConversation]);

  const handleStartChat = useCallback(async () => {
    if (!dbUserId) return;
    setCreatingThread(true);
    setComposeError("");
    try {
      if (composeMode === "direct") {
        const selection = selectedRecipients[0];
        if (!selection) {
          setComposeError("Select someone to chat with.");
          return;
        }
        if (await startDirectThread(selection.id)) closeNewChatModal();
        return;
      }
      if (composeMode === "group" && !selectedRecipients.length) {
        setComposeError("Select at least one colleague for the group.");
        return;
      }
      const payload = await createThreadApi({
        type: "group",
        createdBy: dbUserId,
        title: groupName,
        memberIds: selectedRecipients.map((entry) => entry.id),
        conversationType: composeMode === "group" ? "staff" : composeMode,
        department: newDepartment,
        jobNumber: newJobNumber,
        includeDepartment,
      });
      const thread = payload?.data || payload?.thread;
      if (!thread) throw new Error("The conversation was not created.");
      mergeThread(thread);
      await fetchThreads();
      await openThread(thread.id, thread);
      closeNewChatModal();
    } catch (error) {
      logFailure("❌ Failed to create conversation:", error);
      setComposeError(error.message || "Unable to create the conversation.");
    } finally {
      setCreatingThread(false);
    }
  }, [
    closeNewChatModal,
    composeMode,
    createThreadApi,
    dbUserId,
    fetchThreads,
    groupName,
    includeDepartment,
    mergeThread,
    newDepartment,
    newJobNumber,
    openThread,
    selectedRecipients,
    startDirectThread,
  ]);

  const canInitiateChat =
    composeMode === "direct"
      ? selectedRecipients.length === 1
      : composeMode === "group"
        ? selectedRecipients.length > 0
        : composeMode === "department"
          ? Boolean(newDepartment)
          : composeMode === "job"
            ? Boolean(newJobNumber.trim())
            : Boolean(groupName.trim()) && (selectedRecipients.length > 0 || (newDepartment && includeDepartment));

  const handleDirectoryUser = (userEntry) => {
    if (composeMode === "direct") {
      setSelectedRecipients((prev) => (prev[0]?.id === userEntry.id ? [] : [userEntry]));
      return;
    }
    setSelectedRecipients((prev) =>
      prev.some((entry) => entry.id === userEntry.id)
        ? prev.filter((entry) => entry.id !== userEntry.id)
        : [...prev, userEntry]
    );
  };

  // ---------------------------------------------------------------------------
  // Drafting & sending
  // ---------------------------------------------------------------------------
  const focusComposer = useCallback(() => {
    window.requestAnimationFrame(() => composerInputRef.current?.focus());
  }, []);

  const handleAddFiles = useCallback(
    async (files) => {
      if (!activeThreadId || !files.length) return;
      const room = ATTACHMENT_MAX_PER_MESSAGE - pendingAttachments.length;
      if (room <= 0) {
        setComposeWarning(`A message can carry up to ${ATTACHMENT_MAX_PER_MESSAGE} files.`);
        return;
      }
      setUploading(true);
      setComposeWarning(files.length > room ? `Only the first ${room} file(s) were added.` : "");
      try {
        for (const file of files.slice(0, room)) {
          const descriptor = await uploadAttachment(activeThreadId, file, { actorId: dbUserId });
          setPendingAttachments((prev) => [
            ...prev,
            {
              id: descriptor.path,
              fileName: descriptor.fileName,
              mimeType: descriptor.mimeType,
              sizeBytes: descriptor.sizeBytes,
              isImage: descriptor.isImage,
              downloadUrl: buildAttachmentUrl(activeThreadId, descriptor.path),
              descriptor,
            },
          ]);
        }
      } catch (error) {
        logFailure("❌ Failed to upload attachment:", error);
        setConversationError(error.message || "Unable to upload the file.");
      } finally {
        setUploading(false);
      }
    },
    [activeThreadId, dbUserId, pendingAttachments.length, uploadAttachment]
  );

  const saveEdit = useCallback(async () => {
    if (!editingMessage || !activeThreadId) return;
    const content = messageDraft.trim();
    if (!content) return;
    setSending(true);
    try {
      const payload = await messageAction(activeThreadId, {
        actorId: dbUserId,
        messageId: editingMessage.id,
        action: "edit",
        content,
      });
      const updated = payload?.data;
      if (updated) setMessages((prev) => prev.map((message) => (message.id === updated.id ? updated : message)));
      setEditingMessage(null);
      setMessageDraft("");
    } catch (error) {
      setConversationError(error.message || "Unable to edit the message.");
    } finally {
      setSending(false);
    }
  }, [activeThreadId, dbUserId, editingMessage, messageAction, messageDraft]);

  const handleSendMessage = useCallback(async () => {
    if (editingMessage) {
      await saveEdit();
      return;
    }
    if ((!messageDraft.trim() && !pendingAttachments.length) || !activeThread || !dbUserId) return;

    const parsed = parseDraft(messageDraft, { members: activeThread.members || [] });
    if (parsed.errors.length) {
      setConversationError(parsed.errors.join(" "));
      return;
    }

    setSending(true);
    setConversationError("");
    setComposeWarning("");
    const warnings = [];
    try {
      let targetThreadId = activeThreadId;
      let content = parsed.content.replace(ADD_CUSTOMER_TOKEN_REGEX, "").trim();

      if (parsed.addCustomer) {
        const { thread: nextThread, customer } = await connectCustomerToConversation({
          threadId: activeThreadId,
          customerQuery: parsed.addCustomer,
        });
        targetThreadId = nextThread.id;
        if (!content) {
          const label = customer?.name || customer?.email || parsed.addCustomer;
          content = `Customer ${label} was added to this chat.`;
        }
      }

      // Resolve referenced records so only real ones are linked.
      let links = [];
      if (parsed.references.length) {
        try {
          const resolved = await resolveRecords(parsed.references);
          links = resolved?.data?.links || [];
          const unresolved = resolved?.data?.unresolved || [];
          if (unresolved.length) {
            warnings.push(`Not found, so not linked: ${unresolved.map((entry) => entry.label).join(", ")}.`);
          }
        } catch {
          warnings.push("Linked records could not be checked just now; the message was still sent.");
        }
      }

      const threadUpdates = {};
      if (links.length) threadUpdates.addLinks = links;
      if (parsed.status) threadUpdates.status = parsed.status;
      if (parsed.priority) threadUpdates.priority = parsed.priority;
      if (parsed.assign) threadUpdates.assignedTo = parsed.assign.userId;

      const baseMetadata = {};
      if (replyTo) {
        baseMetadata.replyTo = {
          id: replyTo.id,
          senderName: replyTo.sender?.name || "Unknown",
          contentSnippet: String(replyTo.content || "").slice(0, 200),
        };
      }
      if (pendingAttachments.length) baseMetadata.attachments = pendingAttachments.map((file) => file.descriptor);
      if (links.length) baseMetadata.links = links;
      const jobLink = links.find((link) => link.recordType === "job_card");
      if (jobLink) baseMetadata.jobNumber = jobLink.recordId; // read by job-card message views

      const events = [];
      if (parsed.status) events.push(`Status set to ${getStatus(parsed.status).label}`);
      if (parsed.priority) events.push(`Priority set to ${getPriority(parsed.priority).label}`);
      if (parsed.assign) events.push(`Owner set to ${parsed.assign.name}`);

      const sends = [];
      if (content || baseMetadata.attachments) sends.push({ content, metadata: baseMetadata });
      if (parsed.task) {
        sends.push({
          content: parsed.task.text,
          metadata: { ...(sends.length ? {} : baseMetadata), task: { text: parsed.task.text, status: "open", createdBy: dbUserId } },
        });
      }
      if (parsed.reminder) {
        sends.push({
          content: parsed.reminder.text,
          metadata: { ...(sends.length ? {} : baseMetadata), reminder: { ...parsed.reminder, status: "open", createdBy: dbUserId } },
        });
      }
      if (events.length) sends.push({ content: events.join(" · "), metadata: { event: true } });
      if (!sends.length) throw new Error("Message is empty after processing commands.");

      let latestThread = null;
      const sent = [];
      for (let index = 0; index < sends.length; index += 1) {
        const payload = await sendThreadMessage(targetThreadId, {
          senderId: dbUserId,
          content: sends[index].content,
          metadata: Object.keys(sends[index].metadata).length ? sends[index].metadata : null,
          threadUpdates: index === 0 && Object.keys(threadUpdates).length ? threadUpdates : undefined,
        });
        const newMessage = payload?.data || payload?.message;
        if (newMessage) sent.push(newMessage);
        if (payload?.thread) latestThread = payload.thread;
        if (payload?.warning) warnings.push(payload.warning);
      }

      setMessageDraft("");
      setReplyTo(null);
      setPendingAttachments([]);
      if (latestThread) mergeThread(latestThread);
      if (targetThreadId === activeThreadId) {
        setMessages((prev) => [...prev, ...sent]);
      }
      if (warnings.length) setComposeWarning(warnings.join(" "));
      await fetchThreads();
      await openThread(targetThreadId, null, { silent: targetThreadId === activeThreadId });
    } catch (error) {
      logFailure("❌ Failed to send message:", error);
      setConversationError(error.message || "Unable to send message.");
    } finally {
      setSending(false);
    }
  }, [
    activeThread,
    activeThreadId,
    connectCustomerToConversation,
    dbUserId,
    editingMessage,
    fetchThreads,
    mergeThread,
    messageDraft,
    openThread,
    pendingAttachments,
    replyTo,
    resolveRecords,
    saveEdit,
    sendThreadMessage,
  ]);

  const handleInsertCommandFromHelp = useCallback(
    (command) => {
      setMessageDraft((prev) => (prev && !/\s$/.test(prev) ? `${prev} ${command.insert}` : `${prev}${command.insert}`));
      setCommandHelpOpen(false);
      focusComposer();
    },
    [focusComposer]
  );

  // ---------------------------------------------------------------------------
  // Message actions
  // ---------------------------------------------------------------------------
  const handleMessageAction = useCallback(
    async (message, action) => {
      if (!message || !activeThreadId) return;
      if (action === "reply-start") {
        setEditingMessage(null);
        setReplyTo(message);
        focusComposer();
        return;
      }
      if (action === "edit-start") {
        setReplyTo(null);
        setEditingMessage(message);
        setMessageDraft(message.content || "");
        focusComposer();
        return;
      }
      if (action === "delete" && !window.confirm("Delete this message for everyone?")) return;

      setActionBusyId(message.id);
      try {
        const payload = await messageAction(activeThreadId, { actorId: dbUserId, messageId: message.id, action });
        const updated = payload?.data;
        if (updated) setMessages((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      } catch (error) {
        setConversationError(error.message || "That action could not be completed.");
      } finally {
        setActionBusyId(null);
      }
    },
    [activeThreadId, dbUserId, focusComposer, messageAction]
  );

  const registerMessageNode = useCallback((id, node) => {
    if (node) messageNodesRef.current.set(id, node);
    else messageNodesRef.current.delete(id);
  }, []);

  const jumpToMessage = useCallback((messageId) => {
    const node = messageNodesRef.current.get(messageId);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setJumpHighlightId(messageId);
    window.setTimeout(() => setJumpHighlightId((current) => (current === messageId ? null : current)), 2500);
    if (isMobileView || !window.matchMedia("(min-width: 1600px)").matches) toggleDetails(false);
  }, [isMobileView, toggleDetails]);

  // ---------------------------------------------------------------------------
  // In-conversation search
  // ---------------------------------------------------------------------------
  const searchMatches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!searchOpen || !term) return [];
    return messages
      .filter((message) => !message.metadata?.deleted)
      .filter((message) =>
        `${readableText(message.content, userRoles)} ${message.sender?.name || ""}`.toLowerCase().includes(term)
      )
      .map((message) => message.id);
  }, [messages, searchOpen, searchTerm, userRoles]);

  useEffect(() => {
    setSearchIndex(searchMatches.length ? searchMatches.length - 1 : 0);
  }, [searchMatches.length, searchTerm]);

  const currentSearchId = searchMatches[searchIndex] || null;
  useEffect(() => {
    if (!currentSearchId) return;
    messageNodesRef.current.get(currentSearchId)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentSearchId]);

  // ---------------------------------------------------------------------------
  // Conversation settings
  // ---------------------------------------------------------------------------
  const handleUpdateSettings = useCallback(
    async (patch) => {
      if (!activeThreadId || !dbUserId) return;
      setSettingsBusy(true);
      setSettingsError("");
      try {
        const payload = await updateThread(activeThreadId, { actorId: dbUserId, ...patch });
        const thread = payload?.data || payload?.thread;
        if (thread) mergeThread(thread);

        // Workflow changes are posted into the conversation so everyone sees
        // who changed what.
        const events = [];
        if (patch.status) events.push(`Status set to ${getStatus(patch.status).label}`);
        if (patch.priority) events.push(`Priority set to ${getPriority(patch.priority).label}`);
        if (patch.assignedTo !== undefined) {
          const owner = (activeThread?.members || []).find((member) => member.userId === patch.assignedTo);
          events.push(owner ? `Owner set to ${owner.profile?.name}` : "Owner cleared");
        }
        if (events.length) {
          const sent = await sendThreadMessage(activeThreadId, {
            senderId: dbUserId,
            content: events.join(" · "),
            metadata: { event: true },
          });
          if (sent?.data) setMessages((prev) => [...prev, sent.data]);
        }
      } catch (error) {
        setSettingsError(error.message || "The setting could not be saved.");
      } finally {
        setSettingsBusy(false);
      }
    },
    [activeThread, activeThreadId, dbUserId, mergeThread, sendThreadMessage, updateThread]
  );

  // ---------------------------------------------------------------------------
  // Group management
  // ---------------------------------------------------------------------------
  const handleAddMemberToGroup = useCallback(
    async (userId) => {
      if (!activeThreadId || !dbUserId || !userId) return;
      setGroupManageBusy(true);
      setGroupManageError("");
      try {
        const payload = await addMembers(activeThreadId, { actorId: dbUserId, userIds: [userId] });
        if (payload?.data) {
          mergeThread(payload.data);
          setGroupSearchTerm("");
          setGroupSearchResults([]);
        }
      } catch (error) {
        logFailure("❌ Failed to add member:", error);
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
        const payload = await removeMembers(activeThreadId, { actorId: dbUserId, userIds: [userId] });
        if (payload?.data) mergeThread(payload.data);
      } catch (error) {
        logFailure("❌ Failed to remove member:", error);
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
      const payload = await updateThread(activeThreadId, { actorId: dbUserId, title: groupEditTitle });
      const thread = payload?.data || payload?.thread;
      if (thread) {
        mergeThread(thread);
        await fetchThreads();
      }
      setGroupEditModalOpen(false);
    } catch (error) {
      logFailure("❌ Failed to update group:", error);
      setGroupEditError(error.message || "Unable to update group.");
    } finally {
      setGroupEditBusy(false);
    }
  }, [activeThreadId, dbUserId, fetchThreads, groupEditTitle, mergeThread, updateThread]);

  const deleteThreads = useCallback(
    async (ids) => {
      if (!ids.length || !dbUserId) return;
      setThreadDeleteBusy(true);
      setThreadDeleteError("");
      try {
        await Promise.all(ids.map((threadId) => deleteThreadApi(threadId, { actorId: dbUserId })));
        setThreads((prev) => prev.filter((thread) => !ids.includes(thread.id)));
        if (ids.includes(activeThreadId)) {
          setActiveThreadId(null);
          setMessages([]);
        }
        setSelectedThreadIds([]);
        setThreadSelectionMode(false);
        fetchThreads();
      } catch (error) {
        logFailure("❌ Failed to delete threads:", error);
        setThreadDeleteError(error.message || "Unable to remove the selected conversations.");
      } finally {
        setThreadDeleteBusy(false);
      }
    },
    [activeThreadId, dbUserId, deleteThreadApi, fetchThreads]
  );

  // ---------------------------------------------------------------------------
  // Effects: initial load, deep links, directory, feeds, realtime
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!dbUserId) return;
    fetchThreads();
  }, [dbUserId, fetchThreads]);

  // Deep-link from a job card: open the customer's thread and pre-fill /job.
  useEffect(() => {
    if (deepLinkProcessedRef.current) return;
    if (!router.isReady || !threads.length || loadingThreads) return;
    const { jobNumber, customerEmail, customerName } = router.query;
    if (!jobNumber) return;
    deepLinkProcessedRef.current = true;

    const normalise = (value = "") => (value || "").toLowerCase().trim();
    const customerThread = threads.find((thread) =>
      (thread.members || []).some((member) => {
        if (!normalise(member.role).includes("customer")) return false;
        const profile = member.profile || {};
        if (customerEmail && normalise(profile.email) === normalise(customerEmail)) return true;
        if (customerName && normalise(profile.name) === normalise(customerName)) return true;
        return false;
      })
    );
    if (customerThread && !isMobileView) openThread(customerThread.id, customerThread);
    setMessageDraft(`/job ${jobNumber} `);
    router.replace("/messages", undefined, { shallow: true });
  }, [isMobileView, router, threads, loadingThreads, openThread]);

  // Collaboration deep-link from the top-bar Team workspace:
  //   /messages?to=<userId>                           → open/start a 1:1 DM
  //   /messages?compose=group&members=<id,id>&title=  → create/open a group chat
  useEffect(() => {
    if (collabDeepLinkRef.current) return;
    if (!router.isReady || !dbUserId) return;
    const { to, compose, members, title } = router.query;
    if (!to && compose !== "group") return;
    collabDeepLinkRef.current = true;
    (async () => {
      try {
        if (to) {
          await startDirectThread(String(to));
        } else if (compose === "group" && members) {
          const memberIds = String(members).split(",").map((id) => id.trim()).filter(Boolean);
          if (memberIds.length) {
            const payload = await createThreadApi({
              type: "group",
              createdBy: dbUserId,
              title: title ? String(title) : "",
              memberIds,
            });
            const thread = payload?.data || payload?.thread;
            if (thread) {
              mergeThread(thread);
              await fetchThreads();
              await openThread(thread.id, thread);
            }
          }
        }
      } catch (error) {
        logFailure("❌ Collaboration deep-link failed:", error);
      } finally {
        router.replace("/messages", undefined, { shallow: true });
      }
    })();
  }, [router, dbUserId, startDirectThread, createThreadApi, mergeThread, fetchThreads, openThread]);

  useEffect(() => {
    if (!dbUserId) return undefined;
    const trimmed = directorySearch.trim();
    if (!trimmed) return undefined;
    const handle = setTimeout(() => fetchDirectory(trimmed), 350);
    return () => clearTimeout(handle);
  }, [dbUserId, directorySearch, fetchDirectory]);

  useEffect(() => {
    if (!dbUserId || !newChatModalOpen || directorySearch.trim()) return undefined;
    let cancelled = false;
    setDirectoryLoading(true);
    (async () => {
      try {
        const payload = await listDirectoryUsers({ limit: 100, exclude: dbUserId });
        if (!cancelled) setDirectory(sortDirectoryEntries(payload?.data || payload?.users || []));
      } catch (error) {
        if (!cancelled) {
          logFailure("❌ Failed to load default directory:", error);
          setDirectory([]);
        }
      } finally {
        if (!cancelled) setDirectoryLoading(false);
      }
    })();
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
        const notesResult = await supabase
          .from("notifications")
          .select("notification_id, message, created_at, target_role")
          .or("target_role.ilike.%customer%,target_role.is.null")
          .order("created_at", { ascending: false })
          .limit(5);
        if (notesResult.error) throw notesResult.error;
        if (!cancelled) setSystemNotifications((notesResult.data || []).map((row) => ({ ...row, kind: "notification" })));
      } catch (fetchError) {
        if (!cancelled) {
          setSystemError(fetchError?.message || "Unable to load system notifications.");
          setSystemNotifications([]);
        }
      } finally {
        if (!cancelled) setSystemLoading(false);
      }
    };
    loadSystemNotifications();
    const channel = supabase
      .channel("admin-system-notifications")
      .on("postgres_changes", { schema: "public", table: "notifications", event: "INSERT" }, (payload) => {
        const entry = payload?.new;
        if (!entry) return;
        const targetRole = (entry.target_role || "").toLowerCase();
        if (targetRole && !targetRole.includes("customer")) return;
        setSystemNotifications((prev) => [{ ...entry, kind: "notification" }, ...prev].slice(0, 5));
      })
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadBookingNotifications = async () => {
      setBookingsLoading(true);
      setBookingsError("");
      try {
        const requestsResult = canSeeCustomerRequests
          ? await fetch("/api/messages/customer-requests", { credentials: "same-origin" })
              .then((res) => (res.ok ? res.json() : { items: [] }))
              .catch(() => ({ items: [] }))
          : { items: [] };
        const requestNotes = (requestsResult?.items || []).map((req) => ({
          notification_id: `event-${req.event_id}`,
          kind: "customer_request",
          event_id: req.event_id,
          activity_type: req.activity_type,
          type_label: req.type_label,
          customer_name: req.customer_name,
          vehicle_label: req.vehicle_label,
          vehicle_reg: req.vehicle_reg,
          description: req.description,
          preferred_date: req.preferred_date,
          message: `${req.type_label} ${req.customer_name}${req.vehicle_label ? ` · ${req.vehicle_label}` : ""}`,
          created_at: req.occurred_at,
          target_role: "customer",
        }));
        if (!cancelled) setBookingNotifications(requestNotes);
      } catch (fetchError) {
        if (!cancelled) {
          setBookingsError(fetchError?.message || "Unable to load bookings.");
          setBookingNotifications([]);
        }
      } finally {
        if (!cancelled) setBookingsLoading(false);
      }
    };
    loadBookingNotifications();
    const channel = supabase
      .channel("admin-booking-requests")
      .on("postgres_changes", { schema: "public", table: "customer_activity_events", event: "INSERT" }, (payload) => {
        if (payload?.new?.activity_type !== "booking_request") return;
        loadBookingNotifications();
      })
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [canSeeCustomerRequests]);

  // Realtime: any change to a thread I am in refreshes the list, and the open
  // transcript refreshes in place.
  const threadIdKey = useMemo(() => threads.map((thread) => thread.id).filter(Boolean).join(","), [threads]);
  const activeThreadRef = useRef(null);
  activeThreadRef.current = activeThread;
  const openThreadRef = useRef(openThread);
  openThreadRef.current = openThread;

  useEffect(() => {
    if (!dbUserId || typeof window === "undefined") return undefined;
    const channel = supabase.channel(`messages-refresh-${dbUserId}`);
    if (threadIdKey) {
      const refreshFromMessageChange = (payload) => {
        const row = payload?.new;
        if (!row) return;
        fetchThreads();
        const current = activeThreadRef.current;
        if (current && current.id === row.thread_id && row.sender_id !== dbUserId) {
          openThreadRef.current(current.id, current, { silent: true });
        }
      };
      ["INSERT", "UPDATE"].forEach((event) => {
        channel.on(
          "postgres_changes",
          { schema: "public", table: "messages", event, filter: `thread_id=in.(${threadIdKey})` },
          refreshFromMessageChange
        );
      });
    }
    channel.on(
      "postgres_changes",
      { schema: "public", table: "message_thread_members", event: "UPDATE", filter: `user_id=eq.${dbUserId}` },
      () => fetchThreads()
    );
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [dbUserId, fetchThreads, threadIdKey]);

  // Desktop opens the most recent conversation when nothing is selected.
  useEffect(() => {
    if (!visibleThreads.length) {
      if (activeThreadId && !threads.some((thread) => thread.id === activeThreadId)) {
        setActiveThreadId(null);
        setMessages([]);
      }
      return;
    }
    if (isMobileView || isSystemThreadActive) return;
    if (!activeThreadId) openThread(visibleThreads[0].id, visibleThreads[0]);
  }, [visibleThreads, activeThreadId, isSystemThreadActive, isMobileView, openThread, threads]);

  // Stick to the bottom when a conversation opens or a message arrives — but
  // not when a message is edited, pinned or reacted to in place.
  useEffect(() => {
    const key = `${activeThreadId}:${messages.length}:${messages[messages.length - 1]?.id || ""}`;
    if (key === lastScrollKeyRef.current) return;
    lastScrollKeyRef.current = key;
    const frame = window.requestAnimationFrame(() => {
      if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeThreadId, messages, mobilePanelView]);

  useEffect(() => {
    const previousKey = activeUnreadMarkerKeyRef.current;
    if (previousKey && previousKey !== currentUnreadMarkerKey) dismissUnreadMarker(previousKey);
    activeUnreadMarkerKeyRef.current = currentUnreadMarkerKey;
  }, [currentUnreadMarkerKey, dismissUnreadMarker]);

  const observeMarker = useCallback(
    (show, key, element) => {
      if (!show || !key || !element || dismissedUnreadMarkers[key]) return undefined;
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries[0]?.isIntersecting) return;
          if (unreadMarkerTimersRef.current.has(key)) return;
          const timeoutId = window.setTimeout(() => dismissUnreadMarker(key), 30000);
          unreadMarkerTimersRef.current.set(key, timeoutId);
        },
        { threshold: 0.25 }
      );
      observer.observe(element);
      return () => observer.disconnect();
    },
    [dismissUnreadMarker, dismissedUnreadMarkers]
  );

  useEffect(
    () => observeMarker(showThreadUnreadMarker, activeThreadUnreadMarkerKey, threadUnreadMarkerEl),
    [observeMarker, showThreadUnreadMarker, activeThreadUnreadMarkerKey, threadUnreadMarkerEl]
  );
  useEffect(
    () => observeMarker(showSystemUnreadMarker, systemUnreadMarkerKey, systemUnreadMarkerEl),
    [observeMarker, showSystemUnreadMarker, systemUnreadMarkerKey, systemUnreadMarkerEl]
  );

  useEffect(
    () => () => {
      const activeKey = activeUnreadMarkerKeyRef.current;
      if (activeKey) dismissUnreadMarker(activeKey);
      unreadMarkerTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      unreadMarkerTimersRef.current.clear();
    },
    [dismissUnreadMarker]
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      const activeKey = activeUnreadMarkerKeyRef.current;
      if (activeKey) dismissUnreadMarker(activeKey);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [dismissUnreadMarker]);

  useEffect(() => {
    setGroupSearchTerm("");
    setGroupSearchResults([]);
    setGroupManageError("");
    setSettingsError("");
  }, [activeThreadId]);

  useEffect(() => {
    if (!threadSelectionMode) {
      setSelectedThreadIds([]);
      return;
    }
    setSelectedThreadIds((prev) => prev.filter((threadId) => threads.some((thread) => thread.id === threadId)));
  }, [threadSelectionMode, threads]);

  useEffect(() => {
    const term = groupSearchTerm.trim();
    if (!canManageMembers || !activeThread || term.length < 2) {
      setGroupSearchResults([]);
      setGroupSearchLoading(false);
      return undefined;
    }
    let cancelled = false;
    setGroupSearchLoading(true);
    const excludeIds = [...new Set([...(activeThread.members || []).map((member) => member.userId), dbUserId])].join(",");
    (async () => {
      try {
        const payload = await listDirectoryUsers({ q: term, exclude: excludeIds });
        if (!cancelled) setGroupSearchResults(payload?.data || payload?.users || []);
      } catch (error) {
        if (!cancelled) {
          logFailure("❌ Group search failed:", error);
          setGroupSearchResults([]);
        }
      } finally {
        if (!cancelled) setGroupSearchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeThread, canManageMembers, dbUserId, groupSearchTerm, listDirectoryUsers]);

  // ---------------------------------------------------------------------------
  // View model
  // ---------------------------------------------------------------------------
  if (!user) {
    return <MessagesPageUi view="section1" />;
  }

  const mode = activeSystemView ? "system" : activeBookingsView ? "bookings" : activeThread ? "thread" : "empty";

  const otherMembers = (activeThread?.members || []).filter((member) => member.userId !== dbUserId);
  const directPartner = activeThread?.type === "direct" ? otherMembers[0] || null : null;
  const customerMembers = otherMembers.filter(memberIsCustomer);
  const isAnnouncement = activeThread?.conversationType === "announcement";
  const readOnlyNotice =
    isAnnouncement && !isGroupLeader
      ? "Announcement channel: only channel leaders can post here. You can still react to posts."
      : "";

  const headerPresence = (() => {
    if (!activeThread) return null;
    if (directPartner) return presenceFor(directPartner);
    const active = otherMembers.filter((member) => presenceFor(member)?.tone === "active").length;
    return {
      tone: active ? "active" : null,
      text: `${activeThread.members.length} member${activeThread.members.length === 1 ? "" : "s"}${active ? ` · ${active} active now` : ""}`,
    };
  })();

  const headerSubtitle = activeThread
    ? [
        activeThread.jobNumber && activeThread.conversationType !== "job" ? `Job ${activeThread.jobNumber}` : null,
        activeThread.department && activeThread.conversationType === "department" ? null : activeThread.department,
        activeThread.assigneeName ? `Owner: ${activeThread.assigneeName}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const activeIsPinned = Boolean(activeThread && pinnedThreadIds.includes(activeThread.id));
  const headerMenuItems = activeThread
    ? [
        {
          label: searchOpen ? "Close search" : "Search this conversation",
          onClick: () => {
            setSearchOpen((prev) => !prev);
            setSearchTerm("");
          },
        },
        {
          label: activeIsPinned
            ? "Unpin conversation"
            : pinnedThreadIds.length >= MAX_PINNED_THREADS
              ? "Pin conversation (3 pinned already)"
              : "Pin conversation",
          disabled: !activeIsPinned && pinnedThreadIds.length >= MAX_PINNED_THREADS,
          onClick: () => handleTogglePinnedThread(activeThread.id),
        },
        { label: "Slash command help", onClick: () => setCommandHelpOpen(true) },
        ...(canEditGroup
          ? [
              {
                label: "Rename conversation",
                onClick: () => {
                  setGroupEditTitle(activeThread.title || "");
                  setGroupEditError("");
                  setGroupEditModalOpen(true);
                },
              },
            ]
          : []),
        ...(activeThread.hubReady
          ? [
              {
                label: activeThread.notificationLevel === "none" ? "Unmute conversation" : "Mute conversation",
                onClick: () =>
                  handleUpdateSettings({ notificationLevel: activeThread.notificationLevel === "none" ? "all" : "none" }),
              },
            ]
          : []),
        {
          label: "Notification settings",
          onClick: () => {
            setDetailsTab("details");
            toggleDetails(true);
          },
        },
        {
          label: "Remove conversation",
          danger: true,
          onClick: () => {
            if (window.confirm(`Remove "${activeThread.title}"? This deletes it for everyone in it.`)) {
              deleteThreads([activeThread.id]);
            }
          },
        },
      ]
    : [];


  const lastMineIndex = (() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].senderId === dbUserId && !messages[index].metadata?.event) return index;
    }
    return -1;
  })();
  const lastMine = lastMineIndex >= 0 ? messages[lastMineIndex] : null;
  const receiptFor = (message) => {
    if (!lastMine || message.id !== lastMine.id || !otherMembers.length) return null;
    const sentAt = new Date(message.createdAt).getTime();
    const readers = otherMembers.filter(
      (member) => member.lastReadAt && new Date(member.lastReadAt).getTime() >= sentAt
    );
    if (directPartner) {
      return readers.length ? `Seen ${formatListTimestamp(readers[0].lastReadAt)}` : "Sent";
    }
    if (!readers.length) return "Sent";
    return readers.length === otherMembers.length
      ? "Seen by everyone"
      : `Seen by ${readers.length} of ${otherMembers.length}`;
  };

  const canSend = Boolean(
    (messageDraft.trim() || pendingAttachments.length) && activeThread && !loadingMessages && !sending && !uploading
  );

  const mentionMembers = otherMembers.filter((member) => !memberIsCustomer(member));

  return (
    <MessagesPageUi
      view="section2"
      isMobileView={isMobileView}
      mobilePanelView={mobilePanelView}
      onMobileBack={() => handleMobileBack(false)}
      mode={mode}
      listProps={{
        threads: listThreadsShown,
        pinnedThreads,
        activeThreadId,
        activeSystemView,
        activeBookingsView,
        canSeeBookings: canSeeCustomerRequests,
        systemUnread: hasSystemUnread,
        bookingsUnread: hasBookingsUnread,
        systemPreview: String(latestSystem?.message || "").replace(/^[\s\p{Extended_Pictographic}️]+/u, "").trim(),
        bookingsPreview: latestBooking?.message || "",
        loading: loadingThreads,
        dbUserId,
        searchTerm: threadSearchTerm,
        onSearchChange: setThreadSearchTerm,
        filter: messageFilter,
        onFilterChange: setMessageFilter,
        typeFilter,
        onTypeFilterChange: setTypeFilter,
        onOpenThread: openThread,
        onOpenSystem: openSystemNotificationsThread,
        onOpenBookings: openBookingsThread,
        onTogglePin: handleTogglePinnedThread,
        onNewConversation: handleOpenNewChatModal,
        selectionMode: threadSelectionMode,
        selectedIds: selectedThreadIds,
        onToggleSelect: (threadId) =>
          setSelectedThreadIds((prev) =>
            prev.includes(threadId) ? prev.filter((id) => id !== threadId) : [...prev, threadId]
          ),
        onStartSelection: () => {
          setThreadSelectionMode(true);
          setSelectedThreadIds([]);
        },
        onCloseSelection: () => {
          setThreadSelectionMode(false);
          setSelectedThreadIds([]);
          setThreadDeleteError("");
        },
        onDeleteSelected: () => {
          if (window.confirm(`Remove ${selectedThreadIds.length} conversation(s) for everyone in them?`)) {
            deleteThreads(selectedThreadIds);
          }
        },
        deleteBusy: threadDeleteBusy,
        deleteError: threadDeleteError,
        onWebsiteHelpJoined: async (threadId) => {
          await fetchThreads();
          await openThread(threadId);
        },
        totalUnread: threads.filter((thread) => thread.hasUnread).length,
      }}
      systemFeed={{
        isBookings: activeBookingsView,
        loading: activeBookingsView ? bookingsLoading : systemLoading,
        error: activeBookingsView ? bookingsError : systemError,
        notes: activePseudoNotifications,
        timestampLabel: activePseudoTimestamp ? formatNotificationTimestamp(activePseudoTimestamp) : "no updates yet",
        showUnread: showSystemUnreadMarker,
        unreadIndex: systemUnreadMarkerIndex,
        setUnreadEl: setSystemUnreadMarkerEl,
        formatTimestamp: formatNotificationTimestamp,
        onCreateJob: handleCreateJobFromRequest,
      }}
      headerProps={{
        thread: activeThread,
        title: directPartner?.profile?.name || activeThread?.title || "",
        subtitle: headerSubtitle,
        presence: headerPresence,
        isMobile: isMobileView,
        onBack: () => handleMobileBack(false),
        detailsOpen,
        onToggleDetails: () => toggleDetails(),
        menuItems: headerMenuItems,
      }}
      search={{
        open: searchOpen,
        term: searchTerm,
        onChange: setSearchTerm,
        matchCount: searchMatches.length,
        matchIndex: searchIndex,
        onPrev: () => setSearchIndex((index) => (index - 1 + searchMatches.length) % searchMatches.length),
        onNext: () => setSearchIndex((index) => (index + 1) % searchMatches.length),
        onClose: () => {
          setSearchOpen(false);
          setSearchTerm("");
        },
      }}
      feed={{
        threadId: activeThreadId,
        messages,
        loading: loadingMessages,
        scrollerRef,
        dbUserId,
        roles: userRoles,
        reactions: messageReactions,
        onReact: handleReactToMessage,
        onReply: (message) => handleMessageAction(message, "reply-start"),
        onAction: handleMessageAction,
        onJumpTo: jumpToMessage,
        actionBusyId,
        receiptFor,
        highlightId: currentSearchId || jumpHighlightId,
        readOnly: false,
        memberFor: (userId) => (activeThread?.members || []).find((member) => member.userId === userId) || null,
        showUnread: showThreadUnreadMarker,
        unreadIndex: activeThreadUnreadMarkerIndex,
        setUnreadEl: setThreadUnreadMarkerEl,
        registerRef: registerMessageNode,
        leave: {
          busy: leaveDecisionBusy,
          onApprove: (message) => submitLeaveDecision(message, "approve"),
          onDecline: (message) => {
            setLeaveDecisionError("");
            setLeaveDeclineReason("");
            setLeaveDeclineModal({ open: true, message });
          },
        },
      }}
      composerProps={{
        draft: messageDraft,
        onDraftChange: setMessageDraft,
        onSubmit: handleSendMessage,
        sending,
        canSend,
        replyTo,
        onCancelReply: () => setReplyTo(null),
        editing: editingMessage,
        onCancelEdit: () => {
          setEditingMessage(null);
          setMessageDraft("");
        },
        pendingAttachments,
        uploading,
        onAddFiles: handleAddFiles,
        onRemoveAttachment: (attachment) =>
          setPendingAttachments((prev) => prev.filter((entry) => entry.id !== attachment.id)),
        externalAudience: customerMembers.length
          ? customerMembers.map((member) => member.profile?.name || "The customer").join(", ")
          : null,
        commands: availableCommands,
        members: mentionMembers,
        warning: composeWarning,
        onOpenHelp: () => setCommandHelpOpen(true),
        placeholder: customerMembers.length
          ? "Write to the customer…"
          : isAnnouncement
            ? "Post an announcement…"
            : "Write a message…",
        inputRef: composerInputRef,
      }}
      readOnlyNotice={readOnlyNotice}
      conversationError={conversationError}
      details={{
        open: detailsOpen,
        props: {
          thread: activeThread,
          tab: detailsTab,
          onTabChange: setDetailsTab,
          onClose: () => toggleDetails(false),
          messages,
          dbUserId,
          presenceFor,
          customerDetail,
          onUpdateSettings: handleUpdateSettings,
          settingsBusy,
          settingsError,
          canManageMembers,
          groupLeaderCount,
          groupSearchTerm,
          onGroupSearchChange: setGroupSearchTerm,
          groupSearchResults,
          groupSearchLoading,
          onAddMember: handleAddMemberToGroup,
          onRemoveMember: handleRemoveMemberFromGroup,
          groupManageBusy,
          groupManageError,
          onJumpToMessage: jumpToMessage,
          onMessageAction: handleMessageAction,
          actionBusy: Boolean(actionBusyId),
        },
      }}
      newConversation={{
        open: newChatModalOpen,
        mode: composeMode,
        onModeChange: (nextMode) => {
          setComposeMode(nextMode);
          setComposeError("");
          if (nextMode === "direct") setSelectedRecipients((prev) => (prev.length ? [prev[0]] : []));
        },
        directory,
        directoryLoading,
        directorySearch,
        onDirectorySearch: setDirectorySearch,
        isSelected: (entry) => selectedRecipients.some((picked) => picked.id === entry.id),
        onToggle: handleDirectoryUser,
        selected: selectedRecipients,
        onRemoveSelected: (entry) => setSelectedRecipients((prev) => prev.filter((picked) => picked.id !== entry.id)),
        name: groupName,
        onNameChange: setGroupName,
        department: newDepartment,
        onDepartmentChange: setNewDepartment,
        includeDepartment,
        onIncludeDepartmentChange: setIncludeDepartment,
        jobNumber: newJobNumber,
        onJobNumberChange: setNewJobNumber,
        error: composeError,
        busy: creatingThread,
        canStart: canInitiateChat && !creatingThread,
        onStart: handleStartChat,
        onClose: closeNewChatModal,
      }}
      help={{
        open: commandHelpOpen,
        commands: availableCommands,
        onInsert: handleInsertCommandFromHelp,
        onClose: () => setCommandHelpOpen(false),
      }}
      rename={{
        open: groupEditModalOpen && isGroupChat,
        title: groupEditTitle,
        onTitleChange: setGroupEditTitle,
        busy: groupEditBusy,
        error: groupEditError,
        onSave: handleSaveGroupDetails,
        onClose: () => {
          setGroupEditModalOpen(false);
          setGroupEditError("");
        },
      }}
      leaveDecline={{
        open: leaveDeclineModal.open,
        reason: leaveDeclineReason,
        onReasonChange: (value) => {
          setLeaveDeclineReason(value);
          setLeaveDecisionError("");
        },
        busy: leaveDecisionBusy,
        error: leaveDecisionError,
        onConfirm: handleConfirmDeclineLeaveRequest,
        onClose: () => {
          if (leaveDecisionBusy) return;
          setLeaveDeclineModal({ open: false, message: null });
          setLeaveDeclineReason("");
          setLeaveDecisionError("");
        },
      }}
    />
  );
}

export default MessagesPage;
