// file location: src/components/popups/CheckSheetPopup.js
import React from "react"; // Import React
import ModalPortal from "./ModalPortal";

// CheckSheetPopup shows options to create a check sheet or add dealer details
export default function CheckSheetPopup({ onClose, onAddCheckSheet, onAddDealerDetails }) {
  // Render overlay + options
  return (
    // Full-screen overlay
    <ModalPortal>
      <div className="popup-backdrop">
        {/* Popup card */}
        <div
          className="popup-card"
          style={{
            padding: "24px",
            borderRadius: "8px",
            width: "420px",
          }}
        >
          {/* Title */}
          <h3 style={{ marginTop: 0 }}>Next Step</h3> {/* Heading */}
          {/* Explanation */}
          <p>This job may require additional details. Choose an option:</p> {/* Text */}
          {/* Buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
            {/* Cancel */}
            <button onClick={onClose} style={{ padding: "8px 16px" }}>Cancel</button> {/* Cancel */}
            {/* Add Check Sheet */}
            <button onClick={() => { onAddCheckSheet && onAddCheckSheet(); onClose(); }} style={{ padding: "8px 16px", backgroundColor: "var(--primary)", color: "white" }}>
              Add Check Sheet
            </button> {/* Add check sheet */}
            {/* Add Dealer Car Details */}
            <button onClick={() => { onAddDealerDetails && onAddDealerDetails(); onClose(); }} style={{ padding: "8px 16px", backgroundColor: "var(--primary)", color: "white" }}>
              Add Dealer Car Details
            </button> {/* Add dealer details */}
          </div>
        </div>
      </div>
    </ModalPortal>
  ); // End return
} // End CheckSheetPopup
