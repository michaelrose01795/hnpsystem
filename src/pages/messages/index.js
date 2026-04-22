// file location: src/pages/messages/index.js

"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from
"react";
import { useRouter } from "next/router"; // Next.js router for reading query params
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/database/supabaseClient";
import { appShellTheme } from "@/styles/appTheme";
import useMessagesApi from "@/hooks/api/useMessagesApi";
import { useTheme } from "@/styles/themeProvider";
import ModalPortal from "@/components/popups/ModalPortal";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import StatusMessage from "@/components/ui/StatusMessage";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { SkeletonBlock, SkeletonKeyframes, InlineLoading } from "@/components/ui/LoadingSkeleton";

// Structured inline skeletons used inside the messages page. Kept local because
// thread, message, and colleague rows have distinct final shapes — the skeleton
// matches each one so the loading frame already mirrors the final layout.
import MessagesPageUi from "@/components/page-ui/messages/messages-ui"; // Extracted presentation layer.
function ThreadRowsSkeleton({ count = 4 }) {return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <SkeletonKeyframes />
      {Array.from({ length: count }).map((_, i) =>
      <div
        key={i}
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "center",
          padding: "10px",
          borderRadius: "var(--radius-md)"
        }}>
        
          <SkeletonBlock width="36px" height="36px" borderRadius="999px" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
            <SkeletonBlock width="50%" height="12px" />
            <SkeletonBlock width="80%" height="10px" />
          </div>
        </div>
      )}
    </div>);

}

function MessageBubblesSkeleton({ count = 3 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <SkeletonKeyframes />
      {Array.from({ length: count }).map((_, i) =>
      <div
        key={i}
        style={{
          alignSelf: i % 2 === 0 ? "flex-start" : "flex-end",
          width: i % 2 === 0 ? "62%" : "54%",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          padding: "12px",
          borderRadius: "14px",
          background: "var(--surface)"
        }}>
        
          <SkeletonBlock width="70%" height="10px" />
          <SkeletonBlock width="100%" height="12px" />
          <SkeletonBlock width="40%" height="10px" />
        </div>
      )}
    </div>);

}

function ColleagueRowsSkeleton({ count = 5 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <SkeletonKeyframes />
      {Array.from({ length: count }).map((_, i) =>
      <div key={i} style={{ display: "flex", gap: "10px", alignItems: "center", padding: "6px 0" }}>
          <SkeletonBlock width="32px" height="32px" borderRadius="999px" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
            <SkeletonBlock width="60%" height="10px" />
            <SkeletonBlock width="40%" height="8px" />
          </div>
        </div>
      )}
    </div>);

}

const palette = appShellTheme.palette;
const radii = appShellTheme.radii;
const shadows = appShellTheme.shadows;

const cardStyle = {
  background: "var(--section-card-bg)",
  border: "var(--section-card-border)",
  borderRadius: "var(--radius-lg)",
  padding: "var(--section-card-padding)",
  display: "flex",
  flexDirection: "column",
  gap: "14px"
};

const UNREAD_MARKER_STORAGE_KEY = "messagesUnreadMarkerDismissals";

const SectionTitle = ({ title, subtitle, action }) => {
  const hasHeading = Boolean(title || subtitle);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: hasHeading ? "space-between" : "center",
        alignItems: "center",
        gap: "12px"
      }}>
      
      {hasHeading &&
      <div>
          <h3
          style={{
            margin: 0,
            fontSize: "var(--text-h4)",
            color: palette.accent
          }}>
          
            {title}
          </h3>
          {subtitle &&
        <p style={{ margin: "4px 0 0", color: palette.textMuted, fontSize: "var(--text-body-sm)" }}>
              {subtitle}
            </p>
        }
        </div>
      }
      {action}
    </div>);

};

const ComposeToggleButton = ({ active, children, onClick }) =>
<Button
  type="button"
  variant={active ? "primary" : "secondary"}
  onClick={onClick}>
  
    {children}
  </Button>;


const Chip = ({ label, onRemove, disabled = false, color = palette.accent }) =>
<span
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--space-1)",
    padding: "var(--space-1) var(--space-3)",
    borderRadius: radii.pill,
    backgroundColor: palette.accentSurface,
    color,
    fontSize: "var(--text-body-sm)",
    fontWeight: 600
  }}>
  
    {label}
    {onRemove &&
  <Button
    type="button"
    variant="ghost"
    size="xs"
    pill
    onClick={disabled ? undefined : onRemove}
    disabled={disabled}
    aria-label="Remove">
    
        ×
      </Button>
  }
  </span>;


const AvatarBadge = ({ name }) => {
  const initial = (name || "?").trim().charAt(0)?.toUpperCase() || "?";

  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: "var(--radius-full)",
        backgroundColor: palette.accentSurface,
        color: palette.accent,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "none"
      }}>
      
      {initial}
    </div>);

};

