// file location: src/features/tracking/TrackingPopup.js
//
// The popup every item in the /tracking Loan Cars, Equipment/Tools and
// Oil/Stock tabs opens into. It replaces the right-side StaffDrawer those tabs
// used to open, and keeps StaffDrawer's props so a consumer only swaps the tag.
//
// Nothing here paints anything. It is the staffglobal.css settings popup
// convention end to end: PopupModal's .popup-backdrop / .popup-card,
// .app-settings-popup-card / .app-settings-popup, the compact header with the
// primary actions left of the secondary Close (rendered as the close symbol),
// plus the tracking-popup layout classes that sit beside them in staffglobal.css.
//
// Escape and backdrop clicks are off by default: the consumers already own
// Escape (so they can ignore it while a save is in flight), and a stray click
// on the backdrop must not throw away a half-filled form.

import React from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import { Button } from "@/components/ui";

export default function TrackingPopup({
  open = true,
  title,
  description,
  children,
  footer,
  headerActions,
  onClose,
  ariaLabel,
  closeOnEscape = false,
}) {
  if (!open) return null;

  return (
    <PopupModal
      isOpen
      onClose={onClose}
      closeOnBackdrop={false}
      closeOnEscape={closeOnEscape}
      ariaLabel={ariaLabel || title}
      cardClassName="app-settings-popup-card tracking-popup-card"
    >
      <div className="app-settings-popup tracking-popup">
        <header className="app-popup-compact-header">
          {title && <h2>{title}</h2>}
          <div className="app-popup-compact-header__actions">
            {headerActions}
            {onClose && (
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </header>
        {description && <p className="tracking-popup__meta">{description}</p>}
        <div className="tracking-popup__body">{children}</div>
        {footer && <footer className="tracking-popup__footer">{footer}</footer>}
      </div>
    </PopupModal>
  );
}
