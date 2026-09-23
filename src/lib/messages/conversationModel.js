// file location: src/lib/messages/conversationModel.js
//
// The /messages conversation vocabulary. PLAIN DATA + pure helpers only, so it
// is safe to import from the browser, from API routes and from the DB helper.
// No React, no Supabase, no Node built-ins.
//
// Everything the messaging hub can label, filter or badge on is declared here
// once — conversation types, statuses, priorities, notification levels, the
// DMS record types a conversation can link to, and the slash-command grammar.
// If a value is not in one of these lists, it does not exist.

import { AVAILABLE_DEPARTMENTS } from "@/lib/news/constants";

// ---------------------------------------------------------------------------
// Conversation types
//
// `tone` is an .app-badge modifier. Customer conversations are the only
// externally visible ones, so they carry the warning tone everywhere they are
// labelled — the visual promise that "the customer reads this".
// ---------------------------------------------------------------------------
export const CONVERSATION_TYPES = [
  { value: "staff", label: "Staff", tone: "neutral", external: false, description: "Direct or group chat between colleagues." },
  { value: "customer", label: "Customer", tone: "warning", external: true, description: "Shared with a customer. Everything sent here is visible to them." },
  { value: "department", label: "Department", tone: "accent-soft", external: false, description: "A standing chat for one department." },
  { value: "job", label: "Job", tone: "accent-soft", external: false, description: "Internal chat about a single job card." },
  { value: "announcement", label: "Announcement", tone: "accent-strong", external: false, description: "Leaders post, everyone else reads and reacts." },
  { value: "system", label: "System", tone: "neutral", external: false, description: "Automated, read-only alerts." },
];

export const CONVERSATION_TYPE_VALUES = CONVERSATION_TYPES.map((entry) => entry.value);

export const getConversationType = (value) =>
  CONVERSATION_TYPES.find((entry) => entry.value === value) || CONVERSATION_TYPES[0];

// Types a member can create from the "New conversation" popup. System and
// customer conversations are created by the DMS itself (system feed, /addcust,
// job-card "message customer"), never from scratch.
export const CREATABLE_TYPES = ["staff", "department", "job", "announcement"];

// ---------------------------------------------------------------------------
// Status & priority — only meaningful on work conversations (customer, job,
// department). A plain staff DM has neither.
// ---------------------------------------------------------------------------
export const STATUSES = [
  { value: "open", label: "Open", tone: "accent-soft" },
  { value: "pending", label: "Waiting", tone: "warning" },
  { value: "resolved", label: "Resolved", tone: "success" },
  { value: "closed", label: "Closed", tone: "neutral" },
];
export const STATUS_VALUES = STATUSES.map((entry) => entry.value);
export const getStatus = (value) => STATUSES.find((entry) => entry.value === value) || STATUSES[0];

export const PRIORITIES = [
  { value: "low", label: "Low", tone: "neutral", rank: 0 },
  { value: "normal", label: "Normal", tone: "neutral", rank: 1 },
  { value: "high", label: "High", tone: "warning", rank: 2 },
  { value: "urgent", label: "Urgent", tone: "danger", rank: 3 },
];
export const PRIORITY_VALUES = PRIORITIES.map((entry) => entry.value);
export const getPriority = (value) =>
  PRIORITIES.find((entry) => entry.value === value) || PRIORITIES[1];

export const typeSupportsWorkflow = (type) => ["customer", "job", "department"].includes(type);

// ---------------------------------------------------------------------------
// Per-member notification level
// ---------------------------------------------------------------------------
export const NOTIFICATION_LEVELS = [
  { value: "all", label: "All messages", description: "Unread badge for every new message." },
  { value: "mentions", label: "Mentions only", description: "Only flag the chat when someone @mentions you." },
  { value: "none", label: "Muted", description: "Never flag this chat as unread." },
];
export const NOTIFICATION_LEVEL_VALUES = NOTIFICATION_LEVELS.map((entry) => entry.value);

