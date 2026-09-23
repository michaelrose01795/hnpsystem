// file location: src/features/tracking/map/TrackingMapModal.js
// Full-screen overlay wrapper that presents the CSS site map from the
// Key/Parking tab's "Map" button. Uses the canonical `.popup-backdrop` class
// from staffglobal.css unmodified — that rule carries z-index 9999, which
// keeps the popup above the topbar shell (z-index 3300). Do not override the
// overlay with inline styles: an inline z-index is exactly what previously
// let the topbar show through this popup.

import React from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import TrackingMap from "@/features/tracking/map/TrackingMap";

export default function TrackingMapModal({ onClose, onRefresh, pins }) {
  return (
    <PopupModal
      isOpen
      onClose={onClose}
      closeOnBackdrop={false}
      ariaLabel="Dealership site map"
      cardClassName="tracking-map-modal-card"
    >
      <TrackingMap pins={pins} onRefresh={onRefresh} onClose={onClose} />
    </PopupModal>
  );
}
