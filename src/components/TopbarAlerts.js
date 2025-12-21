import React from "react";
import { useAlerts } from "@/context/AlertContext";
import { useTheme } from "@/styles/themeProvider";

const toneStyles = {
  success: { bg: "var(--success)", text: "var(--surface)" },
  error: { bg: "var(--danger)", text: "var(--surface)" },
  warning: { bg: "var(--danger)", text: "var(--surface)" },
  info: { bg: "var(--info)", text: "var(--accent-purple)" },
};

const getTone = (type) => toneStyles[type] || toneStyles.info;

export function AlertBadge() {
  const { alerts } = useAlerts();
  if (!alerts.length) return null;
  const latest = alerts[alerts.length - 1];
  const tone = getTone(latest.type);

  return (
    <div
      style={{
        position: "absolute",
        bottom: "-12px",
        left: "16px",
        padding: "4px 10px",
        borderRadius: "999px",
        background: tone.bg,
        color: tone.text,
        fontSize: "0.75rem",
        fontWeight: 600,
        boxShadow: "none",
        maxWidth: "220px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {alerts.length > 1 ? `${alerts.length} alerts` : latest.message}
    </div>
  );
}

export default function TopbarAlerts() {
  const { alerts, dismissAlert } = useAlerts();
  const { resolvedMode } = useTheme();
  const closeButtonColor = resolvedMode === "dark" ? "var(--accent-purple)" : "var(--danger)";
  if (!alerts.length) return null;

  const latestAlerts = alerts.slice(-1);

  return (
    <div
      style={{
        position: "fixed",
        top: "16px",
        right: "24px",
        zIndex: 1200,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        maxWidth: "360px",
      }}
    >
      {latestAlerts.map((alert) => {
        const tone = getTone(alert.type);
        return (
          <div
            key={alert.id}
            style={{
              borderRadius: "16px",
              padding: "12px 14px",
              background: tone.bg,
              color: tone.text,
              boxShadow: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
            }}
          >
            <div style={{ fontSize: "0.95rem", fontWeight: 600, flex: 1 }}>{alert.message}</div>
            <button
              type="button"
              onClick={() => dismissAlert(alert.id)}
              style={{
                border: "none",
                background: "transparent",
                color: closeButtonColor,
                borderRadius: "999px",
                padding: "4px 8px",
                cursor: "pointer",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
              aria-label="Dismiss alert"
            >
              Close
            </button>
          </div>
        );
      })}
    </div>
  );
}
