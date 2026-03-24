import React from "react";
import ModalPortal from "@/components/popups/ModalPortal";

export const popupStyleApi = {
  backdrop: {
    position: "fixed",
    inset: 0,
    width: "100vw",
    height: "100dvh",
    maxHeight: "100dvh",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflowY: "auto",
    overscrollBehavior: "contain",
    padding: "var(--popup-viewport-gap, var(--space-6))",
    zIndex: 9999,
  },
  card: {
    backgroundColor: "var(--surface)",
    border: "1px solid var(--border)",
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
  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="popup-backdrop"
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        style={getPopupBackdropStyle(backdropStyle)}
        onClick={(event) => {
          if (!closeOnBackdrop) return;
          if (event.target === event.currentTarget) onClose?.();
        }}
      >
        <div
          className="popup-card"
          style={getPopupCardStyle(cardStyle)}
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </ModalPortal>
  );
}
