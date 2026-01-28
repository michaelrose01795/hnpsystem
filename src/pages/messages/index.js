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
import ModalPortal from "@/components/popups/ModalPortal";

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
      color: active ? "var(--text-inverse)" : palette.accent,
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

const renderMessageContent = (content, userRoles = []) => {
  if (!content) return null;

  // Enhanced regex to catch all slash commands
  const regex = /\/(?:(job|vhc|part|invoice|account|order|user|cust)([a-zA-Z0-9]+)|(\d+)|(customer|vehicle|parts|tracking|valet|hr|clocking|archive|myjobs|appointments))/gi;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    const fullMatch = match[0];
    const prefix = match[1]; // job, vhc, part, etc.
    const value = match[2];  // The value after prefix
    const numberOnly = match[3]; // Just a number
    const standalone = match[4]; // customer, vehicle, parts, etc.

    let href = null;
    let title = fullMatch;

    // Determine the link based on the command
    if (numberOnly) {
      // /12345 - job number shorthand
      href = getJobLink(numberOnly, userRoles);
      title = `Job #${numberOnly}`;
    } else if (prefix === 'job' && value) {
      href = getJobLink(value, userRoles);
      title = `Job #${value}`;
    } else if (prefix === 'vhc' && value) {
      href = `/job-cards/${value}?tab=vhc`;
      title = `VHC for Job #${value}`;
    } else if (prefix === 'part' && value) {
      title = `Part #${value}`;
    } else if (prefix === 'invoice' && value) {
      href = `/accounts/invoices/${value}`;
      title = `Invoice #${value}`;
    } else if (prefix === 'account' && value) {
      href = `/accounts/view/${value}`;
      title = `Account ${value}`;
    } else if (prefix === 'order' && value) {
      href = `/parts/create-order/${value}`;
      title = `Parts Order ${value}`;
    } else if (prefix === 'user' && value) {
      title = `User: ${value}`;
    } else if (prefix === 'cust' && value) {
      title = `Customer: ${value}`;
    } else if (standalone === 'parts') {
      href = '/parts';
      title = 'Parts Management';
    } else if (standalone === 'tracking') {
      href = '/tracking';
      title = 'Vehicle Tracking';
    } else if (standalone === 'valet') {
      href = '/valet';
      title = 'Valet Dashboard';
    } else if (standalone === 'hr') {
      href = '/hr/manager';
      title = 'HR Dashboard';
    } else if (standalone === 'clocking') {
      href = '/clocking';
      title = 'Time Clocking';
    } else if (standalone === 'archive') {
      href = '/job-cards/archive';
      title = 'Job Archive';
    } else if (standalone === 'myjobs') {
      href = '/job-cards/myjobs';
      title = 'My Jobs';
    } else if (standalone === 'appointments') {
      href = '/job-cards/appointments';
      title = 'Appointments';
    }

    // Render as link if href exists, otherwise just highlight
    if (href) {
      parts.push(
        <a
          key={match.index}
          href={href}
          style={{
            color: "inherit",
            textDecoration: "underline",
            fontWeight: 600,
          }}
          title={title}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {fullMatch}
        </a>
      );
    } else {
      parts.push(
        <span
          key={match.index}
          style={{
            fontWeight: 600,
            textDecoration: standalone || (prefix && value) ? "underline" : "none",
          }}
          title={title}
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

const MessageBubble = ({ message, isMine, nameColor = palette.accent, userRoles = [] }) => {
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
          <div style={bubbleStyles}>{renderMessageContent(message.content, userRoles)}</div>
        </div>
      </div>
    </div>
  );
};

const parseSlashCommandMetadata = async (text = "", thread = null) => {
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

    // /addcust[name or email] - connect a customer to chat
    const addCustMatch = token.match(/^addcust(?:\[(.+)\]|(.+))$/i);
    if (addCustMatch && !metadata.addCustomerQuery) {
      const query = (addCustMatch[1] ?? addCustMatch[2] ?? "").trim();
      if (query) {
        metadata.addCustomerQuery = query;
        continue;
      }
    }

    // /customer - reference to customer in thread
    if (token.toLowerCase() === "customer") {
      hasCustomerCommand = true;
      if (!metadata.customerId) {
        const customerMember = (thread?.members || []).find((member) =>
          member.profile?.role?.toLowerCase().includes("customer")
        );
        if (customerMember) {
          metadata.customerId = customerMember.userId;
        }
      }
    }

    // /vehicle - reference to vehicle
    if (token.toLowerCase() === "vehicle") {
      hasVehicleCommand = true;
      if (!metadata.vehicleId) {
        const vehicleReference = thread?.lastMessage?.metadata?.vehicleId;
        if (vehicleReference) {
          metadata.vehicleId = vehicleReference;
        }
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

        // Link customer if /customer command was used and not already set
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

const ADD_CUSTOMER_TOKEN_REGEX = /\/addcust[^\s]+/gi;

const stripAddCustomerCommands = (text = "") =>
  String(text || "")
    .replace(ADD_CUSTOMER_TOKEN_REGEX, "")
    .replace(/\s{2,}/g, " ")
    .trim();

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

// Helper function to get user-specific link for job based on role
const getJobLink = (jobNumber, userRoles = []) => {
  const normalizedRoles = userRoles.map(r => r.toLowerCase());

  // Technicians use myjobs path
  if (normalizedRoles.includes('technician')) {
    return `/job-cards/myjobs/${jobNumber}`;
  }

  // Everyone else uses standard job-cards path
  return `/job-cards/${jobNumber}?tab=messages`;
};

// Filter commands based on user roles
const getAvailableCommands = (userRoles = []) => {
  const normalizedRoles = userRoles.map(r => r.toLowerCase());

  const allCommands = [
    // Job Commands
    {
      command: "/job[number]",
      description: "Link to a job card (e.g., /job12345)",
      autocomplete: "/job",
      pattern: "job",
      hasInput: true,
      roles: ['all'], // Everyone can reference jobs
      getLink: (num) => getJobLink(num, userRoles)
    },
    {
      command: "/[number]",
      description: "Quick link to a job (e.g., /12345)",
      autocomplete: "/",
      pattern: "",
      hasInput: true,
      roles: ['all'],
      getLink: (num) => getJobLink(num, userRoles)
    },

    // Customer Commands
    {
      command: "/cust[name]",
      description: "Reference a customer (e.g., /custjohnsmith)",
      autocomplete: "/cust",
      pattern: "cust",
      hasInput: true,
      roles: ['all']
    },
    {
      command: "/customer",
      description: "Reference the customer (auto-links if /job used)",
      autocomplete: "/customer",
      pattern: "customer",
      hasInput: false,
      roles: ['all']
    },
    {
      command: "/addcust[name or email]",
      description: "Invite a customer and create a shared chat (e.g., /addcust[jane@domain.com])",
      autocomplete: "/addcust",
      pattern: "addcust",
      hasInput: true,
      roles: ['service advisor', 'service manager', 'after sales manager', 'workshop manager', 'admin']
    },

    // Vehicle Commands
    {
      command: "/vehicle",
      description: "Reference the vehicle (auto-links if /job used)",
      autocomplete: "/vehicle",
      pattern: "vehicle",
      hasInput: false,
      roles: ['all']
    },
    {
      command: "/vhc[jobnumber]",
      description: "Link to Vehicle Health Check (e.g., /vhc12345)",
      autocomplete: "/vhc",
      pattern: "vhc",
      hasInput: true,
      roles: ['technician', 'service advisor', 'service manager', 'workshop manager', 'admin'],
      getLink: (num) => `/job-cards/${num}?tab=vhc`
    },

    // Parts Commands
    {
      command: "/part[partnumber]",
      description: "Reference a part (e.g., /partBP123)",
      autocomplete: "/part",
      pattern: "part",
      hasInput: true,
      roles: ['parts', 'parts manager', 'technician', 'service advisor', 'workshop manager', 'admin']
    },
    {
      command: "/parts",
      description: "Link to Parts Management",
      autocomplete: "/parts",
      pattern: "parts",
      hasInput: false,
      roles: ['parts', 'parts manager', 'admin'],
      getLink: () => '/parts'
    },
    {
      command: "/order[ordernumber]",
      description: "Link to parts order (e.g., /orderPO123)",
      autocomplete: "/order",
      pattern: "order",
      hasInput: true,
      roles: ['parts', 'parts manager', 'admin'],
      getLink: (num) => `/parts/create-order/${num}`
    },

    // Account Commands
    {
      command: "/invoice[number]",
      description: "Link to invoice (e.g., /invoiceINV123)",
      autocomplete: "/invoice",
      pattern: "invoice",
      hasInput: true,
      roles: ['accounts', 'service manager', 'workshop manager', 'admin', 'owner'],
      getLink: (num) => `/accounts/invoices/${num}`
    },
    {
      command: "/account[id]",
      description: "Link to customer account (e.g., /accountACC123)",
      autocomplete: "/account",
      pattern: "account",
      hasInput: true,
      roles: ['accounts', 'service manager', 'workshop manager', 'admin', 'owner'],
      getLink: (id) => `/accounts/view/${id}`
    },

    // Tracking & Status
    {
      command: "/tracking",
      description: "Link to Vehicle Tracking",
      autocomplete: "/tracking",
      pattern: "tracking",
      hasInput: false,
      roles: ['service advisor', 'service manager', 'workshop manager', 'valet', 'admin'],
      getLink: () => '/tracking'
    },
    {
      command: "/valet",
      description: "Link to Valet Dashboard",
      autocomplete: "/valet",
      pattern: "valet",
      hasInput: false,
      roles: ['valet', 'service manager', 'workshop manager', 'admin'],
      getLink: () => '/valet'
    },

    // HR Commands
    {
      command: "/hr",
      description: "Link to HR Dashboard",
      autocomplete: "/hr",
      pattern: "hr",
      hasInput: false,
      roles: ['hr manager', 'admin manager', 'owner', 'admin'],
      getLink: () => '/hr/manager'
    },
    {
      command: "/user[name]",
      description: "Reference a staff member (e.g., /userjohnsmith)",
      autocomplete: "/user",
      pattern: "user",
      hasInput: true,
      roles: ['all']
    },

    // Time & Clocking
    {
      command: "/clocking",
      description: "Link to Time Clocking",
      autocomplete: "/clocking",
      pattern: "clocking",
      hasInput: false,
      roles: ['workshop manager', 'service manager', 'admin'],
      getLink: () => '/clocking'
    },

    // Useful Shortcuts
    {
      command: "/archive",
      description: "Link to Job Archive",
      autocomplete: "/archive",
      pattern: "archive",
      hasInput: false,
      roles: ['service advisor', 'service manager', 'workshop manager', 'admin'],
      getLink: () => '/job-cards/archive'
    },
    {
      command: "/myjobs",
      description: "Link to My Jobs",
      autocomplete: "/myjobs",
      pattern: "myjobs",
      hasInput: false,
      roles: ['technician'],
      getLink: () => '/job-cards/myjobs'
    },
    {
      command: "/appointments",
      description: "Link to Appointments",
      autocomplete: "/appointments",
      pattern: "appointments",
      hasInput: false,
      roles: ['service advisor', 'service manager', 'admin'],
      getLink: () => '/job-cards/appointments'
    }
  ];

  // Filter commands based on user roles
  return allCommands.filter(cmd => {
    if (cmd.roles.includes('all')) return true;
    return cmd.roles.some(role => normalizedRoles.includes(role));
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
  const [commandHelpOpen, setCommandHelpOpen] = useState(false);
  const [groupMembersModalOpen, setGroupMembersModalOpen] = useState(false);
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [commandSuggestions, setCommandSuggestions] = useState([]);

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
    connectCustomer: connectCustomerApi,
  } = useMessagesApi();

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  const isGroupChat = Boolean(activeThread && activeThread.type === "group");

  // Get available commands based on user roles
  const availableCommands = useMemo(() => {
    return getAvailableCommands(user?.roles || []);
  }, [user?.roles]);

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

  const connectCustomerToConversation = useCallback(
    async ({ threadId, customerQuery }) => {
      if (!threadId || !dbUserId) {
        throw new Error("Select a conversation before inviting a customer.");
      }
      if (!customerQuery) {
        throw new Error("Customer name or email is required.");
      }
      const payload = await connectCustomerApi({
        threadId,
        actorId: dbUserId,
        customerQuery,
      });
      const nextThread = payload?.thread || payload?.data;
      if (!nextThread?.id) {
        throw new Error("Customer conversation could not be created.");
      }
      mergeThread(nextThread);
      await fetchThreads();
      return {
        thread: nextThread,
        customer: payload?.customer || null,
      };
    },
    [connectCustomerApi, dbUserId, fetchThreads, mergeThread]
  );

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
        const filtered = availableCommands.filter(cmd =>
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
  }, [availableCommands]);

  const handleSelectCommand = useCallback((command) => {
    const cursorPos = document.activeElement?.selectionStart || messageDraft.length;
    const textBeforeCursor = messageDraft.substring(0, cursorPos);
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/');

    if (lastSlashIndex !== -1) {
      const textAfter = messageDraft.substring(cursorPos);
      const newText = messageDraft.substring(0, lastSlashIndex) + command.autocomplete + textAfter;
      setMessageDraft(newText);

      // Set cursor position after the autocompleted text
      // Need to do this in the next tick to ensure the textarea is updated
      setTimeout(() => {
        const textarea = document.getElementById('message-textarea');
        if (textarea) {
          const newCursorPos = lastSlashIndex + command.autocomplete.length;
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
    setShowCommandSuggestions(false);
  }, [messageDraft]);

  const handleInsertCommandFromHelp = useCallback((command) => {
    // Insert command at the end of current message draft
    const newText = messageDraft ? messageDraft + ' ' + command.autocomplete : command.autocomplete;
    setMessageDraft(newText);

    // Close help modal
    setCommandHelpOpen(false);

    // Focus textarea and set cursor at end
    setTimeout(() => {
      const textarea = document.getElementById('message-textarea');
      if (textarea) {
        textarea.focus();
        const cursorPos = newText.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      }
    }, 100);
  }, [messageDraft]);

  const handleSendMessage = useCallback(
    async (event) => {
      event?.preventDefault();
      if (!messageDraft.trim() || !activeThreadId || !dbUserId) return;
      setShowCommandSuggestions(false);
      setSending(true);
      setConversationError("");
      try {
        const parsedMetadata =
          (await parseSlashCommandMetadata(messageDraft, activeThread)) || null;
        const addCustomerQuery = parsedMetadata?.addCustomerQuery;
        if (parsedMetadata && "addCustomerQuery" in parsedMetadata) {
          delete parsedMetadata.addCustomerQuery;
        }

        let targetThreadId = activeThreadId;
        let cleanedContent = messageDraft;

        if (addCustomerQuery) {
          const { thread: nextThread, customer } =
            await connectCustomerToConversation({
              threadId: activeThreadId,
              customerQuery: addCustomerQuery,
            });
          targetThreadId = nextThread.id;
          cleanedContent = stripAddCustomerCommands(messageDraft);
          if (!cleanedContent) {
            const label =
              customer?.name || customer?.email || addCustomerQuery;
            cleanedContent = label
              ? `Customer ${label} was added to this chat.`
              : "Customer invited to this chat.";
          }
        }

        const finalContent = cleanedContent.trim();
        if (!finalContent) {
          throw new Error("Message is empty after processing commands.");
        }

        const payload = await sendThreadMessage(targetThreadId, {
          senderId: dbUserId,
          content: finalContent,
          metadata:
            parsedMetadata && Object.keys(parsedMetadata).length
              ? parsedMetadata
              : null,
        });
        const newMessage = payload?.data || payload?.message;
        if (!newMessage) throw new Error("Message payload missing.");
        setMessageDraft("");
        if (targetThreadId === activeThreadId) {
          setMessages((prev) => [...prev, newMessage]);
        } else {
          setMessages([newMessage]);
        }
        await fetchThreads();
        await openThread(targetThreadId);
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
      connectCustomerToConversation,
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
                className="custom-scrollbar"
                style={{
                  flex: 1,
                  minHeight: 0,
                  maxHeight: "700px",
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
                    {isGroupChat ? (
                      <h3
                        onClick={() => setGroupMembersModalOpen(true)}
                        style={{
                          margin: 0,
                          color: systemTitleColor,
                          cursor: "pointer",
                          textDecoration: "underline",
                          textDecorationStyle: "dotted",
                        }}
                        title="Click to view members"
                      >
                        {activeThread.title}
                      </h3>
                    ) : (
                      <h3 style={{ margin: 0, color: systemTitleColor }}>{activeThread.title}</h3>
                    )}
                  </div>
                  {isGroupChat && canEditGroup && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                      }}
                    >
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
                    </div>
                  )}
                </div>

                <div
                  ref={scrollerRef}
                  style={{
                    marginTop: "16px",
                    flex: 1,
                    minHeight: 0,
                    maxHeight: "540px",
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
                      userRoles={user?.roles || []}
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
                    position: "relative",
                  }}
                >
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
                        border: `1px solid ${palette.border}`,
                        borderRadius: radii.lg,
                        boxShadow: shadows.lg,
                        zIndex: 1000,
                      }}
                    >
                      {commandSuggestions.map((cmd, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleSelectCommand(cmd)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "12px 14px",
                            border: "none",
                            borderBottom: index < commandSuggestions.length - 1 ? `1px solid ${palette.border}` : "none",
                            backgroundColor: "var(--surface)",
                            cursor: "pointer",
                            transition: "background-color 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "var(--info-surface)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "var(--surface)";
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <span style={{ fontWeight: 700, color: palette.accent, fontSize: "0.95rem" }}>
                              {cmd.command}
                            </span>
                            <span style={{ fontSize: "0.85rem", color: palette.textMuted }}>
                              {cmd.description}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <textarea
                    id="message-textarea"
                    rows={3}
                    value={messageDraft}
                    onChange={handleMessageDraftChange}
                    placeholder="Write an internal update… (type / for commands)"
                    style={{
                      width: "100%",
                      borderRadius: radii.lg,
                      border: `1px solid ${palette.border}`,
                      padding: "12px 14px",
                      resize: "none",
                      backgroundColor: "var(--surface)",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                    <button
                      type="button"
                      onClick={() => setCommandHelpOpen(true)}
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        border: `1px solid ${palette.border}`,
                        backgroundColor: "var(--surface)",
                        color: palette.accent,
                        fontWeight: 700,
                        fontSize: "1rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title="Slash command help"
                    >
                      ?
                    </button>
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
        <ModalPortal>
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
        </ModalPortal>
      )}

      {newChatModalOpen && (
        <ModalPortal>
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
        </ModalPortal>
      )}

      {/* Command Help Modal */}
      {commandHelpOpen && (
        <ModalPortal>
          <div
            onClick={() => setCommandHelpOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                ...cardStyle,
                maxWidth: "600px",
                width: "90%",
                maxHeight: "80vh",
                overflowY: "auto",
                gap: "20px",
              }}
            >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, color: palette.textPrimary }}>Slash Commands Help</h3>
              <button
                type="button"
                onClick={() => setCommandHelpOpen(false)}
                style={{
                  border: "none",
                  background: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: palette.textMuted,
                  padding: "4px",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <p style={{ color: palette.textMuted, margin: 0 }}>
                Use slash commands in your messages to create quick links and references.
                Commands shown are based on your role and permissions.
              </p>
              <div style={{
                padding: "8px 12px",
                backgroundColor: "var(--accent-surface)",
                borderRadius: radii.lg,
                borderLeft: `3px solid ${palette.accent}`,
                fontSize: "0.85rem"
              }}>
                <strong style={{ color: palette.accent }}>Click any command below</strong> to insert it into your message!
              </div>

              {/* Organize commands by category */}
              {(() => {
                const categories = {
                  'Jobs & Work': availableCommands.filter(cmd =>
                    ['job', '', 'myjobs', 'archive', 'appointments'].includes(cmd.pattern)
                  ),
                  'Customers & Accounts': availableCommands.filter(cmd =>
                    ['cust', 'customer', 'addcust', 'account', 'invoice'].includes(cmd.pattern)
                  ),
                  'Vehicles': availableCommands.filter(cmd =>
                    ['vehicle', 'vhc', 'tracking', 'valet'].includes(cmd.pattern)
                  ),
                  'Parts & Inventory': availableCommands.filter(cmd =>
                    ['part', 'parts', 'order'].includes(cmd.pattern)
                  ),
                  'Team & Operations': availableCommands.filter(cmd =>
                    ['user', 'hr', 'clocking'].includes(cmd.pattern)
                  ),
                };

                return Object.entries(categories).map(([category, commands]) => {
                  if (commands.length === 0) return null;

                  return (
                    <div key={category}>
                      <h4 style={{
                        margin: "0 0 8px 0",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        color: palette.accent,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em"
                      }}>
                        {category}
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {commands.map((cmd, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleInsertCommandFromHelp(cmd)}
                            style={{
                              padding: "10px 12px",
                              backgroundColor: "var(--info-surface)",
                              borderRadius: radii.lg,
                              borderLeft: `3px solid ${palette.accent}`,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "var(--accent-surface)";
                              e.currentTarget.style.transform = "translateX(4px)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "var(--info-surface)";
                              e.currentTarget.style.transform = "translateX(0)";
                            }}
                          >
                            <strong style={{ color: palette.accent, fontSize: "0.95rem" }}>
                              {cmd.command}
                            </strong>
                            <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", color: palette.textMuted }}>
                              {cmd.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}

              {/* Tips Section */}
              <div style={{
                marginTop: "8px",
                paddingTop: "16px",
                borderTop: `1px solid ${palette.border}`
              }}>
                <div style={{
                padding: "12px",
                backgroundColor: "var(--success-surface)",
                borderRadius: radii.lg,
                borderLeft: `4px solid var(--success)`
              }}>
                <strong style={{ color: "var(--success)" }}>Smart Linking:</strong>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.9rem", color: palette.textMuted }}>
                  When you use <code>/job[number]</code> together with <code>/vehicle</code> or <code>/customer</code>,
                  the system automatically links the vehicle and customer from that job!
                </p>
              </div>

              <div style={{
                padding: "12px",
                backgroundColor: "var(--warning-surface)",
                borderRadius: radii.lg,
                borderLeft: `4px solid var(--warning)`
              }}>
                <strong style={{ color: "var(--warning)" }}>Tip:</strong>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.9rem", color: palette.textMuted }}>
                  Commands are case-insensitive and will be automatically linked when you send your message.
                </p>
              </div>
              </div>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Group Members Modal */}
      {groupMembersModalOpen && activeThread && isGroupChat && (
        <ModalPortal>
          <div
            onClick={() => setGroupMembersModalOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                ...cardStyle,
                maxWidth: "500px",
                width: "90%",
                maxHeight: "70vh",
                overflowY: "auto",
                gap: "20px",
              }}
            >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, color: palette.textPrimary }}>
                {activeThread.title || "Group Chat"}
              </h3>
              <button
                type="button"
                onClick={() => setGroupMembersModalOpen(false)}
                style={{
                  border: "none",
                  background: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: palette.textMuted,
                  padding: "4px",
                }}
              >
                ×
              </button>
            </div>

            <div>
              <h4 style={{ margin: "0 0 12px 0", color: palette.textMuted, fontSize: "0.9rem" }}>
                Members ({activeThread.members.length})
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {activeThread.members.map((member) => (
                  <div
                    key={member.userId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px",
                      backgroundColor: "var(--info-surface)",
                      borderRadius: radii.lg,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: palette.textPrimary }}>
                        {member.profile?.name || "Unknown"}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: palette.textMuted }}>
                        {member.profile?.role || "Unknown role"}
                      </div>
                    </div>
                    {member.role === "leader" && (
                      <span
                        style={{
                          padding: "4px 12px",
                          borderRadius: radii.pill,
                          backgroundColor: palette.accentSurface,
                          color: palette.accent,
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                      >
                        Leader
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </Layout>
  );
}

export default MessagesPage;