export const DEPARTMENTS = AVAILABLE_DEPARTMENTS.filter((name) => name !== "General");

// ---------------------------------------------------------------------------
// Linked DMS records
//
// Every href here is a route that exists in src/pages — checked against the
// tree, so a link chip never 404s.
// ---------------------------------------------------------------------------
export const LINK_TYPES = [
  {
    value: "job_card",
    label: "Job",
    command: "job",
    buildHref: (id) => `/job-cards/${encodeURIComponent(id)}`,
  },
  {
    value: "customer",
    label: "Customer",
    command: "cust",
    buildHref: (id) => `/customers/${encodeURIComponent(id)}`,
  },
  {
    value: "vehicle",
    label: "Vehicle",
    command: "reg",
    // Vehicles have no page of their own; the job list filters by reg.
    buildHref: (id) => `/job-cards?search=${encodeURIComponent(id)}`,
  },
  {
    value: "part",
    label: "Part",
    command: "part",
    buildHref: (id) => `/stock-catalogue?partNumber=${encodeURIComponent(id)}`,
  },
  {
    value: "appointment",
    label: "Appointment",
    command: "appt",
    buildHref: (id) => `/appointments?jobNumber=${encodeURIComponent(id)}`,
  },
  {
    value: "invoice",
    label: "Invoice",
    command: "invoice",
    buildHref: (id) => `/accounts/invoices/${encodeURIComponent(id)}`,
  },
];
export const LINK_TYPE_VALUES = LINK_TYPES.map((entry) => entry.value);
export const getLinkType = (value) => LINK_TYPES.find((entry) => entry.value === value) || null;

export const resolveLinkHref = (link) => {
  if (!link) return null;
  if (link.href) return link.href;
  const type = getLinkType(link.recordType);
  return type && link.recordId ? type.buildHref(String(link.recordId)) : null;
};

export const linkKey = (link) => `${link?.recordType}:${String(link?.recordId || "").toLowerCase()}`;

// Validates and de-duplicates a client-supplied link list. Anything that is not
// a known record type with an id is dropped, so the column only ever holds
// well-formed rows.
export const sanitizeLinks = (links = []) => {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(links) ? links : []) {
    const recordType = String(raw?.recordType || "").trim();
    const recordId = String(raw?.recordId || "").trim().slice(0, 80);
    if (!LINK_TYPE_VALUES.includes(recordType) || !recordId) continue;
    const link = {
      recordType,
      recordId,
      label: String(raw?.label || recordId).trim().slice(0, 120),
      href: resolveLinkHref({ recordType, recordId, href: raw?.href }) || null,
    };
    const key = linkKey(link);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(link);
  }
  return out.slice(0, 40);
};

// ---------------------------------------------------------------------------
// Deriving the type of a legacy thread
//
// Threads created before the conversation hub have no conversation_type, so
// the type is inferred from what they already are.
// ---------------------------------------------------------------------------
const memberIsCustomer = (member) =>
  String(member?.role || member?.profile?.role || "").toLowerCase().includes("customer");

// Demo conversations seeded for the All Access account
// (tools/scripts/seed-all-access-messages.js) carry this prefix in front of an
// ordinary hash, so they can never collide with — or be joined as — a real
// standing department or job chat.
export const DEMO_HASH_PREFIX = "demo-aa:";

const stripDemoPrefix = (uniqueHash = "") => {
  const hash = String(uniqueHash || "");
  return hash.startsWith(DEMO_HASH_PREFIX) ? hash.slice(DEMO_HASH_PREFIX.length) : hash;
};

// The stable hash a conversation was created with doubles as its type marker,
// so types survive on databases where the conversation-hub migration has not
// run (createConversationThread in src/lib/database/messages.js).
const HASH_TYPE_PREFIXES = [
  ["jobteam:", "job"],
  ["department:", "department"],
  ["announcement:", "announcement"],
];

