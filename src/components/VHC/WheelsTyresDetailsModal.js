// file location: src/components/VHC/WheelsTyresDetailsModal.js

import React, { useState } from "react";

export default function WheelsTyresDetailsModal({ isOpen, onClose, onComplete }) {
  const initialTyre = {
    manufacturer: "",
    runFlat: false,
    size: "",
    load: "",
    speed: "",
    tread: { outer: "", middle: "", inner: "" },
    concerns: [],
  };

  const [tyres, setTyres] = useState({
    NSF: { ...initialTyre },
    OSF: { ...initialTyre },
    NSR: { ...initialTyre },
    OSR: { ...initialTyre },
    Spare: {
      type: "not_checked",
      year: "",
      condition: "",
      details: { ...initialTyre },
      concerns: [],
    },
  });

  const [activeWheel, setActiveWheel] = useState("NSF");

  const updateTyre = (field, value) => {
    if (activeWheel === "Spare") {
      setTyres((prev) => ({
        ...prev,
        Spare: {
          ...prev.Spare,
          [field]: value,
        },
      }));
    } else {
      setTyres((prev) => ({
        ...prev,
        [activeWheel]: { ...prev[activeWheel], [field]: value },
      }));
    }
  };

  const copyToAll = () => {
    const current = tyres[activeWheel];
    setTyres((prev) => {
      const updated = { ...prev };
      ["NSF", "OSF", "NSR", "OSR"].forEach((wheel) => {
        updated[wheel] = {
          ...updated[wheel],
          manufacturer: current.manufacturer,
          runFlat: current.runFlat,
          size: current.size,
          load: current.load,
          speed: current.speed,
        };
      });
      if (updated.Spare.type === "spare_tyre") {
        updated.Spare.details = {
          ...updated.Spare.details,
          manufacturer: current.manufacturer,
          runFlat: current.runFlat,
          size: current.size,
          load: current.load,
          speed: current.speed,
        };
      }
      return updated;
    });
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
        background: "rgba(0,0,0,0.6)",
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
          width: "95%",
          height: "95%",
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* LEFT SIDE (Car Layout) */}
        <div
          style={{
            width: "35%",
            background: "#f9f9f9",
            padding: "20px",
            borderRight: "1px solid #ddd",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <h3 style={{ marginBottom: "20px", color: "#FF4040" }}>Car Wheel Layout</h3>

          {/* Car diagram layout */}
          <div
            style={{
              display: "grid",
              gridTemplateRows: "1fr 1fr",
              gridTemplateColumns: "1fr 1fr",
              gap: "40px",
              marginBottom: "40px",
            }}
          >
            <button
              onClick={() => setActiveWheel("NSF")}
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                background: activeWheel === "NSF" ? "#FF4040" : "#eee",
                color: activeWheel === "NSF" ? "white" : "black",
                fontWeight: "bold",
                border: "2px solid #ccc",
                cursor: "pointer",
              }}
            >
              NSF
            </button>
            <button
              onClick={() => setActiveWheel("OSF")}
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                background: activeWheel === "OSF" ? "#FF4040" : "#eee",
                color: activeWheel === "OSF" ? "white" : "black",
                fontWeight: "bold",
                border: "2px solid #ccc",
                cursor: "pointer",
              }}
            >
              OSF
            </button>
            <button
              onClick={() => setActiveWheel("NSR")}
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                background: activeWheel === "NSR" ? "#FF4040" : "#eee",
                color: activeWheel === "NSR" ? "white" : "black",
                fontWeight: "bold",
                border: "2px solid #ccc",
                cursor: "pointer",
              }}
            >
              NSR
            </button>
            <button
              onClick={() => setActiveWheel("OSR")}
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                background: activeWheel === "OSR" ? "#FF4040" : "#eee",
                color: activeWheel === "OSR" ? "white" : "black",
                fontWeight: "bold",
                border: "2px solid #ccc",
                cursor: "pointer",
              }}
            >
              OSR
            </button>
          </div>

          <button
            onClick={() => setActiveWheel("Spare")}
            style={{
              padding: "14px",
              background: activeWheel === "Spare" ? "#FF4040" : "#eee",
              color: activeWheel === "Spare" ? "white" : "black",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
              width: "70%",
            }}
          >
            Spare / Kit
          </button>
        </div>

        {/* RIGHT SIDE (Details) */}
        <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
          <h2 style={{ color: "#FF4040", marginBottom: "20px" }}>
            {activeWheel === "Spare" ? "Spare Tyre / Kit Details" : `${activeWheel} Tyre Details`}
          </h2>

          {activeWheel !== "Spare" ? (
            <>
              {/* Top line: Manufacturer + Size */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <input
                  placeholder="Manufacturer"
                  value={tyres[activeWheel].manufacturer}
                  onChange={(e) => updateTyre("manufacturer", e.target.value)}
                />
                <input
                  placeholder="Size"
                  value={tyres[activeWheel].size}
                  onChange={(e) => updateTyre("size", e.target.value)}
                />
              </div>

              {/* Second line: Run flat + Copy to all */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
                <button
                  onClick={() => updateTyre("runFlat", !tyres[activeWheel].runFlat)}
                  style={{
                    padding: "10px",
                    background: tyres[activeWheel].runFlat ? "#FF4040" : "#ddd",
                    color: tyres[activeWheel].runFlat ? "white" : "black",
                    border: "none",
                    borderRadius: "6px",
                  }}
                >
                  Run Flat: {tyres[activeWheel].runFlat ? "Yes" : "No"}
                </button>
                <button
                  onClick={copyToAll}
                  style={{
                    padding: "10px 20px",
                    background: "#333",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: "bold",
                  }}
                >
                  Copy to All
                </button>
              </div>

              {/* Third line: Load + Speed */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
                <input
                  placeholder="Load"
                  value={tyres[activeWheel].load}
                  onChange={(e) => updateTyre("load", e.target.value)}
                />
                <input
                  placeholder="Speed"
                  value={tyres[activeWheel].speed}
                  onChange={(e) => updateTyre("speed", e.target.value)}
                />
              </div>

              {/* Tread depths */}
              <h4 style={{ marginTop: "20px" }}>Tread Depth (mm)</h4>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  placeholder="Outer"
                  value={tyres[activeWheel].tread.outer}
                  onChange={(e) =>
                    updateTyre("tread", {
                      ...tyres[activeWheel].tread,
                      outer: e.target.value,
                    })
                  }
                />
                <input
                  placeholder="Middle"
                  value={tyres[activeWheel].tread.middle}
                  onChange={(e) =>
                    updateTyre("tread", {
                      ...tyres[activeWheel].tread,
                      middle: e.target.value,
                    })
                  }
                />
                <input
                  placeholder="Inner"
                  value={tyres[activeWheel].tread.inner}
                  onChange={(e) =>
                    updateTyre("tread", {
                      ...tyres[activeWheel].tread,
                      inner: e.target.value,
                    })
                  }
                />
              </div>

              {/* Concerns */}
              <h4 style={{ marginTop: "20px" }}>Concerns</h4>
              <ul>
                {tyres[activeWheel].concerns.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
              <button
                onClick={() =>
                  updateTyre("concerns", [...tyres[activeWheel].concerns, "New concern"])
                }
                style={{
                  marginTop: "10px",
                  padding: "8px 12px",
                  background: "#FF4040",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                + Add Concern
              </button>
            </>
          ) : (
            <>
              {/* Spare options remain same */}
              <select
                value={tyres.Spare.type}
                onChange={(e) => updateTyre("type", e.target.value)}
              >
                <option value="spare_tyre">Spare Tyre</option>
                <option value="repair_kit">Repair Kit</option>
                <option value="space_saver">Space Saver</option>
                <option value="not_checked">Not Checked</option>
              </select>
            </>
          )}

          {/* Bottom buttons */}
          <div style={{ marginTop: "30px", textAlign: "right" }}>
            <button
              onClick={onClose}
              style={{
                padding: "10px 20px",
                border: "none",
                background: "#aaa",
                color: "white",
                borderRadius: "6px",
                marginRight: "10px",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => onComplete(tyres)}
              style={{
                padding: "10px 20px",
                border: "none",
                background: "#FF4040",
                color: "white",
                borderRadius: "6px",
                fontWeight: "bold",
              }}
            >
              Complete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}