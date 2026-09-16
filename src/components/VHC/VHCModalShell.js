// file location: src/components/VHC/VHCModalShell.js
//
// The shared shell for every VHC section modal (Wheels & Tyres, Brakes & Hubs,
// External, Internal Electrics, Underside, Service Indicator, Pre-Pick, Concern
// Picker and the VHC panel's own modal).
//
// Modal mode renders through PopupModal, so the backdrop and the card are the
// canonical `.popup-backdrop` / `.popup-card` from staffglobal.css: the
// accent-tinted, 10px-blurred scrim, --radius-lg, --surface, the
// --popup-viewport-gap clamp and the portrait/mobile rules all come from the
// design system instead of the per-domain overlay object this used to portal
// by hand. Only geometry (width / height / flex layout) is passed in, which is
// what popupStyleApi permits — it strips every visual style key.
//
// Inline mode is NOT a modal: it renders the same header/body/footer in place
// inside the job-card VHC tab, on a canonical <LayerSurface>.
import React from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md 3.0)
import { vhcModalStyles } from "@/styles/appTheme";
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
  const closeButtonColor = "var(--primary)";
  const isBlockingLocked = locked && lockedOverlay;
  if (!isOpen) return null;

  // Header / body / footer. In modal mode this sits directly inside the
  // `.popup-card`, which is already the flex column; the wrapper below only
  // carries the dev-overlay keys and the inline-mode surface.
  const shellBody = (
    <>
        <div
          data-dev-section="1"
          data-dev-section-key={sectionKey ? `${sectionKey}-header` : undefined}
          data-dev-section-type="toolbar"
          data-dev-section-parent={sectionKey ? `${sectionKey}-container` : undefined}
          style={{ ...vhcModalStyles.header, position: "relative", zIndex: 3, border: "none" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h2 style={{ ...vhcModalStyles.headerTitle, color: "var(--text-1)" }}>{title}</h2>
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
                background: "var(--surface)",
                border: "none",
                color: "var(--text-1)",
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
    </>
  );

  if (inlineMode) {
    return (
      <LayerSurface
        data-dev-section="1"
        data-dev-section-key={sectionKey ? `${sectionKey}-container` : undefined}
        data-dev-section-type="content-card"
        data-dev-section-parent={sectionKey ? sectionKey : undefined}
        style={{
          ...vhcModalStyles.container({ width, height }),
          width: "100%",
          height: "auto",
          minHeight: adaptiveHeight ? "auto" : "calc(100vh - 210px)",
        }}
      >
        {shellBody}
      </LayerSurface>
    );
  }

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      // A VHC section modal holds unsaved inspection input, so it must not be
      // dismissable by a stray backdrop click or Escape — same behaviour the
      // hand-rolled overlay had. Closing goes through the header/footer buttons.
      closeOnBackdrop={false}
      closeOnEscape={false}
      ariaLabel={title}
      backdropStyle={overlayStyle || undefined}
      cardStyle={{ ...vhcModalStyles.container({ width, height }) }}
    >
      <div
        data-dev-section="1"
        data-dev-section-key={sectionKey ? `${sectionKey}-container` : undefined}
        data-dev-section-type="content-card"
        data-dev-section-parent={sectionKey ? sectionKey : undefined}
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {shellBody}
      </div>
    </PopupModal>
  );
}

export const buildModalButton = (variant = "primary", { disabled = false } = {}) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
});
