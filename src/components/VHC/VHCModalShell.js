// file location: src/components/VHC/VHCModalShell.js
import React from "react";
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
}) {
  const { resolvedMode } = useTheme();
  const closeButtonColor = resolvedMode === "dark" ? "var(--accent-purple)" : "var(--danger)";
  if (!isOpen) return null;

  return (
    <div style={vhcModalStyles.overlay}>
      <div style={vhcModalStyles.container({ width, height })}>
        <div style={vhcModalStyles.header}>
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

        <div style={vhcModalStyles.body}>{children}</div>

        {footer ? (
          <div style={vhcModalStyles.footer}>{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export const buildModalButton = (variant = "primary", { disabled = false } = {}) => ({
  ...createVhcButtonStyle(variant, { disabled }),
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
});
