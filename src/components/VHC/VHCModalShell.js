// file location: src/components/VHC/VHCModalShell.js
import React from "react";
import { createPortal } from "react-dom";
import { vhcModalStyles } from "@/styles/appTheme";
import useBodyModalLock from "@/hooks/useBodyModalLock";
import Button from "@/components/ui/Button";

export default function VHCModalShell({
  isOpen,
  title,
  subtitle,
  width = "1080px",
  height = "640px",
  inlineMode = false,
  onClose,
  footer = null,
  headerActions = null,
  children,
  hideCloseButton = false,
  adaptiveHeight = false,
  locked = false,
  lockedMessage = "Authorised",
  lockedOverlay = true,
  overlayStyle = null,
  sectionKey = "",
}) {
  useBodyModalLock(isOpen && !inlineMode);

  const closeButtonColor = "var(--primary)";
  const isBlockingLocked = locked && lockedOverlay;
  if (!isOpen) return null;

  const shellContent = (
    <div
      style={
        inlineMode
          ? {
              width: "100%",
              padding: 0,
              margin: 0,
            }
          : { ...vhcModalStyles.overlay, ...(overlayStyle || {}) }
      }
    >
      <div
        data-dev-section="1"
        data-dev-section-key={sectionKey ? `${sectionKey}-container` : undefined}
        data-dev-section-type="content-card"
        data-dev-section-parent={sectionKey ? sectionKey : undefined}
        style={
          inlineMode
            ? {
                ...vhcModalStyles.container({ width, height }),
                width: "100%",
                maxWidth: "100%",
                height: "auto",
                maxHeight: "none",
                minHeight: adaptiveHeight ? "auto" : "calc(100vh - 210px)",
                border: "none",
              }
            : vhcModalStyles.container({ width, height })
        }
      >
        <div
          data-dev-section="1"
          data-dev-section-key={sectionKey ? `${sectionKey}-header` : undefined}
          data-dev-section-type="toolbar"
          data-dev-section-parent={sectionKey ? `${sectionKey}-container` : undefined}
          style={{ ...vhcModalStyles.header, position: "relative", zIndex: 3, border: "none", ...(inlineMode ? { borderBottom: "none" } : {}) }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h2 style={vhcModalStyles.headerTitle}>{title}</h2>
            {subtitle ? (
              <p style={vhcModalStyles.headerSubtitle}>{subtitle}</p>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {headerActions}
            {inlineMode && footer ? footer : null}
            {!hideCloseButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label="Close modal"
                style={{
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
              </Button>
            )}
          </div>
        </div>

        <div
          data-dev-section="1"
          data-dev-section-key={sectionKey ? `${sectionKey}-body` : undefined}
          data-dev-section-type="content-card"
          data-dev-section-parent={sectionKey ? `${sectionKey}-container` : undefined}
          style={{
            ...vhcModalStyles.body,
            pointerEvents: isBlockingLocked ? "none" : "auto",
            filter: isBlockingLocked ? "grayscale(0.1)" : "none",
          }}
        >
          {locked && !lockedOverlay ? (
            <div
              style={{
                marginBottom: "12px",
                padding: "8px 12px",
                borderRadius: "var(--radius-pill)",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "var(--surface-light)",
                border: "none",
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

        {!inlineMode && footer ? (
          <div
            style={{
              ...vhcModalStyles.footer,
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
                borderRadius: "var(--radius-sm)",
                border: "none",
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
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onClose}
                  style={{
                    alignSelf: "center",
                  }}
                >
                  Close
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (inlineMode) {
    return shellContent;
  }

  if (typeof document === "undefined") return null;
  return createPortal(shellContent, document.body);
}

export const buildModalButton = (variant = "primary", { disabled = false } = {}) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
});
