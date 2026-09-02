// file location: src/lib/news/constants.js
//
// The news / communication hub vocabulary. PLAIN DATA + pure helpers only, so
// this module is safe to import from the browser, from API routes and from the
// cron jobs alike. No React, no Supabase, no Node built-ins.
//
// Everything the feed can filter, sort or badge on is declared here once, and
// both the UI and the server validation read from it. If a value is not in one
// of these lists, it does not exist.

import { roleCategories } from "@/config/users";

// ---------------------------------------------------------------------------
// Departments — the audience a post can be targeted at.
// Kept identical to the list the original feed shipped with so existing rows
// keep resolving, then widened with the Retail/Sales role categories.
// ---------------------------------------------------------------------------
export const BASE_DEPARTMENTS = [
  "General",
  "Service",
  "Workshop",
  "Parts",
  "Sales",
  "Valeting",
  "Admin",
  "HR",
];

const CATEGORY_DEPARTMENTS = [
  ...(roleCategories?.Retail || []),
  ...(roleCategories?.Sales || []),
];

export const AVAILABLE_DEPARTMENTS = Array.from(
  new Set([...BASE_DEPARTMENTS, ...CATEGORY_DEPARTMENTS].filter(Boolean))
);

// "General" is the everyone-sees-it bucket: a post with no departments at all
// is treated as General, which is how the pre-hub feed behaved.
export const GENERAL_DEPARTMENT = "General";

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------
export const PRIORITY_NORMAL = "normal";
export const PRIORITY_IMPORTANT = "important";
export const PRIORITY_URGENT = "urgent";

export const PRIORITIES = [
  {
    value: PRIORITY_NORMAL,
    label: "Normal",
    description: "Everyday news. Sits in date order.",
    rank: 0,
  },
  {
    value: PRIORITY_IMPORTANT,
    label: "Important",
    description: "Highlighted, and sorted above normal posts.",
    rank: 1,
  },
  {
    value: PRIORITY_URGENT,
    label: "Urgent",
    description: "Top of the feed until read. Notifies everyone targeted.",
    rank: 2,
  },
];

export const PRIORITY_VALUES = PRIORITIES.map((entry) => entry.value);
export const PRIORITY_RANK = Object.fromEntries(
  PRIORITIES.map((entry) => [entry.value, entry.rank])
);

export const getPriority = (value) =>
  PRIORITIES.find((entry) => entry.value === value) || PRIORITIES[0];

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export const CATEGORIES = [
  { value: "announcement", label: "Announcement", icon: "📣" },
  { value: "operations", label: "Operations", icon: "🔧" },
  { value: "policy", label: "Policy", icon: "📋" },
  { value: "safety", label: "Health & Safety", icon: "⚠️" },
  { value: "training", label: "Training", icon: "🎓" },
  { value: "people", label: "People & HR", icon: "👥" },
  { value: "celebration", label: "Celebration", icon: "🎉" },
  { value: "event", label: "Event", icon: "📅" },
  { value: "system", label: "System", icon: "🤖" },
];

export const CATEGORY_VALUES = CATEGORIES.map((entry) => entry.value);

export const getCategory = (value) =>
  CATEGORIES.find((entry) => entry.value === value) || CATEGORIES[0];

// ---------------------------------------------------------------------------
// Lifecycle status
// ---------------------------------------------------------------------------
export const STATUS_DRAFT = "draft";
export const STATUS_SCHEDULED = "scheduled";
export const STATUS_PUBLISHED = "published";
export const STATUS_ARCHIVED = "archived";

export const STATUSES = [
  { value: STATUS_DRAFT, label: "Draft" },
  { value: STATUS_SCHEDULED, label: "Scheduled" },
  { value: STATUS_PUBLISHED, label: "Published" },
  { value: STATUS_ARCHIVED, label: "Archived" },
];

export const STATUS_VALUES = STATUSES.map((entry) => entry.value);

// ---------------------------------------------------------------------------
// Source — who wrote it
// ---------------------------------------------------------------------------
export const SOURCE_STAFF = "staff";
export const SOURCE_SYSTEM = "system";
export const SOURCE_VALUES = [SOURCE_STAFF, SOURCE_SYSTEM];

