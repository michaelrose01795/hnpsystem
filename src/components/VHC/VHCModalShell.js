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
  fullScreen = false,
  inlineMode = false,
  onClose,
  footer = null,
  children,
  hideCloseButton = false,
  locked = false,
  lockedMessage = "Authorised",
  lockedOverlay = true,
}) {
  const { resolvedMode } = useTheme();
  const closeButtonColor = resolvedMode === "dark" ? "var(--accent-purple)" : "var(--danger)";
  const isBlockingLocked = locked && lockedOverlay;

  const overlayStyle = fullScreen
    ? {
        ...vhcModalStyles.overlay,
        background: "var(--surface)",
        backdropFilter: "none",
        padding: 0,
        alignItems: "stretch",
      }
    : vhcModalStyles.overlay;

  const containerStyle = fullScreen
    ? {
        ...vhcModalStyles.container({ width, height }),
        width: "100vw",
        maxWidth: "100vw",
        height: "100dvh",
        maxHeight: "100dvh",
        borderRadius: 0,
        border: "none",
      }
    : vhcModalStyles.container({ width, height });

  const headerStyle = fullScreen
    ? {
        ...vhcModalStyles.header,
        borderBottom: "1px solid var(--border)",
      }
    : vhcModalStyles.header;

  const bodyStyle = fullScreen
    ? {
        ...vhcModalStyles.body,
        background: "var(--surface)",
      }
    : vhcModalStyles.body;

  const footerStyle = fullScreen
    ? {
        ...vhcModalStyles.footer,
        backgroundColor: "var(--surface)",
      }
    : vhcModalStyles.footer;

  const inlineWrapperStyle = {
    position: "relative",
    width: "100%",
    marginTop: "16px",
  };

  const inlineContainerStyle = {
    ...vhcModalStyles.container({ width, height }),
    width: "100%",
    maxWidth: "100%",
    maxHeight: "none",
    minHeight: "620px",
    borderRadius: "16px",
  };

  if (!isOpen) return null;

  const content = (
    <div style={inlineMode ? inlineWrapperStyle : overlayStyle}>
      <div style={inlineMode ? inlineContainerStyle : containerStyle}>
        <div style={{ ...(inlineMode ? vhcModalStyles.header : headerStyle), position: "relative", zIndex: 3 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h2 style={vhcModalStyles.headerTitle}>{title}</h2>
            {subtitle ? <p style={vhcModalStyles.headerSubtitle}>{subtitle}</p> : null}
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
            ...(inlineMode ? vhcModalStyles.body : bodyStyle),
            pointerEvents: isBlockingLocked ? "none" : "auto",
            filter: isBlockingLocked ? "grayscale(0.1)" : "none",
          }}
        >
          {locked && !lockedOverlay ? (
            <div
              style={{
                marginBottom: "12px",
                padding: "8px 12px",
                borderRadius: "999px",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "var(--surface-light)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                fontSize: "12px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {lockedMessage}
            </div>
          ) : null}
          {children}
        </div>

        {footer ? (
          <div
            style={{
              ...(inlineMode ? vhcModalStyles.footer : footerStyle),
              pointerEvents: isBlockingLocked ? "none" : "auto",
              filter: isBlockingLocked ? "grayscale(0.1)" : "none",
            }}
          >
            {footer}
          </div>
        ) : null}

        {isBlockingLocked ? (
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
    </div>
  );

  if (inlineMode) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

export const buildModalButton = (variant = "primary", { disabled = false } = {}) => ({
  ...createVhcButtonStyle(variant, { disabled }),
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
});
