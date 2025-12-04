// file location: src/components/popups/CheckSheetPopup.js
import React from "react"; // Import React

// CheckSheetPopup shows options to create a check sheet or add dealer details
export default function CheckSheetPopup({ onClose, onAddCheckSheet, onAddDealerDetails }) {
  // Render overlay + options
  return (
    // Full-screen overlay
    <div
      style={{
        position: "fixed", // fixed overlay
        top: 0, // top 0
        left: 0, // left 0
        width: "100%", // full width
        height: "100%", // full height
        backgroundColor: "rgba(var(--shadow-rgb),0.5)", // translucent bg
        display: "flex", // center horizontally
        justifyContent: "center", // center horizontally
        alignItems: "center", // center vertically
        zIndex: 1000, // ensure on top
      }}
    >
      {/* Popup card */}
      <div
        style={{
          backgroundColor: "white", // white card
          padding: "24px", // padding
          borderRadius: "8px", // rounded corners
          width: "420px", // width
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
  ); // End return
} // End CheckSheetPopup