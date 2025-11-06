// file location: src/components/VHC/BrakesHubsDetailsModal.js
import React, { useState } from "react";
import Image from "next/image";
import VHCModalShell, { buildModalButton } from "@/components/VHC/VHCModalShell";
import themeConfig, { createVhcButtonStyle } from "@/styles/appTheme";

const palette = themeConfig.palette;

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
          width: "100%",
          padding: "10px 12px",
          borderRadius: "12px",
          border: `1px solid ${palette.border}`,
          backgroundColor: palette.surface,
          fontSize: "14px",
          color: palette.textPrimary,
          outline: "none",
          boxShadow: "inset 0 1px 3px rgba(15,23,42,0.04)",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = palette.accent;
          e.target.style.boxShadow = "0 0 0 3px rgba(209,0,0,0.12)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = palette.border;
          e.target.style.boxShadow = "inset 0 1px 3px rgba(15,23,42,0.04)";
        }}
      />
      {filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: palette.surface,
            border: `1px solid ${palette.border}`,
            borderRadius: "12px",
            boxShadow: "0 12px 32px rgba(15,23,42,0.18)",
            maxHeight: "160px",
            overflowY: "auto",
            zIndex: 20,
            padding: "6px 0",
          }}
        >
          {filtered.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onChange(opt);
                setFiltered([]);
              }}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                textAlign: "left",
                padding: "10px 16px",
                cursor: "pointer",
                fontSize: "13px",
                color: palette.textPrimary,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = palette.accentSurface;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {opt}
            </button>
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
  const [concernPopup, setConcernPopup] = useState({ open: false, category: "", tempConcern: { issue: "", status: "Red" } });

  const padOptions = Array.from({ length: 15 }, (_, i) => i);
  const padLabels = { frontPads: "Front Pads", rearPads: "Rear Pads" };
  const discLabels = { frontDiscs: "Front Discs", rearDiscs: "Rear Discs" };

  const sectionPanelBase = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    background: palette.surface,
    borderRadius: "18px",
    border: `1px solid ${palette.border}`,
    padding: "20px",
    boxShadow: "0 12px 28px rgba(15,23,42,0.08)",
  };

  const fieldLabelStyle = {
    fontSize: "12px",
    fontWeight: 600,
    color: palette.textMuted,
    letterSpacing: "0.2px",
    marginTop: "4px",
  };

  const selectBaseStyle = {
    padding: "10px 12px",
    borderRadius: "12px",
    border: `1px solid ${palette.border}`,
    backgroundColor: palette.surface,
    color: palette.textPrimary,
    fontSize: "14px",
    outline: "none",
  };

  const concernItemStyle = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "12px",
    backgroundColor: palette.accentSurface,
    border: `1px solid ${palette.border}`,
  };

  const popupOverlayStyle = {
    position: "absolute",
    inset: 0,
    background: "rgba(15,23,42,0.45)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  };

  const popupCardStyle = {
    width: "360px",
    padding: "24px",
    borderRadius: "18px",
    background: palette.surface,
    border: `1px solid ${palette.border}`,
    boxShadow: "0 18px 36px rgba(15,23,42,0.18)",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  };

  const enhanceFocus = (event) => {
    event.target.style.borderColor = palette.accent;
    event.target.style.boxShadow = "0 0 0 3px rgba(209,0,0,0.12)";
  };

  const resetFocus = (event) => {
    event.target.style.borderColor = palette.border;
    event.target.style.boxShadow = "none";
  };

  const updatePadMeasurement = (category, value) => {
    setData((prev) => ({ ...prev, [category]: { ...prev[category], measurement: value } }));
    const numbers = value.split(",").map((v) => parseFloat(v.trim())).filter((v) => !isNaN(v));
    const min = Math.min(...numbers);
    if (min >= 5) updatePadStatus(category, "Green");
    else if (min >= 3) updatePadStatus(category, "Amber");
    else updatePadStatus(category, "Red");
  };

  const updatePadStatus = (category, value) => {
    setData((prev) => ({ ...prev, [category]: { ...prev[category], status: value } }));
  };

  const updateDisc = (category, field, value) => {
    setData((prev) => ({ ...prev, [category]: { ...prev[category], [field]: { ...prev[category][field], ...value } } }));
  };

  const addConcern = (category, concern) => {
    setData((prev) => ({ ...prev, [category]: { ...prev[category], concerns: [...prev[category].concerns, concern] } }));
  };

  // ✅ New completion logic
  const isCompleteEnabled = () => {
    // Front must always be complete
    const frontPadsDone = data.frontPads.measurement !== "" && data.frontPads.status !== "";
    const frontDiscsDone = data.frontDiscs.measurements.thickness !== "" && data.frontDiscs.measurements.status && data.frontDiscs.visual.status;

    if (!frontPadsDone || !frontDiscsDone) return false;

    if (showDrum) {
      // ✅ Rear drum setup: pads filled + drum button selected
      const rearPadsDone = data.rearPads.measurement !== "" && data.rearPads.status !== "";
      const drumSelected = data.rearDrums.status !== "";
      return rearPadsDone && drumSelected;
    } else {
      // ✅ Rear disc setup: pads and discs filled
      const rearPadsDone = data.rearPads.measurement !== "" && data.rearPads.status !== "";
      const rearDiscsDone = data.rearDiscs.measurements.thickness !== "" && data.rearDiscs.measurements.status && data.rearDiscs.visual.status;
      return rearPadsDone && rearDiscsDone;
    }
  };

  if (!isOpen) return null;

  const PadsSection = ({ category, showDrumButton }) => {
    const padData = data[category];
    const title = padLabels[category] || "Pads";

    return (
      <div style={sectionPanelBase}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: palette.textPrimary, margin: 0 }}>
            {title}
          </h3>
          <span style={{ fontSize: "12px", fontWeight: 600, color: palette.textMuted }}>
            {padData.status || "Status"}
          </span>
        </div>

        <label style={fieldLabelStyle}>Pad Measurement (mm)</label>
        <AutoCompleteInput
          value={padData.measurement}
          onChange={(val) => updatePadMeasurement(category, val)}
          options={padOptions}
        />

        <label style={fieldLabelStyle}>Status</label>
        <select
          value={padData.status}
          onChange={(e) => updatePadStatus(category, e.target.value)}
          style={selectBaseStyle}
          onFocus={enhanceFocus}
          onBlur={resetFocus}
        >
          <option>Red</option>
          <option>Amber</option>
          <option>Green</option>
        </select>

        <button
          type="button"
          onClick={() =>
            setConcernPopup({
              open: true,
              category,
              tempConcern: { issue: "", status: "Red" },
            })
          }
          style={{
            ...buildModalButton("primary"),
            alignSelf: "flex-start",
            padding: "10px 18px",
          }}
        >
          + Add Concern
        </button>

        {padData.concerns?.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {padData.concerns.map((c, idx) => (
              <div key={idx} style={concernItemStyle}>
                <span style={{ flex: 1, fontSize: "13px", color: palette.textPrimary }}>
                  {c.issue}
                </span>
                <select
                  value={c.status}
                  onChange={(e) => {
                    const updated = [...padData.concerns];
                    updated[idx].status = e.target.value;
                    setData((prev) => ({
                      ...prev,
                      [category]: { ...prev[category], concerns: updated },
                    }));
                  }}
                  style={{ ...selectBaseStyle, width: "120px" }}
                  onFocus={enhanceFocus}
                  onBlur={resetFocus}
                >
                  <option>Red</option>
                  <option>Amber</option>
                </select>
              </div>
            ))}
          </div>
        )}

        {showDrumButton && (
          <button
            type="button"
            onClick={() => setShowDrum(true)}
            style={{
              ...buildModalButton("ghost"),
              border: `1px dashed ${palette.accent}`,
              color: palette.accent,
              background: "transparent",
              padding: "10px 16px",
            }}
          >
            Drum Brakes
          </button>
        )}
      </div>
    );
  };

  // ✅ Discs Section
  const DiscsSection = ({ category }) => {
    const discData = data[category];
    const title = discLabels[category] || "Discs";

    const tabWrapperStyle = {
      display: "inline-flex",
      gap: "8px",
      padding: "4px",
      borderRadius: "999px",
      backgroundColor: palette.accentSurface,
      marginTop: "8px",
    };

    const tabButtonStyle = (active) => ({
      ...createVhcButtonStyle(active ? "primary" : "ghost"),
      backgroundColor: active ? palette.accent : "transparent",
      color: active ? "#ffffff" : palette.textPrimary,
      padding: "8px 16px",
      fontSize: "12px",
      border: active ? "none" : "1px solid transparent",
      boxShadow: active ? "0 6px 18px rgba(209,0,0,0.18)" : "none",
    });

    return (
      <div style={sectionPanelBase}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: palette.textPrimary, margin: 0 }}>
            {title}
          </h3>
          <span style={{ fontSize: "12px", fontWeight: 600, color: palette.textMuted }}>
            {discData.tab === "measurements"
              ? discData.measurements.status || "Status"
              : discData.visual.status || "Status"}
          </span>
        </div>

        <div style={tabWrapperStyle}>
          {["measurements", "visual"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() =>
                setData((prev) => ({
                  ...prev,
                  [category]: { ...prev[category], tab },
                }))
              }
              style={tabButtonStyle(discData.tab === tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {discData.tab === "measurements" && (
          <>
            <label style={fieldLabelStyle}>Disc Thickness (mm)</label>
            <input
              type="text"
              value={discData.measurements.thickness}
              onChange={(e) =>
                updateDisc(category, "measurements", { thickness: e.target.value })
              }
              style={{
                ...selectBaseStyle,
                boxShadow: "inset 0 1px 3px rgba(15,23,42,0.04)",
              }}
              onFocus={enhanceFocus}
              onBlur={resetFocus}
            />

            <label style={fieldLabelStyle}>Status</label>
            <select
              value={discData.measurements.status}
              onChange={(e) =>
                updateDisc(category, "measurements", { status: e.target.value })
              }
              style={selectBaseStyle}
              onFocus={enhanceFocus}
              onBlur={resetFocus}
            >
              <option>Red</option>
              <option>Amber</option>
              <option>Green</option>
            </select>
          </>
        )}

        {discData.tab === "visual" && (
          <>
            <label style={fieldLabelStyle}>Visual Inspection</label>
            <select
              value={discData.visual.status}
              onChange={(e) =>
                updateDisc(category, "visual", { status: e.target.value })
              }
              style={selectBaseStyle}
              onFocus={enhanceFocus}
              onBlur={resetFocus}
            >
              <option>Red</option>
              <option>Amber</option>
              <option>Green</option>
            </select>
          </>
        )}

        <button
          type="button"
          onClick={() =>
            setConcernPopup({
              open: true,
              category,
              tempConcern: { issue: "", status: "Red" },
            })
          }
          style={{
            ...buildModalButton("primary"),
            alignSelf: "flex-start",
            padding: "10px 18px",
          }}
        >
          + Add Concern
        </button>

        {discData.concerns?.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {discData.concerns.map((c, idx) => (
              <div key={idx} style={concernItemStyle}>
                <span style={{ flex: 1, fontSize: "13px", color: palette.textPrimary }}>
                  {c.issue}
                </span>
                <select
                  value={c.status}
                  onChange={(e) => {
                    const updated = [...discData.concerns];
                    updated[idx].status = e.target.value;
                    setData((prev) => ({
                      ...prev,
                      [category]: { ...prev[category], concerns: updated },
                    }));
                  }}
                  style={{ ...selectBaseStyle, width: "120px" }}
                  onFocus={enhanceFocus}
                  onBlur={resetFocus}
                >
                  <option>Red</option>
                  <option>Amber</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ✅ Drum Brakes Section
  const DrumBrakesSection = () => (
    <div style={sectionPanelBase}>
      <h3 style={{ fontSize: "16px", fontWeight: 700, color: palette.textPrimary, margin: 0 }}>
        Drum Brakes
      </h3>
      <p style={{ fontSize: "13px", color: palette.textMuted, margin: 0 }}>
        Select the observation that best matches the rear drum condition.
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          marginTop: "8px",
        }}
      >
        {["Good", "Visual check", "Replace", "Not checked"].map((label) => {
          const active = data.rearDrums.status === label;
          return (
            <button
              key={label}
              type="button"
              onClick={() =>
                setData((prev) => ({ ...prev, rearDrums: { status: label } }))
              }
              style={{
                ...createVhcButtonStyle(active ? "primary" : "ghost"),
                padding: "10px 18px",
                backgroundColor: active ? palette.accent : palette.surface,
                color: active ? "#ffffff" : palette.textPrimary,
                border: active ? "none" : `1px solid ${palette.border}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowDrum(false)}
        style={{
          ...buildModalButton("ghost"),
          alignSelf: "flex-start",
          padding: "10px 18px",
          color: palette.accent,
        }}
      >
        Disc Brakes
      </button>
    </div>
  );

  const leftPanelStyle = {
    width: "320px",
    background: palette.accentSurface,
    border: `1px solid ${palette.border}`,
    borderRadius: "24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "28px",
    padding: "32px 24px",
    boxShadow: "0 16px 32px rgba(209,0,0,0.16)",
  };

  const imageStyle = (active) => ({
    cursor: "pointer",
    border: active ? `4px solid ${palette.accent}` : `2px solid ${palette.border}`,
    borderRadius: "18px",
    objectFit: "contain",
    background: palette.surface,
    padding: "16px",
    transition: "transform 0.2s ease, border-color 0.2s ease",
  });

  return (
    <VHCModalShell
      isOpen={isOpen}
      title="Brakes & Hubs"
      subtitle="Capture pad wear, disc condition, and drum checks."
      width="1080px"
      height="640px"
      onClose={() => {
        setConcernPopup({ open: false, category: "", tempConcern: { issue: "", status: "Red" } });
        onClose();
      }}
      footer={
        <>
          <button type="button" onClick={onClose} style={buildModalButton("secondary")}>
            Close
          </button>
          <button
            type="button"
            onClick={() => onComplete(data)}
            disabled={!isCompleteEnabled()}
            style={buildModalButton("primary", { disabled: !isCompleteEnabled() })}
          >
            Complete Section
          </button>
        </>
      }
    >
      <div style={{ display: "flex", gap: "24px", height: "100%", position: "relative" }}>
        <aside style={leftPanelStyle}>
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: palette.textPrimary, margin: 0 }}>
              Select Axle
            </h3>
            <p style={{ fontSize: "13px", color: palette.textMuted, margin: "4px 0 0" }}>
              Tap a diagram to switch between front and rear checks.
            </p>
          </div>
          <Image
            src="/images/Brakes3.png"
            alt="Front Brakes"
            width={172}
            height={172}
            style={imageStyle(activeSide === "front")}
            onClick={() => {
              setActiveSide("front");
              setShowDrum(false);
            }}
          />
          <Image
            src="/images/Brakes3.png"
            alt="Rear Brakes"
            width={172}
            height={172}
            style={imageStyle(activeSide === "rear")}
            onClick={() => setActiveSide("rear")}
          />
        </aside>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "24px", position: "relative" }}>
          {activeSide === "front" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "20px",
              }}
            >
              <PadsSection category="frontPads" />
              <DiscsSection category="frontDiscs" />
            </div>
          )}

          {activeSide === "rear" && !showDrum && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "20px",
              }}
            >
              <PadsSection category="rearPads" showDrumButton />
              <DiscsSection category="rearDiscs" />
            </div>
          )}

          {activeSide === "rear" && showDrum && <DrumBrakesSection />}

          {concernPopup.open && (
            <div style={popupOverlayStyle}>
              <div style={popupCardStyle}>
                <h4 style={{ fontSize: "16px", fontWeight: 700, color: palette.textPrimary, margin: 0 }}>
                  Add Concern
                </h4>
                <p style={{ fontSize: "12px", color: palette.textMuted, margin: "4px 0 12px" }}>
                  Document an issue for{" "}
                  {padLabels[concernPopup.category] ||
                    discLabels[concernPopup.category] ||
                    "this area"}
                  .
                </p>
                <label style={fieldLabelStyle}>Concern</label>
                <input
                  type="text"
                  value={concernPopup.tempConcern.issue}
                  onChange={(e) =>
                    setConcernPopup((prev) => ({
                      ...prev,
                      tempConcern: { ...prev.tempConcern, issue: e.target.value },
                    }))
                  }
                  placeholder="Describe the issue…"
                  style={{
                    ...selectBaseStyle,
                    width: "100%",
                    boxShadow: "inset 0 1px 3px rgba(15,23,42,0.04)",
                  }}
                  onFocus={enhanceFocus}
                  onBlur={resetFocus}
                />

                <label style={fieldLabelStyle}>Severity</label>
                <select
                  value={concernPopup.tempConcern.status}
                  onChange={(e) =>
                    setConcernPopup((prev) => ({
                      ...prev,
                      tempConcern: { ...prev.tempConcern, status: e.target.value },
                    }))
                  }
                  style={{ ...selectBaseStyle, width: "100%" }}
                  onFocus={enhanceFocus}
                  onBlur={resetFocus}
                >
                  <option>Red</option>
                  <option>Amber</option>
                </select>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "16px" }}>
                  <button
                    type="button"
                    onClick={() =>
                      setConcernPopup({
                        open: false,
                        category: "",
                        tempConcern: { issue: "", status: "Red" },
                      })
                    }
                    style={buildModalButton("ghost")}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!concernPopup.tempConcern.issue.trim()) return;
                      addConcern(concernPopup.category, concernPopup.tempConcern);
                      setConcernPopup({
                        open: false,
                        category: "",
                        tempConcern: { issue: "", status: "Red" },
                      });
                    }}
                    style={buildModalButton("primary")}
                  >
                    Add Concern
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </VHCModalShell>
  );
}
