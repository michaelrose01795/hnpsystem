// src/components/popups/Popup.js
import React from "react";

export default function Popup({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(var(--shadow-rgb),0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000
    }}>
      <div style={{
        background: "var(--surface)",
        color: "var(--text-primary)",
        padding: "20px",
        borderRadius: "12px",
        minWidth: "300px",
        maxWidth: "90%",
        boxShadow: "0 16px 32px rgba(var(--shadow-rgb),0.25)",
        border: "1px solid var(--border)"
      }}>
        {children}
        <button
          onClick={onClose}
          style={{
            marginTop: "10px",
            padding: "10px 14px",
            borderRadius: "10px",
            backgroundColor: "var(--primary)",
            color: "var(--surface)",
            border: "1px solid var(--primary-light)",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
