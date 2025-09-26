// file location: src/components/VHC/ExternalDetailsModal.js
import React, { useState } from "react";

export default function ExternalDetailsModal({ isOpen, onClose, onComplete, initialData }) {
  const [data, setData] = useState({
    "Glass/mirrors/Door locks": { concerns: [] },
    Brakes: { concerns: [] },
    "Clutch/Transmission operations": { concerns: [] },
    "Engine noise/smoke": { concerns: [] },
    "Number plates": { concerns: [] },
    Lights: { concerns: [] },
    Miscellaneous: { concerns: [] },
    Tyres: { concerns: [] }, // 8th button
    ...initialData,
  });

  const [activeConcern, setActiveConcern] = useState({ open: false, category: "", temp: { issue: "", status: "Red" } });

  if (!isOpen) return null;

  const buttonOrder = [
    "Glass/mirrors/Door locks",
    "Brakes",
    "Clutch/Transmission operations",
    "Engine noise/smoke",
    "Number plates",
    "Lights",
    "Miscellaneous",
    "Tyres",
  ];

  const openConcern = (key) => {
    setActiveConcern({ open: true, category: key, temp: { issue: "", status: "Red" } });
  };

  const addConcern = () => {
    const { category, temp } = activeConcern;
    setData((prev) => ({
      ...prev,
      [category]: { ...prev[category], concerns: [...prev[category].concerns, temp] },
    }));
    setActiveConcern({ open: false, category: "", temp: { issue: "", status: "Red" } });
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
        <h2 style={{ color: "#FF4040", marginBottom: "24px" }}>External / Drive-in Inspection</h2>

        {/* 2x4 Button Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
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
                width: "160px",
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

        {/* ✅ Concern Popup */}
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
                width: "400px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <h3 style={{ color: "#FF4040" }}>{activeConcern.category}</h3>
              <input
                type="text"
                placeholder="Enter issue"
                value={activeConcern.temp.issue}
                onChange={(e) =>
                  setActiveConcern((prev) => ({ ...prev, temp: { ...prev.temp, issue: e.target.value } }))
                }
                style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
              />
              <label>Status:</label>
              <select
                value={activeConcern.temp.status}
                onChange={(e) =>
                  setActiveConcern((prev) => ({ ...prev, temp: { ...prev.temp, status: e.target.value } }))
                }
                style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
              >
                <option>Red</option>
                <option>Amber</option>
              </select>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
                <button
                  onClick={() => setActiveConcern({ open: false, category: "", temp: { issue: "", status: "Red" } })}
                  style={{ padding: "6px 12px", border: "none", borderRadius: "6px", background: "#ccc", fontWeight: "bold", cursor: "pointer" }}
                >
                  Close
                </button>
                <button
                  onClick={addConcern}
                  style={{ padding: "6px 12px", border: "none", borderRadius: "6px", background: "#FF4040", color: "white", fontWeight: "bold", cursor: "pointer" }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}