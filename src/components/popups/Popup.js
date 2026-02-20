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
        padding: "20px",
        borderRadius: "12px",
        minWidth: "300px",
        maxWidth: "90%",
      }}
    >
      {children}
      <button
        onClick={onClose}
        style={{
          marginTop: "10px",
          padding: "10px 14px",
          borderRadius: "10px",
          backgroundColor: "var(--primary)",
          color: "white",
          border: "1px solid var(--primary-light)",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Close
      </button>
    </PopupModal>
  );
}
