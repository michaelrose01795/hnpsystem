// file location: src/features/websiteManager/helpers.js
// Shared, stateless helpers + tiny presentational atoms for the Website Manager.
// Kept inside the feature folder because they are specific to this tool.
import React from "react";

// Status tokens used across the Website Manager. Pages and content blocks are
// either published or draft — a binary toggle.
export const STATUS_META = {
  published: { label: "Published", badgeClass: "app-badge--success" },
  draft: { label: "Draft", badgeClass: "app-badge--warning" },
};

export function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

export function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(iso);
  }
}

export function formatSize(kb) {
  if (kb == null) return "—";
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

// Generates a client-side unique id for records created in this tool.
// Real records will use DB-generated ids once the backend exists.
export function makeId(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// Shared table cell styling. `borderBottom: var(--separating-line)` is the one
// border permitted inside lists/tables by CLAUDE.md §3.0a.
export const cellStyle = {
  padding: "10px 10px",
  borderBottom: "var(--separating-line)",
  textAlign: "left",
  verticalAlign: "middle",
};

export const headCellStyle = {
  ...cellStyle,
  fontSize: "0.7rem",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--text-1)",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

// Small status pill reused by every panel.
export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status || "—", badgeClass: "app-badge--neutral" };
  return (
    <span className={`app-badge ${meta.badgeClass} app-badge--uppercase`}>
      {meta.label}
    </span>
  );
}

// Friendly empty-state row used inside panels.
export function EmptyState({ message }) {
  return (
    <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.9rem" }}>
      {message}
    </p>
  );
}