export const deriveConversationType = ({ conversationType, members = [], uniqueHash = "" } = {}) => {
  if (conversationType && CONVERSATION_TYPE_VALUES.includes(conversationType)) {
    // A job/staff chat that a customer was later invited into is customer-facing.
    if (conversationType !== "customer" && members.some(memberIsCustomer)) return "customer";
    return conversationType;
  }
  if (members.some(memberIsCustomer)) return "customer";
  const hash = stripDemoPrefix(uniqueHash);
  const match = HASH_TYPE_PREFIXES.find(([prefix]) => hash.startsWith(prefix));
  return match ? match[1] : "staff";
};

// Department name from a "department:<name>" hash.
export const departmentFromHash = (uniqueHash = "") => {
  const hash = stripDemoPrefix(uniqueHash);
  return hash.startsWith("department:") ? hash.slice("department:".length) : null;
};

// Job number from a thread's stable hash: "job:123" (customer chat for a job)
// or "jobteam:123" (internal job chat).
export const jobNumberFromHash = (uniqueHash = "") => {
  const match = stripDemoPrefix(uniqueHash).match(/^job(?:team)?:(.+)$/);
  return match ? match[1] : null;
};

// ---------------------------------------------------------------------------
// Mentions — same token as the news hub (@[Name](u:123)) so one renderer and
// one parser serve both.
// ---------------------------------------------------------------------------
const MENTION_PATTERN = /@\[([^[\]]+)\]\(u:(\d+)\)/g;

export const extractMentionIds = (text = "") =>
  Array.from(new Set([...String(text || "").matchAll(MENTION_PATTERN)].map((m) => Number(m[2]))));

export const flattenMentions = (text = "") =>
  String(text || "").replace(MENTION_PATTERN, (_m, name) => `@${name}`);

// ---------------------------------------------------------------------------
// Slash commands
//
// Two kinds:
//   • reference commands  (/job123, /reg AB12CDE, /cust Jane Smith …) stay in
//     the message as a link chip AND link that record to the conversation;
//   • action commands     (/task, /remind, /assign, /status, /priority) are
//     consumed: they change the conversation or become an action card.
//
// `roles` is the set of roles that see the command in the picker; "all" is
// everyone. The server never trusts this list — it re-checks every action it
// applies (membership, leader-only, workflow types).
// ---------------------------------------------------------------------------
export const COMMAND_GROUPS = [
  { value: "link", label: "Link a DMS record" },
  { value: "action", label: "Actions" },
  { value: "navigate", label: "Quick links" },
];

