// src/components/popups/Popup.js
import React from "react";
import ModalPortal from "./ModalPortal";

export default function Popup({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="popup-backdrop" style={{ zIndex: 1100 }}>
        <div
          className="popup-card"
          style={{
            padding: "20px",
            borderRadius: "12px",
            minWidth: "300px",
            maxWidth: "90%",
            boxShadow: "none",
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
        </div>
      </div>
    </ModalPortal>
  );
}
