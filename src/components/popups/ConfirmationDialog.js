"use client";

import { useEffect } from "react";
import { useTheme } from "@/styles/themeProvider";

const renderMessageLines = (message) => {
  if (!message && message !== 0) return [];
  const text = String(message);
  return text.split("\n");
};

export default function ConfirmationDialog({
  isOpen,
  title,
  message,
  description,
  cancelLabel = "No",
  confirmLabel = "Yes",
  onCancel,
  onConfirm,
}) {
  const { resolvedMode } = useTheme();
  const closeButtonColor = resolvedMode === "dark" ? "var(--accent-purple)" : "var(--danger)";
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

  if (!isOpen) return null;

  const lines = renderMessageLines(message);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || "Confirmation dialog"}
      className="popup-backdrop"
      style={{ padding: "20px" }}
    >
      <div
        className="popup-card"
        style={{
          width: "min(520px, 100%)",
          padding: "28px",
          borderRadius: "24px",
          boxShadow: "none",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
          <div>
            {title && (
              <p
                style={{
                  margin: "0 0 6px",
                  fontSize: "0.75rem",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--info)",
                }}
              >
                {title}
              </p>
            )}
            <div>
              {lines.map((line, index) => (
                <p
                  key={`${line}-${index}`}
                  style={{
                    margin: "6px 0",
                    color: "var(--text-primary)",
                    lineHeight: 1.4,
                    fontSize: "0.95rem",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {line}
                </p>
              ))}
              {description && (
                <p
                  style={{
                    margin: "10px 0 0",
                    color: "var(--info-dark)",
                    fontSize: "0.9rem",
                    lineHeight: 1.5,
                  }}
                >
                  {description}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            style={{
              border: "none",
              background: "transparent",
              fontSize: "0.95rem",
              lineHeight: 1,
              cursor: "pointer",
              color: closeButtonColor,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Close
          </button>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            marginTop: "10px",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "1px solid var(--primary)",
              backgroundColor: "var(--primary)",
              color: "var(--surface)",
              cursor: "pointer",
              fontWeight: 600,
              boxShadow: "none",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
