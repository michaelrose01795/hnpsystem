// file location: src/components/VHC/ServiceIndicatorDetailsModal.js

import React, { useState } from "react";

export default function ServiceIndicatorDetailsModal({
  isOpen,
  initialData,
  onClose,
  onComplete,
}) {
  const [serviceChoice, setServiceChoice] = useState(null); // left side choice
  const [oilStatus, setOilStatus] = useState(null); // Yes, No, EV
  const [concerns, setConcerns] = useState([]); // store concerns
  const [showConcernModal, setShowConcernModal] = useState(false); // toggle concern popup
  const [newConcern, setNewConcern] = useState(""); // concern text
  const [concernStatus, setConcernStatus] = useState("Red"); // Red/Amber/Green
  const [activeConcernTarget, setActiveConcernTarget] = useState(null); // track where concern came from

  if (!isOpen) return null;

  // ✅ Add a new concern
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

  // ✅ Check if we can complete
  const canComplete =
    serviceChoice &&
    (oilStatus === "Yes" ||
      oilStatus === "EV" ||
      (oilStatus === "No" && concerns.some((c) => c.source === "oil")));

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
          width: "900px",
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

        {/* ✅ Split into 2 sides */}
        <div style={{ display: "flex", flex: 1, gap: "20px" }}>
          {/* LEFT SIDE - Service Reminder Reset */}
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
            <button
              onClick={() => setServiceChoice("reset")}
              style={{
                width: "70%",
                padding: "14px",
                background: serviceChoice === "reset" ? "#FF4040" : "#eee",
                color: serviceChoice === "reset" ? "white" : "black",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Service Reminder Reset
            </button>
            <button
              onClick={() => setServiceChoice("not_required")}
              style={{
                width: "70%",
                padding: "14px",
                background: serviceChoice === "not_required" ? "#FF4040" : "#eee",
                color: serviceChoice === "not_required" ? "white" : "black",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Service Reminder Not Required
            </button>
            <button
              onClick={() => setServiceChoice("no_reminder")}
              style={{
                width: "70%",
                padding: "14px",
                background: serviceChoice === "no_reminder" ? "#FF4040" : "#eee",
                color: serviceChoice === "no_reminder" ? "white" : "black",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Doesn’t Have a Service Reminder
            </button>
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

          {/* RIGHT SIDE - Under Bonnet */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: "20px",
            }}
          >
            <h3>Oil Level OK?</h3>
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <button
                onClick={() => setOilStatus("Yes")}
                style={{
                  padding: "12px 18px",
                  background: oilStatus === "Yes" ? "#FF4040" : "#eee",
                  color: oilStatus === "Yes" ? "white" : "black",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Yes
              </button>
              <button
                onClick={() => setOilStatus("No")}
                style={{
                  padding: "12px 18px",
                  background: oilStatus === "No" ? "#FF4040" : "#eee",
                  color: oilStatus === "No" ? "white" : "black",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                No
              </button>
              <button
                onClick={() => setOilStatus("EV")}
                style={{
                  padding: "12px 18px",
                  background: oilStatus === "EV" ? "#FF4040" : "#eee",
                  color: oilStatus === "EV" ? "white" : "black",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                EV
              </button>
            </div>

            {/* ✅ Concern button always available */}
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

            {concerns.length > 0 && (
              <ul style={{ marginTop: "10px", textAlign: "left" }}>
                {concerns.map((c, idx) => (
                  <li key={idx}>
                    {c.text} ({c.status})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ✅ Concern Modal Popup */}
        {showConcernModal && (
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
              zIndex: 1100,
            }}
          >
            <div
              style={{
                background: "white",
                padding: "20px",
                borderRadius: "8px",
                width: "400px",
              }}
            >
              <h3 style={{ marginBottom: "10px" }}>Add Concern</h3>
              <textarea
                value={newConcern}
                onChange={(e) => setNewConcern(e.target.value)}
                placeholder="Describe concern..."
                style={{
                  width: "100%",
                  height: "80px",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  marginBottom: "10px",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "10px",
                  marginBottom: "10px",
                }}
              >
                {["Red", "Amber", "Green"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setConcernStatus(s)}
                    style={{
                      padding: "8px 12px",
                      background: concernStatus === s ? "#FF4040" : "#eee",
                      color: concernStatus === s ? "white" : "black",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  onClick={() => {
                    setShowConcernModal(false);
                    setActiveConcernTarget(null);
                  }}
                  style={{
                    padding: "8px 12px",
                    background: "gray",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={addConcern}
                  style={{
                    padding: "8px 12px",
                    background: "#FF4040",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ Fixed buttons */}
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
              padding: "10px 16px",
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