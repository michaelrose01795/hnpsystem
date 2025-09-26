// file location: src/components/VHC/ServiceIndicatorDetailsModal.js

import React, { useState } from "react";

export default function ServiceIndicatorDetailsModal({
  isOpen,
  initialData,
  onClose,
  onComplete,
}) {
  const [serviceChoice, setServiceChoice] = useState(null);
  const [oilStatus, setOilStatus] = useState(null);
  const [concerns, setConcerns] = useState([]);
  const [showConcernModal, setShowConcernModal] = useState(false);
  const [newConcern, setNewConcern] = useState("");
  const [concernStatus, setConcernStatus] = useState("Red");
  const [activeConcernTarget, setActiveConcernTarget] = useState(null);

  if (!isOpen) return null;

  const addConcern = () => {
    if (newConcern.trim() !== "") {
      setConcerns((prev) => [
        ...prev,
        { text: newConcern, status: concernStatus, source: activeConcernTarget },
      ]);
      setNewConcern("");
      setConcernStatus("Red");
      setShowConcernModal(false);
      setActiveConcernTarget(null);
    }
  };

  const canComplete =
    serviceChoice &&
    (oilStatus === "Yes" ||
      oilStatus === "EV" ||
      (oilStatus === "No" && concerns.some((c) => c.source === "oil")));

  const underBonnetItems = [
    "Antifreeze Strength",
    "Water/Oil",
    "Fluid Leaks",
    "Alternator Belt/Battery",
    "Power Steering Fluid",
    "Fuel System",
    "Cam Belt",
    "Miscellaneous",
  ];

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
          width: "1000px",
          height: "600px",
          display: "flex",
          flexDirection: "column",
          padding: "20px",
          position: "relative",
        }}
      >
        <h2 style={{ color: "#FF4040", marginBottom: "16px", textAlign: "center" }}>
          Service Indicator & Under Bonnet
        </h2>

        <div style={{ display: "flex", flex: 1, gap: "20px" }}>
          {/* LEFT SIDE */}
          <div
            style={{
              flex: 1,
              borderRight: "1px solid #ddd",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: "20px",
            }}
          >
            <h3>Service Reminder</h3>
            {["reset", "not_required", "no_reminder", "indicator_on"].map((choice) => (
              <button
                key={choice}
                onClick={() => setServiceChoice(choice)}
                style={{
                  width: "70%",
                  padding: "14px",
                  background: serviceChoice === choice ? "#FF4040" : "#eee",
                  color: serviceChoice === choice ? "white" : "black",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                {choice === "reset"
                  ? "Service Reminder Reset"
                  : choice === "not_required"
                  ? "Service Reminder Not Required"
                  : choice === "no_reminder"
                  ? "Doesn’t Have a Service Reminder"
                  : "Service Indicator On"}
              </button>
            ))}
            <button
              onClick={() => {
                setActiveConcernTarget("service");
                setShowConcernModal(true);
              }}
              style={{
                width: "70%",
                padding: "10px",
                background: "#FF4040",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              + Add Concern
            </button>
          </div>

          {/* RIGHT SIDE */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Top 40% - Oil Level */}
            <div
              style={{
                flex: 0.4,
                borderBottom: "1px solid #ddd",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: "20px",
              }}
            >
              <h3>Oil Level OK?</h3>
              <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                {["Yes", "No", "EV"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setOilStatus(status)}
                    style={{
                      padding: "12px 18px",
                      background: oilStatus === status ? "#FF4040" : "#eee",
                      color: oilStatus === status ? "white" : "black",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    {status}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setActiveConcernTarget("oil");
                  setShowConcernModal(true);
                }}
                style={{
                  padding: "10px 14px",
                  background: "#FF4040",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                + Add Concern
              </button>
            </div>

            {/* Bottom 60% - Other Under Bonnet Items */}
            <div
              style={{
                flex: 0.6,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "15px", 
                padding: "1px",
                alignContent: "start", // move buttons to top
              }}
            >
              {underBonnetItems.map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setActiveConcernTarget(item);
                    setShowConcernModal(true);
                  }}
                  style={{
                    padding: "10px", // medium size between small and original
                    background: "#eee",
                    color: "black",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Concern Modal */}
        {showConcernModal && (
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
              zIndex: 3000,
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
                gap: "16px",
                maxHeight: "80%",
                overflowY: "auto",
              }}
            >
              <h3 style={{ color: "#FF4040" }}>Add Concern</h3>
              <textarea
                value={newConcern}
                onChange={(e) => setNewConcern(e.target.value)}
                placeholder="Describe concern..."
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "1rem" }}
              />
              <div style={{ display: "flex", gap: "10px" }}>
                {["Red", "Amber", "Green"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setConcernStatus(status)}
                    style={{
                      flex: 1,
                      padding: "8px",
                      borderRadius: "6px",
                      border: "none",
                      fontWeight: "bold",
                      cursor: "pointer",
                      background: concernStatus === status ? "#FF4040" : "#ddd",
                      color: concernStatus === status ? "white" : "black",
                    }}
                  >
                    {status}
                  </button>
                ))}
              </div>
              <button
                onClick={addConcern}
                style={{
                  padding: "10px",
                  borderRadius: "6px",
                  background: "#FF4040",
                  color: "white",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Save Concern
              </button>
              <button
                onClick={() => setShowConcernModal(false)}
                style={{
                  padding: "10px",
                  borderRadius: "6px",
                  background: "#ccc",
                  color: "black",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Fixed buttons */}
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            right: "20px",
            display: "flex",
            gap: "10px",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 16px",
              border: "none",
              background: "gray",
              color: "white",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Close
          </button>
          <button
            disabled={!canComplete}
            onClick={() => onComplete({ serviceChoice, oilStatus, concerns })}
            style={{
              padding: "1px 16px",
              border: "none",
              background: canComplete ? "#FF4040" : "#aaa",
              color: "white",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: canComplete ? "pointer" : "not-allowed",
            }}
          >
            Complete
          </button>
        </div>
      </div>
    </div>
  );
}