// ---------------------------------------------------------------------------
// Links from a post to a real DMS record.
//
// `href` is built here so a link rendered on a card, in the composer preview
// and in a search result always points at the same route.
// ---------------------------------------------------------------------------
export const LINK_TYPES = [
  {
    value: "job_card",
    label: "Job card",
    icon: "🗂",
    placeholder: "Job number, e.g. 24019",
    buildHref: (id) => `/job-cards/${encodeURIComponent(id)}`,
  },
  {
    value: "customer",
    label: "Customer",
    icon: "👤",
    placeholder: "Customer id",
    buildHref: (id) => `/customers?customerId=${encodeURIComponent(id)}`,
  },
  {
    value: "vehicle",
    label: "Vehicle",
    icon: "🚗",
    placeholder: "Registration",
    buildHref: (id) => `/vehicles?reg=${encodeURIComponent(id)}`,
  },
  {
    value: "appointment",
    label: "Appointment",
    icon: "📅",
    placeholder: "Appointment id",
    buildHref: (id) => `/appointments?appointmentId=${encodeURIComponent(id)}`,
  },
  {
    value: "delivery",
    label: "Delivery",
    icon: "🚚",
    placeholder: "Delivery id",
    buildHref: (id) => `/parts/deliveries?deliveryId=${encodeURIComponent(id)}`,
  },
  {
    value: "vhc",
    label: "VHC",
    icon: "🔍",
    placeholder: "VHC id",
    buildHref: (id) => `/vhc/${encodeURIComponent(id)}`,
  },
  {
    value: "stock",
    label: "Stock / part",
    icon: "📦",
    placeholder: "Part number",
    buildHref: (id) => `/parts/inventory?partNumber=${encodeURIComponent(id)}`,
  },
  {
    value: "invoice",
    label: "Invoice",
    icon: "🧾",
    placeholder: "Invoice number",
    buildHref: (id) => `/invoices?invoiceId=${encodeURIComponent(id)}`,
  },
];

export const LINK_TYPE_VALUES = LINK_TYPES.map((entry) => entry.value);

export const getLinkType = (value) =>
  LINK_TYPES.find((entry) => entry.value === value) || null;

// Resolve the route for a link row. A stored href wins (it was resolved when
// the post was written and may point somewhere more specific); otherwise the
// type's builder runs.
export const resolveLinkHref = (link) => {
  if (!link) return null;
  if (link.href) return link.href;
  const type = getLinkType(link.recordType || link.record_type);
  const id = link.recordId ?? link.record_id;
  if (!type || !id) return null;
  return type.buildHref(String(id));
};

// ---------------------------------------------------------------------------
// Feed view density
// ---------------------------------------------------------------------------
export const DENSITY_COMFORTABLE = "comfortable";
export const DENSITY_COMPACT = "compact";
export const DENSITY_VALUES = [DENSITY_COMFORTABLE, DENSITY_COMPACT];

// ---------------------------------------------------------------------------
// Feed filters (the tab row above the feed)
// ---------------------------------------------------------------------------
export const FEED_FILTER_ALL = "all";
export const FEED_FILTER_UNREAD = "unread";
export const FEED_FILTER_ACK = "action";
export const FEED_FILTER_SAVED = "saved";
export const FEED_FILTER_MENTIONS = "mentions";
export const FEED_FILTER_PINNED = "pinned";
export const FEED_FILTER_MINE = "mine";

export const FEED_FILTERS = [
  { value: FEED_FILTER_ALL, label: "All" },
  { value: FEED_FILTER_UNREAD, label: "Unread" },
  { value: FEED_FILTER_ACK, label: "Needs action" },
  { value: FEED_FILTER_MENTIONS, label: "Mentions" },
  { value: FEED_FILTER_SAVED, label: "Saved" },
  { value: FEED_FILTER_PINNED, label: "Pinned" },
];

export const FEED_FILTER_VALUES = [
  ...FEED_FILTERS.map((entry) => entry.value),
  FEED_FILTER_MINE,
];

// ---------------------------------------------------------------------------
// Digest frequency (notification preferences)
// ---------------------------------------------------------------------------
export const DIGEST_FREQUENCIES = [
  { value: "realtime", label: "As they happen" },
  { value: "daily", label: "Daily summary only" },
  { value: "off", label: "Off" },
];

