// src/components/popups/Popup.js

import Popup from "../../components/popups/Popup";

export default function Popup({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000
    }}>
      <div style={{
        background: "white",
        padding: "20px",
        borderRadius: "8px",
        minWidth: "300px",
        maxWidth: "90%"
      }}>
        {children}
        <button onClick={onClose} style={{ marginTop: "10px" }}>Close</button>
      </div>
    </div>
  );
}