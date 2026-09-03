// file location: src/features/websiteManager/helpers.js
// Shared, stateless helpers + tiny presentational atoms for the Website Manager.
// Kept inside the feature folder because they are specific to this tool.
//
// 2026-09-01: the `cellStyle` / `headCellStyle` inline style objects and the
// bare-paragraph `EmptyState` that used to live here are gone. `.app-data-table`
// in staffglobal.css already paints cell padding and the --separating-line row
// rule, and `@/components/ui/EmptyState` is the canonical empty surface for the
// whole app — the local copies were making Website Manager tables and empty
// states look subtly different from every other staff page.
import React from "react";
import LayerTheme from "@/components/ui/LayerTheme";

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
export function makeId(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// Slugifies free text into the stable text PK the website_* tables use.
// "Sell Your Car" -> "sell-your-car". Used when staff add a nav link or a
// section so they never have to invent an id by hand.
export function slugify(text, fallback = "item") {
  const slug = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

// Small status pill reused by every panel.
export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status || "—", badgeClass: "app-badge--neutral" };
  return (
    <span className={`app-badge ${meta.badgeClass} app-badge--uppercase`}>
      {meta.label}
    </span>
  );
}

// One headline figure. A <LayerTheme> so it alternates correctly inside a
// <Section> (which is a LayerSurface) — see CLAUDE.md §3.0.
export function StatCard({ label, value, hint }) {
  return (
    <LayerTheme gap="var(--space-1)">
      <span className="website-manager__stat-label">{label}</span>
      <span className="website-manager__stat-value">{value}</span>
      {hint ? <span className="website-manager__stat-label">{hint}</span> : null}
    </LayerTheme>
  );
}
