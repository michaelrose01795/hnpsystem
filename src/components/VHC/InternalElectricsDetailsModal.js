// file location: src/components/VHC/CosmeticsDetailsModal.js
import React, { useState } from "react";

export default function CosmeticsDetailsModal({ isOpen, onClose, onComplete, initialData }) {
  const [data, setData] = useState({
    "Bodywork & Paint": { concerns: [] },
    "Glass & Mirrors": { concerns: [] },
    "Interior Trim": { concerns: [] },
    "Upholstery & Seats": { concerns: [] },
    "Media Systems": { concerns: [] },
    Miscellaneous: { concerns: [] },
    ...initialData,
  });

  const [activeConcern, setActiveConcern] = useState({
    open: false,
    category: "",
    temp: { issue: "", status: "Red" },
  });

  if (!isOpen) return null;

  const buttonOrder = [
    "Bodywork & Paint",
    "Glass & Mirrors",
    "Interior Trim",
    "Upholstery & Seats",
    "Media Systems",
    "Miscellaneous",
  ];

  const openConcern = (key) => {
    setActiveConcern({ open: true, category: key, temp: { issue: "", status: "Red" } });
  };

  const addConcern = () => {
    const { category, temp } = activeConcern;
    if (temp.issue.trim() === "") return; // prevent empty concerns
    setData((prev) => ({
      ...prev,
      [category]: { ...prev[category], concerns: [...prev[category].concerns, temp] },
    }));
    // ✅ Keep popup open, just clear the input
    setActiveConcern((prev) => ({ ...prev, temp: { issue: "", status: "Red" } }));
  };

  const updateConcern = (category, idx, field, value) => {
    const updated = [...data[category].concerns];
    updated[idx][field] = value;
    setData((prev) => ({ ...prev, [category]: { ...prev[category], concerns: updated } }));
  };

  const deleteConcern = (category, idx) => {
    setData((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        concerns: prev[category].concerns.filter((_, i) => i !== idx),
      },
    }));
  };

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
          borderRadius: "10px",
          width: "850px",
          height: "550px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "24px",
          position: "relative",
        }}
      >
        <h2 style={{ color: "#FF4040", marginBottom: "24px" }}>Cosmetics Inspection</h2>

        {/* Button Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "repeat(2, 1fr)",
            gap: "16px",
            width: "100%",
            maxWidth: "750px",
            marginBottom: "40px",
          }}
        >
          {buttonOrder.map((key) => (
            <button
              key={key}
              onClick={() => openConcern(key)}
              style={{
                width: "200px",
                height: "80px",
                borderRadius: "8px",
                border: "none",
                background: "#f5f5f5",
                color: "black",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              {key} {data[key].concerns.length > 0 && `(${data[key].concerns.length})`}
            </button>
          ))}
        </div>

        {/* Close & Complete */}
        <div style={{ display: "flex", gap: "16px" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              border: "none",
              borderRadius: "6px",
              background: "#ccc",
              color: "#333",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Close
          </button>

          <button
            onClick={() => onComplete(data)}
            style={{
              padding: "10px 20px",
              border: "none",
              borderRadius: "6px",
              background: "#FF4040",
              color: "white",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Complete
          </button>
        </div>

        {/* Concern Popup */}
        {activeConcern.open && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 2000,
            }}
          >
            <div
              style={{
                background: "white",
                borderRadius: "10px",
                padding: "24px",
                width: "450px",
                maxHeight: "80%",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                overflowY: "auto",
              }}
            >
              <h3 style={{ color: "#FF4040" }}>{activeConcern.category}</h3>

              {/* Input to add new concern */}
              <input
                type="text"
                placeholder="Enter issue"
                value={activeConcern.temp.issue}
                onChange={(e) =>
                  setActiveConcern((prev) => ({ ...prev, temp: { ...prev.temp, issue: e.target.value } }))
                }
                style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "1rem" }}
              />
              <label>Status:</label>
              <select
                value={activeConcern.temp.status}
                onChange={(e) =>
                  setActiveConcern((prev) => ({ ...prev, temp: { ...prev.temp, status: e.target.value } }))
                }
                style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "1rem" }}
              >
                <option>Red</option>
                <option>Amber</option>
                <option>Green</option>
              </select>

              <button
                onClick={addConcern}
                style={{
                  padding: "8px",
                  border: "none",
                  borderRadius: "6px",
                  background: "#FF4040",
                  color: "white",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Add Concern
              </button>

              {/* List of existing concerns */}
              {data[activeConcern.category].concerns.map((c, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    padding: "8px",
                    background: "#f5f5f5",
                    borderRadius: "6px",
                    fontSize: "1rem",
                  }}
                >
                  <input
                    type="text"
                    value={c.issue}
                    onChange={(e) => updateConcern(activeConcern.category, idx, "issue", e.target.value)}
                    style={{ flex: 1, padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
                  />
                  <select
                    value={c.status}
                    onChange={(e) => updateConcern(activeConcern.category, idx, "status", e.target.value)}
                    style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
                  >
                    <option>Red</option>
                    <option>Amber</option>
                    <option>Green</option>
                  </select>
                  <button
                    onClick={() => deleteConcern(activeConcern.category, idx)}
                    style={{
                      padding: "6px 10px",
                      border: "none",
                      borderRadius: "6px",
                      background: "#FF4040",
                      color: "white",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}

              {/* Close button */}
              <button
                onClick={() => setActiveConcern({ open: false, category: "", temp: { issue: "", status: "Red" } })}
                style={{
                  padding: "8px",
                  border: "none",
                  borderRadius: "6px",
                  background: "#ccc",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
