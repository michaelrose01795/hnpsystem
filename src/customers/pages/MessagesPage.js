// file location: src/customers/pages/MessagesPage.js

"use client";

import React, { useCallback, useEffect, useState } from "react";
import CustomerLayout from "@/customers/components/CustomerLayout";
import AppointmentTimeline from "@/customers/components/AppointmentTimeline";
import { useCustomerPortalData } from "@/customers/hooks/useCustomerPortalData";
import { useUser } from "@/context/UserContext";
import { useConfirmation } from "@/context/ConfirmationContext";
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
            color: "var(--primary)",
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
            color: "var(--primary)",
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
    [fetchThreads, confirm]
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

    const channel = supabase
      .channel(`customer-messaging-${dbUserId}`)
      .on("postgres_changes", { schema: "public", table: "messages", event: "INSERT" }, (payload) => {
        if (!payload?.new) return;
        // Only refresh threads list, don't re-open the thread
        fetchThreads();
        // If message is for active thread and not from current user, just reload messages without refreshing threads again
        if (activeThread?.id === payload.new.thread_id && payload.new.sender_id !== dbUserId) {
          openThread(activeThread, true); // Skip refresh since we just called fetchThreads
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
    <CustomerLayout>
      {error && (
        <div className="mb-4 rounded-2xl border border-[var(--danger)] bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger-dark)]">
          {error}
        </div>
      )}
      {isLoading ? (
        <div className="mb-4 rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)]">
          Loading messages…
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-[var(--surface-light)] bg-[var(--surface)] p-5">
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--primary)] px-4 py-3 text-white">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white">Message centre</p>
              <h3 className="text-xl font-semibold text-white">Message the right person</h3>
            </div>
            <span className="rounded-full border border-white/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
              Conversations stay linked to your job
            </span>
          </header>

          <div className="mt-4 space-y-6">
            <div className="space-y-3 rounded-2xl border border-[var(--surface-light)] bg-[var(--danger-surface)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-[var(--primary)]">
                    Live conversations
                  </p>
                  <h4 className="text-lg font-semibold text-[var(--text-primary)]">Your messages</h4>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setComposerOpen(true)}
                    disabled={composerCreating}
                    className="rounded-full border border-dashed border-[var(--primary)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    + New conversation
                  </button>
                  <button
                    type="button"
                    onClick={fetchThreads}
                    disabled={threadsLoading}
                    className="rounded-full border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--primary)] hover:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {threadsLoading ? "Refreshing…" : "Refresh"}
                  </button>
                </div>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                System alerts stay pinned above your chats so you never miss a stock or VHC update.
              </p>
              {conversationFeedback && (
                <p className="rounded-2xl border border-[var(--success)] bg-[var(--success-surface)] px-4 py-3 text-sm text-[var(--success-dark)]">
                  {conversationFeedback}
                </p>
              )}
              {conversationError && (
                <p className="rounded-2xl border border-[var(--danger)] bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger-dark)]">
                  {conversationError}
                </p>
              )}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={openSystemNotificationsThread}
                  className={`w-full text-left rounded-2xl border px-4 py-3 text-sm transition ${
                    isSystemThreadActive
                      ? "border-[var(--primary)] bg-[var(--surface-light)]"
                      : "border-[var(--surface-light)] bg-[var(--background)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">System notifications</p>
                      <p className="text-xs text-[var(--text-secondary)]">{systemPreview}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasSystemUnread && (
                        <span className="rounded-full bg-[var(--primary)] px-3 py-1 text-[0.65rem] font-semibold text-white">
                          Unread
                        </span>
                      )}
                      <span className="rounded-full border border-[var(--surface-light)] px-3 py-1 text-[0.65rem] font-semibold text-[var(--danger)]">
                        Read only
                      </span>
                    </div>
                  </div>
                  <p className="text-[0.65rem] text-[var(--text-secondary)]">Latest {systemTimestampLabel}</p>
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
                          className={`w-full text-left rounded-2xl border px-4 py-3 transition ${
                            isActiveThread
                              ? "border-[var(--primary)] bg-[var(--surface-light)]"
                              : "border-[var(--surface-light)] bg-[var(--background)]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-[var(--text-primary)]">
                              {thread.title || "Conversation"}
                            </p>
                            {thread.hasUnread && (
                              <span className="rounded-full bg-[var(--primary)] px-3 py-1 text-xs font-semibold text-white">
                                Unread
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {thread.lastMessage?.sender?.name || "Team"} · {preview.length > 80 ? `${preview.slice(0, 80)}…` : preview}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">
                    No open conversations yet. Start one with the button above.
                  </p>
                )}
              </div>
            </div>

            {isSystemThreadActive ? (
              <div className="space-y-4 rounded-2xl border border-[var(--surface-light)] bg-[var(--background)] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-[var(--primary)]">System thread</p>
                    <h4 className="text-lg font-semibold text-[var(--text-primary)]">System notifications</h4>
                  </div>
                  <span className="rounded-full bg-[var(--danger-surface)] px-3 py-1 text-xs font-semibold text-[var(--danger)]">
                    Read only
                  </span>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {systemLoading && (
                    <p className="text-sm text-[var(--text-secondary)]">Loading notifications…</p>
                  )}
                  {!systemLoading && systemError && (
                    <p className="text-sm text-[var(--danger)]">{systemError}</p>
                  )}
                  {!systemLoading && !systemError && systemNotifications.length === 0 && (
                    <p className="text-sm text-[var(--text-secondary)]">No system notifications yet.</p>
                  )}
                  {!systemLoading && !systemError && systemNotifications.length > 0 && (
                    <div className="space-y-3">
                      {systemNotifications.map((note) => (
                        <article
                          key={`system-${note.notification_id}`}
                          className="space-y-1 rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] px-4 py-3 text-sm"
                        >
                          <p className="text-sm text-[var(--text-primary)]">{note.message || "System update"}</p>
                          <p className="text-[0.65rem] text-[var(--text-secondary)]">
                            {formatNotificationTimestamp(note.created_at)}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Only the system posts here; this thread cannot be deleted or renamed.
                </p>
              </div>
            ) : activeThread ? (
              <div className="space-y-4 rounded-2xl border border-[var(--surface-light)] bg-[var(--surface)] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-[var(--primary)]">Active thread</p>
                    <h4 className="text-lg font-semibold text-[var(--text-primary)]">{activeThread.title}</h4>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {formatMessageTimestamp(threadMessages[threadMessages.length - 1]?.createdAt)}
                  </span>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto pb-2">
                  {messagesLoading && (
                    <p className="text-sm text-[var(--text-secondary)]">Loading conversation…</p>
                  )}
                  {!messagesLoading && messagesError && (
                    <p className="text-sm text-[var(--danger)]">{messagesError}</p>
                  )}
                  {!messagesLoading && !messagesError && threadMessages.length === 0 && (
                    <p className="text-sm text-[var(--text-secondary)]">No messages yet. Start the conversation below.</p>
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
                              isMine ? "border-[var(--surface-light)] bg-[var(--surface-light)]" : "border-[var(--surface-light)] bg-[var(--background)]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-[var(--text-primary)]">{senderName}</span>
                              <span className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                                {formatMessageTimestamp(message.createdAt)}
                              </span>
                            </div>
                            <p className="text-[var(--text-secondary)]">{renderMessageContentWithLinks(message.content)}</p>
                            {message.metadata?.jobNumber && (
                              <p className="text-[0.65rem] text-[var(--text-secondary)]">
                                Linked job #{message.metadata.jobNumber}
                              </p>
                            )}
                            {message.metadata?.customerId && (
                              <p className="text-[0.65rem] text-[var(--text-secondary)]">
                                Linked customer profile
                              </p>
                            )}
                            {message.metadata?.vehicleId && (
                              <p className="text-[0.65rem] text-[var(--text-secondary)]">
                                Linked vehicle {vehicles?.find((v) => v.id === message.metadata.vehicleId)?.reg || "(vehicle data)"}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              {message.savedForever ? (
                                <span className="rounded-full border border-[var(--surface-light)] px-3 py-1 text-[0.65rem] font-semibold text-[var(--primary)]">
                                  Saved forever
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSaveMessage(message)}
                                  disabled={savingMessageId === message.id}
                                  className="rounded-full border border-[var(--surface-light)] px-3 py-1 text-[0.65rem] font-semibold text-[var(--primary)] hover:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
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
                        border: "1px solid var(--surface-light)",
                        borderRadius: "16px",
                        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)",
                        zIndex: 1000,
                      }}
                    >
                      {commandSuggestions.map((cmd, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleSelectCommand(cmd)}
                          className="w-full border-b border-[var(--surface-light)] bg-[var(--background)] px-4 py-3 text-left hover:bg-[var(--surface-light)]"
                          style={{
                            borderBottom: index < commandSuggestions.length - 1 ? "1px solid var(--surface-light)" : "none",
                          }}
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-bold text-[var(--primary)]">
                              {cmd.command}
                            </span>
                            <span className="text-xs text-[var(--text-secondary)]">
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
                    className="w-full rounded-2xl border border-[var(--surface-light)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!dbUserId || sendingMessage || !messageDraft.trim()}
                      className="rounded-full bg-[var(--primary)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:bg-[var(--danger)]"
                    >
                      {sendingMessage ? "Sending…" : "Send"}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--surface-light)] bg-[var(--background)] p-6 text-sm text-[var(--text-secondary)]">
                Select a conversation to view messages and replies.
              </div>
            )}
          </div>
          {composerOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-2xl rounded-3xl border border-[var(--surface-light)] bg-[var(--surface)] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-[var(--primary)]">Compose</p>
                    <h3 className="text-xl font-semibold text-[var(--text-primary)]">Create a group chat</h3>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Search by name, check the people you need, and create a new thread.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setComposerOpen(false)}
                    className="rounded-full border border-[var(--surface-light)] px-3 py-1 text-xs font-semibold text-[var(--primary)]"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <label className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Search users</label>
                  <input
                    type="search"
                    value={composerSearch}
                    onChange={(event) => setComposerSearch(event.target.value)}
                    placeholder="Find teammates by name or email"
                    className="w-full rounded-2xl border border-[var(--search-surface-muted)] bg-[var(--search-surface)] px-4 py-3 text-sm text-[var(--search-text)] focus:border-[var(--primary)] focus:outline-none"
                  />
                  <div className="max-h-60 overflow-y-auto space-y-2 rounded-2xl border border-[var(--search-surface-muted)] bg-[var(--search-surface)] p-3 text-[var(--search-text)]">
                    {composerLoading && (
                      <p className="text-sm text-[var(--search-text)]">Searching your roster…</p>
                    )}
                    {!composerLoading && composerError && (
                      <p className="text-sm text-[var(--search-text)]">{composerError}</p>
                    )}
                    {!composerLoading && !composerError && !composerHasSearch && (
                      <p className="text-sm text-[var(--search-text)]">Type a name to see matching users.</p>
                    )}
                    {!composerLoading && !composerError && composerHasSearch && composerResults.length === 0 && (
                      <p className="text-sm text-[var(--search-text)]">No users match that search.</p>
                    )}
                    {!composerLoading && !composerError && composerResults.length > 0 && (
                      <div className="space-y-2">
                        {composerResults.map((user) => {
                          const isSelected = composerSelection.some((entry) => entry.id === user.id);
                          return (
                            <label
                              key={user.id}
                              className="flex cursor-pointer items-center justify-between rounded-2xl border border-[var(--danger-surface)] bg-[var(--background)] px-3 py-2 text-sm transition hover:border-[var(--primary)]"
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleComposerUser(user)}
                                  className="h-4 w-4 rounded border-[var(--primary)]"
                                />
                                <div>
                                  <p className="font-semibold text-[var(--text-primary)]">{user.name}</p>
                                  <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                                    {user.role || "Team member"}
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs text-[var(--text-secondary)]">{user.email}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">
                    Selected {composerSelection.length} colleague
                    {composerSelection.length === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    disabled={composerCreating || composerSelection.length === 0}
                    className="rounded-full bg-[var(--primary)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
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