export const SLASH_COMMANDS = [
  // Link a record
  { name: "job", syntax: "/job 12345", insert: "/job ", group: "link", description: "Link a job card", roles: ["all"] },
  { name: "cust", syntax: "/cust Jane Smith", insert: "/cust ", group: "link", description: "Link a customer by name or email", roles: ["all"] },
  { name: "reg", syntax: "/reg AB12 CDE", insert: "/reg ", group: "link", description: "Link a vehicle by registration", roles: ["all"] },
  { name: "part", syntax: "/part BP123", insert: "/part ", group: "link", description: "Link a part by part number", roles: ["all"] },
  { name: "appt", syntax: "/appt 12345", insert: "/appt ", group: "link", description: "Link the appointment for a job", roles: ["all"] },
  { name: "invoice", syntax: "/invoice INV123", insert: "/invoice ", group: "link", description: "Link an invoice", roles: ["accounts", "service manager", "workshop manager", "after sales manager", "admin", "admin manager"] },
  { name: "vhc", syntax: "/vhc 12345", insert: "/vhc ", group: "link", description: "Link a job's vehicle health check", roles: ["technician", "service advisor", "service manager", "workshop manager", "admin"] },
  { name: "addcust", syntax: "/addcust jane@domain.com", insert: "/addcust ", group: "link", description: "Invite a customer into a shared chat", roles: ["service advisor", "service manager", "after sales manager", "workshop manager", "admin"] },

  // Actions
  { name: "task", syntax: "/task Order front pads", insert: "/task ", group: "action", description: "Add a task card to the conversation", roles: ["all"] },
  { name: "remind", syntax: "/remind tomorrow 09:00 Call customer", insert: "/remind ", group: "action", description: "Set a reminder (today, tomorrow, 3d, 2h or a date)", roles: ["all"] },
  { name: "assign", syntax: "/assign @Name", insert: "/assign @", group: "action", description: "Make a member the owner of this conversation", roles: ["all"] },
  { name: "status", syntax: "/status resolved", insert: "/status ", group: "action", description: "Set status: open, pending, resolved or closed", roles: ["all"] },
  { name: "priority", syntax: "/priority high", insert: "/priority ", group: "action", description: "Set priority: low, normal, high or urgent", roles: ["all"] },

  // Quick links (unchanged behaviour from the original page)
  { name: "parts", syntax: "/parts", insert: "/parts", group: "navigate", description: "Parts management", href: "/stock-catalogue", roles: ["parts", "parts manager", "admin"] },
  { name: "tracking", syntax: "/tracking", insert: "/tracking", group: "navigate", description: "Vehicle tracking", href: "/tracking/Key-Parking", roles: ["service advisor", "service manager", "workshop manager", "valet", "admin"] },
  { name: "valet", syntax: "/valet", insert: "/valet", group: "navigate", description: "Valet dashboard", href: "/valet", roles: ["valet", "service manager", "workshop manager", "admin"] },
  { name: "appointments", syntax: "/appointments", insert: "/appointments", group: "navigate", description: "Appointments diary", href: "/appointments", roles: ["service advisor", "service manager", "admin"] },
  { name: "archive", syntax: "/archive", insert: "/archive", group: "navigate", description: "Job archive", href: "/archive", roles: ["service advisor", "service manager", "workshop manager", "admin"] },
  { name: "clocking", syntax: "/clocking", insert: "/clocking", group: "navigate", description: "Time clocking", href: "/clocking", roles: ["workshop manager", "service manager", "admin"] },
  { name: "hr", syntax: "/hr", insert: "/hr", group: "navigate", description: "HR dashboard", href: "/hr/manager", roles: ["hr manager", "admin manager", "admin"] },
  { name: "myjobs", syntax: "/myjobs", insert: "/myjobs", group: "navigate", description: "My jobs", href: "/tech", roles: ["technician"] },
];

export const getAvailableSlashCommands = (roles = [], { allAccess = false } = {}) => {
  const normalized = (roles || []).map((role) => String(role || "").toLowerCase());
  if (allAccess) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (cmd) => cmd.roles.includes("all") || cmd.roles.some((role) => normalized.includes(role))
  );
};

// Suggestions for the "/" picker. `fragment` is what follows the slash.
export const matchSlashCommands = (fragment = "", available = SLASH_COMMANDS) => {
  const term = String(fragment || "").toLowerCase();
  if (!term) return available;
  return available.filter(
    (cmd) => cmd.name.startsWith(term) || cmd.description.toLowerCase().includes(term)
  );
};

// ---------------------------------------------------------------------------
// Reminder due-date grammar: today | tomorrow | Nd | Nh | Nm | YYYY-MM-DD |
// DD/MM[/YYYY] | a weekday — each optionally followed by HH:MM.
// Returns { dueAt: ISO string, rest: remaining text } or null.
// ---------------------------------------------------------------------------
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export const parseReminderWhen = (input = "", now = new Date()) => {
  const text = String(input || "").trim();
  if (!text) return null;
  const words = text.split(/\s+/);
  const first = words[0].toLowerCase();
  const base = new Date(now.getTime());
  let consumed = 1;
  let due = null;
  let relative = false;

  const rel = first.match(/^(\d{1,3})(m|h|d|w)$/);
  if (first === "today") {
    due = base;
  } else if (first === "tomorrow") {
    due = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, 9, 0);
  } else if (rel) {
    const amount = Number(rel[1]);
    const unitMs = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[rel[2]];
    due = new Date(base.getTime() + amount * unitMs);
    relative = true;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(first)) {
    const [y, m, d] = first.split("-").map(Number);
    due = new Date(y, m - 1, d, 9, 0);
  } else if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(first)) {
    const [d, m, yRaw] = first.split("/").map(Number);
    const y = yRaw ? (yRaw < 100 ? 2000 + yRaw : yRaw) : base.getFullYear();
    due = new Date(y, m - 1, d, 9, 0);
  } else if (WEEKDAYS.includes(first)) {
    const target = WEEKDAYS.indexOf(first);
    const delta = ((target - base.getDay() + 7) % 7) || 7;
    due = new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta, 9, 0);
  }
  if (!due || Number.isNaN(due.getTime())) return null;

  const timeMatch = !relative && words[1] && words[1].match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    due.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
    consumed = 2;
  } else if (first === "today" && !relative) {
    // "today" without a time means end of the working day.
    due.setHours(17, 0, 0, 0);
  }
  return { dueAt: due.toISOString(), rest: words.slice(consumed).join(" ").trim() };
};

