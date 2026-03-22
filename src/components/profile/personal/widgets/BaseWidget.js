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
  onRemove,
  onOpenSettings,
  dragHandleProps = null,
  resizeHandleProps = null,
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
        background:
          `linear-gradient(180deg, color-mix(in srgb, ${accent || "var(--accent-purple)"} 18%, var(--surface) 82%) 0%, color-mix(in srgb, ${accent || "var(--accent-purple)"} 10%, var(--surface) 90%) 100%)`,
        borderRadius: "20px",
        border: "1px solid rgba(var(--accent-purple-rgb), 0.18)",
        boxShadow: "var(--shadow-lg)",
        padding: "10px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {!compact && dragHandleProps ? (
        <div
          {...dragHandleProps}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "24px",
            background: "rgba(var(--primary-rgb), 0.09)",
            borderTopLeftRadius: "14px",
            borderTopRightRadius: "14px",
            cursor: "move",
            userSelect: "none",
            touchAction: "none",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: "42px",
              height: "5px",
              borderRadius: "999px",
              background: "rgba(var(--primary-rgb), 0.35)",
            }}
          />
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "flex-start",
          background: "rgba(var(--primary-rgb), 0.08)",
          borderRadius: "14px",
          padding: "10px 12px",
        }}
      >
        <div style={{ display: "grid", gap: "6px", minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "0.96rem",
                fontWeight: 700,
                color: accent || "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </div>
            {subtitle ? (
              <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                {subtitle}
              </div>
            ) : null}
          </div>
          {monthLabel || statusLabel ? (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              {monthLabel ? <StatusBadge tone="neutral">{monthLabel}</StatusBadge> : null}
              {statusLabel ? (
                <StatusBadge
                  tone={
                    statusLabel === "Actual"
                      ? "positive"
                      : statusLabel === "Projected"
                        ? "warning"
                        : "info"
                  }
                >
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
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              style={{
                border: "none",
                borderRadius: "999px",
                padding: "7px 10px",
                background: "rgba(198, 40, 40, 0.1)",
                color: "var(--danger, #c62828)",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "0.76rem",
              }}
            >
              Hide
            </button>
          ) : null}
        </div>
      </div>

      {summary ? <SurfacePanel style={{ padding: "8px" }}>{summary}</SurfacePanel> : null}

      <SurfacePanel
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          minHeight: 0,
          flex: 1,
          overflow: "auto",
        }}
      >
        {children}
      </SurfacePanel>

      {!compact && resizeHandleProps ? (
        <div
          aria-hidden="true"
          {...resizeHandleProps}
          style={{
            position: "absolute",
            right: "10px",
            bottom: "10px",
            width: "22px",
            height: "22px",
            borderRight: "2px solid rgba(var(--primary-rgb), 0.45)",
            borderBottom: "2px solid rgba(var(--primary-rgb), 0.45)",
            cursor: "nwse-resize",
            background: "rgba(var(--primary-rgb), 0.08)",
            borderBottomRightRadius: "10px",
            touchAction: "none",
          }}
        />
      ) : null}
    </div>
  );
}
