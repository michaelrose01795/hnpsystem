// file location: src/components/HR/MetricCard.js
import React from "react";

export function MetricCard({
  icon,
  label,
  primary,
  secondary,
  trend,
  accentColor = "#1F7A8C",
}) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "16px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)",
        minWidth: "200px",
        flex: 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "1.6rem" }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "#4B5563" }}>
          {label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
        <span style={{ fontSize: "2rem", fontWeight: 700, color: accentColor }}>
          {primary}
        </span>
        {secondary ? (
          <span style={{ color: "#6B7280", fontWeight: 500 }}>{secondary}</span>
        ) : null}
      </div>
      {trend ? (
        <span
          style={{
            backgroundColor: "rgba(31, 122, 140, 0.08)",
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
        background: "white",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)",
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
          <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#111827" }}>
            {title}
          </div>
          {subtitle ? (
            <div style={{ fontSize: "0.85rem", color: "#6B7280", marginTop: "4px" }}>
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
    default: { bg: "rgba(37, 99, 235, 0.12)", color: "#2563EB" },
    success: { bg: "rgba(16, 185, 129, 0.12)", color: "#059669" },
    warning: { bg: "rgba(245, 158, 11, 0.12)", color: "#B45309" },
    danger: { bg: "rgba(239, 68, 68, 0.12)", color: "#B91C1C" },
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
