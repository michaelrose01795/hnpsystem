// file location: src/components/JobCards/JobCardModal.js
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function JobCardModal({ isOpen, onClose }) {
  const router = useRouter();
  const [jobNumber, setJobNumber] = useState(""); // start empty

  // Reset job number whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setJobNumber("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClockOn = () => {
    if (!jobNumber) return; // optional: prevent empty submission
    onClose();
    router.push(`/job-cards/${jobNumber}`);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "8px",
          width: "320px",
          textAlign: "center",
        }}
      >
        <h2 style={{ marginBottom: "16px", color: "#FF4040" }}>
          Enter Job Number
        </h2>

        <input
          type="text"
          value={jobNumber}
          onChange={(e) => setJobNumber(e.target.value)}
          style={{
            width: "100%",
            padding: "8px",
            marginBottom: "16px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            fontSize: "1rem",
          }}
        />

        <button
          onClick={handleClockOn}
          style={{
            width: "100%",
            padding: "10px",
            backgroundColor: "#FF4040",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Clock On
        </button>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            marginTop: "10px",
            padding: "10px",
            backgroundColor: "#ccc",
            color: "#333",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
