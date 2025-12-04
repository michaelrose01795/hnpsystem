// file location: src/components/VHC/UndersideDetailsModal.js
import React, { useState } from "react";
import VHCModalShell, { buildModalButton } from "@/components/VHC/VHCModalShell";
import themeConfig, { createVhcButtonStyle, vhcModalContentStyles } from "@/styles/appTheme";

const palette = themeConfig.palette;

const CATEGORY_ORDER = [
  "Exhaust system/catalyst",
  "Steering",
  "Front suspension",
  "Rear suspension",
  "Driveshafts/oil leaks",
  "Miscellaneous",
];

const STATUS_OPTIONS = ["Red", "Amber"];

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
  boxShadow: "inset 0 1px 3px rgba(var(--shadow-rgb),0.05)",
};

const statusSelectStyle = {
  ...inputStyle,
  width: "auto",
};

export default function UndersideDetailsModal({ isOpen, onClose, onComplete, initialData }) {
  const contentWrapperStyle = {
    ...vhcModalContentStyles.contentWrapper,
    gap: "24px",
    height: "100%",
  };
  const summaryBadgeBase = vhcModalContentStyles.badge;
  const baseCardStyle = {
    ...vhcModalContentStyles.baseCard,
    alignItems: "flex-start",
    height: "100%",
  };
  const cardGridStyle = {
    ...vhcModalContentStyles.cardGrid,
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gridAutoRows: "minmax(0, 1fr)",
    alignContent: "stretch",
  };

  const setCardHoverState = (element, hovering) => {
    const source = hovering
      ? vhcModalContentStyles.baseCardHover
      : {
          transform: vhcModalContentStyles.baseCard.transform,
          boxShadow: vhcModalContentStyles.baseCard.boxShadow,
          borderColor: vhcModalContentStyles.baseCard.borderColor,
        };
    Object.entries(source).forEach(([key, value]) => {
      element.style[key] = value;
    });
  };

  const [data, setData] = useState(() => ({
    "Exhaust system/catalyst": { concerns: [] },
    Steering: { concerns: [] },
    "Front suspension": { concerns: [] },
    "Rear suspension": { concerns: [] },
    "Driveshafts/oil leaks": { concerns: [] },
    Miscellaneous: { concerns: [] },
    ...initialData,
  }));

  const [activeConcern, setActiveConcern] = useState({
    open: false,
    category: "",
    temp: { issue: "", status: "Red" },
  });

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

  const handleClose = () => {
    if (typeof onClose === "function") {
      onClose(data);
    }
  };

  const modalFooter = (
    <>
      <button type="button" onClick={handleClose} style={buildModalButton("ghost")}>
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
      onClose={handleClose}
      title="Underside"
      hideCloseButton
      width="1280px"
      height="780px"
      footer={modalFooter}
    >
      <div style={contentWrapperStyle}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            minHeight: 0,
          }}
        >
          <div
            style={{
              ...cardGridStyle,
              flex: 1,
              minHeight: 0,
            }}
          >
          {CATEGORY_ORDER.map((category) => {
            const concerns = data[category]?.concerns ?? [];
            const redCount = concerns.filter((c) => c.status === "Red").length;
            const amberCount = concerns.filter((c) => c.status === "Amber").length;
            const loggedCount = redCount + amberCount;

            return (
              <button
                key={category}
                type="button"
                onClick={() => enableConcern(category)}
                style={baseCardStyle}
                onMouseEnter={(e) => setCardHoverState(e.currentTarget, true)}
                onMouseLeave={(e) => setCardHoverState(e.currentTarget, false)}
              >
                <span style={{ fontSize: "16px", fontWeight: 700, color: palette.textPrimary, textAlign: "left" }}>
                  {category}
                </span>
                <span style={{ fontSize: "13px", color: palette.textMuted, textAlign: "left" }}>
                  Tap to log underside observations or amend existing notes.
                </span>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <div style={summaryBadgeBase}>{loggedCount} logged</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      </div>

      {activeConcern.open ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(var(--shadow-rgb),0.55)",
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
              boxShadow: "0 18px 36px rgba(var(--shadow-rgb),0.20)",
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
                  e.target.style.boxShadow = "0 0 0 3px rgba(var(--primary-rgb),0.12)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = palette.border;
                  e.target.style.boxShadow = "inset 0 1px 3px rgba(var(--shadow-rgb),0.05)";
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
                  No concerns added yet. Add items to keep this section current.
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
                      boxShadow: "0 4px 14px rgba(var(--shadow-rgb),0.08)",
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
                        e.target.style.boxShadow = "0 0 0 3px rgba(var(--primary-rgb),0.12)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = palette.border;
                        e.target.style.boxShadow = "inset 0 1px 3px rgba(var(--shadow-rgb),0.05)";
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
