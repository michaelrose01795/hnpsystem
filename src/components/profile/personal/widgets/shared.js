import React from "react";

export function formatCurrency(value) {
  return `£${Number(value || 0).toFixed(2)}`;
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

export const widgetButtonStyle = {
  border: "none",
  borderRadius: "999px",
  padding: "7px 11px",
  background: "var(--accent-purple)",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: "0.76rem",
  fontWeight: 600,
};

export const widgetGhostButtonStyle = {
  border: "1px solid rgba(var(--accent-purple-rgb), 0.24)",
  borderRadius: "999px",
  padding: "7px 11px",
  background: "rgba(var(--surface-rgb, 255, 255, 255), 0.86)",
  color: "var(--text-primary)",
  cursor: "pointer",
  fontSize: "0.76rem",
  fontWeight: 600,
};

export const widgetInputStyle = {
  width: "100%",
  borderRadius: "10px",
  border: "1px solid rgba(var(--accent-purple-rgb), 0.18)",
  background: "var(--surface)",
  color: "var(--text-primary)",
  padding: "9px 10px",
  fontSize: "0.82rem",
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

export function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: "0.78rem",
        fontWeight: 600,
        letterSpacing: "0.01em",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </div>
  );
}

export function EmptyState({ children }) {
  return (
    <div
      style={{
        borderRadius: "12px",
        border: "1px dashed rgba(var(--accent-purple-rgb), 0.24)",
        padding: "12px",
        background: "var(--surface)",
        color: "var(--text-secondary)",
        fontSize: "0.8rem",
      }}
    >
      {children}
    </div>
  );
}

export function MetricPill({ label, value, accent = "var(--accent-purple)" }) {
  return (
    <div
      style={{
        display: "grid",
        gap: "3px",
        padding: "8px 10px",
        borderRadius: "12px",
        background: "var(--surface)",
        border: "1px solid rgba(var(--accent-purple-rgb), 0.12)",
      }}
    >
      <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ fontSize: "0.92rem", color: accent, fontWeight: 700 }}>
        {value}
      </span>
    </div>
  );
}

export function SurfacePanel({ children, style = {} }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid rgba(var(--accent-purple-rgb), 0.12)",
        borderRadius: "14px",
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
      background: "rgba(46, 125, 50, 0.12)",
      color: "var(--success, #2e7d32)",
    },
    warning: {
      background: "rgba(239, 108, 0, 0.12)",
      color: "var(--warning, #ef6c00)",
    },
    neutral: {
      background: "rgba(var(--primary-rgb), 0.08)",
      color: "var(--text-secondary)",
    },
    info: {
      background: "rgba(21, 101, 192, 0.1)",
      color: "var(--info, #1565c0)",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "999px",
        padding: "5px 9px",
        fontSize: "0.68rem",
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        ...(tones[tone] || tones.info),
        ...style,
      }}
    >
      {children}
    </span>
  );
}
