"use client";

import { useEffect } from "react";
import PopupModal from "@/components/popups/popupStyleApi";

// Plain-string fallback: split a multi-line message into <p> lines so existing
// callers that pass `confirm("Line 1\nLine 2")` keep rendering the same way.
const renderMessageLines = (message) => {
  if (!message && message !== 0) return [];
  const text = String(message);
  return text.split("\n");
};

// Theme-token tones used by the new structured `details` prop. Each tile picks
// one of these by passing { tone: "info" | "success" | "warning" | "accent" }.
// Falls back to "info" so unknown tones still render a valid tile.
const TONE_STYLES = {
  info: {
    background: "var(--theme)",
    label: "var(--info)",
    value: "var(--text-1)",
  },
  success: {
    background: "var(--success-surface)",
    label: "var(--success)",
    value: "var(--text-1)",
  },
  warning: {
    background: "var(--warning-surface)",
    label: "var(--warning-dark)",
    value: "var(--text-1)",
  },
  accent: {
    background: "var(--theme)",
    label: "var(--accentText)",
    value: "var(--text-1)",
  },
  neutral: {
    background: "var(--surface)",
    label: "var(--text-1)",
    value: "var(--text-1)",
  },
};

const resolveToneStyle = (tone) => TONE_STYLES[tone] || TONE_STYLES.info;

export default function ConfirmationDialog({
  isOpen,
  title,
  message,
  description,
  details, // Optional array: [{ label, value, tone }] — renders as themed tile grid.
  cancelLabel = "No",
  confirmLabel = "Yes",
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return undefined;

    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel?.();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [isOpen, onCancel]);

  const lines = renderMessageLines(message);
  const handleConfirm = () => {
    onConfirm?.();
  };

  const hasDetails = Array.isArray(details) && details.length > 0;

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onCancel}
      ariaLabel={title || "Confirmation dialog"}
      cardStyle={{
        width: "min(560px, 100%)",
        padding: "var(--space-7)",
        borderRadius: "var(--radius-xl)",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      {/* Header: small uppercase eyebrow title + the main prompt */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {title && (
          <p
            style={{
              margin: 0,
              fontSize: "0.75rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--info)",
              fontWeight: 600,
            }}
          >
            {title}
          </p>
        )}
        {lines.length > 0 && (
          <div>
            {lines.map((line, index) => (
              <p
                key={`${line}-${index}`}
                style={{
                  margin: index === 0 ? "0" : "6px 0 0",
                  color: "var(--text-1)",
                  lineHeight: 1.35,
                  // First line is the headline question, the rest are supporting copy.
                  fontSize: index === 0 ? "1.15rem" : "0.95rem",
                  fontWeight: index === 0 ? 600 : 400,
                  whiteSpace: "pre-wrap",
                }}
              >
                {line}
              </p>
            ))}
          </div>
        )}
        {description && (
          <p
            style={{
              margin: 0,
              color: "var(--text-1)",
              fontSize: "0.9rem",
              lineHeight: 1.5,
            }}
          >
            {description}
          </p>
        )}
      </div>

      {/* Structured details grid: responsive 2-column tile layout, each tile
          tinted with a theme surface so sections are visually distinct. */}
      {hasDetails && (
        <div
          style={{
            display: "grid",
            gap: "10px",
            // Auto-fit so single-tile sets centre, and the grid collapses to 1
            // column on narrow widths automatically.
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          {details.map((entry, index) => {
            const tone = resolveToneStyle(entry?.tone);
            const label = entry?.label ?? "";
            const value = entry?.value ?? "—";
            return (
              <div
                key={`${label}-${index}`}
                style={{
                  background: tone.background,
                  borderRadius: "var(--radius-md)",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  // Subtle inner border using the matching label colour at low
                  // alpha keeps the tile readable in dark mode where flat
                  // surfaces can blend into the dialog background.
                  border: "1px solid rgba(0,0,0,0.04)",
                }}
              >
                <span
                  style={{
                    fontSize: "0.65rem",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: tone.label,
                    fontWeight: 700,
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontSize: "1rem",
                    color: tone.value,
                    fontWeight: 600,
                    lineHeight: 1.25,
                    wordBreak: "break-word",
                  }}
                >
                  {value}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Action row */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "12px",
          marginTop: "4px",
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "var(--control-padding)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--primary-border)",
            backgroundColor: "var(--surface)",
            color: "var(--text-1)",
            cursor: "pointer",
            fontWeight: 600,
            minWidth: "96px",
          }}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          style={{
            padding: "var(--control-padding)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--primary)",
            backgroundColor: "var(--primary)",
            color: "var(--text-2)",
            cursor: "pointer",
            fontWeight: 600,
            minWidth: "96px",
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </PopupModal>
  );
}
