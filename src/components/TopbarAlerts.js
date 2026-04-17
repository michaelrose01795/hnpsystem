import React, { useState } from "react";
import { useAlerts } from "@/context/AlertContext";

const toneStyles = {
  success: { bg: "var(--success-surface)", text: "var(--success-strong)", border: "var(--success-border)" },
  error:   { bg: "var(--danger-surface)",  text: "var(--danger-text)",   border: "var(--danger-border)" },
  warning: { bg: "var(--warning-surface)", text: "var(--warning-text)",  border: "var(--warning-border)" },
  info:    { bg: "var(--accent-surface)",  text: "var(--accent-strong)", border: "var(--accent-base)" },
};

const getTone = (type) => toneStyles[type] || toneStyles.info;

function CopyDevInfoButton({ devInfo }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(devInfo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const ta = document.createElement("textarea");
      ta.value = devInfo;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy error details for developer"
      style={{
        border: "1px solid currentColor",
        background: "transparent",
        color: "inherit",
        borderRadius: "var(--radius-pill)",
        padding: "3px 10px",
        cursor: "pointer",
        fontWeight: 600,
        fontSize: "0.72rem",
        letterSpacing: "0.04em",
        opacity: copied ? 1 : 0.8,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {copied ? "Copied!" : "Copy for Dev"}
    </button>
  );
}

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
        borderRadius: "var(--radius-pill)",
        background: tone.bg,
        color: tone.text,
        fontSize: "0.75rem",
        fontWeight: 600,
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

  // Show the 3 most recent alerts, newest on top
  const visibleAlerts = alerts.slice(-3).reverse();

  return (
    <div
      style={{
        position: "fixed",
        top: "calc(var(--page-gutter-y) + 75px + 12px)",
        right: "24px",
        zIndex: 1200,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        maxWidth: "400px",
        width: "min(400px, calc(100vw - 48px))",
      }}
    >
      {visibleAlerts.map((alert) => {
        const tone = getTone(alert.type);
        return (
          <div
            key={alert.id}
            role="alert"
            style={{
              borderRadius: "var(--radius-md)",
              padding: "12px 14px",
              background: tone.bg,
              color: tone.text,
              border: `1px solid ${tone.border}`,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            }}
          >
            {/* Message row */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <div style={{ fontSize: "0.95rem", fontWeight: 600, flex: 1, lineHeight: 1.4 }}>
                {alert.message}
              </div>
              <button
                type="button"
                onClick={() => dismissAlert(alert.id)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  borderRadius: "var(--radius-pill)",
                  padding: "2px 6px",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  flexShrink: 0,
                  opacity: 0.7,
                  lineHeight: 1,
                }}
                aria-label="Dismiss alert"
              >
                ✕
              </button>
            </div>

            {/* Dev copy row — only shown when devInfo is present */}
            {alert.devInfo ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  paddingTop: "4px",
                  borderTop: `1px solid ${tone.border}`,
                }}
              >
                <span style={{ fontSize: "0.72rem", opacity: 0.75, fontStyle: "italic" }}>
                  Dev info available
                </span>
                <CopyDevInfoButton devInfo={alert.devInfo} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
