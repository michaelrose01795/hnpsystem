// file location: src/components/HR/MetricCard.js
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
      style={{
        background: "var(--surface)",
        borderRadius: "16px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        boxShadow: "0 8px 20px rgba(var(--accent-purple-rgb), 0.08)",
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
            borderRadius: "999px",
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

export function SectionCard({ title, subtitle, action, children }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 6px 18px rgba(var(--accent-purple-rgb), 0.05)",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
        flex: 1,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--accent-purple)" }}>
            {title}
          </div>
          {subtitle ? (
            <div style={{ fontSize: "0.85rem", color: "var(--info)", marginTop: "4px" }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
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
        borderRadius: "999px",
        padding: "4px 10px",
      }}
    >
      {label}
    </span>
  );
}
