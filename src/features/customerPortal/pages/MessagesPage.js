// file location: src/features/customerPortal/pages/MessagesPage.js

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import CustomerLayout from "@/features/customerPortal/components/CustomerLayout";
import AppointmentTimeline from "@/features/customerPortal/components/AppointmentTimeline";
import { useCustomerPortalData } from "@/features/customerPortal/hooks/useCustomerPortalData";
import { useUser } from "@/context/UserContext";
import { useConfirmation } from "@/context/ConfirmationContext";
import { supabase } from "@/lib/database/supabaseClient";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { InlineLoading, SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";

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

// Strip leading icon glyphs / emoji (ℹ️, ⚠️, ✅, etc.) from system-notification
// messages so the customer-facing list reads as clean status text.
const stripLeadingNotificationIcon = (message = "") => {
  if (!message) return "";
  return String(message)
    .replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\s]+/u, "")
    .trim();
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
const parseSlashCommandMetadata = async (text = "", customer, vehicles = []) => {
  if (!text) return null;
  const metadata = {};
  const tokens = text.match(/\/[^\s]+/g) || [];

  // First pass: collect all commands
  let hasJobNumber = false;
  let hasVehicleCommand = false;
  let hasCustomerCommand = false;

  for (const raw of tokens) {
    const token = raw.replace("/", "").trim();
    if (!token) continue;

    // /job[number] or /[number]
    const jobMatch = token.match(/^(?:job)?(\d+)$/i);
    if (jobMatch && !metadata.jobNumber) {
      metadata.jobNumber = jobMatch[1];
      hasJobNumber = true;
      continue;
    }

    // /cust[name] - extract customer name
    const custMatch = token.match(/^cust(.+)$/i);
    if (custMatch && !metadata.customerName) {
      metadata.customerName = custMatch[1];
      continue;
    }

    // /customer - reference to customer
    if (token.toLowerCase() === "customer") {
      hasCustomerCommand = true;
      if (customer?.id) {
        metadata.customerId = customer.id;
      }
    }

    // /vehicle - reference to vehicle
    if (token.toLowerCase() === "vehicle") {
      hasVehicleCommand = true;
      if (vehicles?.[0]?.id) {
        metadata.vehicleId = vehicles[0].id;
      }
    }
  }

  // Second pass: if job number is present and vehicle/customer commands are used,
  // fetch the job data to link vehicle and customer
  if (hasJobNumber && (hasVehicleCommand || hasCustomerCommand)) {
    try {
      const response = await fetch(`/api/jobcards/${metadata.jobNumber}`);
      if (response.ok) {
        const jobData = await response.json();

        // Link vehicle if /vehicle command was used and not already set
        if (hasVehicleCommand && !metadata.vehicleId && jobData.vehicleId) {
          metadata.vehicleId = jobData.vehicleId;
        }

        // Link customer if /customer command was used and not already set from context
        if (hasCustomerCommand && !metadata.customerId && jobData.customerId) {
          metadata.customerId = jobData.customerId;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch job data for metadata:', error);
      // Continue without the job data
    }
  }

  return Object.keys(metadata).length ? metadata : null;
};

// Helper function to render message content with clickable slash commands
const renderMessageContentWithLinks = (content) => {
  if (!content) return null;

  const parts = [];
  let lastIndex = 0;
  const regex = /\/(job)?(\d+)|\/cust([a-zA-Z]+)|\/customer|\/vehicle/gi;

  let match;
  while ((match = regex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    const fullMatch = match[0];
    const isJob = match[1] !== undefined || /^\/\d+/.test(fullMatch);
    const jobNumber = match[2];
    const custName = match[3];

    if (isJob && jobNumber) {
      // /job[number] or /[number] - link to VHC details page for customers
      parts.push(
        <a
          key={match.index}
          href={`/job-cards/${jobNumber}?tab=vhc`}
          style={{
            color: "var(--text-accent)",
            textDecoration: "underline",
            fontWeight: 600,
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {fullMatch}
        </a>
      );
    } else if (custName) {
      // /cust[name]
      parts.push(
        <span
          key={match.index}
          style={{
            fontWeight: 600,
            textDecoration: "underline",
            color: "var(--text-accent)",
          }}
          title={`Customer: ${custName}`}
        >
          {fullMatch}
        </span>
      );
    } else {
      // /customer or /vehicle
      parts.push(
        <span
          key={match.index}
          style={{
            fontWeight: 600,
          }}
        >
          {fullMatch}
        </span>
      );
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return parts.length > 0 ? parts : content;
};

// Available slash commands for customers
const SLASH_COMMANDS = [
  {
    command: "/job[number]",
    description: "Link to a job (e.g., /job12345)",
    autocomplete: "/job",
    pattern: "job",
    hasInput: true
  },
  {
    command: "/[number]",
    description: "Quick link to a job (e.g., /12345)",
    autocomplete: "/",
    pattern: "",
    hasInput: true
  },
  {
    command: "/customer",
    description: "Reference yourself (auto-links if /job used)",
    autocomplete: "/customer",
    pattern: "customer",
    hasInput: false
  },
  {
    command: "/vehicle",
    description: "Reference your vehicle (auto-links if /job used)",
    autocomplete: "/vehicle",
    pattern: "vehicle",
    hasInput: false
  }
];

export default function CustomerMessagesPage() {
  const { timeline, customer, vehicles, isLoading, error } = useCustomerPortalData();
  const { dbUserId } = useUser();
  const { confirm } = useConfirmation();

  // Mobile view state (iPhone Messages-style navigation)
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState("threads"); // "threads" | "chat"

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 480px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

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
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [commandSuggestions, setCommandSuggestions] = useState([]);

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

  // Unread divider state
  const [unreadAfterTimestamp, setUnreadAfterTimestamp] = useState(null);
  const [showUnreadDivider, setShowUnreadDivider] = useState(false);
  const unreadDividerRef = useRef(null);
  const unreadTimerRef = useRef(null);

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
    async (thread, skipRefresh = false) => {
      if (!dbUserId || !thread?.id) return;
      setIsSystemThreadActive(false);
      setActiveThread(thread);
      if (isMobile) setMobileView("chat");
      setMessagesLoading(true);
      setMessagesError("");
      // Capture lastReadAt BEFORE marking read so we know where the divider goes
      if (thread.hasUnread && thread.lastReadAt) {
        setUnreadAfterTimestamp(thread.lastReadAt);
        setShowUnreadDivider(true);
      } else if (thread.hasUnread && !thread.lastReadAt) {
        // Never read before — all messages are unread, use epoch
        setUnreadAfterTimestamp("1970-01-01T00:00:00.000Z");
        setShowUnreadDivider(true);
      } else {
        setUnreadAfterTimestamp(null);
        setShowUnreadDivider(false);
      }
      // Clear any existing hide timer
      if (unreadTimerRef.current) {
        clearTimeout(unreadTimerRef.current);
        unreadTimerRef.current = null;
      }
      try {
        const response = await fetch(
          `/api/messages/threads/${thread.id}/messages${buildQuery({ userId: dbUserId })}`
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || "Unable to load conversation.");
        }
        setThreadMessages(payload.data || []);
        if (!skipRefresh) {
          await fetchThreads();
        }
      } catch (fetchError) {
        console.error("❌ Failed to load conversation:", fetchError);
        setMessagesError(fetchError.message || "Unable to load conversation.");
      } finally {
        setMessagesLoading(false);
      }
    },
    [dbUserId, fetchThreads, isMobile]
  );

  const openSystemNotificationsThread = useCallback(() => {
    setIsSystemThreadActive(true);
    setActiveThread(null);
    if (isMobile) setMobileView("chat");
    setThreadMessages([]);
    setMessagesLoading(false);
    setMessagesError("");
    setLastSystemViewedAt(new Date().toISOString());
    // Hide unread divider when switching away from a chat thread
    setShowUnreadDivider(false);
    setUnreadAfterTimestamp(null);
    if (unreadTimerRef.current) {
      clearTimeout(unreadTimerRef.current);
      unreadTimerRef.current = null;
    }
  }, [isMobile]);

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

  // Handle message draft change with command suggestions
  const handleMessageDraftChange = useCallback((event) => {
    const value = event.target.value;
    setMessageDraft(value);

    // Detect slash command at cursor position
    const cursorPos = event.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/');

    if (lastSlashIndex !== -1) {
      const textAfterSlash = textBeforeCursor.substring(lastSlashIndex + 1);
      // Only show suggestions if there's no space after the slash
      if (!textAfterSlash.includes(' ')) {
        const searchTerm = textAfterSlash.toLowerCase();
        const filtered = SLASH_COMMANDS.filter(cmd =>
          cmd.pattern.toLowerCase().startsWith(searchTerm) ||
          cmd.command.toLowerCase().includes(searchTerm) ||
          (searchTerm === '' && cmd.pattern === '') // Show /[number] when typing just /
        );
        setCommandSuggestions(filtered);
        setShowCommandSuggestions(filtered.length > 0);
      } else {
        setShowCommandSuggestions(false);
      }
    } else {
      setShowCommandSuggestions(false);
    }
  }, []);

  // Handle selecting a command from suggestions
  const handleSelectCommand = useCallback((command) => {
    const cursorPos = document.activeElement?.selectionStart || messageDraft.length;
    const textBeforeCursor = messageDraft.substring(0, cursorPos);
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/');

    if (lastSlashIndex !== -1) {
      const textAfter = messageDraft.substring(cursorPos);
      const newText = messageDraft.substring(0, lastSlashIndex) + command.autocomplete + textAfter;
      setMessageDraft(newText);

      // Set cursor position after the autocompleted text
      setTimeout(() => {
        const textarea = document.getElementById('message-draft');
        if (textarea) {
          const newCursorPos = lastSlashIndex + command.autocomplete.length;
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
    setShowCommandSuggestions(false);
  }, [messageDraft]);

  // Handle send message
  const handleSendMessage = useCallback(
    async (event) => {
      event?.preventDefault();
      if (!activeThread?.id || !dbUserId || !messageDraft.trim()) return;
      setShowCommandSuggestions(false);
      setSendingMessage(true);
      setMessagesError("");
      try {
        const metadata = await parseSlashCommandMetadata(messageDraft, customer, vehicles);
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
      const confirmed = await confirm(
        "Save this message forever? It will be excluded from auto cleanup."
      );
      if (!confirmed) return;
      setSavingMessageId(message.id);
      setMessagesError("");
      try {
        const response = await fetch(`/api/messages/messages/${message.id}/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saved: true, threadId: activeThread?.id || null }),
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
    [activeThread, fetchThreads, confirm]
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
    openThread(threads[0], true); // Skip refresh since we just fetched threads
  }, [threads, activeThread, openThread]);

  // Effect: Subscribe to real-time updates (CLIENT-SIDE ONLY)
  useEffect(() => {
    if (!dbUserId || typeof window === "undefined") return undefined;

    const refreshFromMessageChange = (payload) => {
      if (!payload?.new) return;
      // Only refresh threads list, don't re-open the thread
      fetchThreads();
      // If message is for active thread and not from current user, just reload messages without refreshing threads again
      if (activeThread?.id === payload.new.thread_id && payload.new.sender_id !== dbUserId) {
        openThread(activeThread, true); // Skip refresh since we just called fetchThreads
      }
    };

    const channel = supabase
      .channel(`customer-messaging-${dbUserId}`)
      .on(
        "postgres_changes",
        { schema: "public", table: "messages", event: "INSERT" },
        refreshFromMessageChange
      )
      .on(
        "postgres_changes",
        { schema: "public", table: "messages", event: "UPDATE" },
        refreshFromMessageChange
      )
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

  // Effect: Auto-hide unread divider after 30s of being visible on screen
  useEffect(() => {
    if (!showUnreadDivider) return;
    const node = unreadDividerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Start 30-second timer when divider scrolls into view
          if (!unreadTimerRef.current) {
            unreadTimerRef.current = setTimeout(() => {
              setShowUnreadDivider(false);
              setUnreadAfterTimestamp(null);
              unreadTimerRef.current = null;
            }, 30000);
          }
        } else {
          // If it scrolls out of view, cancel the timer
          if (unreadTimerRef.current) {
            clearTimeout(unreadTimerRef.current);
            unreadTimerRef.current = null;
          }
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      if (unreadTimerRef.current) {
        clearTimeout(unreadTimerRef.current);
        unreadTimerRef.current = null;
      }
    };
  }, [showUnreadDivider, threadMessages]);

  // Effect: Hide unread divider when user navigates away / tab loses focus
  useEffect(() => {
    if (!showUnreadDivider) return;

    const handleHide = () => {
      if (document.visibilityState === "hidden") {
        setShowUnreadDivider(false);
        setUnreadAfterTimestamp(null);
        if (unreadTimerRef.current) {
          clearTimeout(unreadTimerRef.current);
          unreadTimerRef.current = null;
        }
      }
    };

    document.addEventListener("visibilitychange", handleHide);
    return () => document.removeEventListener("visibilitychange", handleHide);
  }, [showUnreadDivider]);

  const latestSystemNotification = systemNotifications?.[0];
  const latestSystemMessage =
    stripLeadingNotificationIcon(latestSystemNotification?.message) ||
    "No system updates yet.";
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
    <CustomerLayout>
      {error && (
        <div className="mb-4 rounded-2xl bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger-dark)]">
          {error}
        </div>
      )}
      {/* ── Mobile: iPhone Messages-style navigation ── */}
      {isMobile ? (
        <div className="space-y-4">
          {mobileView === "threads" ? (
            /* ── Thread list view (like iOS Messages inbox) ── */
            <section className="rounded-3xl bg-[var(--surface)] p-4">
              <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--primary)] px-4 py-3 text-[var(--text-2)]">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-[var(--text-2)]">Messages</p>
                  <h3 className="text-lg font-semibold text-[var(--text-2)]">Your conversations</h3>
                </div>
              </header>

              <div className="mt-3 space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setComposerOpen(true)}
                    disabled={composerCreating}
                    className="flex-1 rounded-full bg-[var(--theme)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    + New
                  </button>
                  <button
                    type="button"
                    onClick={fetchThreads}
                    disabled={threadsLoading}
                    className="rounded-full bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-accent)] hover:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {threadsLoading ? "…" : "Refresh"}
                  </button>
                </div>
                {conversationFeedback && (
                  <p className="rounded-2xl bg-[var(--success-surface)] px-3 py-2 text-sm text-[var(--success-dark)]">
                    {conversationFeedback}
                  </p>
                )}
                {conversationError && (
                  <p className="rounded-2xl bg-[var(--danger-surface)] px-3 py-2 text-sm text-[var(--danger-dark)]">
                    {conversationError}
                  </p>
                )}

                {/* System notifications thread */}
                <button
                  type="button"
                  onClick={openSystemNotificationsThread}
                  className="w-full text-left rounded-2xl bg-[var(--surface)] px-4 py-3 text-sm transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--text-1)]">System notifications</p>
                    <div className="flex items-center gap-1">
                      {hasSystemUnread && (
                        <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-[0.6rem] font-semibold text-[var(--text-2)]">
                          New
                        </span>
                      )}
                      <span className="rounded-full bg-[var(--danger-surface)] px-2 py-0.5 text-[0.6rem] font-semibold text-[var(--danger-dark)]">
                        Read only
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-1)] line-clamp-1">{systemPreview}</p>
                  <p className="text-[0.6rem] text-[var(--text-1)]">{systemTimestampLabel}</p>
                </button>

                {/* Thread list */}
                {threads.length ? (
                  <div className="space-y-2">
                    {threads.map((thread) => {
                      const preview = thread.lastMessage?.content || "No messages yet.";
                      return (
                        <button
                          key={thread.id}
                          type="button"
                          onClick={() => openThread(thread)}
                          className="w-full text-left rounded-2xl bg-[var(--surface)] px-4 py-3 transition active:bg-[var(--surface)]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-[var(--text-1)] line-clamp-1">
                              {thread.title || "Conversation"}
                            </p>
                            <div className="flex items-center gap-1 shrink-0">
                              {thread.hasUnread && (
                                <span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
                              )}
                              <span className="text-[0.6rem] text-[var(--text-1)]">
                                {thread.lastMessage?.createdAt
                                  ? formatMessageTimestamp(thread.lastMessage.createdAt)
                                  : ""}
                              </span>
                            </div>
                          </div>
                          <p className="mt-0.5 text-xs text-[var(--text-1)] line-clamp-1">
                            {thread.lastMessage?.sender?.name || "Team"}: {preview.length > 60 ? `${preview.slice(0, 60)}…` : preview}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-1)]">
                    No conversations yet. Tap + New to start one.
                  </p>
                )}
              </div>
            </section>
          ) : (
            /* ── Chat view (like iOS Messages conversation) ── */
            <section className="rounded-3xl bg-[var(--surface)] p-4">
              {/* Back button */}
              <button
                type="button"
                onClick={() => { setMobileView("threads"); setActiveThread(null); setIsSystemThreadActive(false); }}
                className="mb-3 flex items-center gap-1 text-sm font-semibold text-[var(--text-accent)]"
              >
                <span style={{ fontSize: "18px", lineHeight: 1 }}>&lsaquo;</span> Messages
              </button>

              {isSystemThreadActive ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-[var(--text-1)]">System notifications</h4>
                    <span className="rounded-full bg-[var(--danger-surface)] px-2 py-0.5 text-[0.6rem] font-semibold text-[var(--danger-dark)]">
                      Read only
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[60dvh] overflow-y-auto">
                    {systemLoading && (
                      <div className="space-y-2">
                        <SkeletonKeyframes />
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="flex flex-col gap-1">
                            <SkeletonBlock width="50%" height="10px" />
                            <SkeletonBlock width="80%" height="12px" />
                          </div>
                        ))}
                      </div>
                    )}
                    {!systemLoading && systemError && (
                      <p className="text-sm text-[var(--danger)]">{systemError}</p>
                    )}
                    {!systemLoading && !systemError && systemNotifications.length === 0 && (
                      <p className="text-sm text-[var(--text-1)]">No system notifications yet.</p>
                    )}
                    {!systemLoading && !systemError && systemNotifications.length > 0 && (
                      <div className="space-y-2">
                        {systemNotifications.map((note) => (
                          <article
                            key={`system-${note.notification_id}`}
                            className="space-y-1 rounded-2xl bg-[var(--surface)] px-3 py-2 text-sm"
                          >
                            <p className="text-sm text-[var(--text-1)]">
                              {stripLeadingNotificationIcon(note.message) || "System update"}
                            </p>
                            <p className="text-[0.6rem] text-[var(--text-1)]">
                              {formatNotificationTimestamp(note.created_at)}
                            </p>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : activeThread ? (
                <div className="flex flex-col" style={{ maxHeight: "calc(100dvh - 200px)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-base font-semibold text-[var(--text-1)] line-clamp-1">{activeThread.title}</h4>
                    <span className="shrink-0 text-[0.6rem] text-[var(--text-1)]">
                      {formatMessageTimestamp(threadMessages[threadMessages.length - 1]?.createdAt)}
                    </span>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto pb-2" style={{ maxHeight: "calc(100dvh - 340px)" }}>
                    {messagesLoading && (
                      <div className="space-y-3">
                        <SkeletonKeyframes />
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div
                            key={i}
                            className={i % 2 === 0 ? "self-start" : "self-end ml-auto"}
                            style={{
                              width: i % 2 === 0 ? "62%" : "52%",
                              background: "var(--surface)",
                              borderRadius: 14,
                              padding: 10,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <SkeletonBlock width="70%" height="10px" />
                            <SkeletonBlock width="100%" height="12px" />
                          </div>
                        ))}
                      </div>
                    )}
                    {!messagesLoading && messagesError && (
                      <p className="text-sm text-[var(--danger)]">{messagesError}</p>
                    )}
                    {!messagesLoading && !messagesError && threadMessages.length === 0 && (
                      <p className="text-sm text-[var(--text-1)]">No messages yet. Start below.</p>
                    )}
                    {!messagesLoading && !messagesError && (
                      <div className="space-y-2">
                        {threadMessages.map((message, index) => {
                          const senderName =
                            message.sender?.name || (message.senderId === dbUserId ? "You" : "Team member");
                          const isMine = message.senderId === dbUserId;
                          const isFirstUnread =
                            showUnreadDivider &&
                            unreadAfterTimestamp &&
                            new Date(message.createdAt) > new Date(unreadAfterTimestamp) &&
                            (index === 0 || new Date(threadMessages[index - 1].createdAt) <= new Date(unreadAfterTimestamp));
                          return (
                            <React.Fragment key={message.id || `${message.senderId}-${message.createdAt}`}>
                              {isFirstUnread && (
                                <div ref={unreadDividerRef} className="flex items-center gap-2 py-1">
                                  <div className="h-px flex-1 bg-[var(--primary)]" />
                                  <span className="shrink-0 text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-[var(--text-accent)]">
                                    New
                                  </span>
                                  <div className="h-px flex-1 bg-[var(--primary)]" />
                                </div>
                              )}
                              <div
                                className={`rounded-2xl px-3 py-2 text-sm ${
                                  isMine
                                    ? "ml-8 bg-[var(--primary)] text-[var(--text-2)]"
                                    : "mr-8 bg-[var(--surface)]"
                                }`}
                              >
                                {!isMine && (
                                  <p className="text-xs font-semibold text-[var(--text-1)] mb-0.5">{senderName}</p>
                                )}
                                <p className={isMine ? "text-[var(--text-2)]" : "text-[var(--text-1)]"}>
                                  {renderMessageContentWithLinks(message.content)}
                                </p>
                                <p className={`text-[0.6rem] mt-0.5 ${isMine ? "text-[var(--text-2)]/70" : "text-[var(--text-1)]"}`}>
                                  {formatMessageTimestamp(message.createdAt)}
                                </p>
                                {message.metadata?.jobNumber && (
                                  <p className={`text-[0.6rem] ${isMine ? "text-[var(--text-2)]/70" : "text-[var(--text-1)]"}`}>
                                    Job #{message.metadata.jobNumber}
                                  </p>
                                )}
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <form onSubmit={handleSendMessage} className="relative mt-2 space-y-2">
                    {showCommandSuggestions && commandSuggestions.length > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: "100%",
                          left: 0,
                          right: 0,
                          marginBottom: "4px",
                          maxHeight: "180px",
                          overflowY: "auto",
                          backgroundColor: "var(--surface)",
                          borderRadius: "var(--radius-md)",
                          boxShadow: "var(--shadow-lg)",
                          zIndex: 1000,
                        }}
                      >
                        {commandSuggestions.map((cmd, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectCommand(cmd)}
                            className="w-full bg-[var(--surface)] px-3 py-2 text-left hover:bg-[var(--surface)]"
                            style={{
                              borderBottom: idx < commandSuggestions.length - 1 ? "var(--separating-line)" : "none",
                            }}
                          >
                            <span className="text-sm font-bold text-[var(--text-accent)]">{cmd.command}</span>
                            <span className="ml-2 text-xs text-[var(--text-1)]">{cmd.description}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <textarea
                        id="message-draft"
                        rows={1}
                        value={messageDraft}
                        onChange={handleMessageDraftChange}
                        placeholder="Message…"
                        className="flex-1 rounded-2xl bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-1)] placeholder:text-[var(--text-1)] focus:border-[var(--primary)] focus:outline-none"
                        style={{ resize: "none", maxHeight: "80px" }}
                      />
                      <button
                        type="submit"
                        disabled={!dbUserId || sendingMessage || !messageDraft.trim()}
                        className="shrink-0 rounded-full bg-[var(--primary)] p-2.5 text-[var(--text-2)] disabled:opacity-40"
                        aria-label="Send"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
                        </svg>
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <p className="text-sm text-[var(--text-1)]">
                  Select a conversation to view messages.
                </p>
              )}
            </section>
          )}
        </div>
      ) : (
      /* ── Desktop: existing 2-column layout ── */
      <div
        style={{
          display: "grid",
          gap: "var(--page-stack-gap)",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          width: "100%",
        }}
      >
        <section
          style={{
            background: "var(--surface)",
            borderRadius: "var(--page-card-radius)",
            padding: "var(--section-card-padding)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          <header
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              background: "var(--primary)",
              color: "var(--text-2)",
              borderRadius: "var(--radius-md)",
              padding: "12px 16px",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.3em",
                  color: "var(--text-2)",
                }}
              >
                Message centre
              </p>
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.15rem",
                  fontWeight: 600,
                  color: "var(--text-2)",
                }}
              >
                Message the right person
              </h3>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 10px",
                borderRadius: "var(--radius-pill)",
                background: "rgba(var(--text-2-rgb), 0.18)",
                color: "var(--text-2)",
                fontSize: "0.7rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.18em",
              }}
            >
              Conversations linked to your job
            </span>
          </header>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <div
              style={{
                background: "var(--theme)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-4)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.3em",
                      color: "var(--text-accent)",
                    }}
                  >
                    Live conversations
                  </p>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: "1.05rem",
                      fontWeight: 600,
                      color: "var(--text-1)",
                    }}
                  >
                    Your messages
                  </h4>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setComposerOpen(true)}
                    disabled={composerCreating}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "var(--radius-pill)",
                      background: "var(--primary)",
                      color: "var(--text-2)",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: composerCreating ? "not-allowed" : "pointer",
                      opacity: composerCreating ? 0.6 : 1,
                    }}
                  >
                    + New conversation
                  </button>
                  <button
                    type="button"
                    onClick={fetchThreads}
                    disabled={threadsLoading}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "var(--radius-pill)",
                      background: "var(--surface)",
                      color: "var(--text-1)",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: threadsLoading ? "not-allowed" : "pointer",
                      opacity: threadsLoading ? 0.6 : 1,
                    }}
                  >
                    {threadsLoading ? "Refreshing…" : "Refresh"}
                  </button>
                </div>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.8rem",
                  color: "var(--text-1)",
                  opacity: 0.85,
                }}
              >
                System alerts stay pinned above your chats so you never miss a stock or VHC update.
              </p>
              {conversationFeedback && (
                <p className="rounded-2xl bg-[var(--success-surface)] px-4 py-3 text-sm text-[var(--success-dark)]">
                  {conversationFeedback}
                </p>
              )}
              {conversationError && (
                <p className="rounded-2xl bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger-dark)]">
                  {conversationError}
                </p>
              )}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={openSystemNotificationsThread}
                  className={`w-full text-left rounded-2xl px-4 py-3 text-sm transition ${
                    isSystemThreadActive
                      ? "bg-[var(--primary-soft,var(--theme))]"
                      : "bg-[var(--surface)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--text-1)]">System notifications</p>
                      <p className="text-xs text-[var(--text-1)]">{systemPreview}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasSystemUnread && (
                        <span className="rounded-full bg-[var(--primary)] px-3 py-1 text-[0.65rem] font-semibold text-[var(--text-2)]">
                          Unread
                        </span>
                      )}
                      <span className="rounded-full bg-[var(--danger-surface)] px-3 py-1 text-[0.65rem] font-semibold text-[var(--danger-dark)]">
                        Read only
                      </span>
                    </div>
                  </div>
                  <p className="text-[0.65rem] text-[var(--text-1)]">Latest {systemTimestampLabel}</p>
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
                          className={`w-full text-left rounded-2xl px-4 py-3 transition ${
                            isActiveThread
                              ? "bg-[var(--primary-soft,var(--theme))]"
                              : "bg-[var(--surface)]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-[var(--text-1)]">
                              {thread.title || "Conversation"}
                            </p>
                            {thread.hasUnread && (
                              <span className="rounded-full bg-[var(--primary)] px-3 py-1 text-xs font-semibold text-[var(--text-2)]">
                                Unread
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--text-1)]">
                            {thread.lastMessage?.sender?.name || "Team"} · {preview.length > 80 ? `${preview.slice(0, 80)}…` : preview}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-1)]">
                    No open conversations yet. Start one with the button above.
                  </p>
                )}
              </div>
            </div>

            {isSystemThreadActive ? (
              <div
                style={{
                  background: "var(--surface)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-4)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                }}
              >
                <header
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    background: "var(--primary)",
                    color: "var(--text-2)",
                    borderRadius: "var(--radius-md)",
                    padding: "12px 16px",
                  }}
                >
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.3em",
                        color: "var(--text-2)",
                      }}
                    >
                      System thread
                    </p>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: "1.05rem",
                        fontWeight: 600,
                        color: "var(--text-2)",
                      }}
                    >
                      System notifications
                    </h4>
                  </div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 10px",
                      borderRadius: "var(--radius-pill)",
                      background: "rgba(var(--text-2-rgb), 0.18)",
                      color: "var(--text-2)",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.18em",
                    }}
                  >
                    Read only
                  </span>
                </header>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-2)",
                    maxHeight: "320px",
                    overflowY: "auto",
                  }}
                >
                  {systemLoading && (
                    <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-1)" }}>
                      Loading notifications…
                    </p>
                  )}
                  {!systemLoading && systemError && (
                    <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--danger-dark)" }}>
                      {systemError}
                    </p>
                  )}
                  {!systemLoading && !systemError && systemNotifications.length === 0 && (
                    <p
                      style={{
                        margin: 0,
                        padding: "var(--space-4)",
                        textAlign: "center",
                        background: "var(--theme)",
                        borderRadius: "var(--radius-md)",
                        fontSize: "0.875rem",
                        color: "var(--text-1)",
                      }}
                    >
                      No system notifications yet.
                    </p>
                  )}
                  {!systemLoading && !systemError && systemNotifications.length > 0 &&
                    systemNotifications.map((note) => (
                      <article
                        key={`system-${note.notification_id}`}
                        style={{
                          background: "var(--theme)",
                          borderRadius: "var(--radius-md)",
                          padding: "12px 14px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.9rem",
                            color: "var(--text-1)",
                            lineHeight: 1.4,
                          }}
                        >
                          {stripLeadingNotificationIcon(note.message) || "System update"}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.7rem",
                            color: "var(--text-1)",
                            opacity: 0.7,
                          }}
                        >
                          {formatNotificationTimestamp(note.created_at)}
                        </p>
                      </article>
                    ))}
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: "0.75rem",
                    color: "var(--text-1)",
                    opacity: 0.75,
                  }}
                >
                  Only the system posts here; this thread cannot be deleted or renamed.
                </p>
              </div>
            ) : activeThread ? (
              <div className="space-y-4 rounded-2xl bg-[var(--surface)] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-[var(--text-accent)]">Active thread</p>
                    <h4 className="text-lg font-semibold text-[var(--text-1)]">{activeThread.title}</h4>
                  </div>
                  <span className="text-xs text-[var(--text-1)]">
                    {formatMessageTimestamp(threadMessages[threadMessages.length - 1]?.createdAt)}
                  </span>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto pb-2">
                  {messagesLoading && (
                    <p className="text-sm text-[var(--text-1)]">Loading conversation…</p>
                  )}
                  {!messagesLoading && messagesError && (
                    <p className="text-sm text-[var(--danger)]">{messagesError}</p>
                  )}
                  {!messagesLoading && !messagesError && threadMessages.length === 0 && (
                    <p className="text-sm text-[var(--text-1)]">No messages yet. Start the conversation below.</p>
                  )}
                  {!messagesLoading && !messagesError && (
                    <div className="space-y-3">
                      {threadMessages.map((message, index) => {
                        const senderName =
                          message.sender?.name || (message.senderId === dbUserId ? "You" : "Team member");
                        const isMine = message.senderId === dbUserId;
                        // Check if the unread divider should appear before this message
                        const isFirstUnread =
                          showUnreadDivider &&
                          unreadAfterTimestamp &&
                          new Date(message.createdAt) > new Date(unreadAfterTimestamp) &&
                          (index === 0 || new Date(threadMessages[index - 1].createdAt) <= new Date(unreadAfterTimestamp));
                        return (
                          <React.Fragment key={message.id || `${message.senderId}-${message.createdAt}`}>
                            {isFirstUnread && (
                              <div
                                ref={unreadDividerRef}
                                className="flex items-center gap-3 py-1"
                              >
                                <div className="h-px flex-1 bg-[var(--primary)]" />
                                <span className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[var(--text-accent)]">
                                  New messages
                                </span>
                                <div className="h-px flex-1 bg-[var(--primary)]" />
                              </div>
                            )}
                          <div
                            className={`space-y-1 rounded-2xl px-4 py-3 text-sm ${
                              isMine ? "bg-[var(--primary-soft,var(--theme))]" : "bg-[var(--surface)]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-[var(--text-1)]">{senderName}</span>
                              <span className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--text-1)]">
                                {formatMessageTimestamp(message.createdAt)}
                              </span>
                            </div>
                            <p className="text-[var(--text-1)]">{renderMessageContentWithLinks(message.content)}</p>
                            {message.metadata?.jobNumber && (
                              <p className="text-[0.65rem] text-[var(--text-1)]">
                                Linked job #{message.metadata.jobNumber}
                              </p>
                            )}
                            {message.metadata?.customerId && (
                              <p className="text-[0.65rem] text-[var(--text-1)]">
                                Linked customer profile
                              </p>
                            )}
                            {message.metadata?.vehicleId && (
                              <p className="text-[0.65rem] text-[var(--text-1)]">
                                Linked vehicle {vehicles?.find((v) => v.id === message.metadata.vehicleId)?.reg || "(vehicle data)"}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              {message.savedForever ? (
                                <span className="rounded-full bg-[var(--theme)] px-3 py-1 text-[0.65rem] font-semibold text-[var(--text-accent)]">
                                  Saved forever
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSaveMessage(message)}
                                  disabled={savingMessageId === message.id}
                                  className="rounded-full bg-[var(--theme)] px-3 py-1 text-[0.65rem] font-semibold text-[var(--text-accent)] hover:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {savingMessageId === message.id ? "Saving…" : "Save forever"}
                                </button>
                              )}
                            </div>
                          </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>
                <form onSubmit={handleSendMessage} className="relative space-y-3">
                  {/* Command suggestions dropdown */}
                  {showCommandSuggestions && commandSuggestions.length > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "100%",
                        left: 0,
                        right: 0,
                        marginBottom: "8px",
                        maxHeight: "240px",
                        overflowY: "auto",
                        backgroundColor: "var(--surface)",
                        border: "none",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "var(--shadow-lg)",
                        zIndex: 1000,
                      }}
                    >
                      {commandSuggestions.map((cmd, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleSelectCommand(cmd)}
                          className="w-full bg-[var(--surface)] px-4 py-3 text-left hover:bg-[var(--theme)]"
                          style={{
                            borderBottom: index < commandSuggestions.length - 1 ? "var(--separating-line)" : "none",
                          }}
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-bold text-[var(--text-accent)]">
                              {cmd.command}
                            </span>
                            <span className="text-xs text-[var(--text-1)]">
                              {cmd.description}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <label htmlFor="message-draft" className="sr-only">
                    Message
                  </label>
                  <textarea
                    id="message-draft"
                    rows={3}
                    value={messageDraft}
                    onChange={handleMessageDraftChange}
                    placeholder="Type your message… (type / for commands)"
                    className="w-full rounded-2xl bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-1)] placeholder:text-[var(--text-1)] focus:border-[var(--primary)] focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!dbUserId || sendingMessage || !messageDraft.trim()}
                      className="rounded-full bg-[var(--primary)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-2)] hover:bg-[var(--primary-selected)] disabled:cursor-not-allowed disabled:bg-[var(--danger)]"
                    >
                      {sendingMessage ? "Sending…" : "Send"}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="rounded-2xl bg-[var(--theme)] p-6 text-sm text-[var(--text-1)]">
                Select a conversation to view messages and replies.
              </div>
            )}
          </div>
        </section>
        <AppointmentTimeline events={timeline} />
      </div>
      )}
      {/* Composer modal (shared between mobile & desktop) */}
      {composerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create a group chat"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            background: "rgba(0, 0, 0, 0.45)",
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) setComposerOpen(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: isMobile ? "100%" : "640px",
              maxHeight: "calc(100dvh - 32px)",
              background: "var(--surface)",
              borderRadius: "var(--page-card-radius)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
            }}
          >
            <header
              style={{
                background: "var(--primary)",
                color: "var(--text-2)",
                padding: "16px 20px",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.3em",
                    color: "var(--text-2)",
                  }}
                >
                  Compose
                </p>
                <h3
                  style={{
                    margin: "4px 0 0",
                    fontSize: isMobile ? "1.1rem" : "1.3rem",
                    fontWeight: 600,
                    color: "var(--text-2)",
                  }}
                >
                  Create a group chat
                </h3>
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: "0.8rem",
                    lineHeight: 1.4,
                    color: "var(--text-2)",
                    opacity: 0.92,
                  }}
                >
                  Search by name, check the people you need, and create a new thread.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                aria-label="Close composer"
                style={{
                  flexShrink: 0,
                  padding: "6px 14px",
                  borderRadius: "var(--radius-pill)",
                  background: "rgba(var(--text-2-rgb), 0.18)",
                  color: "var(--text-2)",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </header>

            <div
              style={{
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label
                  htmlFor="composer-search"
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    color: "var(--text-1)",
                  }}
                >
                  Search users
                </label>
                <SearchBar
                  value={composerSearch}
                  onChange={(event) => setComposerSearch(event.target.value)}
                  onClear={() => setComposerSearch("")}
                  placeholder="Find teammates by name or email"
                />
              </div>

              <div
                style={{
                  background: "var(--theme)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  maxHeight: "300px",
                  overflowY: "auto",
                }}
              >
                {composerLoading && (
                  <InlineLoading width={160} label="Searching your roster" />
                )}
                {!composerLoading && composerError && (
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--danger-dark)" }}>
                    {composerError}
                  </p>
                )}
                {!composerLoading && !composerError && !composerHasSearch && (
                  <p
                    style={{
                      margin: 0,
                      padding: "16px 12px",
                      textAlign: "center",
                      fontSize: "0.875rem",
                      color: "var(--text-1)",
                      opacity: 0.75,
                    }}
                  >
                    Type a name to see matching users.
                  </p>
                )}
                {!composerLoading &&
                  !composerError &&
                  composerHasSearch &&
                  composerResults.length === 0 && (
                    <p
                      style={{
                        margin: 0,
                        padding: "16px 12px",
                        textAlign: "center",
                        fontSize: "0.875rem",
                        color: "var(--text-1)",
                        opacity: 0.75,
                      }}
                    >
                      No users match that search.
                    </p>
                  )}
                {!composerLoading &&
                  !composerError &&
                  composerResults.length > 0 &&
                  composerResults.map((user) => {
                    const isSelected = composerSelection.some(
                      (entry) => entry.id === user.id
                    );
                    return (
                      <label
                        key={user.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          padding: "10px 12px",
                          background: "var(--surface)",
                          borderRadius: "var(--radius-md)",
                          cursor: "pointer",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleComposerUser(user)}
                            style={{
                              width: "16px",
                              height: "16px",
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <p
                              style={{
                                margin: 0,
                                fontSize: "0.9rem",
                                fontWeight: 600,
                                color: "var(--text-1)",
                              }}
                            >
                              {user.name}
                            </p>
                            <p
                              style={{
                                margin: 0,
                                fontSize: "0.65rem",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.18em",
                                color: "var(--text-accent)",
                              }}
                            >
                              {user.role || "Team member"}
                            </p>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-1)",
                            opacity: 0.75,
                            textAlign: "right",
                            wordBreak: "break-word",
                          }}
                        >
                          {user.email}
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>

            <footer
              style={{
                background: "var(--theme)",
                padding: "14px 20px",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <span
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-1)",
                }}
              >
                Selected {composerSelection.length} colleague
                {composerSelection.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={composerCreating || composerSelection.length === 0}
                style={{
                  padding: "10px 20px",
                  borderRadius: "var(--radius-pill)",
                  background:
                    composerCreating || composerSelection.length === 0
                      ? "var(--theme)"
                      : "var(--primary)",
                  color:
                    composerCreating || composerSelection.length === 0
                      ? "var(--text-1)"
                      : "var(--text-2)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor:
                    composerCreating || composerSelection.length === 0
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    composerCreating || composerSelection.length === 0 ? 0.7 : 1,
                }}
              >
                {composerCreating ? "Creating…" : "Create chat"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </CustomerLayout>
  );
}
