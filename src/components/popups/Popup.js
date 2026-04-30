// src/components/popups/Popup.js
import React from "react";
import PopupModal from "@/components/popups/popupStyleApi";

export default function Popup({ isOpen, onClose, children }) {
  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      backdropStyle={{ zIndex: 1100 }}
      cardStyle={{
        padding: "var(--section-card-padding)",
        borderRadius: "var(--radius-sm)",
        minWidth: "300px",
        maxWidth: "90%",
      }}
    >
      {children}
      <button
        onClick={onClose}
        style={{
          marginTop: "var(--space-2)",
          padding: "var(--control-padding)",
          borderRadius: "var(--input-radius)",
          backgroundColor: "var(--primary)",
          color: "white",
          border: "1px solid var(--primary-hover)",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Close
      </button>
    </PopupModal>
  );
}
