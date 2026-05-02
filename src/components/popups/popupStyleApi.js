// file location: src/components/popups/popupStyleApi.js

import React from "react";
import ModalPortal from "@/components/popups/ModalPortal";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

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
    overflow: "hidden",
    overscrollBehavior: "contain",
    padding: "var(--popup-viewport-gap, clamp(10px, 2.5vw, 20px))",
    zIndex: 9999,
  },
  card: {
    backgroundColor: "var(--surface)",
    color: "var(--text-1)",
    border: "none",
    borderRadius: "var(--radius-lg)",
    width: "min(100%, 960px)",
    maxWidth: "calc(100vw - (var(--popup-viewport-gap, clamp(10px, 2.5vw, 20px)) * 2))",
    maxHeight: "calc(100dvh - (var(--popup-viewport-gap, clamp(10px, 2.5vw, 20px)) * 2))",
    overflowY: "auto",
    overscrollBehavior: "contain",
    position: "relative",
    margin: "auto",
    boxShadow: "none",
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
          {children}
        </DevLayoutSection>
      </DevLayoutSection>
    </ModalPortal>
  );
}
