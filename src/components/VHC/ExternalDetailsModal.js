// file location: src/components/VHC/ExternalDetailsModal.js
import React, { useState } from "react";
import VHCModalShell, { buildModalButton } from "@/components/VHC/VHCModalShell";
import themeConfig, {
  createVhcButtonStyle,
  vhcModalContentStyles,
  popupOverlayStyles,
  popupCardStyles,
} from "@/styles/appTheme";
import { DropdownField } from "@/components/dropdownAPI";

const palette = themeConfig.palette;

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

const createDefaultCategoryData = () =>
  CATEGORY_ORDER.reduce((acc, key) => {
    acc[key] = { concerns: [] };
    return acc;
  }, {});

const STATUS_OPTIONS = ["Red", "Amber", "Green"];

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
  boxShadow: "none",
};

const statusSelectStyle = {
  ...inputStyle,
  width: "auto",
};

export default function ExternalDetailsModal({ isOpen, onClose, onComplete, initialData, locked = false, summaryItems = [] }) {
  // Find matching summary item for a concern to get its approval status from the database
  const findSummaryItemForConcern = (category, concern) => {
    if (!concern || !category || !Array.isArray(summaryItems)) return null;
    const concernText = (concern.issue || concern.text || "").toLowerCase().trim();
    if (!concernText) return null;

    return summaryItems.find((item) => {
      // Match section name (External for this modal)
      if (item.sectionName !== "External") return false;
      // Match category (label in summary)
      if (item.label !== category) return false;
      // Match concern text
      const itemConcerns = item.concerns || [];
      return itemConcerns.some((c) => {
        const cText = (c.text || c.issue || "").toLowerCase().trim();
        return cText === concernText;
      });
    });
  };

  const isConcernLocked = (concern, category) => {
    if (!concern || typeof concern !== "object") return false;
    if (concern.locked === true) return true;
    if (concern.authorised === true || concern.authorized === true) return true;
    if (concern.declined === true) return true;
    const decision =
      concern.approvalStatus ||
      concern.decisionStatus ||
      concern.decisionKey ||
      concern.statusDecision ||
      "";
    const normalized = String(decision).toLowerCase();
    if (["authorized", "authorised", "declined", "completed"].includes(normalized)) return true;

    // Check summary items for authorization status from database
    const summaryItem = findSummaryItemForConcern(category, concern);
    if (summaryItem) {
      const approvalStatus = (summaryItem.approvalStatus || "").toLowerCase();
      if (["authorized", "authorised", "declined", "completed"].includes(approvalStatus)) {
        return true;
      }
    }
    return false;
  };

  const getLockReason = (concern, category) => {
    if (!concern || typeof concern !== "object") return null;
    if (concern.declined === true) return "declined";
    if (concern.authorised === true || concern.authorized === true) return "authorised";
    const decision =
      concern.approvalStatus ||
      concern.decisionStatus ||
      concern.decisionKey ||
      concern.statusDecision ||
      "";
    const normalized = String(decision).toLowerCase();
    if (normalized === "declined") return "declined";
    if (["authorized", "authorised", "completed"].includes(normalized)) return "authorised";
    if (concern.locked === true) return "authorised";

    // Check summary items for authorization status from database
    const summaryItem = findSummaryItemForConcern(category, concern);
    if (summaryItem) {
      const approvalStatus = (summaryItem.approvalStatus || "").toLowerCase();
      if (approvalStatus === "declined") return "declined";
      if (["authorized", "authorised", "completed"].includes(approvalStatus)) return "authorised";
    }
    return null;
  };

  const lockedRowOverlayStyle = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "16px",
    zIndex: 10,
    pointerEvents: "none",
  };

  const lockedRowBadgeStyle = (isDeclined) => ({
    padding: "8px 16px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
    backgroundColor: isDeclined ? "var(--danger-surface)" : "var(--success-surface)",
    color: isDeclined ? "var(--danger)" : "var(--success)",
    border: `1px solid ${isDeclined ? "var(--danger)" : "var(--success)"}`,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  });
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
      lockedOverlay={false}
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

      {activeConcern.open ? (
        <div
          style={{
            ...popupOverlayStyles,
            zIndex: 1400,
            padding: "24px",
          }}
        >
          <div
            style={{
              ...popupCardStyles,
              width: "min(420px, 90%)",
              maxHeight: "86%",
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
              <DropdownField
                value={activeConcern.temp.status}
                onChange={(e) =>
                  setActiveConcern((prev) => ({
                    ...prev,
                    temp: { ...prev.temp, status: e.target.value },
                  }))
                }
                className="vhc-concern-dropdown"
                style={statusSelectStyle}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </DropdownField>

              <button
                type="button"
                onClick={addConcern}
                style={{ ...createVhcButtonStyle("primary"), alignSelf: "flex-end" }}
              >
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
                  No concerns added yet. Capture details to keep this section up to date.
                </div>
              ) : (
                data[activeConcern.category].concerns.map((concern, idx) => {
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
        </div>
      ) : null}
    </VHCModalShell>
  );
}
