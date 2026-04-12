// file location: src/components/popups/popupStyleApi.js

import React from "react";
import ModalPortal from "@/components/popups/ModalPortal";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { useDevLayoutOverlay } from "@/context/DevLayoutOverlayContext";

export const popupStyleApi = {
  backdrop: {
    position: "fixed",
    inset: 0,
    width: "100vw",
    height: "100dvh",
    maxHeight: "100dvh",
    backgroundColor: "var(--overlay)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflowY: "auto",
    overscrollBehavior: "contain",
    padding: "var(--popup-viewport-gap, var(--space-6))",
    zIndex: 9999,
  },
  card: {
    backgroundColor: "var(--surfaceMain)",
    border: "1px solid var(--accentBorder)",
    borderRadius: "var(--radius-lg)",
    width: "min(100%, 960px)",
    maxWidth: "calc(100vw - (var(--popup-viewport-gap, var(--space-6)) * 2))",
    maxHeight: "calc(100dvh - (var(--popup-viewport-gap, var(--space-6)) * 2))",
    overflowY: "auto",
    overscrollBehavior: "contain",
    position: "relative",
    margin: "auto",
    boxShadow: "var(--shadow-xl)",
  },
};

export const getPopupBackdropStyle = (overrides = {}) => ({
  ...popupStyleApi.backdrop,
  ...overrides,
});

export const getPopupCardStyle = (overrides = {}) => ({
  ...popupStyleApi.card,
  ...overrides,
});

export default function PopupModal({
  isOpen = true,
  onClose,
  closeOnBackdrop = true,
  backdropStyle,
  cardStyle,
  role = "dialog",
  ariaLabel,
  children,
}) {
  const { canAccess, enabled, toggleEnabled } = useDevLayoutOverlay();

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <DevLayoutSection
        className="popup-backdrop"
        sectionKey="shared-popup-backdrop"
        sectionType="floating-action"
        shell
        backgroundToken="popup-backdrop"
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        style={getPopupBackdropStyle(backdropStyle)}
        onClick={(event) => {
          if (!closeOnBackdrop) return;
          if (event.target === event.currentTarget) onClose?.();
        }}
      >
        <DevLayoutSection
          className="popup-card"
          sectionKey="shared-popup-card"
          parentKey="shared-popup-backdrop"
          sectionType="content-card"
          backgroundToken="popup-card"
          style={getPopupCardStyle(cardStyle)}
          onClick={(event) => event.stopPropagation()}
        >
          {canAccess && (
            <div
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label="Toggle dev layout overlay for the current screen"
                className={`app-btn ${enabled ? "app-btn--primary" : "app-btn--secondary"} app-btn--xs app-btn--pill`}
                onClick={toggleEnabled}
              >
                Screen Overlay {enabled ? "ON" : "OFF"}
              </button>
            </div>
          )}
          {children}
        </DevLayoutSection>
      </DevLayoutSection>
    </ModalPortal>
  );
}