export const DIGEST_VALUES = DIGEST_FREQUENCIES.map((entry) => entry.value);

// ---------------------------------------------------------------------------
// Automated post keys. Every system-generated post carries one of these as the
// prefix of its system_key, which is UNIQUE — so a re-run of the cron job
// updates the existing post rather than duplicating it.
// ---------------------------------------------------------------------------
export const SYSTEM_POST_DAILY_SUMMARY = "daily-summary";
export const SYSTEM_POST_CAPACITY_ALERT = "capacity-alert";
export const SYSTEM_POST_PARTS_BACKLOG = "parts-backlog";
export const SYSTEM_POST_VHC_BACKLOG = "vhc-backlog";
export const SYSTEM_POST_DELIVERY_LOAD = "delivery-load";

export const SYSTEM_AUTHOR = "HNPSystem — Automated";

// ---------------------------------------------------------------------------
// Attachment limits
// ---------------------------------------------------------------------------
export const ATTACHMENT_BUCKET = "news-attachments";
export const ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024; // 15 MB per file.
export const ATTACHMENT_MAX_PER_POST = 8;
export const ATTACHMENT_ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/"];
export const ATTACHMENT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
];

export const isAllowedAttachmentMime = (mimeType) => {
  const value = String(mimeType || "").toLowerCase();
  if (!value) return false;
  if (ATTACHMENT_ALLOWED_MIME_TYPES.includes(value)) return true;
  return ATTACHMENT_ALLOWED_MIME_PREFIXES.some((prefix) => value.startsWith(prefix));
};

// ---------------------------------------------------------------------------
// Department normalisation — shared by the feed, the composer and the server.
// ---------------------------------------------------------------------------
export const normalizeDepartment = (value) => {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  const key = normalized.toLowerCase();
  const match = AVAILABLE_DEPARTMENTS.find((dept) => dept.toLowerCase() === key);
  return match || normalized;
};

export const normalizeDepartments = (input) => {
  if (!input) return [];
  const list = Array.isArray(input) ? input : [input];
  return Array.from(new Set(list.map(normalizeDepartment).filter(Boolean)));
};

// Which departments a set of roles can see. Mirrors the mapping the original
// newsfeed page carried inline, kept here so the API can apply the same rule
// server-side rather than trusting the client's filter.
export const deriveDepartmentsFromRoles = (roles = [], { allAccess = false } = {}) => {
  if (allAccess) return [...AVAILABLE_DEPARTMENTS];

  const canonical = new Map(
    AVAILABLE_DEPARTMENTS.map((department) => [department.toLowerCase(), department])
  );
  const sanitize = (role) =>
    String(role || "")
      .toLowerCase()
      .replace(/[-_]/g, " ")
      .trim();

  const mapped = new Set();
  for (const role of roles) {
    const exact = canonical.get(String(role || "").trim().toLowerCase());
    if (exact) mapped.add(exact);

    const normalized = sanitize(role);
    if (!normalized) continue;
    if (
      normalized.includes("service") ||
      normalized.includes("after sales") ||
      normalized.includes("aftersales")
    ) {
      mapped.add("Service");
    }
    if (
      normalized.includes("workshop") ||
      normalized.includes("tech") ||
      normalized.includes("mot")
    ) {
      mapped.add("Workshop");
    }
    if (normalized.includes("parts")) mapped.add("Parts");
    if (normalized.includes("sales") && !normalized.includes("after sales")) {
      mapped.add("Sales");
    }
    if (normalized.includes("valet")) mapped.add("Valeting");
    if (normalized.includes("hr")) mapped.add("HR");
    if (normalized.includes("admin")) mapped.add("Admin");
  }
  return Array.from(mapped);
};

// A post is visible to a viewer when it is untargeted (General), explicitly
// General, or targeted at one of the viewer's departments.
export const isPostVisibleToDepartments = (postDepartments, viewerDepartments) => {
  const targets = Array.isArray(postDepartments) ? postDepartments : [];
  if (targets.length === 0) return true;
  if (targets.includes(GENERAL_DEPARTMENT)) return true;
  const viewer = new Set(viewerDepartments || []);
  return targets.some((department) => viewer.has(department));
};
