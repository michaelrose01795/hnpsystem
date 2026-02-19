// file location: src/components/VHC/ExternalDetailsModal.js
import React, { useState } from "react";
import { createPortal } from "react-dom";
import VHCModalShell, { buildModalButton } from "@/components/VHC/VHCModalShell";
import themeConfig, {
  createVhcButtonStyle,
  vhcModalContentStyles,
  popupOverlayStyles,
  popupCardStyles,
} from "@/styles/appTheme";
import { DropdownField } from "@/components/dropdownAPI";
import IssueAutocomplete from "@/components/vhc/IssueAutocomplete";
import {
  palette,
  STATUS_OPTIONS,
  fieldLabelStyle,
  inputStyle,
  statusSelectStyle,
  lockedRowOverlayStyle,
  lockedRowBadgeStyle,
} from "@/components/VHC/vhcModalStyles";
import { useConcernLock } from "@/components/VHC/useConcernLock";

const HORN_LEGACY_LABEL = "Horn/Washers/Wipers";
const HORN_LABEL = "Wipers/Washers/Horn";

const CATEGORY_ORDER = [
  HORN_LABEL,
  "Front Lights",
  "Rear lights",
  "Wheel Trim",
  "Clutch/Transmission operations",
  "Number plates",
  "Doors",
  "Trims",
  "Miscellaneous",
];

const EXTERNAL_SECTION_KEYS = {
  [HORN_LABEL]: "external_wipers_washers_horn",
  "Front Lights": "external_front_lights",
  "Rear lights": "external_rear_lights",
  "Wheel Trim": "external_wheel_trim",
  "Clutch/Transmission operations": "external_clutch_transmission_operations",
  "Number plates": "external_number_plates",
  Doors: "external_doors",
  Trims: "external_trims",
  Miscellaneous: "external_miscellaneous",
};

const isMiscCategory = (category = "") => category === "Miscellaneous";

const createDefaultCategoryData = () =>
  CATEGORY_ORDER.reduce((acc, key) => {
    acc[key] = { concerns: [] };
    return acc;
  }, {});


