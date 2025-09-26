// file location: src/components/VHC/WheelsTyresDetailsModal.js

import React, { useState } from "react";

// ✅ Autocomplete small component
function AutoCompleteInput({ value, onChange, options, placeholder }) {
  const [filtered, setFiltered] = useState([]);
  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    setFiltered(options.filter((o) => o.toLowerCase().includes(val.toLowerCase())));
  };
  return (
    <div style={{ position: "relative" }}>
      <input
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
      />
      {filtered.length > 0 && (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "white",
            border: "1px solid #ccc",
            maxHeight: "100px",
            overflowY: "auto",
            zIndex: 100,
            margin: 0,
            padding: "5px",
            listStyle: "none",
          }}
        >
          {filtered.map((o, i) => (
            <li
              key={i}
              onClick={() => onChange(o)}
              style={{ padding: "4px", cursor: "pointer" }}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function WheelsTyresDetailsModal({ isOpen, onClose, onComplete }) {
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

  const [tyres, setTyres] = useState({
    NSF: { ...initialTyre },
    OSF: { ...initialTyre },
    NSR: { ...initialTyre },
    OSR: { ...initialTyre },
    Spare: {
      type: "spare", // ✅ default is now 'spare'
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

  const tyreBrands = [
    "Unknown", "Michelin", "Continental", "Goodyear", "Pirelli", "Bridgestone", "Dunlop",
    "Yokohama", "Hankook", "Kumho", "Falken", "Toyo", "Nexen", "Firestone",
  ];

  // ✅ Not checked last
  const spareTypes = ["Spare Tyre", "Repair Kit", "space_saver", "boot_full", "not_checked"];

  const updateTyre = (field, value) => {
    if (activeWheel === "Spare") {
      setTyres((prev) => ({ ...prev, Spare: { ...prev.Spare, details: { ...prev.Spare.details, [field]: value } } }));
    } else {
      setTyres((prev) => ({ ...prev, [activeWheel]: { ...prev[activeWheel], [field]: value } }));
    }
  };

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
        updated[activeWheel] = { ...wheel, tread: newTread, treadLocked: { ...wheel.treadLocked, outer: true } };
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

  const copyToAll = () => {
    setCopyActive((prev) => !prev);
    if (!copyActive) {
      const current = tyres[activeWheel];
      setTyres((prev) => {
        const updated = { ...prev };
        ["NSF", "OSF", "NSR", "OSR"].forEach((wheel) => {
          updated[wheel] = { ...updated[wheel], manufacturer: current.manufacturer, runFlat: current.runFlat, size: current.size, load: current.load, speed: current.speed };
        });
        // ✅ copy to spare as well if spare type is 'spare'
        if (updated.Spare.type === "spare") {
          updated.Spare.details = { ...updated.Spare.details, manufacturer: current.manufacturer, runFlat: current.runFlat, size: current.size, load: current.load, speed: current.speed };
        }
        return updated;
      });
    }
  };

  const addConcern = () => {
    if (!concernInput.trim()) return;
    setTyres((prev) => {
      const updated = { ...prev };
      if (!updated[activeWheel].concerns) updated[activeWheel].concerns = [];
      updated[activeWheel].concerns.push({ text: concernInput, status: concernStatus });
      return updated;
    });
    setConcernModal(null);
    setConcernInput("");
  };

  const allWheelsComplete = () => {
    const checkTyre = (t) => t.manufacturer && t.size && t.load && t.speed;
    const mainWheels = ["NSF", "OSF", "NSR", "OSR"].every((w) => checkTyre(tyres[w]));
    let spareOk = false;
    const spare = tyres.Spare;
    if (spare.type === "spare") {
      spareOk = spare.details.manufacturer && spare.details.size && spare.details.load && spare.details.speed;
    } else if (spare.type === "repair") {
      spareOk = spare.month && spare.year;
    } else if (spare.type === "space_saver") {
      spareOk = spare.condition !== "";
    } else if (spare.type === "not_checked") {
      spareOk = spare.note.trim() !== "";
    } else if (spare.type === "boot_full") {
      spareOk = true;
    }
    return mainWheels && spareOk;
  };

  if (!isOpen) return null;

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

  // ✅ Month & Year arrays
  const months = Array.from({ length: 12 }, (_, i) => `${i + 1}`);
  const years = Array.from({ length: 3000 - 2015 + 1 }, (_, i) => `${2015 + i}`);

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
          position: "relative",
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
        <div style={{ flex: 1, padding: "20px", overflowY: "auto", position: "relative" }}>
          <h2 style={{ color: "#FF4040", marginBottom: "20px" }}>
            {activeWheel === "Spare" ? "Spare / Kit Details" : `${activeWheel} Tyre Details`}
          </h2>

          {activeWheel !== "Spare" ? (
            <>
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <select
                  value={tyres[activeWheel].manufacturer}
                  onChange={(e) => updateTyre("manufacturer", e.target.value)}
                  style={buttonStyle(!!tyres[activeWheel].manufacturer)}
                >
                  <option value="">Manufacturer</option>
                  {tyreBrands.map((b) => (
                    <option key={b} value={b}>{b}</option>
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
              {/* Spare / Kit full layout with buttons */}
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontWeight: "bold", display: "block", marginBottom: "8px" }}>Spare Type:</label>
                <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                  {spareTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => setTyres((prev) => ({ ...prev, Spare: { ...prev.Spare, type } }))}
                      style={buttonStyle(tyres.Spare.type === type)}
                    >
                      {type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>

              {tyres.Spare.type === "Spare Tyre" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "10px" }}>
                  <select
                    value={tyres.Spare.details.manufacturer}
                    onChange={(e) => updateTyre("manufacturer", e.target.value)}
                    style={buttonStyle(!!tyres.Spare.details.manufacturer)}
                  >
                    <option value="">Manufacturer</option>
                    {tyreBrands.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <input
                    placeholder="Size"
                    value={tyres.Spare.details.size}
                    onChange={(e) => updateTyre("size", e.target.value)}
                    style={buttonStyle(!!tyres.Spare.details.size)}
                  />
                  <input
                    placeholder="Load"
                    value={tyres.Spare.details.load}
                    onChange={(e) => updateTyre("load", e.target.value)}
                    style={buttonStyle(!!tyres.Spare.details.load)}
                  />
                  <input
                    placeholder="Speed"
                    value={tyres.Spare.details.speed}
                    onChange={(e) => updateTyre("speed", e.target.value)}
                    style={buttonStyle(!!tyres.Spare.details.speed)}
                  />
                </div>
              )}

              {/* ✅ Repair kit as dropdowns */}
              {tyres.Spare.type === "Repair Kit" && (
                <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
                  <select
                    value={tyres.Spare.month}
                    onChange={(e) => setTyres((prev) => ({ ...prev, Spare: { ...prev.Spare, month: e.target.value } }))}
                    style={buttonStyle(!!tyres.Spare.month)}
                  >
                    <option value="">Month</option>
                    {months.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={tyres.Spare.year}
                    onChange={(e) => setTyres((prev) => ({ ...prev, Spare: { ...prev.Spare, year: e.target.value } }))}
                    style={buttonStyle(!!tyres.Spare.year)}
                  >
                    <option value="">Year</option>
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* ✅ Space saver Good/Bad buttons */}
              {tyres.Spare.type === "space_saver" && (
                <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
                  {["Good", "Bad"].map((cond) => (
                    <button
                      key={cond}
                      onClick={() => setTyres((prev) => ({ ...prev, Spare: { ...prev.Spare, condition: cond } }))}
                      style={buttonStyle(tyres.Spare.condition === cond)}
                    >
                      {cond}
                    </button>
                  ))}
                </div>
              )}

              {tyres.Spare.type === "not_checked" && (
                <textarea
                  placeholder="Notes"
                  value={tyres.Spare.note}
                  onChange={(e) => setTyres((prev) => ({ ...prev, Spare: { ...prev.Spare, note: e.target.value } }))}
                  style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc", marginTop: "10px", minHeight: "60px" }}
                />
              )}

              {tyres.Spare.type === "boot_full" && <p>Boot is full.</p>}
            </>
          )}

          <div style={{ marginTop: "20px" }}>
            <h4>Concerns</h4>
            <button onClick={() => setConcernModal(true)} style={buttonStyle(false)}>Add Concern</button>
            <ul>
              {(tyres[activeWheel].concerns || []).map((c, idx) => (
                <li key={idx} style={{ color: c.status === "Red" ? "red" : "orange" }}>
                  {c.text} ({c.status})
                </li>
              ))}
            </ul>
          </div>

          {/* ✅ Buttons absolutely positioned bottom-right */}
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
                padding: "10px 20px",
                border: "none",
                background: "#aaa",
                color: "white",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Close
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
                cursor: "pointer",
              }}
              disabled={!allWheelsComplete()}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* ✅ Simple concern modal */}
      {concernModal && (
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
            zIndex: 3000,
          }}
        >
          <div style={{ background: "white", padding: "20px", borderRadius: "10px", width: "400px" }}>
            <h3>Add Concern</h3>
            <input
              placeholder="Concern description"
              value={concernInput}
              onChange={(e) => setConcernInput(e.target.value)}
              style={{ width: "100%", marginBottom: "10px", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
            />
            <select
              value={concernStatus}
              onChange={(e) => setConcernStatus(e.target.value)}
              style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc", marginBottom: "10px" }}
            >
              <option value="Amber">Amber</option>
              <option value="Red">Red</option>
            </select>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setConcernModal(null)} style={buttonStyle(false)}>Cancel</button>
              <button onClick={addConcern} style={buttonStyle(true)}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
