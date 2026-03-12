// file location: src/components/HR/MetricCard.js
// Exports MetricCard (metric display widget) and StatusTag (status badge).
// SectionCard re-export has been removed — all consumers now import it from @/components/Section directly.
import React from "react";

export function MetricCard({
  icon,
  label,
  primary,
  secondary,
  trend,
  accentColor = "var(--info-dark)",
}) {
  return (
    <div
      className="app-section-card"
      style={{
        gap: "14px",
        minWidth: "200px",
        flex: 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "1.6rem" }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--info-dark)" }}>
          {label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
        <span style={{ fontSize: "2rem", fontWeight: 700, color: accentColor }}>
          {primary}
        </span>
        {secondary ? (
          <span style={{ color: "var(--info)", fontWeight: 500 }}>{secondary}</span>
        ) : null}
      </div>
      {trend ? (
        <span
          style={{
            backgroundColor: "rgba(var(--info-rgb), 0.08)",
            color: accentColor,
            borderRadius: "var(--radius-pill)",
            padding: "6px 12px",
            fontSize: "0.8rem",
            fontWeight: 600,
            alignSelf: "flex-start",
          }}
        >
          {trend}
        </span>
      ) : null}
    </div>
  );
}


export function StatusTag({ label, tone = "default" }) {
  const variants = {
    default: { bg: "rgba(var(--accent-purple-rgb), 0.12)", color: "var(--accent-purple)" },
    success: { bg: "rgba(var(--info-rgb), 0.12)", color: "var(--info-dark)" },
    warning: { bg: "rgba(var(--warning-rgb), 0.12)", color: "var(--warning)" },
    danger: { bg: "rgba(var(--danger-rgb), 0.12)", color: "var(--danger)" },
  };

  const palette = variants[tone] ?? variants.default;

  return (
    <span
      style={{
        backgroundColor: palette.bg,
        color: palette.color,
        fontWeight: 600,
        fontSize: "0.75rem",
        borderRadius: "var(--radius-pill)",
        padding: "4px 10px",
      }}
    >
      {label}
    </span>
  );
}