// ---------------------------------------------------------------------------
// Parsing a drafted message.
//
// Returns:
//   content     the text that is actually sent (action commands removed)
//   references  [{ recordType, query, token }] records to resolve and link
//   task        { text } | null
//   reminder    { text, dueAt } | null
//   assign      { userId, name } | null
//   status      one of STATUS_VALUES | null
//   priority    one of PRIORITY_VALUES | null
//   addCustomer query string | null
//   errors      [string] — commands that were typed but not understood
//
// A line that STARTS with an action command is that action; reference
// commands may appear anywhere in the text.
// ---------------------------------------------------------------------------
const REFERENCE_PATTERNS = [
  // /job 123, /job123, /123 (legacy shorthand)
  { recordType: "job_card", re: /(^|\s)\/(?:job\s*)?(\d{2,10})(?=$|[\s.,!?])/gi },
  { recordType: "job_card", re: /(^|\s)\/job\s*([A-Za-z0-9-]{2,20})(?=$|[\s.,!?])/gi },
  { recordType: "vehicle", re: /(^|\s)\/reg\s+([A-Za-z0-9]{2,4}(?:\s?[A-Za-z0-9]{3})?)(?![A-Za-z0-9])/gi },
  { recordType: "part", re: /(^|\s)\/part\s*([A-Za-z0-9._-]{2,40})(?=$|[\s,!?])/gi },
  { recordType: "appointment", re: /(^|\s)\/appt\s*([A-Za-z0-9-]{1,20})(?=$|[\s.,!?])/gi },
  { recordType: "invoice", re: /(^|\s)\/invoice\s*([A-Za-z0-9-]{2,40})(?=$|[\s.,!?])/gi },
  { recordType: "vhc", re: /(^|\s)\/vhc\s*([A-Za-z0-9-]{2,20})(?=$|[\s.,!?])/gi },
];

// /cust takes the rest of the line (or a bracketed value) because a name has spaces.
const CUSTOMER_PATTERN = /(^|\s)\/cust(?:\[([^\]]+)\]|\s+([^\n/@]+?))(?=$|\n|\s\/|\s@)/gi;

