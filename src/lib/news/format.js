// file location: src/lib/news/format.js
//
// Presentation helpers shared by the feed, the detail popup, the composer
// preview and the search results. Pure functions — no React, no data access —
// so the same string appears everywhere a post is rendered.

// ---------------------------------------------------------------------------
// Authors
// ---------------------------------------------------------------------------

// Authors are stored as "First Last" or the legacy "First Last — Role".
// The feed shows the name; getAuthorRole() recovers the role half when present.
export const formatAuthorName = (author) =>
  String(author || "System").split("—")[0].split(" - ")[0].trim() || "System";

export const formatAuthorRole = (author) => {
  const raw = String(author || "");
  const parts = raw.includes("—") ? raw.split("—") : raw.split(" - ");
  if (parts.length < 2) return "";
  return parts.slice(1).join(" ").trim();
};

// Two-letter monogram for the avatar fallback when a user has no photo_url.
export const getInitials = (name) => {
  const cleaned = formatAuthorName(name);
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
};

// ---------------------------------------------------------------------------
// Dates
//
// The hub shows both halves of a date deliberately: the relative age is what
// people scan for, the absolute stamp is what they need when a post refers to
// "Friday". formatPostDate() returns the pair so a card can render either.
// ---------------------------------------------------------------------------

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatTimeAgo = (value) => {
  const date = toDate(value);
  if (!date) return "Unknown time";

  const diffInMs = Date.now() - date.getTime();
  if (diffInMs < 0) return "Scheduled";

  const minutes = Math.floor(diffInMs / 60000);
  const hours = Math.floor(diffInMs / 3600000);
  const days = Math.floor(diffInMs / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
};

// "Fri 12 Sep 2025, 14:30" — UK ordering, 24-hour clock.
export const formatAbsolute = (value) => {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// "12 Sep 2025" — used where the time of day adds nothing (expiry, due dates).
export const formatDateOnly = (value) => {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Today and yesterday get a friendlier stamp than a full date.
export const formatPostDate = (value) => {
  const date = toDate(value);
  if (!date) return { relative: "Unknown time", absolute: "", short: "" };

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  let short;
  if (sameDay) short = `Today, ${time}`;
  else if (isYesterday) short = `Yesterday, ${time}`;
  else short = formatAbsolute(value);

  return { relative: formatTimeAgo(value), absolute: formatAbsolute(value), short };
};

// "in 3 days" / "2 days overdue" — used for acknowledgement due dates.
export const formatDueLabel = (value) => {
  const date = toDate(value);
  if (!date) return "";
  const diffMs = date.getTime() - Date.now();
  const days = Math.round(diffMs / 86400000);
  if (diffMs < 0) {
    const overdue = Math.abs(days);
    if (overdue === 0) return "Due today";
    return `${overdue} day${overdue === 1 ? "" : "s"} overdue`;
  }
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
};

export const isExpired = (value) => {
  const date = toDate(value);
  return Boolean(date) && date.getTime() <= Date.now();
};

// ---------------------------------------------------------------------------
// @mentions
//
// Stored inline in the post/comment body as  @[Display Name](u:123)  so the
// text stays readable in the database and the mention survives a rename of the
// user. parseMentionBody() turns it into render tokens; extractMentionIds()
// is what the server uses to write the news_mentions rows.
// ---------------------------------------------------------------------------

const MENTION_PATTERN = /@\[([^\]]+)\]\(u:(\d+)\)/g;

export const buildMentionToken = (name, userId) => `@[${name}](u:${userId})`;

export const extractMentionIds = (body) => {
  const ids = new Set();
  const text = String(body || "");
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const id = Number(match[2]);
    if (Number.isFinite(id) && id > 0) ids.add(id);
  }
  return Array.from(ids);
};

// Returns [{ type: "text" | "mention", value, userId? }] in document order.
export const parseMentionBody = (body) => {
  const text = String(body || "");
  const tokens = [];
  let cursor = 0;

  for (const match of text.matchAll(MENTION_PATTERN)) {
    if (match.index > cursor) {
      tokens.push({ type: "text", value: text.slice(cursor, match.index) });
    }
    tokens.push({ type: "mention", value: match[1], userId: Number(match[2]) });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    tokens.push({ type: "text", value: text.slice(cursor) });
  }
  return tokens;
};

// The body with mention tokens flattened to "@Display Name" — for previews,
// search snippets and anywhere a plain string is needed.
export const stripMentionTokens = (body) =>
  String(body || "").replace(MENTION_PATTERN, (_match, name) => `@${name}`);

// ---------------------------------------------------------------------------
// Snippets
// ---------------------------------------------------------------------------
export const buildSnippet = (body, length = 180) => {
  const plain = stripMentionTokens(body).replace(/\s+/g, " ").trim();
  if (plain.length <= length) return plain;
  return `${plain.slice(0, length - 1).trimEnd()}…`;
};

// Human file size for attachment rows.
export const formatFileSize = (bytes) => {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};
