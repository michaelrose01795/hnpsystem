import React from "react";
import ModalPortal from "@/components/popups/ModalPortal";

export const popupStyleApi = {
  backdrop: {
    position: "fixed",
    inset: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflowY: "auto",
    padding: "20px",
    zIndex: 9999,
  },
  card: {
    backgroundColor: "var(--surface)",
    border: "1px solid var(--surface-light)",
    borderRadius: "32px",
    width: "100%",
    maxWidth: "650px",
    maxHeight: "90vh",
    overflowY: "auto",
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