export default function ExternalDetailsModal({ isOpen, onClose, onComplete, initialData, locked = false, summaryItems = [], inlineMode = false }) {
  const { isConcernLocked, getLockReason } = useConcernLock(summaryItems, "External");
  const contentWrapperStyle = {
    ...vhcModalContentStyles.contentWrapper,
    gap: "24px",
  };
  const summaryBadgeBase = vhcModalContentStyles.badge;
  const baseCardStyle = {
    ...vhcModalContentStyles.baseCard,
    alignItems: "flex-start",
    height: "auto",
  };
  const cardGridStyle = {
    ...vhcModalContentStyles.cardGrid,
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gridAutoRows: "auto",
    alignContent: "start",
  };

  const setCardHoverState = (element, hovering) => {
    const source = hovering
      ? vhcModalContentStyles.baseCardHover
      : {
          transform: vhcModalContentStyles.baseCard.transform,
          boxShadow: "none",
          borderColor: vhcModalContentStyles.baseCard.borderColor,
        };
    Object.entries(source).forEach(([key, value]) => {
      element.style[key] = value;
    });
  };

  const buildInitialData = (incoming) => {
    const defaults = createDefaultCategoryData();
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
      return defaults;
    }

    Object.entries(incoming).forEach(([rawKey, value]) => {
      const targetKey = rawKey === HORN_LEGACY_LABEL ? HORN_LABEL : rawKey;
      const concerns = Array.isArray(value?.concerns) ? value.concerns : [];
      defaults[targetKey] = {
        ...(value || {}),
        concerns,
      };
    });

    return defaults;
  };

  const [data, setData] = useState(() => buildInitialData(initialData));

  const [activeConcern, setActiveConcern] = useState({
    open: false,
    category: "",
    temp: { issue: "", status: "Red" },
  });

  const enableConcern = (category) => {
    setActiveConcern({
      open: true,
      category,
      temp: { issue: "", status: "Red" },
    });
  };

  const addConcern = () => {
    const { category, temp } = activeConcern;
    if (temp.issue.trim() === "") return;
    setData((prev) => ({
      ...prev,
      [category]: { ...prev[category], concerns: [...prev[category].concerns, temp] },
    }));
    setActiveConcern((prev) => ({
      ...prev,
      temp: { issue: "", status: "Red" },
    }));
  };

  const updateConcern = (category, idx, field, value) => {
    const current = data?.[category]?.concerns?.[idx];
    if (isConcernLocked(current, category)) return;
    setData((prev) => {
      const updated = [...prev[category].concerns];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, [category]: { ...prev[category], concerns: updated } };
    });
  };

  const deleteConcern = (category, idx) => {
    const current = data?.[category]?.concerns?.[idx];
    if (isConcernLocked(current, category)) return;
    setData((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        concerns: prev[category].concerns.filter((_, i) => i !== idx),
      },
    }));
  };

  const activeConcernEntries = data[activeConcern.category]?.concerns ?? [];
  const shouldScrollConcernEntries = activeConcernEntries.length > 2;

  const handleClose = () => {
    if (typeof onClose === "function") {
      onClose(data);
    }
  };

  const modalFooter = (
    <>
      <button
        type="button"
        onClick={handleClose}
        style={buildModalButton("ghost")}
      >
        Close
      </button>
      <button
        type="button"
        onClick={() => onComplete(data)}
        style={buildModalButton("primary")}
      >
        Save & Complete
      </button>
    </>
  );

  return (
    <VHCModalShell
      isOpen={isOpen}
      onClose={handleClose}
      title="External"
      locked={locked}
      inlineMode={inlineMode}
      adaptiveHeight
      lockedOverlay={false}
      hideCloseButton
      width="1280px"
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
              overflowY: "auto",
              paddingRight: "6px",
            }}
          >
          {CATEGORY_ORDER.map((category) => {
            const concerns = data[category]?.concerns ?? [];
            const redCount = concerns.filter((c) => c.status === "Red").length;
            const amberCount = concerns.filter((c) => c.status === "Amber").length;
            const greenCount = concerns.filter((c) => c.status === "Green").length;
            const loggedCount = redCount + amberCount + greenCount;

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
                  Tap to log observations or review existing issues.
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

      {activeConcern.open && typeof document !== "undefined"
        ? createPortal(
        <div
          style={{
            ...popupOverlayStyles,
            zIndex: 5600,
            padding: "24px",
          }}
        >
          <div
            style={{
              ...popupCardStyles,
              width: "min(520px, 92vw)",
              maxWidth: "92vw",
              minHeight: "480px",
              maxHeight: "90vh",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              overflow: "visible",
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
              {isMiscCategory(activeConcern.category) ? (
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
                  readOnly={locked}
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
              ) : (
                <IssueAutocomplete
                  sectionKey={EXTERNAL_SECTION_KEYS[activeConcern.category] || "external_miscellaneous"}
                  value={activeConcern.temp.issue}
                  onChange={(nextValue) =>
                    setActiveConcern((prev) => ({
                      ...prev,
                      temp: { ...prev.temp, issue: nextValue },
                    }))
                  }
                  onSelect={(nextValue) =>
                    setActiveConcern((prev) => ({
                      ...prev,
                      temp: { ...prev.temp, issue: nextValue },
                    }))
                  }
                  disabled={locked}
                  placeholder="Describe the issue…"
                  inputStyle={inputStyle}
                />
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "0 0 150px", minWidth: "150px" }}>
                  <label style={fieldLabelStyle}>Status</label>
                  <DropdownField
                    value={activeConcern.temp.status}
                    onChange={(e) =>
                      setActiveConcern((prev) => ({
                        ...prev,
                        temp: { ...prev.temp, status: e.target.value },
                      }))
                    }
                    className="vhc-concern-dropdown"
                    style={{ ...statusSelectStyle, width: "100%" }}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </DropdownField>
                </div>
                <button
                  type="button"
                  onClick={addConcern}
                  disabled={locked}
                  style={{ ...createVhcButtonStyle("primary") }}
                >
                  Add Concern
                </button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                overflowY: shouldScrollConcernEntries ? "auto" : "visible",
                maxHeight: shouldScrollConcernEntries ? "360px" : "none",
                paddingRight: shouldScrollConcernEntries ? "6px" : "0px",
              }}
            >
              {activeConcernEntries.length === 0 ? (
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
                  No concerns added yet. Capture details to keep this section up to date.
                </div>
              ) : (
                activeConcernEntries.map((concern, idx) => {
                  const rowLocked = isConcernLocked(concern, activeConcern.category);
                  const lockReason = getLockReason(concern, activeConcern.category);
                  const isDeclined = lockReason === "declined";
                  return (
                    <div
                      key={`${activeConcern.category}-${idx}`}
                      style={{
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        padding: "14px",
                        borderRadius: "16px",
                        border: `1px solid ${palette.border}`,
                        background: palette.surface,
                        boxShadow: "none",
                      }}
                    >
                      {rowLocked && lockReason && (
                        <div style={lockedRowOverlayStyle}>
                          <span style={lockedRowBadgeStyle(isDeclined)}>
                            Row {isDeclined ? "Declined" : "Authorised"}
                          </span>
                        </div>
                      )}
                      <label style={fieldLabelStyle}>Issue</label>
                      {isMiscCategory(activeConcern.category) ? (
                        <input
                          type="text"
                          value={concern.issue}
                          onChange={(e) => updateConcern(activeConcern.category, idx, "issue", e.target.value)}
                          readOnly={rowLocked}
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
                      ) : (
                        <IssueAutocomplete
                          sectionKey={EXTERNAL_SECTION_KEYS[activeConcern.category] || "external_miscellaneous"}
                          value={concern.issue}
                          onChange={(nextValue) => updateConcern(activeConcern.category, idx, "issue", nextValue)}
                          onSelect={(nextValue) => updateConcern(activeConcern.category, idx, "issue", nextValue)}
                          disabled={rowLocked}
                          placeholder="Describe the issue…"
                          inputStyle={inputStyle}
                        />
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                        <DropdownField
                          value={concern.status}
                          onChange={(e) => updateConcern(activeConcern.category, idx, "status", e.target.value)}
                          className="vhc-concern-dropdown"
                          style={{ ...statusSelectStyle, flex: "0 0 130px" }}
                          disabled={rowLocked}
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </DropdownField>

                        <button
                          type="button"
                          onClick={() => deleteConcern(activeConcern.category, idx)}
                          disabled={rowLocked}
                          style={{
                            ...createVhcButtonStyle("ghost", { disabled: rowLocked }),
                            color: rowLocked ? palette.textMuted : palette.danger,
                            borderColor: palette.border,
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>,
          document.body
        )
        : null}
    </VHCModalShell>
  );
}