const formatJobBadgeNumber = (value) => {
  const cleaned = String(value || "").trim();
  if (!cleaned) return "JOB";
  if (/^\d+$/.test(cleaned)) {
    return `JOB ${cleaned.padStart(5, "0")}`;
  }
  return `JOB ${cleaned.toUpperCase()}`;
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
    const value = match[2]; // The value after prefix
    const numberOnly = match[3]; // Just a number
    const standalone = match[4]; // customer, vehicle, parts, etc.

    let href = null;
    let title = fullMatch;
    let jobBadgeLabel = null;

    // Determine the link based on the command
    if (numberOnly) {
      // /12345 - job number shorthand
      href = getJobLink(numberOnly, userRoles);
      title = `Job #${numberOnly}`;
      jobBadgeLabel = formatJobBadgeNumber(numberOnly);
    } else if (prefix === 'job' && value) {
      href = getJobLink(value, userRoles);
      title = `Job #${value}`;
      jobBadgeLabel = formatJobBadgeNumber(value);
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
            color: jobBadgeLabel ? palette.accent : "inherit",
            textDecoration: "none",
            fontWeight: jobBadgeLabel ? 700 : 600,
            display: jobBadgeLabel ? "inline-flex" : "inline",
            alignItems: "center",
            border: jobBadgeLabel ? `1px solid rgba(var(--accent-purple-rgb), 0.32)` : "none",
            borderRadius: jobBadgeLabel ? radii.pill : 0,
            padding: jobBadgeLabel ? "2px 10px" : 0,
            margin: jobBadgeLabel ? "0 3px" : 0,
            backgroundColor: jobBadgeLabel ? "rgba(var(--accent-purple-rgb), 0.12)" : "transparent",
            fontSize: jobBadgeLabel ? "0.76rem" : "inherit",
            letterSpacing: jobBadgeLabel ? "0.04em" : "normal",
            textTransform: jobBadgeLabel ? "uppercase" : "none"
          }}
          title={title}
          onClick={(e) => {
            e.stopPropagation();
          }}>
          
          {jobBadgeLabel || fullMatch}
        </a>
      );
    } else {
      parts.push(
        <span
          key={match.index}
          style={{
            fontWeight: 600,
            textDecoration: standalone || prefix && value ? "underline" : "none"
          }}
          title={title}>
          
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

const REACTION_EMOJIS = ["👍", "👎", "❤️", "🔥", "😂", "😮"];

const MessageBubble = ({
  message,
  isMine,
  nameColor = palette.accent,
  userRoles = [],
  currentUserId = null,
  onApproveLeaveRequest,
  onDeclineLeaveRequest,
  decisionBusy = false,
  isFirstInGroup = true,
  isLastInGroup = true,
  reactions = [],
  onReact,
  onReply
}) => {
  const senderName = message.sender?.name || "Unknown";
  const [actionsOpen, setActionsOpen] = useState(false);
  const leaveRequestMeta = message?.metadata?.leaveRequest || null;
  const replyToMeta = message?.metadata?.replyTo || null;
  const leaveStatus = String(leaveRequestMeta?.status || "").trim();
  const leaveStatusKey = leaveStatus.toLowerCase();
  const canDecideLeaveRequest =
  Boolean(leaveRequestMeta?.absenceId) &&
  Array.isArray(leaveRequestMeta?.managerIds) &&
  leaveRequestMeta.managerIds.includes(currentUserId) &&
  leaveStatusKey === "pending";

  const radiusValue = isMine ?
  `${isFirstInGroup ? "18px" : "18px"} ${isFirstInGroup ? "18px" : "4px"} ${isLastInGroup ? "6px" : "4px"} 18px` :
  `${isFirstInGroup ? "18px" : "4px"} 18px 18px ${isLastInGroup ? "6px" : "4px"}`;

  const bubbleStyles = {
    padding: "10px 14px",
    borderRadius: radiusValue,
    backgroundColor: isMine ? "rgba(var(--accent-purple-rgb), 0.14)" : "var(--search-surface)",
    color: palette.textPrimary,
    maxWidth: "100%",
    boxShadow: "var(--shadow-md)",
    lineHeight: 1.45,
    cursor: "pointer",
    position: "relative"
  };

  const aggregatedReactions = reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  return (
    <div
      data-dev-section="1"
      data-dev-section-key={`messages-bubble-${message.id}`}
      data-dev-section-type="content-card"
      data-dev-section-parent="messages-thread-feed"
      data-dev-background-token={isMine ? "messages-bubble-mine" : "messages-bubble-peer"}
      style={{
        display: "flex",
        justifyContent: isMine ? "flex-end" : "flex-start",
        width: "100%",
        marginTop: isFirstInGroup ? "6px" : "2px"
      }}>
      
      <div
        style={{
          display: "flex",
          flexDirection: isMine ? "row-reverse" : "row",
          alignItems: "flex-end",
          maxWidth: "75%"
        }}>
        
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            alignItems: isMine ? "flex-end" : "flex-start",
            position: "relative"
          }}>
          
          {replyToMeta &&
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: isMine ? "flex-end" : "flex-start",
              marginBottom: "-6px",
              opacity: 0.75
            }}>
            
              <div
              style={{
                fontSize: "0.68rem",
                fontWeight: 600,
                color: palette.textMuted,
                padding: "0 10px 2px"
              }}>
              
                Replying to {replyToMeta.senderName || "message"}
              </div>
              <div
              style={{
                padding: "8px 12px",
                borderRadius: "14px",
                backgroundColor: "var(--search-surface)",
                color: palette.textMuted,
                fontSize: "0.78rem",
                maxWidth: "420px",
                transform: "scale(0.95)",
                transformOrigin: isMine ? "right bottom" : "left bottom",
                border: `1px solid ${palette.border}`
              }}>
              
                {String(replyToMeta.contentSnippet || "").slice(0, 160)}
              </div>
            </div>
          }
          {actionsOpen &&
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              borderRadius: radii.pill,
              backgroundColor: "var(--surface)",
              border: `1px solid ${palette.border}`,
              boxShadow: shadows.lg,
              marginBottom: "2px",
              zIndex: 2
            }}>
            
              {REACTION_EMOJIS.map((emoji) =>
            <Button
              key={emoji}
              type="button"
              variant="ghost"
              size="xs"
              pill
              onClick={(e) => {
                e.stopPropagation();
                onReact?.(emoji);
                setActionsOpen(false);
              }}
              aria-label={`React with ${emoji}`}>
              
                  {emoji}
                </Button>
            )}
              <div style={{ width: "1px", height: "18px", backgroundColor: palette.border }} />
              <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                onReply?.();
                setActionsOpen(false);
              }}>
              
                Reply
              </Button>
            </div>
          }
          <div
            style={bubbleStyles}
            onClick={() => setActionsOpen((v) => !v)}
            role="button"
            tabIndex={0}>
            
            {renderMessageContent(message.content, userRoles)}
            {leaveRequestMeta ?
            <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: radii.pill,
                    backgroundColor:
                    leaveStatusKey === "approved" ?
                    "var(--success-surface)" :
                    leaveStatusKey === "declined" ?
                    "var(--danger-surface)" :
                    "var(--info-surface)",
                    color:
                    leaveStatusKey === "approved" ?
                    "var(--success)" :
                    leaveStatusKey === "declined" ?
                    "var(--danger)" :
                    "var(--info-dark)",
                    fontSize: "0.72rem",
                    fontWeight: 700
                  }}>
                  
                    {leaveStatus || "Pending"}
                  </span>
                  <span style={{ fontSize: "0.76rem", color: palette.textMuted }}>
                    {leaveRequestMeta.leaveType || "Leave"} · {leaveRequestMeta.startDate || ""}
                    {leaveRequestMeta.endDate && leaveRequestMeta.endDate !== leaveRequestMeta.startDate ?
                  ` to ${leaveRequestMeta.endDate}` :
                  ""}
                  </span>
                </div>
                {leaveRequestMeta.requestNotes ?
              <div style={{ fontSize: "0.8rem", color: palette.textMuted }}>
                    {leaveRequestMeta.requestNotes}
                  </div> :
              null}
                {leaveRequestMeta.declineReason ?
              <div style={{ fontSize: "0.8rem", color: "var(--danger)", fontWeight: 600 }}>
                    Decline reason: {leaveRequestMeta.declineReason}
                  </div> :
              null}
                {canDecideLeaveRequest ?
              <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                    <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  pill
                  disabled={decisionBusy}
                  onClick={() => onApproveLeaveRequest?.(message)}>
                  
                      Approve
                    </Button>
                    <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  pill
                  disabled={decisionBusy}
                  onClick={() => onDeclineLeaveRequest?.(message)}>
                  
                      Decline
                    </Button>
                  </div> :
              null}
              </div> :
            null}
          </div>
          {Object.keys(aggregatedReactions).length > 0 &&
          <div
            style={{
              display: "flex",
              gap: "4px",
              flexWrap: "wrap",
              marginTop: "-6px",
              padding: "0 6px"
            }}>
            
              {Object.entries(aggregatedReactions).map(([emoji, count]) =>
            <Button
              key={emoji}
              type="button"
              variant="secondary"
              size="xs"
              pill
              onClick={(e) => {
                e.stopPropagation();
                onReact?.(emoji);
              }}>
              
                  <span>{emoji}</span>
                  {count > 1 &&
              <span style={{ color: palette.textMuted, marginLeft: "var(--space-xs)" }}>
                      {count}
                    </span>
              }
                </Button>
            )}
            </div>
          }
        </div>
      </div>
    </div>);

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
String(text || "").
replace(ADD_CUSTOMER_TOKEN_REGEX, "").
replace(/\s{2,}/g, " ").
trim();

