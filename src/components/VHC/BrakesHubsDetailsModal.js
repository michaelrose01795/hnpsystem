// file location: src/components/VHC/BrakesHubsDetailsModal.js

import React, { useState } from "react";

// ✅ Autocomplete small component
function AutoCompleteInput({ value, onChange, options }) {
  const [filtered, setFiltered] = useState([]);
  const handleChange = (val) => {
    onChange(val);
    setFiltered(options.filter((opt) => opt.toString().includes(val)));
  };
  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
      />
      {filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            background: "white",
            border: "1px solid #ccc",
            width: "100%",
            maxHeight: "100px",
            overflowY: "auto",
            zIndex: 10,
          }}
        >
          {filtered.map((opt, idx) => (
            <div
              key={idx}
              onClick={() => {
                onChange(opt);
                setFiltered([]);
              }}
              style={{ padding: "4px", cursor: "pointer" }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BrakesHubsDetailsModal({ isOpen, onClose, onComplete, initialData }) {
  const [data, setData] = useState({
    frontPads: { measurement: "", concerns: [] },
    rearPads: { measurement: "", concerns: [] },
    frontDiscs: { tab: "measurements", measurements: { thickness: "", status: "Red" }, visual: { status: "Red" }, concerns: [] },
    rearDiscs: { tab: "measurements", measurements: { thickness: "", status: "Red" }, visual: { status: "Red" }, concerns: [] },
    ...initialData,
  });

  const [activeCategory, setActiveCategory] = useState("frontPads");
  const [concernPopup, setConcernPopup] = useState({ open: false, category: "", tempConcern: { issue: "", status: "Red" } });

  const padOptions = Array.from({ length: 15 }, (_, i) => i); // 0-14 mm
  const discIssues = ["Pitting", "Lipped", "Corroded", "Warped"];

  const updatePadMeasurement = (category, value) => {
    setData((prev) => ({ ...prev, [category]: { ...prev[category], measurement: value } }));
  };

  const updateDisc = (category, field, value) => {
    setData((prev) => ({ ...prev, [category]: { ...prev[category], [field]: { ...prev[category][field], ...value } } }));
  };

  const addConcern = (category, concern) => {
    setData((prev) => ({ ...prev, [category]: { ...prev[category], concerns: [...prev[category].concerns, concern] } }));
  };

  const isCompleteEnabled = () => {
    const pads = ["frontPads", "rearPads"];
    const discs = ["frontDiscs", "rearDiscs"];
    return pads.every((p) => data[p].measurement !== "") &&
      discs.every(
        (d) =>
          data[d].measurements.thickness !== "" &&
          data[d].measurements.status &&
          data[d].visual.status
      );
  };

  if (!isOpen) return null;

  const categories = ["frontPads", "frontDiscs", "rearPads", "rearDiscs"];

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
          width: "800px",
          height: "550px", // Fixed height
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* Left: categories */}
        <div style={{ width: "200px", borderRight: "1px solid #eee", paddingRight: "16px" }}>
          <h3 style={{ color: "#FF4040", marginBottom: "12px" }}>Categories</h3>
          {categories.map((cat) => (
            <div
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: "8px 12px",
                marginBottom: "6px",
                borderRadius: "4px",
                cursor: "pointer",
                backgroundColor: activeCategory === cat ? "#FF4040" : "#f5f5f5",
                color: activeCategory === cat ? "white" : "black",
                fontWeight: activeCategory === cat ? "bold" : "normal",
                textTransform: "capitalize",
              }}
            >
              {cat.replace(/([A-Z])/g, " $1")}
            </div>
          ))}
        </div>

        {/* Right: details */}
        <div style={{ flex: 1, paddingLeft: "16px", overflowY: "auto" }}>
          <h3 style={{ fontWeight: "bold", marginBottom: "12px", textTransform: "capitalize" }}>
            {activeCategory.replace(/([A-Z])/g, " $1")}
          </h3>

          {/* Pads */}
          {(activeCategory === "frontPads" || activeCategory === "rearPads") && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", minHeight: "350px" }}>
              <label>Measurement (mm):</label>
              <AutoCompleteInput
                value={data[activeCategory].measurement}
                onChange={(val) => updatePadMeasurement(activeCategory, val)}
                options={padOptions}
              />
              <button
                onClick={() =>
                  setConcernPopup({ open: true, category: activeCategory, tempConcern: { issue: "", status: "Red" } })
                }
                style={{
                  padding: "6px 12px",
                  borderRadius: "4px",
                  border: "none",
                  background: "#FF4040",
                  color: "white",
                  cursor: "pointer",
                  marginTop: "8px",
                }}
              >
                + Add Concern
              </button>

              {/* Show added concerns */}
              {data[activeCategory].concerns.map((c, idx) => (
                <div key={idx} style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
                  <span>{c.issue}</span>
                  <select
                    value={c.status}
                    onChange={(e) => {
                      const updated = [...data[activeCategory].concerns];
                      updated[idx].status = e.target.value;
                      setData((prev) => ({ ...prev, [activeCategory]: { ...prev[activeCategory], concerns: updated } }));
                    }}
                    style={{ padding: "4px", borderRadius: "4px", border: "1px solid #ccc" }}
                  >
                    <option>Red</option>
                    <option>Amber</option>
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Discs */}
          {(activeCategory === "frontDiscs" || activeCategory === "rearDiscs") && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", minHeight: "350px" }}>
              {/* Tabs */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                {["measurements", "visual"].map((tab) => (
                  <div
                    key={tab}
                    onClick={() =>
                      setData((prev) => ({ ...prev, [activeCategory]: { ...prev[activeCategory], tab } }))
                    }
                    style={{
                      padding: "6px 12px",
                      cursor: "pointer",
                      borderRadius: "4px",
                      backgroundColor: data[activeCategory].tab === tab ? "#FF4040" : "#f5f5f5",
                      color: data[activeCategory].tab === tab ? "white" : "black",
                      fontWeight: data[activeCategory].tab === tab ? "bold" : "normal",
                    }}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </div>
                ))}
              </div>

              {/* Tab content */}
              {data[activeCategory].tab === "measurements" ? (
                <>
                  <label>Thickness (mm):</label>
                  <input
                    type="number"
                    value={data[activeCategory].measurements.thickness}
                    onChange={(e) => updateDisc(activeCategory, "measurements", { thickness: e.target.value })}
                    style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
                  />
                  <label>Status:</label>
                  <select
                    value={data[activeCategory].measurements.status}
                    onChange={(e) => updateDisc(activeCategory, "measurements", { status: e.target.value })}
                    style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
                  >
                    <option>Red</option>
                    <option>Amber</option>
                    <option>Green</option>
                  </select>

                  <button
                    onClick={() =>
                      setConcernPopup({ open: true, category: activeCategory, tempConcern: { issue: "", status: "Red" } })
                    }
                    style={{
                      padding: "6px 12px",
                      borderRadius: "4px",
                      border: "none",
                      background: "#FF4040",
                      color: "white",
                      cursor: "pointer",
                      marginTop: "8px",
                    }}
                  >
                    + Add Concern
                  </button>

                  {/* Show added concerns */}
                  {data[activeCategory].concerns.map((c, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
                      <span>{c.issue}</span>
                      <select
                        value={c.status}
                        onChange={(e) => {
                          const updated = [...data[activeCategory].concerns];
                          updated[idx].status = e.target.value;
                          setData((prev) => ({ ...prev, [activeCategory]: { ...prev[activeCategory], concerns: updated } }));
                        }}
                        style={{ padding: "4px", borderRadius: "4px", border: "1px solid #ccc" }}
                      >
                        <option>Red</option>
                        <option>Amber</option>
                      </select>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <label>Visual check status:</label>
                  <select
                    value={data[activeCategory].visual.status}
                    onChange={(e) => updateDisc(activeCategory, "visual", { status: e.target.value })}
                    style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
                  >
                    <option>Red</option>
                    <option>Amber</option>
                    <option>Green</option>
                  </select>

                  <button
                    onClick={() =>
                      setConcernPopup({ open: true, category: activeCategory, tempConcern: { issue: "", status: "Red" } })
                    }
                    style={{
                      marginTop: "8px",
                      padding: "6px 12px",
                      borderRadius: "4px",
                      border: "none",
                      background: "#FF4040",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    + Add Concern
                  </button>

                  {/* Show added concerns */}
                  {data[activeCategory].concerns.map((c, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
                      <span>{c.issue}</span>
                      <select
                        value={c.status}
                        onChange={(e) => {
                          const updated = [...data[activeCategory].concerns];
                          updated[idx].status = e.target.value;
                          setData((prev) => ({ ...prev, [activeCategory]: { ...prev[activeCategory], concerns: updated } }));
                        }}
                        style={{ padding: "4px", borderRadius: "4px", border: "1px solid #ccc" }}
                      >
                        <option>Red</option>
                        <option>Amber</option>
                      </select>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Concern popup */}
          {concernPopup.open && (
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
                zIndex: 1100,
              }}
            >
              <div
                style={{
                  background: "white",
                  padding: "24px",
                  borderRadius: "10px",
                  width: "400px",
                }}
              >
                <h3>Add Concern</h3>
                <label>Issue:</label>
                <AutoCompleteInput
                  value={concernPopup.tempConcern.issue}
                  onChange={(val) =>
                    setConcernPopup((prev) => ({ ...prev, tempConcern: { ...prev.tempConcern, issue: val } }))
                  }
                  options={discIssues}
                />
                <label>Status:</label>
                <select
                  value={concernPopup.tempConcern.status}
                  onChange={(e) =>
                    setConcernPopup((prev) => ({ ...prev, tempConcern: { ...prev.tempConcern, status: e.target.value } }))
                  }
                  style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
                >
                  <option>Red</option>
                  <option>Amber</option>
                </select>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
                  <button
                    onClick={() =>
                      setConcernPopup({ open: false, category: "", tempConcern: { issue: "", status: "Red" } })
                    }
                    style={{
                      padding: "6px 12px",
                      borderRadius: "4px",
                      border: "none",
                      background: "#ccc",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      addConcern(concernPopup.category, concernPopup.tempConcern);
                      setConcernPopup({ open: false, category: "", tempConcern: { issue: "", status: "Red" } });
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "4px",
                      border: "none",
                      background: "#FF4040",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
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
              disabled={!isCompleteEnabled()}
              onClick={() => onComplete(data)}
              style={{
                padding: "8px 16px",
                border: "none",
                background: isCompleteEnabled() ? "#FF4040" : "#f5f5f5",
                color: isCompleteEnabled() ? "white" : "#aaa",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: isCompleteEnabled() ? "pointer" : "not-allowed",
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
