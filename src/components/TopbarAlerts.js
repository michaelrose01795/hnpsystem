import React from "react";
import { useAlerts } from "@/context/AlertContext";

const toneStyles = {
  success: { bg: "linear-gradient(135deg,#22c55e,#15803d)", text: "#ffffff" },
  error: { bg: "linear-gradient(135deg,#ef4444,#991b1b)", text: "#ffffff" },
  warning: { bg: "linear-gradient(135deg,#f97316,#c2410c)", text: "#ffffff" },
  info: { bg: "linear-gradient(135deg,#38bdf8,#0ea5e9)", text: "#0f172a" },
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
        boxShadow: "0 6px 12px rgba(15,23,42,0.15)",
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
  if (!alerts.length) return null;

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
      {alerts.map((alert) => {
        const tone = getTone(alert.type);
        return (
          <div
            key={alert.id}
            style={{
              borderRadius: "16px",
              padding: "12px 14px",
              background: tone.bg,
              color: tone.text,
              boxShadow: "0 12px 30px rgba(15,23,42,0.2)",
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
                background: "rgba(255,255,255,0.15)",
                color: tone.text,
                borderRadius: "999px",
                width: "26px",
                height: "26px",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                fontWeight: 700,
              }}
              aria-label="Dismiss alert"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
