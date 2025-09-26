// src/components/VHC/BrakesHubsDetailsModal.js
import React, { useState } from "react";
import Image from "next/image";

// ✅ Autocomplete small component
function AutoCompleteInput({ value, onChange, options }) {
  const [filtered, setFiltered] = useState([]);
  const handleChange = (val) => {
    onChange(val);
    setFiltered(options.filter((opt) => opt.toString().includes(val)));
  };
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        style={{
          padding: "6px",
          borderRadius: "4px",
          border: "1px solid #ccc",
          width: "100%",
        }}
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
    frontPads: { measurement: "", status: "Green", concerns: [] },
    rearPads: { measurement: "", status: "Green", concerns: [] },
    frontDiscs: { tab: "measurements", measurements: { thickness: "", status: "Green" }, visual: { status: "Green" }, concerns: [] },
    rearDiscs: { tab: "measurements", measurements: { thickness: "", status: "Green" }, visual: { status: "Green" }, concerns: [] },
    rearDrums: { status: "" },
    ...initialData,
  });

  const [activeSide, setActiveSide] = useState("front");
  const [showDrum, setShowDrum] = useState(false);
  const [concernPopup, setConcernPopup] = useState({
    open: false,
    category: "",
    tempConcern: { issue: "", status: "Red" },
  });

  const padOptions = Array.from({ length: 15 }, (_, i) => i);

  const updatePadMeasurement = (category, value) => {
    setData((prev) => ({
      ...prev,
      [category]: { ...prev[category], measurement: value },
    }));
    const numbers = value.split(",").map((v) => parseFloat(v.trim())).filter((v) => !isNaN(v));
    const min = Math.min(...numbers);
    if (min >= 5) updatePadStatus(category, "Green");
    else if (min >= 3) updatePadStatus(category, "Amber");
    else updatePadStatus(category, "Red");
  };

  const updatePadStatus = (category, value) => {
    setData((prev) => ({
      ...prev,
      [category]: { ...prev[category], status: value },
    }));
  };

  const updateDisc = (category, field, value) => {
    setData((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: { ...prev[category][field], ...value },
      },
    }));
  };

  const addConcern = (category, concern) => {
    setData((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        concerns: [...prev[category].concerns, concern],
      },
    }));
  };

  const isCompleteEnabled = () => {
    const padsDone = ["frontPads", "rearPads"].every(
      (p) => data[p].measurement !== "" && data[p].status !== ""
    );
    if (showDrum) {
      return padsDone && data.rearDrums.status !== "";
    } else {
      const discsDone = ["frontDiscs", "rearDiscs"].every(
        (d) =>
          data[d].measurements.thickness !== "" &&
          data[d].measurements.status &&
          data[d].visual.status
      );
      return padsDone && discsDone;
    }
  };

  if (!isOpen) return null;

  // ✅ Pads Section
  const PadsSection = ({ category }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, paddingRight: "12px" }}>
      <label style={{ marginTop: "66px" }}>Pad Measurement (mm):</label>
      <AutoCompleteInput
        value={data[category].measurement}
        onChange={(val) => updatePadMeasurement(category, val)}
        options={padOptions}
      />
      <label>Status:</label>
      <select
        value={data[category].status}
        onChange={(e) => updatePadStatus(category, e.target.value)}
        style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
      >
        <option>Red</option>
        <option>Amber</option>
        <option>Green</option>
      </select>

      <button
        onClick={() => setConcernPopup({ open: true, category, tempConcern: { issue: "", status: "Red" } })}
        style={{ padding: "6px 12px", borderRadius: "4px", border: "none", background: "#FF4040", color: "white", cursor: "pointer", marginTop: "8px" }}
      >
        + Add Concern
      </button>

      {data[category].concerns.map((c, idx) => (
        <div key={idx} style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
          <span>{c.issue}</span>
          <select
            value={c.status}
            onChange={(e) => {
              const updated = [...data[category].concerns];
              updated[idx].status = e.target.value;
              setData((prev) => ({
                ...prev,
                [category]: { ...prev[category], concerns: updated },
              }));
            }}
            style={{ padding: "4px", borderRadius: "4px", border: "1px solid #ccc" }}
          >
            <option>Red</option>
            <option>Amber</option>
          </select>
        </div>
      ))}
    </div>
  );

  // ✅ Discs Section
  const DiscsSection = ({ category, showDrumButton }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, borderLeft: "1px solid #ddd", paddingLeft: "12px" }}>
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          {["measurements", "visual"].map((tab) => (
            <div
              key={tab}
              onClick={() => setData((prev) => ({ ...prev, [category]: { ...prev[category], tab } }))}
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                borderRadius: "4px",
                backgroundColor: data[category].tab === tab ? "#FF4040" : "#f5f5f5",
                color: data[category].tab === tab ? "white" : "black",
                fontWeight: data[category].tab === tab ? "bold" : "normal",
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </div>
          ))}
        </div>
        {showDrumButton && (
          <button
            onClick={() => setShowDrum(true)}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
              background: "#FF4040",
              color: "white",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Drum Brakes
          </button>
        )}
      </div>

      {data[category].tab === "measurements" && (
        <>
          <label style={{ marginTop: "12px" }}>Disk Thickness (mm):</label>
          <input
            type="text"
            value={data[category].measurements.thickness}
            onChange={(e) => updateDisc(category, "measurements", { thickness: e.target.value })}
            style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
          <label>Status:</label>
          <select
            value={data[category].measurements.status}
            onChange={(e) => updateDisc(category, "measurements", { status: e.target.value })}
            style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
          >
            <option>Red</option>
            <option>Amber</option>
            <option>Green</option>
          </select>
        </>
      )}
      {data[category].tab === "visual" && (
        <>
          <label style={{ marginTop: "12px" }}>Visual check status:</label>
          <select
            value={data[category].visual.status}
            onChange={(e) => updateDisc(category, "visual", { status: e.target.value })}
            style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
          >
            <option>Red</option>
            <option>Amber</option>
            <option>Green</option>
          </select>
        </>
      )}

      <button
        onClick={() => setConcernPopup({ open: true, category, tempConcern: { issue: "", status: "Red" } })}
        style={{ padding: "6px 12px", borderRadius: "4px", border: "none", background: "#FF4040", color: "white", cursor: "pointer", marginTop: "8px" }}
      >
        + Add Concern
      </button>

      {data[category].concerns.map((c, idx) => (
        <div key={idx} style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
          <span>{c.issue}</span>
          <select
            value={c.status}
            onChange={(e) => {
              const updated = [...data[category].concerns];
              updated[idx].status = e.target.value;
              setData((prev) => ({
                ...prev,
                [category]: { ...prev[category], concerns: updated },
              }));
            }}
            style={{ padding: "4px", borderRadius: "4px", border: "1px solid #ccc" }}
          >
            <option>Red</option>
            <option>Amber</option>
          </select>
        </div>
      ))}
    </div>
  );

  // ✅ Drum Brakes Section
  const DrumBrakesSection = () => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "20px" }}>
      <h3 style={{ marginBottom: "16px" }}>Drum Brakes</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center" }}>
        {["Good", "Visual check", "Replace", "Not checked"].map((label) => (
          <button
            key={label}
            onClick={() => setData((prev) => ({ ...prev, rearDrums: { status: label } }))}
            style={{
              padding: "12px 20px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              background: data.rearDrums.status === label ? "#FF4040" : "#f5f5f5",
              color: data.rearDrums.status === label ? "white" : "black",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: "16px" }}>
        <button
          onClick={() => setShowDrum(false)}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            background: "#FF4040",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Disk Brakes
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
      <div style={{ background: "white", borderRadius: "10px", width: "1000px", height: "600px", display: "flex", overflow: "hidden", position: "relative" }}>
        
        {/* Left side */}
        <div style={{ width: "35%", background: "#fff", borderRight: "1px solid #eee", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px" }}>
          <h3 style={{ color: "#FF4040" }}>Car View</h3>

          {/* ✅ Brake disk and pad images acting as buttons */}
          <Image
            src="/images/FrontBrakes.png"
            alt="Front Brakes"
            width={80}
            height={80}
            onClick={() => { setActiveSide("front"); setShowDrum(false); }}
            style={{ cursor: "pointer", border: activeSide === "front" ? "2px solid #FF4040" : "none", borderRadius: "6px" }}
          />
          <Image
            src="/images/RearBrake.png"
            alt="Rear Brakes"
            width={80}
            height={80}
            onClick={() => { setActiveSide("rear"); setShowDrum(false); }}
            style={{ cursor: "pointer", border: activeSide === "rear" ? "2px solid #FF4040" : "none", borderRadius: "6px" }}
          />

          {/* Optional buttons */}
          <button onClick={() => { setActiveSide("front"); setShowDrum(false); }} style={{ padding: "10px 20px", borderRadius: "6px", border: "none", background: activeSide === "front" ? "#FF4040" : "#f5f5f5", color: activeSide === "front" ? "white" : "black", cursor: "pointer", fontWeight: "bold" }}>
            Front Brakes
          </button>
          <button onClick={() => { setActiveSide("rear"); setShowDrum(false); }} style={{ padding: "10px 20px", borderRadius: "6px", border: "none", background: activeSide === "rear" ? "#FF4040" : "#f5f5f5", color: activeSide === "rear" ? "white" : "black", cursor: "pointer", fontWeight: "bold" }}>
            Rear Brakes
          </button>
        </div>

        {/* Right side */}
        <div style={{ flex: 1, padding: "16px", overflowY: "auto" }}>
          {activeSide === "front" && (
            <div style={{ display: "flex", gap: "16px", height: "100%" }}>
              <PadsSection category="frontPads" />
              <DiscsSection category="frontDiscs" />
            </div>
          )}
          {activeSide === "rear" && !showDrum && (
            <div style={{ display: "flex", gap: "16px", height: "100%" }}>
              <PadsSection category="rearPads" />
              <DiscsSection category="rearDiscs" showDrumButton />
            </div>
          )}
          {activeSide === "rear" && showDrum && <DrumBrakesSection />}

          {/* Fixed Action buttons */}
          <div style={{ position: "absolute", bottom: "16px", right: "16px", display: "flex", gap: "10px" }}>
            <button onClick={onClose} style={{ padding: "8px 16px", border: "none", background: "#ccc", color: "#333", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
              Close
            </button>
            <button disabled={!isCompleteEnabled()} onClick={() => onComplete(data)} style={{ padding: "8px 16px", border: "none", background: isCompleteEnabled() ? "#FF4040" : "#f5f5f5", color: isCompleteEnabled() ? "white" : "#aaa", borderRadius: "6px", fontWeight: "bold", cursor: isCompleteEnabled() ? "pointer" : "not-allowed" }}>
              Complete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
