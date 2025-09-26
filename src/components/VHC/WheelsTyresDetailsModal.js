// file location: src/components/VHC/WheelsTyresDetailsModal.js

import React, { useState } from "react";

export default function WheelsTyresDetailsModal({ isOpen, onClose, onComplete }) {
  // ✅ Tyre template
  const initialTyre = {
    manufacturer: "",
    runFlat: false,
    size: "",
    load: "",
    speed: "",
    tread: { outer: "", middle: "", inner: "" },
    treadLocked: { outer: false, middle: false, inner: false },
    concerns: [],
  };

  // ✅ All wheels state
  const [tyres, setTyres] = useState({
    NSF: { ...initialTyre },
    OSF: { ...initialTyre },
    NSR: { ...initialTyre },
    OSR: { ...initialTyre },
    Spare: {
      type: "",
      year: "",
      month: "",
      condition: "",
      details: { ...initialTyre },
      concerns: [],
      note: "",
    },
  });

  const [activeWheel, setActiveWheel] = useState("NSF");
  const [copyActive, setCopyActive] = useState(false);
  const [concernModal, setConcernModal] = useState(null);
  const [concernInput, setConcernInput] = useState("");
  const [concernStatus, setConcernStatus] = useState("Amber");

  // ✅ Tyre brands
  const tyreBrands = [
    "Unknown",
    "Michelin",
    "Continental",
    "Goodyear",
    "Pirelli",
    "Bridgestone",
    "Dunlop",
    "Yokohama",
    "Hankook",
    "Kumho",
    "Falken",
    "Toyo",
    "Nexen",
    "Firestone",
  ];

  // ✅ Update normal fields
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

  // ✅ Update tread
  const updateTread = (section, value) => {
    setTyres((prev) => {
      const updated = { ...prev };
      const wheel = updated[activeWheel];
      if (!wheel) return prev;

      if (section === "outer") {
        const newTread = {
          ...wheel.tread,
          outer: value,
          middle: wheel.treadLocked.middle ? wheel.tread.middle : value,
          inner: wheel.treadLocked.inner ? wheel.tread.inner : value,
        };
        updated[activeWheel] = {
          ...wheel,
          tread: newTread,
          treadLocked: { ...wheel.treadLocked, outer: true },
        };
      } else {
        updated[activeWheel] = {
          ...wheel,
          tread: { ...wheel.tread, [section]: value },
          treadLocked: { ...wheel.treadLocked, [section]: true },
        };
      }
      return updated;
    });
  };

  // ✅ Copy to all toggle
  const copyToAll = () => {
    setCopyActive((prev) => !prev);
    if (!copyActive) {
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
        if (updated.Spare.type === "spare") {
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
    }
  };

  // ✅ Add concern
  const addConcern = () => {
    if (!concernInput.trim()) return;
    setTyres((prev) => {
      const updated = { ...prev };
      if (!updated[activeWheel].concerns) updated[activeWheel].concerns = [];
      updated[activeWheel].concerns.push({
        text: concernInput,
        status: concernStatus,
      });
      return updated;
    });
    setConcernModal(null);
    setConcernInput("");
  };

  // ✅ Validation - all wheels & spare
  const allWheelsComplete = () => {
    const checkTyre = (t) => t.manufacturer && t.size && t.load && t.speed;
    const mainWheels = ["NSF", "OSF", "NSR", "OSR"].every((w) => checkTyre(tyres[w]));
    let spareOk = false;

    if (tyres.Spare.type === "spare") {
      spareOk =
        tyres.Spare.details.manufacturer &&
        tyres.Spare.details.size &&
        tyres.Spare.details.load &&
        tyres.Spare.details.speed;
    } else if (tyres.Spare.type === "repair") {
      spareOk = tyres.Spare.month && tyres.Spare.year;
    } else if (tyres.Spare.type === "space_saver") {
      spareOk = tyres.Spare.condition !== "";
    } else if (tyres.Spare.type === "not_checked") {
      spareOk = tyres.Spare.note.trim() !== "";
    } else if (tyres.Spare.type === "boot_full") {
      spareOk = true;
    }
    return mainWheels && spareOk;
  };

  if (!isOpen) return null;

  // ✅ Button style
  const buttonStyle = (active) => ({
    padding: "8px 12px",
    background: active ? "#FF4040" : "#ddd",
    color: active ? "white" : "black",
    border: "none",
    borderRadius: "6px",
    fontWeight: "bold",
    flex: 1,
    cursor: "pointer",
  });

  // ✅ Input style (for tread boxes narrower)
  const treadInputStyle = (active) => ({
    padding: "6px",
    background: active ? "#FF4040" : "#f0f0f0",
    color: active ? "white" : "black",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontWeight: "bold",
    width: "70px",
    textAlign: "center",
  });

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
          overflow: "hidden",
        }}
      >
        {/* LEFT SIDE */}
        <div
          style={{
            width: "40%",
            background: "#f9f9f9",
            padding: "20px",
            borderRight: "1px solid #ddd",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <h3 style={{ marginBottom: "20px", color: "#FF4040" }}>Top View</h3>
          <div
            style={{
              display: "grid",
              gridTemplateRows: "1fr 1fr",
              gridTemplateColumns: "1fr 1fr",
              gap: "40px",
              marginBottom: "40px",
            }}
          >
            {["NSF", "OSF", "NSR", "OSR"].map((wheel) => (
              <button
                key={wheel}
                onClick={() => setActiveWheel(wheel)}
                style={{
                  width: "100px",
                  height: "100px",
                  borderRadius: "50%",
                  background: activeWheel === wheel ? "#FF4040" : "#eee",
                  color: activeWheel === wheel ? "white" : "black",
                  fontWeight: "bold",
                  border: "2px solid #ccc",
                  cursor: "pointer",
                }}
              >
                {wheel}
              </button>
            ))}
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

        {/* RIGHT SIDE */}
        <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
          <h2 style={{ color: "#FF4040", marginBottom: "20px" }}>
            {activeWheel === "Spare" ? "Spare / Kit Details" : `${activeWheel} Tyre Details`}
          </h2>

          {activeWheel !== "Spare" ? (
            <>
              {/* Copy + Run Flat */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
                <button onClick={copyToAll} style={buttonStyle(copyActive)}>
                  Copy to All
                </button>
                <button
                  onClick={() => updateTyre("runFlat", !tyres[activeWheel].runFlat)}
                  style={buttonStyle(tyres[activeWheel].runFlat)}
                >
                  Run Flat: {tyres[activeWheel].runFlat ? "Yes" : "No"}
                </button>
              </div>

              {/* Dropdowns */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <select
                  value={tyres[activeWheel].manufacturer}
                  onChange={(e) => updateTyre("manufacturer", e.target.value)}
                  style={buttonStyle(!!tyres[activeWheel].manufacturer)}
                >
                  <option value="">Manufacturer</option>
                  {tyreBrands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Size"
                  value={tyres[activeWheel].size}
                  onChange={(e) => updateTyre("size", e.target.value)}
                  style={buttonStyle(!!tyres[activeWheel].size)}
                />
                <input
                  placeholder="Load"
                  value={tyres[activeWheel].load}
                  onChange={(e) => updateTyre("load", e.target.value)}
                  style={buttonStyle(!!tyres[activeWheel].load)}
                />
                <input
                  placeholder="Speed"
                  value={tyres[activeWheel].speed}
                  onChange={(e) => updateTyre("speed", e.target.value)}
                  style={buttonStyle(!!tyres[activeWheel].speed)}
                />
              </div>

              {/* Tread depths */}
              <h4 style={{ marginTop: "20px" }}>Tread Depth (mm)</h4>
              <div style={{ display: "flex", gap: "12px" }}>
                {["outer", "middle", "inner"].map((section) => (
                  <input
                    key={section}
                    placeholder={section.toUpperCase()}
                    value={tyres[activeWheel].tread[section]}
                    onChange={(e) => updateTread(section, e.target.value)}
                    style={treadInputStyle(!!tyres[activeWheel].tread[section])}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Spare / Kit options */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                {["spare", "repair", "space_saver", "not_checked", "boot_full"].map((type) => (
                  <button
                    key={type}
                    onClick={() => updateTyre("type", type)}
                    style={buttonStyle(tyres.Spare.type === type)}
                  >
                    {type.replace("_", " ")}
                  </button>
                ))}
              </div>

              {/* Spare type details */}
              {tyres.Spare.type === "spare" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px" }}>
                  <select
                    value={tyres.Spare.details.manufacturer}
                    onChange={(e) =>
                      setTyres((p) => ({
                        ...p,
                        Spare: {
                          ...p.Spare,
                          details: { ...p.Spare.details, manufacturer: e.target.value },
                        },
                      }))
                    }
                    style={buttonStyle(!!tyres.Spare.details.manufacturer)}
                  >
                    <option value="">Manufacturer</option>
                    {tyreBrands.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                  <input
                    placeholder="Size"
                    value={tyres.Spare.details.size}
                    onChange={(e) =>
                      setTyres((p) => ({
                        ...p,
                        Spare: {
                          ...p.Spare,
                          details: { ...p.Spare.details, size: e.target.value },
                        },
                      }))
                    }
                    style={buttonStyle(!!tyres.Spare.details.size)}
                  />
                  <input
                    placeholder="Load"
                    value={tyres.Spare.details.load}
                    onChange={(e) =>
                      setTyres((p) => ({
                        ...p,
                        Spare: {
                          ...p.Spare,
                          details: { ...p.Spare.details, load: e.target.value },
                        },
                      }))
                    }
                    style={buttonStyle(!!tyres.Spare.details.load)}
                  />
                  <input
                    placeholder="Speed"
                    value={tyres.Spare.details.speed}
                    onChange={(e) =>
                      setTyres((p) => ({
                        ...p,
                        Spare: {
                          ...p.Spare,
                          details: { ...p.Spare.details, speed: e.target.value },
                        },
                      }))
                    }
                    style={buttonStyle(!!tyres.Spare.details.speed)}
                  />
                </div>
              )}

              {tyres.Spare.type === "repair" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <select
                    value={tyres.Spare.month}
                    onChange={(e) => updateTyre("month", e.target.value)}
                    style={buttonStyle(!!tyres.Spare.month)}
                  >
                    <option value="">Month</option>
                    {[
                      "January (1)",
                      "February (2)",
                      "March (3)",
                      "April (4)",
                      "May (5)",
                      "June (6)",
                      "July (7)",
                      "August (8)",
                      "September (9)",
                      "October (10)",
                      "November (11)",
                      "December (12)",
                    ].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={tyres.Spare.year}
                    onChange={(e) => updateTyre("year", e.target.value)}
                    style={buttonStyle(!!tyres.Spare.year)}
                  >
                    <option value="">Year</option>
                    {Array.from({ length: 20 }, (_, i) => 2015 + i).map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}

              {tyres.Spare.type === "space_saver" && (
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => updateTyre("condition", "Good")}
                    style={buttonStyle(tyres.Spare.condition === "Good")}
                  >
                    Good
                  </button>
                  <button
                    onClick={() => updateTyre("condition", "Bad")}
                    style={buttonStyle(tyres.Spare.condition === "Bad")}
                  >
                    Bad
                  </button>
                </div>
              )}

              {tyres.Spare.type === "not_checked" && (
                <textarea
                  placeholder="Reason"
                  value={tyres.Spare.note}
                  onChange={(e) => updateTyre("note", e.target.value)}
                  style={{ width: "100%", minHeight: "80px" }}
                />
              )}
            </>
          )}

          {/* Concerns */}
          <div style={{ marginTop: "20px" }}>
            <h4>Concerns</h4>
            <button onClick={() => setConcernModal(true)} style={buttonStyle(false)}>
              Add Concern
            </button>
            <ul>
              {(tyres[activeWheel].concerns || []).map((c, idx) => (
                <li key={idx} style={{ color: c.status === "Red" ? "red" : "orange" }}>
                  {c.text} ({c.status})
                </li>
              ))}
            </ul>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 mt-4">
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
              Close
            </button>
            <button
              onClick={() => allWheelsComplete() && onComplete(tyres)}
              style={{
                padding: "10px 20px",
                border: "none",
                background: allWheelsComplete() ? "#FF4040" : "#ddd",
                color: "white",
                borderRadius: "6px",
                fontWeight: "bold",
              }}
              disabled={!allWheelsComplete()}
            >
              Complete
            </button>
          </div>
        </div>
      </div>

      {/* Concern modal */}
      {concernModal && (
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
          <div style={{ background: "white", padding: "20px", borderRadius: "8px", width: "400px" }}>
            <h3>Add Concern</h3>
            <AutoCompleteInput
              placeholder="Concern"
              value={concernInput}
              onChange={setConcernInput}
              options={concernOptions}
            />
            <div style={{ margin: "10px 0" }}>
              <button onClick={() => setConcernStatus("Amber")} style={buttonStyle(concernStatus === "Amber")}>
                Amber
              </button>
              <button onClick={() => setConcernStatus("Red")} style={buttonStyle(concernStatus === "Red")}>
                Red
              </button>
            </div>
            <button onClick={addConcern} style={buttonStyle(true)}>
              Save Concern
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
