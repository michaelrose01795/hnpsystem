// file location: src/components/VHC/InternalElectricsDetailsModal.js
import React, { useMemo, useState } from "react";
import VHCModalShell, { buildModalButton } from "@/components/VHC/VHCModalShell";
import themeConfig, { createVhcButtonStyle } from "@/styles/appTheme";

const palette = themeConfig.palette;

const CATEGORY_ORDER = [
  "Interior Lights",
  "Media Systems",
  "Air Con/Heating/ventilation",
  "Warning Lamps",
  "Seatbelt",
  "Miscellaneous",
];

const STATUS_OPTIONS = ["Red", "Amber"];

const baseCardStyle = {
  border: `1px solid ${palette.border}`,
  background: palette.surface,
  borderRadius: "18px",
  padding: "18px",
  boxShadow: "0 8px 20px rgba(209,0,0,0.10)",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  alignItems: "flex-start",
  transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
  cursor: "pointer",
};

const concernBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "6px 12px",
  borderRadius: "999px",
  backgroundColor: palette.accentSurface,
  border: `1px solid ${palette.border}`,
  fontSize: "12px",
  fontWeight: 600,
  color: palette.accent,
};

const fieldLabelStyle = {
  fontSize: "12px",
  fontWeight: 600,
  color: palette.textMuted,
  letterSpacing: "0.3px",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "12px",
  border: `1px solid ${palette.border}`,
  backgroundColor: palette.surface,
  fontSize: "14px",
  color: palette.textPrimary,
  outline: "none",
  boxShadow: "inset 0 1px 3px rgba(15,23,42,0.05)",
};

const statusSelectStyle = {
  ...inputStyle,
  width: "auto",
};

