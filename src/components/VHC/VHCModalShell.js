// file location: src/components/VHC/VHCModalShell.js
import React from "react";
import { createPortal } from "react-dom";
import { vhcModalStyles, createVhcButtonStyle } from "@/styles/appTheme";
import { useTheme } from "@/styles/themeProvider";

export default function VHCModalShell({
  isOpen,
  title,
  subtitle,
  width = "1080px",
  height = "640px",
  onClose,
  footer = null,
  children,
  hideCloseButton = false,
  locked = false,
  lockedMessage = "Section been authorised.",
}) {
  const { resolvedMode } = useTheme();
  const closeButtonColor = resolvedMode === "dark" ? "var(--accent-purple)" : "var(--danger)";
  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div style={vhcModalStyles.overlay}>
      <div style={vhcModalStyles.container({ width, height })}>
        <div style={{ ...vhcModalStyles.header, position: "relative", zIndex: 3 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h2 style={vhcModalStyles.headerTitle}>{title}</h2>
            {subtitle ? (
              <p style={vhcModalStyles.headerSubtitle}>{subtitle}</p>
            ) : null}
          </div>
          {!hideCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              style={{
                ...createVhcButtonStyle("ghost"),
                border: "none",
                boxShadow: "none",
                padding: "6px 12px",
                fontSize: "0.95rem",
                fontWeight: 700,
                color: closeButtonColor,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Close
            </button>
          )}
        </div>

        <div
          style={{
            ...vhcModalStyles.body,
            pointerEvents: locked ? "none" : "auto",
            filter: locked ? "grayscale(0.1)" : "none",
          }}
        >
          {children}
        </div>

        {footer ? (
          <div
            style={{
              ...vhcModalStyles.footer,
              pointerEvents: locked ? "none" : "auto",
              filter: locked ? "grayscale(0.1)" : "none",
            }}
          >
            {footer}
          </div>
        ) : null}

        {locked ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(15, 23, 42, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
              padding: "24px",
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderRadius: "12px",
                border: "1px solid var(--danger)",
                background: "var(--surface)",
                color: "var(--danger)",
                fontWeight: 700,
                fontSize: "14px",
                textAlign: "center",
                maxWidth: "420px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {lockedMessage}
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    ...createVhcButtonStyle("primary"),
                    alignSelf: "center",
                  }}
                >
                  Close
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

export const buildModalButton = (variant = "primary", { disabled = false } = {}) => ({
  ...createVhcButtonStyle(variant, { disabled }),
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
});
