// file location: src/components/VHC/UndersideDetailsModal.js
import React, { useState } from "react";
import { createPortal } from "react-dom";
import VHCModalShell from "@/components/VHC/VHCModalShell";
import SectionCameraButton from "@/components/VHC/mediaCapture/SectionCameraButton";
import Button from "@/components/ui/Button";
import {
  vhcModalContentStyles,
  popupOverlayStyles,
  popupCardStyles,
} from "@/styles/appTheme";
import { DropdownField } from "@/components/ui/dropdownAPI";
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

const CATEGORY_ORDER = [
  "Exhaust system/catalyst",
  "Steering",
  "Front suspension",
  "Rear suspension",
  "Driveshafts/oil leaks",
  "Miscellaneous",
];

const UNDERSIDE_SECTION_KEYS = {
  "Exhaust system/catalyst": "underside_exhaust_system_catalyst",
  Steering: "underside_steering",
  "Front suspension": "underside_front_suspension",
  "Rear suspension": "underside_rear_suspension",
  "Driveshafts/oil leaks": "underside_driveshafts_oil_leaks",
  Miscellaneous: "underside_miscellaneous",
};

const isMiscCategory = (category = "") => category === "Miscellaneous";


export default function UndersideDetailsModal({
  isOpen,
  onClose,
  onComplete,
  initialData,
  locked = false,
  summaryItems = [],
  inlineMode = false,
  jobId = null,
  jobNumber = null,
  userId = null,
  onSectionMediaUploaded = null,
}) {
  const { isConcernLocked, getLockReason } = useConcernLock(summaryItems, "Underside");
  const contentWrapperStyle = {
    ...vhcModalContentStyles.contentWrapper,
    gap: "24px",
  };
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

  const handleSaveComplete = () => {
    onComplete(data);
  };

  const canShowCamera = Boolean(jobId || jobNumber);

  const modalFooter = (
    <>
      {canShowCamera ? (
        <SectionCameraButton
          sectionKey="underside"
          sectionLabel="Underside"
          vhcData={{ undersideInspection: data }}
          jobId={jobId}
          jobNumber={jobNumber}
          userId={userId}
          onUploadComplete={onSectionMediaUploaded}
        />
      ) : null}
      <Button variant="ghost" size="sm" onClick={handleClose} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
        Close
      </Button>
      <Button variant="primary" size="sm" onClick={handleSaveComplete} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
        Save & Complete
      </Button>
    </>
  );

  return (
    <VHCModalShell
      isOpen={isOpen}
      onClose={handleClose}
      title="Underside"
      locked={locked}
      inlineMode={inlineMode}
      adaptiveHeight
      lockedOverlay={false}
      hideCloseButton
      width="1280px"
      footer={modalFooter}
      sectionKey="vhc-underside"
    >
      <div style={contentWrapperStyle} data-dev-section="1" data-dev-section-key="vhc-underside-content" data-dev-section-type="content-card" data-dev-section-parent="vhc-underside-body">
        <div
          data-dev-section="1"
          data-dev-section-key="vhc-underside-layout"
          data-dev-section-type="content-card"
          data-dev-section-parent="vhc-underside-content"
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
                onMouseEnter={(e) => {
                  setCardHoverState(e.currentTarget, true);
                }}
                onMouseLeave={(e) => {
                  setCardHoverState(e.currentTarget, false);
                }}
              >
                <span style={{ fontSize: "16px", fontWeight: 700, color: palette.textPrimary, textAlign: "left" }}>
                  {category}
                </span>
                <span style={{ fontSize: "13px", color: palette.textMuted, textAlign: "left" }}>
                  Tap to log underside observations or amend existing notes.
                </span>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <div className="app-badge app-badge--control app-badge--accent-soft">{loggedCount} logged</div>
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
            zIndex: 9000,
            padding: "var(--popup-viewport-gap, clamp(12px, 2.5vw, 24px))",
          }}
        >
          <div
            style={{
              ...popupCardStyles,
              width: "min(720px, 94vw)",
              minHeight: "auto",
              maxHeight: "calc(100dvh - 48px)",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 0,
              overflow: "hidden",
              background: "var(--page-card-bg, var(--surface))",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              padding: "18px 20px",
              background: "var(--page-card-bg-alt, var(--surface-light))",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--info)", fontWeight: 700 }}>
                  Issue report
                </span>
                <h3 style={{ fontSize: "20px", fontWeight: 800, color: palette.accent, margin: 0 }}>
                  {activeConcern.category}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveConcern({ open: false, category: "", temp: { issue: "", status: "Red" } })}
                style={{ padding: "6px 14px" }}
              >
                Close
              </Button>
            </div>

            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "12px", background: "var(--surface)" }}>
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
                />
              ) : (
                <IssueAutocomplete
                  sectionKey={UNDERSIDE_SECTION_KEYS[activeConcern.category] || "underside_miscellaneous"}
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
                <Button variant="primary" size="sm" onClick={addConcern} disabled={locked}>
                  Add Concern
                </Button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                overflowY: shouldScrollConcernEntries ? "auto" : "visible",
                maxHeight: shouldScrollConcernEntries ? "340px" : "none",
                padding: "0 20px 20px",
              }}
            >
              {activeConcernEntries.length === 0 ? (
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "var(--radius-md)",
                    border: "none",
                    backgroundColor: palette.accentSurface,
                    color: palette.textMuted,
                    fontSize: "13px",
                  }}
                >
                  No concerns added yet. Add items to keep this section current.
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
                        borderRadius: "var(--radius-md)",
                        border: "none",
                        background: palette.surface,
                      }}
                    >
                      {rowLocked && lockReason && (
                        <div style={lockedRowOverlayStyle}>
                          <span style={lockedRowBadgeStyle(isDeclined)}>
                            Row {isDeclined ? "Declined" : "Authorised"}
                          </span>
                        </div>
                      )}
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) 160px auto",
                        gap: "10px",
                        alignItems: "center"
                      }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: palette.textMuted }}>{activeConcern.category}</span>
                        <DropdownField
                          value={concern.status}
                          onChange={(e) => updateConcern(activeConcern.category, idx, "status", e.target.value)}
                          className="vhc-concern-dropdown"
                          style={{ ...statusSelectStyle, width: "160px", flex: "0 0 160px" }}
                          disabled={rowLocked}
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </DropdownField>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => deleteConcern(activeConcern.category, idx)}
                          disabled={rowLocked}
                        >
                          Remove
                        </Button>
                      </div>
                      <label style={fieldLabelStyle}>Issue</label>
                      {isMiscCategory(activeConcern.category) ? (
                        <input
                          type="text"
                          value={concern.issue}
                          onChange={(e) => updateConcern(activeConcern.category, idx, "issue", e.target.value)}
                          readOnly={rowLocked}
                          style={inputStyle}
                        />
                      ) : (
                        <IssueAutocomplete
                          sectionKey={UNDERSIDE_SECTION_KEYS[activeConcern.category] || "underside_miscellaneous"}
                          value={concern.issue}
                          onChange={(nextValue) => updateConcern(activeConcern.category, idx, "issue", nextValue)}
                          onSelect={(nextValue) => updateConcern(activeConcern.category, idx, "issue", nextValue)}
                          disabled={rowLocked}
                          placeholder="Describe the issue…"
                          inputStyle={inputStyle}
                        />
                      )}

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