export default function InternalElectricsDetailsModal({ isOpen, onClose, onComplete, initialData }) {
  const [data, setData] = useState(() => ({
    "Interior Lights": { concerns: [] },
    "Media Systems": { concerns: [] },
    "Air Con/Heating/ventilation": { concerns: [] },
    "Warning Lamps": { concerns: [] },
    Seatbelt: { concerns: [] },
    Miscellaneous: { concerns: [] },
    ...initialData,
  }));

  const [activeConcern, setActiveConcern] = useState({
    open: false,
    category: "",
    temp: { issue: "", status: "Red" },
  });

  const totals = useMemo(
    () =>
      CATEGORY_ORDER.reduce(
        (acc, key) => ({
          count: acc.count + (data[key]?.concerns.length || 0),
          red: acc.red + (data[key]?.concerns.filter((c) => c.status === "Red").length || 0),
          amber: acc.amber + (data[key]?.concerns.filter((c) => c.status === "Amber").length || 0),
        }),
        { count: 0, red: 0, amber: 0 },
      ),
    [data],
  );

  const enableConcern = (category) => {
    setActiveConcern({ open: true, category, temp: { issue: "", status: "Red" } });
  };

  const addConcern = () => {
    const { category, temp } = activeConcern;
    if (temp.issue.trim() === "") return;
    setData((prev) => ({
      ...prev,
      [category]: { ...prev[category], concerns: [...prev[category].concerns, temp] },
    }));
    setActiveConcern((prev) => ({ ...prev, temp: { issue: "", status: "Red" } }));
  };

  const updateConcern = (category, idx, field, value) => {
    setData((prev) => {
      const updated = [...prev[category].concerns];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, [category]: { ...prev[category], concerns: updated } };
    });
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

  const modalFooter = (
    <>
      <button type="button" onClick={onClose} style={buildModalButton("ghost")}>
        Close
      </button>
      <button type="button" onClick={() => onComplete(data)} style={buildModalButton("primary")}>
        Save & Complete
      </button>
    </>
  );

  return (
    <VHCModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Internal Electrics"
      subtitle="Track cabin electronics with the same look and feel as the dashboard."
      width="960px"
      height="620px"
      footer={modalFooter}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderRadius: "18px",
            border: `1px solid ${palette.border}`,
            background: palette.accentSurface,
            boxShadow: "0 6px 16px rgba(209,0,0,0.12)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "13px", color: palette.textMuted, fontWeight: 600, letterSpacing: "0.2px" }}>
              Concerns Logged
            </span>
            <span style={{ fontSize: "20px", fontWeight: 700, color: palette.textPrimary }}>
              {totals.count} interior electrical issues tracked
            </span>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={concernBadgeStyle}>
              <span style={{ width: "10px", height: "10px", borderRadius: "999px", background: palette.danger }} />
              {totals.red} Red
            </div>
            <div style={concernBadgeStyle}>
              <span style={{ width: "10px", height: "10px", borderRadius: "999px", background: palette.warning }} />
              {totals.amber} Amber
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "18px",
          }}
        >
          {CATEGORY_ORDER.map((category) => {
            const concerns = data[category]?.concerns ?? [];
            const redCount = concerns.filter((c) => c.status === "Red").length;
            const amberCount = concerns.filter((c) => c.status === "Amber").length;

            return (
              <button
                key={category}
                type="button"
                onClick={() => enableConcern(category)}
                style={baseCardStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.boxShadow = "0 12px 28px rgba(209,0,0,0.16)";
                  e.currentTarget.style.borderColor = palette.accentSoft;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 8px 20px rgba(209,0,0,0.10)";
                  e.currentTarget.style.borderColor = palette.border;
                }}
              >
                <span style={{ fontSize: "16px", fontWeight: 700, color: palette.textPrimary, textAlign: "left" }}>
                  {category}
                </span>
                <span style={{ fontSize: "13px", color: palette.textMuted, textAlign: "left" }}>
                  Tap to log cabin electrics observations and review open issues.
                </span>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <div style={concernBadgeStyle}>{concerns.length} logged</div>
                  {redCount > 0 ? (
                    <div style={{ ...concernBadgeStyle, color: palette.danger, borderColor: palette.danger }}>
                      {redCount} Red
                    </div>
                  ) : null}
                  {amberCount > 0 ? (
                    <div style={{ ...concernBadgeStyle, color: palette.warning, borderColor: palette.warning }}>
                      {amberCount} Amber
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {activeConcern.open ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: "420px",
              maxWidth: "90%",
              maxHeight: "86%",
              background: palette.surface,
              borderRadius: "20px",
              border: `1px solid ${palette.border}`,
              boxShadow: "0 18px 36px rgba(15,23,42,0.20)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: palette.accent, margin: 0 }}>
                {activeConcern.category}
              </h3>
              <button
                type="button"
                onClick={() => setActiveConcern({ open: false, category: "", temp: { issue: "", status: "Red" } })}
                style={{ ...createVhcButtonStyle("ghost"), padding: "6px 14px" }}
              >
                Close
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <label style={fieldLabelStyle}>Issue</label>
              <input
                type="text"
                placeholder="Describe the issue…"
                value={activeConcern.temp.issue}
                onChange={(e) =>
                  setActiveConcern((prev) => ({
                    ...prev,
                    temp: { ...prev.temp, issue: e.target.value },
                  }))
                }
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = palette.accent;
                  e.target.style.boxShadow = "0 0 0 3px rgba(209,0,0,0.12)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = palette.border;
                  e.target.style.boxShadow = "inset 0 1px 3px rgba(15,23,42,0.05)";
                }}
              />

              <label style={fieldLabelStyle}>Status</label>
              <select
                value={activeConcern.temp.status}
                onChange={(e) =>
                  setActiveConcern((prev) => ({
                    ...prev,
                    temp: { ...prev.temp, status: e.target.value },
                  }))
                }
                style={statusSelectStyle}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <button type="button" onClick={addConcern} style={{ ...createVhcButtonStyle("primary"), alignSelf: "flex-end" }}>
                Add Concern
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                overflowY: "auto",
                paddingRight: "4px",
              }}
            >
              {(data[activeConcern.category]?.concerns ?? []).length === 0 ? (
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "16px",
                    border: `1px dashed ${palette.border}`,
                    backgroundColor: palette.accentSurface,
                    color: palette.textMuted,
                    fontSize: "13px",
                  }}
                >
                  No concerns added yet. Document issues as they are discovered.
                </div>
              ) : (
                data[activeConcern.category].concerns.map((concern, idx) => (
                  <div
                    key={`${activeConcern.category}-${idx}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      padding: "14px",
                      borderRadius: "16px",
                      border: `1px solid ${palette.border}`,
                      background: palette.surface,
                      boxShadow: "0 4px 14px rgba(15,23,42,0.08)",
                    }}
                  >
                    <label style={fieldLabelStyle}>Issue</label>
                    <input
                      type="text"
                      value={concern.issue}
                      onChange={(e) => updateConcern(activeConcern.category, idx, "issue", e.target.value)}
                      style={inputStyle}
                      onFocus={(e) => {
                        e.target.style.borderColor = palette.accent;
                        e.target.style.boxShadow = "0 0 0 3px rgba(209,0,0,0.12)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = palette.border;
                        e.target.style.boxShadow = "inset 0 1px 3px rgba(15,23,42,0.05)";
                      }}
                    />

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                      <select
                        value={concern.status}
                        onChange={(e) => updateConcern(activeConcern.category, idx, "status", e.target.value)}
                        style={{ ...statusSelectStyle, flex: "0 0 130px" }}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => deleteConcern(activeConcern.category, idx)}
                        style={{ ...createVhcButtonStyle("ghost"), color: palette.danger, borderColor: palette.border }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </VHCModalShell>
  );
}