const formatNotificationTimestamp = (value) => {
  if (!value) return "Unknown time";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

// Helper function to get user-specific link for job based on role
const getJobLink = (jobNumber, userRoles = []) => {
  const normalizedRoles = userRoles.map((r) => r.toLowerCase());

  // Technicians use myjobs path
  if (normalizedRoles.includes('technician')) {
    return `/job-cards/myjobs/${jobNumber}`;
  }

  // Everyone else uses standard job-cards path
  return `/job-cards/${jobNumber}?tab=messages`;
};

// Filter commands based on user roles
const getAvailableCommands = (userRoles = []) => {
  const normalizedRoles = userRoles.map((r) => r.toLowerCase());

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
  }];


  // Filter commands based on user roles
  return allCommands.filter((cmd) => {
    if (cmd.roles.includes('all')) return true;
    return cmd.roles.some((role) => normalizedRoles.includes(role));
  });
};

const sortDirectoryEntries = (entries = []) =>
[...entries].sort((a, b) =>
(a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
);

function MessagesPage() {
  const router = useRouter(); // Access query params from job card navigation
  const { dbUserId, user } = useUser();
  const { isDark } = useTheme();

  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [messageReactions, setMessageReactions] = useState({});
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
  const [systemUnreadCutoff, setSystemUnreadCutoff] = useState(null);
  const [activeThreadUnreadCutoff, setActiveThreadUnreadCutoff] = useState(false);
  const [dismissedUnreadMarkers, setDismissedUnreadMarkers] = useState({});
  const [threadUnreadMarkerEl, setThreadUnreadMarkerEl] = useState(null);
  const [systemUnreadMarkerEl, setSystemUnreadMarkerEl] = useState(null);

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
  const [leaveDecisionBusy, setLeaveDecisionBusy] = useState(false);
  const [leaveDecisionError, setLeaveDecisionError] = useState("");
  const [leaveDeclineModal, setLeaveDeclineModal] = useState({ open: false, message: null });
  const [leaveDeclineReason, setLeaveDeclineReason] = useState("");

  const [isMobileView, setIsMobileView] = useState(false); // portrait phone single-panel toggle
  const [mobilePanelView, setMobilePanelView] = useState("threads");

  // Detect portrait phone viewport for iPhone-style message navigation
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 480px) and (orientation: portrait)");
    setIsMobileView(mediaQuery.matches);
    const handler = (event) => setIsMobileView(event.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const mobileHistoryPushedRef = useRef(false); // tracks whether we pushed a history entry
  const ensureMobileConversationHistory = useCallback(() => {
    if (!isMobileView || mobileHistoryPushedRef.current) return;
    window.history.pushState({ mobileChat: true }, "");
    mobileHistoryPushedRef.current = true;
  }, [isMobileView]);

  // Helper: go back to thread list on mobile (calledFromPopState flag prevents history.back loop)
  const handleMobileBack = useCallback((calledFromPopState = false) => {
    setMobilePanelView("threads");
    setActiveThreadId(null); // deselect thread to show list
    setActiveSystemView(false); // exit system view too
    setMessages([]); // clear messages panel
    if (mobileHistoryPushedRef.current && !calledFromPopState) {
      mobileHistoryPushedRef.current = false; // reset flag before popping
      window.history.back(); // pop the chat history entry we pushed
    } else {
      mobileHistoryPushedRef.current = false; // reset flag
    }
  }, []);

  useEffect(() => {
    if (isMobileView) return;
    mobileHistoryPushedRef.current = false;
    setMobilePanelView("threads");
  }, [isMobileView]);

  // Listen for browser back button (popstate) to return to thread list on mobile
  useEffect(() => {
    if (!isMobileView) return; // only on mobile
    const onPopState = () => {
      if (mobileHistoryPushedRef.current || activeThreadId || activeSystemView) {
        handleMobileBack(true); // pass true so we don't call history.back again
      }
    };
    window.addEventListener("popstate", onPopState); // listen for back button
    return () => window.removeEventListener("popstate", onPopState); // cleanup
  }, [activeSystemView, activeThreadId, isMobileView, handleMobileBack]);

  const scrollerRef = useRef(null);
  const unreadMarkerTimersRef = useRef(new Map());
  const activeUnreadMarkerKeyRef = useRef(null);
  const deepLinkProcessedRef = useRef(false); // Track whether job card deep-link has been handled
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
    connectCustomer: connectCustomerApi
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

  const hasThreadStarted = useCallback((thread) => {
    const content = thread?.lastMessage?.content;
    return Boolean(
      typeof content === "string" && content.trim() || thread?.lastMessage?.id
    );
  }, []);

  const visibleThreads = useMemo(
    () =>
    threads.filter(
      (thread) => hasThreadStarted(thread) || thread.id === activeThreadId
    ),
    [threads, hasThreadStarted, activeThreadId]
  );

  const filteredThreads = useMemo(() => {
    const term = threadSearchTerm.trim().toLowerCase();
    if (!term) return visibleThreads;
    return visibleThreads.filter((thread) => {
      const title = (thread.title || "").toLowerCase();
      const lastMessage = (thread.lastMessage?.content || "").toLowerCase();
      return title.includes(term) || lastMessage.includes(term);
    });
  }, [threadSearchTerm, visibleThreads]);

  const userNameColor = "var(--accent-purple)";
  const systemTitleColor = userNameColor;
  const unreadBackgroundColor = "rgba(var(--accent-purple-rgb), 0.14)";

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

  const orderedSystemNotifications = useMemo(
    () =>
    [...(systemNotifications || [])].sort(
      (a, b) => new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime()
    ),
    [systemNotifications]
  );
  const latestSystemNotification =
  orderedSystemNotifications?.[orderedSystemNotifications.length - 1];
  const latestSystemTimestamp = latestSystemNotification?.created_at || null;
  const latestSystemTime = latestSystemTimestamp ? new Date(latestSystemTimestamp).getTime() : 0;
  const lastSystemTime = lastSystemViewedAt ? new Date(lastSystemViewedAt).getTime() : 0;
  const hasSystemUnread =
  Boolean(systemNotifications.length) && latestSystemTime > lastSystemTime;
  const systemTimestampLabel = latestSystemTimestamp ?
  formatNotificationTimestamp(latestSystemTimestamp) :
  "No updates yet";
  const isSystemThreadActive = activeSystemView;
  const activeThreadUnreadMarkerIndex = useMemo(() => {
    if (!messages.length) return -1;
    if (activeThreadUnreadCutoff === false) return -1;
    if (!activeThreadUnreadCutoff) return 0;
    const cutoffTime = new Date(activeThreadUnreadCutoff).getTime();
    if (Number.isNaN(cutoffTime)) return -1;
    return messages.findIndex(
      (message) => new Date(message?.createdAt || 0).getTime() > cutoffTime
    );
  }, [messages, activeThreadUnreadCutoff]);
  const systemUnreadMarkerIndex = useMemo(() => {
    if (!orderedSystemNotifications.length) return -1;
    if (!systemUnreadCutoff) return 0;
    const cutoffTime = new Date(systemUnreadCutoff).getTime();
    if (Number.isNaN(cutoffTime)) return -1;
    return orderedSystemNotifications.findIndex(
      (note) => new Date(note?.created_at || 0).getTime() > cutoffTime
    );
  }, [orderedSystemNotifications, systemUnreadCutoff]);
  const activeThreadUnreadMarkerKey = useMemo(() => {
    if (!activeThread || activeThreadUnreadMarkerIndex < 0) return null;
    const cutoff = activeThreadUnreadCutoff === null ? "none" : String(activeThreadUnreadCutoff);
    return `thread:${activeThread.id}:${cutoff}`;
  }, [activeThread, activeThreadUnreadCutoff, activeThreadUnreadMarkerIndex]);
  const systemUnreadMarkerKey = useMemo(() => {
    if (!activeSystemView || systemUnreadMarkerIndex < 0) return null;
    const cutoff = systemUnreadCutoff === null ? "none" : String(systemUnreadCutoff);
    return `system:${cutoff}`;
  }, [activeSystemView, systemUnreadCutoff, systemUnreadMarkerIndex]);
  const showThreadUnreadMarker = Boolean(
    activeThreadUnreadMarkerKey && !dismissedUnreadMarkers[activeThreadUnreadMarkerKey]
  );
  const showSystemUnreadMarker = Boolean(
    systemUnreadMarkerKey && !dismissedUnreadMarkers[systemUnreadMarkerKey]
  );
  const currentUnreadMarkerKey = activeSystemView ?
  showSystemUnreadMarker ? systemUnreadMarkerKey : null :
  showThreadUnreadMarker ? activeThreadUnreadMarkerKey : null;

  const dismissUnreadMarker = useCallback((markerKey) => {
    if (!markerKey) return;
    setDismissedUnreadMarkers((prev) => {
      if (prev[markerKey]) return prev;
      const next = { ...prev, [markerKey]: true };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(UNREAD_MARKER_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
    const timerId = unreadMarkerTimersRef.current.get(markerKey);
    if (timerId) {
      window.clearTimeout(timerId);
      unreadMarkerTimersRef.current.delete(markerKey);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(UNREAD_MARKER_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        setDismissedUnreadMarkers(parsed);
      }
    } catch {

      // Ignore malformed storage data and start fresh.
    }}, []);

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
          limit: 100
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
    async (threadId, threadSnapshot = null) => {
      if (!threadId || !dbUserId) return;
      ensureMobileConversationHistory();
      if (isMobileView) {
        setMobilePanelView("conversation");
      }
      const referenceThread =
      threadSnapshot || threads.find((thread) => thread.id === threadId) || null;
      const currentMember = (referenceThread?.members || []).find(
        (member) => member.userId === dbUserId
      );
      setActiveThreadUnreadCutoff(
        referenceThread?.hasUnread ? currentMember?.lastReadAt || null : false
      );
      setActiveSystemView(false);
      setActiveThreadId(threadId);
      setLoadingMessages(true);
      setConversationError("");
      try {
        const payload = await listThreadMessages(threadId, {
          userId: dbUserId
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
    [dbUserId, ensureMobileConversationHistory, isMobileView, listThreadMessages, setThreads, threads]
  );

  const openSystemNotificationsThread = useCallback(() => {
    ensureMobileConversationHistory();
    if (isMobileView) {
      setMobilePanelView("conversation");
    }
    setSystemUnreadCutoff(lastSystemViewedAt || null);
    setActiveSystemView(true);
    setActiveThreadId(null);
    setMessages([]);
    setLoadingMessages(false);
    setConversationError("");
    setLastSystemViewedAt(new Date().toISOString());
  }, [ensureMobileConversationHistory, isMobileView, lastSystemViewedAt]);

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
          body: JSON.stringify({
            decision,
            reason,
            threadId: activeThreadId,
            messageId: message.id
          })
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Unable to process leave request.");
        }

        if (leaveDeclineModal.open) {
          setLeaveDeclineModal({ open: false, message: null });
          setLeaveDeclineReason("");
        }

        await openThread(activeThreadId, activeThread);
        await fetchThreads();
      } catch (error) {
        console.error("Failed to process leave request decision:", error);
        setLeaveDecisionError(error.message || "Unable to process leave request.");
        setConversationError(error.message || "Unable to process leave request.");
      } finally {
        setLeaveDecisionBusy(false);
      }
    },
    [activeThread, activeThreadId, fetchThreads, leaveDeclineModal.open, openThread]
  );

  const handleApproveLeaveRequest = useCallback(
    async (message) => {
      await submitLeaveDecision(message, "approve");
    },
    [submitLeaveDecision]
  );

  const handleOpenDeclineLeaveRequest = useCallback((message) => {
    setLeaveDecisionError("");
    setLeaveDeclineReason("");
    setLeaveDeclineModal({ open: true, message });
  }, []);

  const handleConfirmDeclineLeaveRequest = useCallback(async () => {
    if (!leaveDeclineReason.trim() || !leaveDeclineModal.message) {
      setLeaveDecisionError("Enter a reason before declining this leave request.");
      return;
    }
    await submitLeaveDecision(leaveDeclineModal.message, "decline", leaveDeclineReason.trim());
  }, [leaveDeclineModal.message, leaveDeclineReason, submitLeaveDecision]);

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
        customerQuery
      });
      const nextThread = payload?.thread || payload?.data;
      if (!nextThread?.id) {
        throw new Error("Customer conversation could not be created.");
      }
      mergeThread(nextThread);
      await fetchThreads();
      return {
        thread: nextThread,
        customer: payload?.customer || null
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
          targetUserId
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
        memberIds: selectedRecipients.map((user) => user.id)
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
  selectedRecipients]
  );

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
  startDirectThread]
  );

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
        const filtered = availableCommands.filter((cmd) =>
        cmd.pattern.toLowerCase().startsWith(searchTerm) ||
        cmd.command.toLowerCase().includes(searchTerm) ||
        searchTerm === '' && cmd.pattern === '' // Show /[number] when typing just /
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
            customerQuery: addCustomerQuery
          });
          targetThreadId = nextThread.id;
          cleanedContent = stripAddCustomerCommands(messageDraft);
          if (!cleanedContent) {
            const label =
            customer?.name || customer?.email || addCustomerQuery;
            cleanedContent = label ?
            `Customer ${label} was added to this chat.` :
            "Customer invited to this chat.";
          }
        }

        const finalContent = cleanedContent.trim();
        if (!finalContent) {
          throw new Error("Message is empty after processing commands.");
        }

        const replyMetadata = replyTo ?
        {
          replyTo: {
            id: replyTo.id,
            senderName: replyTo.sender?.name || "Unknown",
            contentSnippet: String(replyTo.content || "").slice(0, 200)
          }
        } :
        null;
        const mergedMetadata = {
          ...(parsedMetadata || {}),
          ...(replyMetadata || {})
        };
        const payload = await sendThreadMessage(targetThreadId, {
          senderId: dbUserId,
          content: finalContent,
          metadata: Object.keys(mergedMetadata).length ? mergedMetadata : null
        });
        const newMessage = payload?.data || payload?.message;
        if (!newMessage) throw new Error("Message payload missing.");
        setMessageDraft("");
        setReplyTo(null);
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
    replyTo,
    sendThreadMessage]

  );

  useEffect(() => {
    if (!dbUserId) return;
    fetchThreads();
  }, [dbUserId, fetchThreads]);

  // Deep-link from job card: find customer thread and pre-fill /job command
  useEffect(() => {
    if (deepLinkProcessedRef.current) return; // Only run once
    if (!router.isReady || !threads.length || loadingThreads) return; // Wait for threads to load
    const { jobNumber, customerEmail, customerName } = router.query; // Read job card params
    if (!jobNumber) return; // No deep-link params present

    deepLinkProcessedRef.current = true; // Mark as processed

    // Find a thread that has a member matching the customer email or name
    const normalise = (value = "") => (value || "").toLowerCase().trim();
    const customerThread = threads.find((thread) => {
      const members = thread.members || [];
      return members.some((member) => {
        const profile = member.profile || {};
        const role = normalise(member.role);
        const isCustomerRole = role.includes("customer");
        if (!isCustomerRole) return false; // Only match customer members
        if (customerEmail && normalise(profile.email) === normalise(customerEmail)) return true;
        if (customerName && normalise(profile.name) === normalise(customerName)) return true;
        return false;
      });
    });

    if (customerThread && !isMobileView) {
      openThread(customerThread.id, customerThread); // Open the matching thread
      setMessageDraft(`/job${jobNumber} `); // Pre-fill draft with job reference
    } else {
      // No existing customer thread found — pre-fill draft for when user starts a new conversation
      setMessageDraft(`/job${jobNumber} `);
    }

    // Clean query params from URL without navigation
    router.replace("/messages", undefined, { shallow: true });
  }, [isMobileView, router.isReady, router.query, threads, loadingThreads, openThread]);

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
          exclude: dbUserId
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
        const { data, error } = await supabase.
        from("notifications").
        select("notification_id, message, created_at, target_role").
        or("target_role.ilike.%customer%,target_role.is.null").
        order("created_at", { ascending: false }).
        limit(5);
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
    const channel = supabase.
    channel("admin-system-notifications").
    on(
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
    ).
    subscribe();

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
      const refreshFromMessageChange = (payload) => {
        const row = payload?.new;
        if (!row) return;
        fetchThreads();
        if (activeThread && activeThread.id === row.thread_id && row.sender_id !== dbUserId) {
          openThread(activeThread.id, { ...activeThread, hasUnread: false });
        }
      };

      channel.on(
        "postgres_changes",
        {
          schema: "public",
          table: "messages",
          event: "INSERT",
          filter: `thread_id=in.(${threadIds.join(",")})`
        },
        refreshFromMessageChange
      );
      channel.on(
        "postgres_changes",
        {
          schema: "public",
          table: "messages",
          event: "UPDATE",
          filter: `thread_id=in.(${threadIds.join(",")})`
        },
        refreshFromMessageChange
      );
    }

    channel.on(
      "postgres_changes",
      {
        schema: "public",
        table: "message_thread_members",
        event: "UPDATE",
        filter: `user_id=eq.${dbUserId}`
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
    if (!visibleThreads.length) {
      setActiveThreadId(null);
      setMessages([]);
      return;
    }
    if (isMobileView) {
      return;
    }
    if (activeSystemView) {
      return;
    }
    if (!activeThreadId) {
      openThread(visibleThreads[0].id, visibleThreads[0]);
    }
  }, [visibleThreads, activeThreadId, activeSystemView, isMobileView, openThread]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!isMobileView || mobilePanelView !== "conversation") return;
    const frame = window.requestAnimationFrame(() => {
      if (!scrollerRef.current) return;
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeThreadId, activeSystemView, isMobileView, messages.length, mobilePanelView]);

  useEffect(() => {
    const previousKey = activeUnreadMarkerKeyRef.current;
    if (previousKey && previousKey !== currentUnreadMarkerKey) {
      dismissUnreadMarker(previousKey);
    }
    activeUnreadMarkerKeyRef.current = currentUnreadMarkerKey;
  }, [currentUnreadMarkerKey, dismissUnreadMarker]);

  useEffect(() => {
    if (!showThreadUnreadMarker || !activeThreadUnreadMarkerKey || !threadUnreadMarkerEl) return;
    if (dismissedUnreadMarkers[activeThreadUnreadMarkerKey]) return;
    let observer = null;
    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (unreadMarkerTimersRef.current.has(activeThreadUnreadMarkerKey)) return;
        const timeoutId = window.setTimeout(() => {
          dismissUnreadMarker(activeThreadUnreadMarkerKey);
        }, 30000);
        unreadMarkerTimersRef.current.set(activeThreadUnreadMarkerKey, timeoutId);
      },
      { threshold: 0.25 }
    );
    observer.observe(threadUnreadMarkerEl);
    return () => {
      if (observer) observer.disconnect();
    };
  }, [
  showThreadUnreadMarker,
  activeThreadUnreadMarkerKey,
  threadUnreadMarkerEl,
  dismissUnreadMarker,
  dismissedUnreadMarkers]
  );

  useEffect(() => {
    if (!showSystemUnreadMarker || !systemUnreadMarkerKey || !systemUnreadMarkerEl) return;
    if (dismissedUnreadMarkers[systemUnreadMarkerKey]) return;
    let observer = null;
    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (unreadMarkerTimersRef.current.has(systemUnreadMarkerKey)) return;
        const timeoutId = window.setTimeout(() => {
          dismissUnreadMarker(systemUnreadMarkerKey);
        }, 30000);
        unreadMarkerTimersRef.current.set(systemUnreadMarkerKey, timeoutId);
      },
      { threshold: 0.25 }
    );
    observer.observe(systemUnreadMarkerEl);
    return () => {
      if (observer) observer.disconnect();
    };
  }, [
  showSystemUnreadMarker,
  systemUnreadMarkerKey,
  systemUnreadMarkerEl,
  dismissUnreadMarker,
  dismissedUnreadMarkers]
  );

  useEffect(
    () => () => {
      const activeKey = activeUnreadMarkerKeyRef.current;
      if (activeKey) dismissUnreadMarker(activeKey);
      unreadMarkerTimersRef.current.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      unreadMarkerTimersRef.current.clear();
    },
    [dismissUnreadMarker]
  );

  // Dismiss the unread marker when the user switches away (tab hidden / page reload)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        const activeKey = activeUnreadMarkerKeyRef.current;
        if (activeKey) dismissUnreadMarker(activeKey);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [dismissUnreadMarker]);

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
    groupSearchTerm.trim().length < 2)
    {
      setGroupSearchResults([]);
      setGroupSearchLoading(false);
      return;
    }

    let cancelled = false;
    setGroupSearchLoading(true);
    const excludeIds = [
    ...new Set([
    ...(activeThread?.members || []).map((member) => member.userId),
    dbUserId]
    )].
    join(",");

    const runSearch = async () => {
      try {
        const payload = await listDirectoryUsers({
          q: groupSearchTerm,
          exclude: excludeIds
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
          userIds: [userId]
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
          userIds: [userId]
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
        title: groupEditTitle
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
  setThreadSelectionMode]
  );

  const handleCloseSelectionMode = useCallback(() => {
    setThreadSelectionMode(false);
    setSelectedThreadIds([]);
    setThreadDeleteError("");
  }, []);

  const canSend = Boolean(
    messageDraft.trim() && activeThread && !loadingMessages && !sending
  );

  const canInitiateChat =
  composeMode === "direct" ?
  selectedRecipients.length === 1 :
  selectedRecipients.length > 0;

  if (!user) {
    return <MessagesPageUi view="section1" />;




  }

  return <MessagesPageUi view="section2" activeSystemView={activeSystemView} activeThread={activeThread} activeThreadId={activeThreadId} activeThreadUnreadMarkerIndex={activeThreadUnreadMarkerIndex} availableCommands={availableCommands} Button={Button} canEditGroup={canEditGroup} canInitiateChat={canInitiateChat} canSend={canSend} cardStyle={cardStyle} Chip={Chip} closeGroupEditModal={closeGroupEditModal} closeNewChatModal={closeNewChatModal} ColleagueRowsSkeleton={ColleagueRowsSkeleton} commandHelpOpen={commandHelpOpen} commandSuggestions={commandSuggestions} composeError={composeError} composeMode={composeMode} ComposeToggleButton={ComposeToggleButton} conversationError={conversationError} dbUserId={dbUserId} DevLayoutSection={DevLayoutSection} directory={directory} directoryLoading={directoryLoading} directorySearch={directorySearch} filteredThreads={filteredThreads} formatNotificationTimestamp={formatNotificationTimestamp} groupEditBusy={groupEditBusy} groupEditError={groupEditError} groupEditModalOpen={groupEditModalOpen} groupEditTitle={groupEditTitle} groupLeaderCount={groupLeaderCount} groupManageBusy={groupManageBusy} groupManageError={groupManageError} groupMembersModalOpen={groupMembersModalOpen} groupName={groupName} groupSearchLoading={groupSearchLoading} groupSearchResults={groupSearchResults} groupSearchTerm={groupSearchTerm} handleAddMemberToGroup={handleAddMemberToGroup} handleApproveLeaveRequest={handleApproveLeaveRequest} handleCloseSelectionMode={handleCloseSelectionMode} handleConfirmDeclineLeaveRequest={handleConfirmDeclineLeaveRequest} handleDeleteSelectedThreads={handleDeleteSelectedThreads} handleDirectoryUser={handleDirectoryUser} handleInsertCommandFromHelp={handleInsertCommandFromHelp} handleMessageDraftChange={handleMessageDraftChange} handleMobileBack={handleMobileBack} handleOpenDeclineLeaveRequest={handleOpenDeclineLeaveRequest} handleOpenNewChatModal={handleOpenNewChatModal} handleRemoveMemberFromGroup={handleRemoveMemberFromGroup} handleSaveGroupDetails={handleSaveGroupDetails} handleSelectCommand={handleSelectCommand} handleSendMessage={handleSendMessage} handleStartChat={handleStartChat} handleThreadCheckboxChange={handleThreadCheckboxChange} hasSystemUnread={hasSystemUnread} InlineLoading={InlineLoading} InputField={InputField} isGroupChat={isGroupChat} isGroupLeader={isGroupLeader} isMobileView={isMobileView} isRecipientSelected={isRecipientSelected} leaveDecisionBusy={leaveDecisionBusy} leaveDecisionError={leaveDecisionError} leaveDeclineModal={leaveDeclineModal} leaveDeclineReason={leaveDeclineReason} loadingMessages={loadingMessages} loadingThreads={loadingThreads} MessageBubble={MessageBubble} MessageBubblesSkeleton={MessageBubblesSkeleton} messageDraft={messageDraft} messageReactions={messageReactions} messages={messages} mobilePanelView={mobilePanelView} ModalPortal={ModalPortal} newChatModalOpen={newChatModalOpen} openGroupEditModal={openGroupEditModal} openSystemNotificationsThread={openSystemNotificationsThread} openThread={openThread} orderedSystemNotifications={orderedSystemNotifications} palette={palette} radii={radii} replyTo={replyTo} scrollerRef={scrollerRef} SearchBar={SearchBar} SectionTitle={SectionTitle} selectedRecipients={selectedRecipients} selectedThreadIds={selectedThreadIds} sending={sending} setCommandHelpOpen={setCommandHelpOpen} setComposeError={setComposeError} setComposeMode={setComposeMode} setDirectorySearch={setDirectorySearch} setGroupEditTitle={setGroupEditTitle} setGroupMembersModalOpen={setGroupMembersModalOpen} setGroupName={setGroupName} setGroupSearchTerm={setGroupSearchTerm} setLeaveDecisionError={setLeaveDecisionError} setLeaveDeclineModal={setLeaveDeclineModal} setLeaveDeclineReason={setLeaveDeclineReason} setMessageReactions={setMessageReactions} setReplyTo={setReplyTo} setSelectedRecipients={setSelectedRecipients} setSelectedThreadIds={setSelectedThreadIds} setSystemUnreadMarkerEl={setSystemUnreadMarkerEl} setThreadSearchTerm={setThreadSearchTerm} setThreadSelectionMode={setThreadSelectionMode} setThreadUnreadMarkerEl={setThreadUnreadMarkerEl} shadows={shadows} showCommandSuggestions={showCommandSuggestions} showSystemUnreadMarker={showSystemUnreadMarker} showThreadUnreadMarker={showThreadUnreadMarker} StatusMessage={StatusMessage} systemError={systemError} systemLoading={systemLoading} systemTimestampLabel={systemTimestampLabel} systemTitleColor={systemTitleColor} systemUnreadMarkerIndex={systemUnreadMarkerIndex} threadDeleteBusy={threadDeleteBusy} threadDeleteError={threadDeleteError} ThreadRowsSkeleton={ThreadRowsSkeleton} threadSearchTerm={threadSearchTerm} threadSelectionMode={threadSelectionMode} unreadBackgroundColor={unreadBackgroundColor} user={user} userNameColor={userNameColor} visibleThreads={visibleThreads} />;



















































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































}

export default MessagesPage;
