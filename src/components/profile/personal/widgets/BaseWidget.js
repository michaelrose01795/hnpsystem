import React from "react";
import { StatusBadge, SurfacePanel } from "@/components/profile/personal/widgets/shared";

export default function BaseWidget({
  title,
  subtitle,
  accent,
  monthLabel = "",
  statusLabel = "",
  summary = null,
  children,
  onOpenSettings,
  compact = false,
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        height: "100%",
        minHeight: 0,
        background: "var(--surface)",
        borderTop: `2px solid ${accent || "rgba(var(--accent-purple-rgb), 0.2)"}`,
        borderRadius: "18px",
        border: "1px solid rgba(var(--accent-purple-rgb), 0.14)",
        boxShadow: "var(--shadow-md)",
        padding: "10px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "flex-start",
          borderRadius: "12px",
          padding: "10px 12px",
          background: "rgba(var(--primary-rgb), 0.04)",
        }}
      >
        <div style={{ display: "grid", gap: "6px", minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "0.94rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </div>
            {subtitle ? <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{subtitle}</div> : null}
          </div>
          {monthLabel || statusLabel ? (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              {monthLabel ? <StatusBadge tone="neutral">{monthLabel}</StatusBadge> : null}
              {statusLabel ? (
                <StatusBadge tone={statusLabel === "Actual" ? "positive" : statusLabel === "Projected" ? "warning" : "info"}>
                  {statusLabel}
                </StatusBadge>
              ) : null}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {onOpenSettings ? (
            <button
              type="button"
              onClick={onOpenSettings}
              style={{
                border: "1px solid rgba(var(--accent-purple-rgb), 0.18)",
                borderRadius: "999px",
                padding: "7px 10px",
                background: "rgba(var(--surface-rgb, 255, 255, 255), 0.82)",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "0.76rem",
              }}
            >
              Settings
            </button>
          ) : null}
        </div>
      </div>

      {summary ? <SurfacePanel style={{ padding: "8px", borderColor: "rgba(var(--accent-purple-rgb), 0.08)" }}>{summary}</SurfacePanel> : null}

      <SurfacePanel
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          minHeight: 0,
          flex: 1,
          overflow: compact ? "visible" : "auto",
          borderColor: "rgba(var(--accent-purple-rgb), 0.08)",
        }}
      >
        {children}
      </SurfacePanel>
    </div>
  );
}
