// file location: src/components/VHC/BrakesHubsDetailsModal.js

import React, { useState } from "react";

// ✅ Modal with visual front/rear brake layout
export default function BrakesHubsDetailsModal({ isOpen, onClose, onComplete, initialData }) {
  // ✅ Ensure each category is always an array
  const [data, setData] = useState({
    frontPads: [],
    frontDiscs: [],
    rearPads: [],
    rearDiscs: [],
    ...initialData, // overwrite defaults if initialData exists
  });

  // ✅ Add a new issue for a category
  const addIssue = (category) => {
    setData((prev) => ({
      ...prev,
      [category]: [...(prev[category] || []), { title: "", details: "" }], // safe fallback
    }));
  };

  // ✅ Update issue title/details
  const updateIssue = (category, idx, field, value) => {
    const updated = [...(data[category] || [])]; // safe fallback
    updated[idx][field] = value;
    setData((prev) => ({ ...prev, [category]: updated }));
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "white",
          padding: "24px",
          borderRadius: "10px",
          width: "750px",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <h2 style={{ color: "#FF4040", marginBottom: "16px" }}>Brakes & Hubs</h2>

        {/* ✅ Diagram-like layout for front/rear brakes */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}>
          {["frontPads", "frontDiscs", "rearPads", "rearDiscs"].map((category) => (
            <div key={category} style={{ flex: 1, margin: "0 8px" }}>
              <h3 style={{ fontWeight: "bold", marginBottom: "8px", textTransform: "capitalize" }}>
                {category.replace(/([A-Z])/g, " $1")}
              </h3>

              {(data[category] || []).map((issue, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    gap: "6px",
                    marginBottom: "6px",
                    flexDirection: "column",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Issue title"
                    value={issue.title}
                    onChange={(e) => updateIssue(category, idx, "title", e.target.value)}
                    style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
                  />
                  <input
                    type="text"
                    placeholder="Details"
                    value={issue.details}
                    onChange={(e) => updateIssue(category, idx, "details", e.target.value)}
                    style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
                  />
                </div>
              ))}

              <button
                onClick={() => addIssue(category)}
                style={{
                  padding: "6px 10px",
                  backgroundColor: "#FF4040",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "0.85rem",
                  marginTop: "4px",
                }}
              >
                + Add Issue
              </button>
            </div>
          ))}
        </div>

        {/* ✅ Action buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              border: "none",
              background: "#ccc",
              color: "#333",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Close
          </button>
          <button
            onClick={() => onComplete(data)}
            style={{
              padding: "8px 16px",
              border: "none",
              background: "#FF4040",
              color: "white",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Complete
          </button>
        </div>
      </div>
    </div>
  );
}
