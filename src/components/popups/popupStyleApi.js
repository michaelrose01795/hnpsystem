// file location: src/components/popups/popupStyleApi.js

import React from "react";
import ModalPortal from "@/components/popups/ModalPortal";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

// Visual popup properties belong exclusively to staffglobal.css. Consumers may
// still supply geometry/layout overrides for a particular workflow, but cannot
// repaint the shared backdrop or card and silently drift from the staff theme.
export const popupStyleApi = Object.freeze({ backdrop: Object.freeze({}), card: Object.freeze({}) });

const BLOCKED_VISUAL_STYLE_KEYS = new Set([
  "background",
  "backgroundColor",
  "backgroundImage",
  "backdropFilter",
  "WebkitBackdropFilter",
  "border",
  "borderColor",
  "borderStyle",
  "borderWidth",
  "borderRadius",
  "boxShadow",
  "color",
  "filter",
  "outline",
  "zIndex",
]);

const sanitisePopupStyle = (style, area) => {
  if (!style || typeof style !== "object") return undefined;

  const cleaned = {};
  const dropped = [];
  Object.entries(style).forEach(([key, value]) => {
    if (BLOCKED_VISUAL_STYLE_KEYS.has(key)) {
      dropped.push(key);
      return;
    }
    cleaned[key] = value;
  });

  if (dropped.length && process.env.NODE_ENV !== "production" && typeof console !== "undefined") {
    console.warn(
      `[PopupModal] Dropped ${area} visual style key(s): ${dropped.join(", ")}. ` +
        "Popup visuals are owned by staffglobal.css."
    );
  }

  return cleaned;
};

export const getPopupBackdropStyle = (overrides) => sanitisePopupStyle(overrides, "backdrop");

export const getPopupCardStyle = (overrides) => sanitisePopupStyle(overrides, "card");

export default function PopupModal({
  isOpen = true,
  onClose,
  closeOnBackdrop = true,
  closeOnEscape = true,
  backdropStyle,
  backdropClassName = "",
  cardStyle,
  cardClassName = "",
  role = "dialog",
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  children,
}) {
  React.useEffect(() => {
    if (!isOpen || !closeOnEscape || !onClose || typeof window === "undefined") return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEscape, isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <DevLayoutSection
        className={["popup-backdrop", backdropClassName].filter(Boolean).join(" ")}
        sectionKey="shared-popup-backdrop"
        sectionType="floating-action"
        shell
        backgroundToken="popup-backdrop"
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        style={getPopupBackdropStyle(backdropStyle)}
        onClick={(event) => {
          if (!closeOnBackdrop) return;
          if (event.target === event.currentTarget) onClose?.();
        }}
      >
        <DevLayoutSection
          className={["popup-card", cardClassName].filter(Boolean).join(" ")}
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
