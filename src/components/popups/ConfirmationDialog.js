"use client";

import { useEffect } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";

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
    label: "var(--info)",
    value: "var(--text-1)",
  },
  success: {
    label: "var(--success)",
    value: "var(--text-1)",
  },
  warning: {
    label: "var(--warning-dark)",
    value: "var(--text-1)",
  },
  accent: {
    label: "var(--accentText)",
    value: "var(--text-1)",
  },
  neutral: {
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
  const actionButtons = (
    <>
      <Button
        type="button"
        variant="primary"
        onClick={handleConfirm}
      >
        {confirmLabel}
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={onCancel}
      >
        {cancelLabel}
      </Button>
    </>
  );

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onCancel}
      ariaLabel={title || "Confirmation dialog"}
      cardStyle={{
        width: "min(560px, 100%)",
        padding: "var(--space-7)",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      {/* Header: small uppercase eyebrow title + the main prompt */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div className="app-popup-compact-header">
          {title && <h2>{title}</h2>}
          <div className="app-popup-compact-header__actions">
            {actionButtons}
          </div>
        </div>
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
              <LayerTheme
                key={`${label}-${index}`}
                radius="var(--radius-md)"
                padding="12px 14px"
                gap="4px"
                style={{
                  minWidth: 0,
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
              </LayerTheme>
            );
          })}
        </div>
      )}

    </PopupModal>
  );
}
