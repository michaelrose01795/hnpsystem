// file location: src/components/mobile/ServiceModeBadge.js
// Visual badge that labels a job as workshop or mobile. Reuses theme tokens so it
// adopts the app's light/dark palette without bespoke colour definitions.

import React from "react";

const baseStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "2px 10px",
  borderRadius: "999px",
  fontSize: "0.75rem",
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  border: "1px solid transparent",
};

const modeStyles = {
  mobile: {
    backgroundColor: "rgba(var(--primary-rgb, 59,130,246), 0.15)",
    color: "var(--primary-dark, #1d4ed8)",
    borderColor: "rgba(var(--primary-rgb, 59,130,246), 0.35)",
  },
  workshop: {
    backgroundColor: "var(--surface-muted, #f1f5f9)",
    color: "var(--text-secondary, #475569)",
    borderColor: "var(--border-subtle, rgba(15,23,42,0.1))",
  },
};

export default function ServiceModeBadge({ mode = "workshop" }) {
  const key = mode === "mobile" ? "mobile" : "workshop";
  const label = key === "mobile" ? "Mobile Visit" : "Workshop";
  return (
    <span style={{ ...baseStyle, ...modeStyles[key] }} aria-label={`Service mode: ${label}`}>
      {key === "mobile" ? "🚐" : "🏭"} {label}
    </span>
  );
}
