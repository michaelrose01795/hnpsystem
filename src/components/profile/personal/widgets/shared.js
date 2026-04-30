// file location: src/components/profile/personal/widgets/shared.js

import React from "react";
import { toNumber } from "@/lib/profile/personalFinance";

export { toNumber };

/* ── Formatters ────────────────────────────────────────────── */

export function formatCurrency(value) {
  return `£${Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(value) {
  if (!value) return "No date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ── Input styles ── */

export const widgetInputStyle = {
  width: "100%",
  minHeight: "var(--control-height-sm)",
  borderRadius: "var(--control-radius)",
  border: "var(--control-border)",
  background: "var(--control-bg)",
  color: "var(--text-1)",
  padding: "var(--control-padding-sm)",
  fontSize: "var(--control-font-size)",
  fontWeight: "var(--control-font-weight)",
  transition: "var(--control-transition)",
};

export const widgetSelectStyle = {
  ...widgetInputStyle,
  appearance: "none",
};

export const widgetTextAreaStyle = {
  ...widgetInputStyle,
  minHeight: "96px",
  resize: "vertical",
};

export const widgetAccentSurfaceStyle = {
  background: "var(--theme)",
  border: "1px solid rgba(var(--accent-base-rgb), 0.24)",
  borderRadius: "var(--radius-md)",
};

export const widgetInsetSurfaceStyle = {
  background: "var(--surface)",
  border: "1px solid rgba(var(--accent-base-rgb), 0.12)",
  borderRadius: "var(--radius-sm)",
};

export const widgetModalBackdropStyle = {
  position: "fixed",
  inset: 0,
  background: "var(--overlay)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
};

export function getWidgetModalCardStyle(isMobile = false, overrides = {}) {
  return {
    width: "100%",
    maxWidth: "min(100%, 720px)",
    maxHeight: isMobile ? "calc(100vh - 16px)" : "calc(100vh - 48px)",
    background: "rgba(var(--surface-rgb), 0.98)",
    borderRadius: isMobile ? "18px" : "22px",
    border: "1px solid rgba(var(--accent-base-rgb), 0.18)",
    boxShadow: "var(--shadow-lg)",
    padding: isMobile ? "16px" : "20px",
    display: "flex",
    flexDirection: "column",
    gap: isMobile ? "12px" : "14px",
    margin: isMobile ? "8px 0" : "18px 0",
    overflow: "hidden",
    ...overrides,
  };
}

/* ── Dashboard primitives ──────────────────────────────────── */

/** Large featured value with a small label above. */
export function Headline({ label, value, accent = "var(--text-1)", size = "large" }) {
  const valueSizes = { large: "1.45rem", medium: "1.1rem" };
  return (
    <div style={{ display: "grid", gap: "2px" }}>
      <span style={{ fontSize: "0.66rem", fontWeight: 600, color: "var(--text-1)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ fontSize: valueSizes[size] || valueSizes.large, fontWeight: 800, color: accent, lineHeight: 1.2 }}>
        {value}
      </span>
    </div>
  );
}

/** Compact key/value row for breakdowns. */
export function DataRow({ label, value, accent, muted = false }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "8px",
        padding: "5px 0",
        fontSize: "0.82rem",
        borderBottom: "1px solid rgba(var(--accent-base-rgb), 0.12)",
      }}
    >
      <span style={{ color: muted ? "var(--text-1)" : "var(--text-1)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontWeight: 700, color: accent || "var(--text-1)", whiteSpace: "nowrap", flexShrink: 0 }}>{value}</span>
    </div>
  );
}

/** Small inline metric for tight grid layouts. */
export function MetricPill({ label, value, accent = "var(--accent-base)" }) {
  return (
    <div
      style={{
        display: "grid",
        gap: "2px",
        padding: "8px 10px",
        borderRadius: "10px",
        background: "var(--surface)",
        border: "1px solid rgba(var(--accent-base-rgb), 0.12)",
        borderLeft: `2px solid ${accent}`,
      }}
    >
      <span style={{ fontSize: "0.66rem", color: "var(--text-1)", fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ fontSize: "0.88rem", color: accent, fontWeight: 700 }}>
        {value}
      </span>
    </div>
  );
}

/** Divider line between sections inside a card. */
export function CardDivider() {
  return <div style={{ borderTop: "1px solid rgba(var(--accent-base-rgb), 0.12)", margin: "4px 0" }} />;
}

export function SectionLabel({ children }) {
  const content =
    typeof children === "string"
      ? children.replace(/\s*\((?:Database|Linked)\)\s*/g, "").trim()
      : children;

  return (
    <div
      style={{
        fontSize: "0.68rem",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--text-1)",
        paddingTop: "2px",
      }}
    >
      {content}
    </div>
  );
}

export function EmptyState({ children }) {
  return (
    <div
      style={{
        borderRadius: "var(--radius-sm)",
        padding: "12px 14px",
        background: "var(--surface)",
        border: "1px solid rgba(var(--accent-base-rgb), 0.12)",
        color: "var(--text-1)",
        fontSize: "0.8rem",
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

export function SurfacePanel({ children, style = {} }) {
  return (
    <div
      style={{
        ...widgetInsetSurfaceStyle,
        padding: "10px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function StatusBadge({ children, tone = "info", style = {} }) {
  const tones = {
    positive: {
      background: "var(--success-surface)",
      color: "var(--successMain)",
    },
    warning: {
      background: "var(--warning-surface)",
      color: "var(--warningMain)",
    },
    neutral: {
      background: "var(--theme)",
      color: "var(--surfaceTextMuted)",
    },
    info: {
      background: "var(--theme)",
      color: "var(--accentText)",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "999px",
        padding: "3px 8px",
        fontSize: "0.66rem",
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        ...(tones[tone] || tones.info),
        ...style,
      }}
    >
      {children}
    </span>
  );
}