export const parseDraft = (draft = "", { members = [], now = new Date() } = {}) => {
  const result = {
    content: "",
    references: [],
    task: null,
    reminder: null,
    assign: null,
    status: null,
    priority: null,
    addCustomer: null,
    errors: [],
  };
  const keptLines = [];

  for (const line of String(draft || "").split("\n")) {
    const trimmed = line.trim();
    const action = trimmed.match(/^\/(task|remind|assign|status|priority|addcust)\b\s*(.*)$/i);
    if (!action) {
      keptLines.push(line);
      continue;
    }
    const [, rawName, rawArg] = action;
    const name = rawName.toLowerCase();
    const arg = rawArg.trim().replace(/^\[(.*)\]$/, "$1").trim();

    if (name === "task") {
      if (arg) result.task = { text: arg.slice(0, 280) };
      else result.errors.push("Add the task after /task.");
      continue;
    }
    if (name === "remind") {
      const parsed = parseReminderWhen(arg, now);
      if (parsed && parsed.rest) result.reminder = { text: parsed.rest.slice(0, 280), dueAt: parsed.dueAt };
      else result.errors.push("Use /remind <when> <what>, e.g. /remind tomorrow 09:00 Call customer.");
      continue;
    }
    if (name === "status") {
      const value = arg.toLowerCase().replace("waiting", "pending");
      if (STATUS_VALUES.includes(value)) result.status = value;
      else result.errors.push(`Status must be one of: ${STATUS_VALUES.join(", ")}.`);
      continue;
    }
    if (name === "priority") {
      const value = arg.toLowerCase();
      if (PRIORITY_VALUES.includes(value)) result.priority = value;
      else result.errors.push(`Priority must be one of: ${PRIORITY_VALUES.join(", ")}.`);
      continue;
    }
    if (name === "assign") {
      const mentionIds = extractMentionIds(arg);
      const byMention = mentionIds.length
        ? members.find((m) => Number(m.userId) === mentionIds[0])
        : null;
      const plain = arg.replace(/^@/, "").toLowerCase();
      const byName =
        byMention ||
        (plain
          ? members.find((m) => String(m.profile?.name || "").toLowerCase().startsWith(plain))
          : null);
      if (byName) result.assign = { userId: Number(byName.userId), name: byName.profile?.name || "Member" };
      else result.errors.push("/assign needs a member of this conversation, e.g. /assign @Name.");
      continue;
    }
    if (name === "addcust") {
      if (arg) result.addCustomer = arg;
      else result.errors.push("Add a customer name or email after /addcust.");
      continue;
    }
  }

  const content = keptLines.join("\n").trim();
  result.content = content;

  const seen = new Set();
  const pushRef = (recordType, query, token) => {
    const key = `${recordType}:${query.toLowerCase()}`;
    if (!query || seen.has(key)) return;
    seen.add(key);
    result.references.push({ recordType, query, token: token.trim() });
  };
  for (const { recordType, re } of REFERENCE_PATTERNS) {
    for (const match of content.matchAll(re)) {
      // "/job" followed by digits is caught by the first pattern; skip the
      // alphanumeric pattern re-matching the same numbers.
      if (recordType === "job_card" && /^\d+$/.test(match[2]) && re !== REFERENCE_PATTERNS[0].re) continue;
      pushRef(recordType === "vhc" ? "job_card" : recordType, match[2].trim(), match[0]);
    }
  }
  for (const match of content.matchAll(CUSTOMER_PATTERN)) {
    pushRef("customer", (match[2] || match[3] || "").trim(), match[0]);
  }

  return result;
};

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------
export const formatClock = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

// List timestamp: time today, "Yesterday", weekday this week, else date.
export const formatListTimestamp = (value, now = new Date()) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((startOfToday - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / 86_400_000);
  if (diffDays <= 0) return formatClock(date);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString("en-GB", { weekday: "short" });
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

// Day separator label: "Today", "Yesterday", else "Tuesday 23 September".
export const formatDayLabel = (value, now = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((startOfToday - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
};

export const formatDueLabel = (value, now = new Date()) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = formatDayLabel(date, now);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  return `${isTomorrow ? "Tomorrow" : day} ${formatClock(date)}`;
};

// One-line preview of a message for the conversation list.
export const buildPreview = (message) => {
  if (!message) return "";
  const meta = message.metadata || {};
  if (meta.task) return `Task: ${meta.task.text}`;
  if (meta.reminder) return `Reminder: ${meta.reminder.text}`;
  const text = flattenMentions(message.content || "").replace(/\s+/g, " ").trim();
  if (text) return text;
  if (Array.isArray(meta.attachments) && meta.attachments.length) {
    return meta.attachments.length === 1 ? meta.attachments[0].fileName : `${meta.attachments.length} files`;
  }
  return "";
};

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------
export const ATTACHMENT_BUCKET = "message-attachments";
export const ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;
export const ATTACHMENT_MAX_PER_MESSAGE = 6;
