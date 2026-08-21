// file location: src/components/VHC/ExternalDetailsModal.js
import React, { useEffect, useState } from "react";
import VHCModalShell from "@/components/VHC/VHCModalShell";
import IssueReportPopup, {
  IssueReportAddSection,
  IssueReportList,
  IssueReportRow,
} from "@/components/VHC/IssueReportPopup";
import SectionCameraButton from "@/components/VHC/mediaCapture/SectionCameraButton";
import Button from "@/components/ui/Button";
import {
  vhcModalContentStyles,
} from "@/styles/appTheme";
import IssueAutocomplete from "@/components/VHC/IssueAutocomplete";
import {
  palette,
  inputStyle,
  lockedRowOverlayStyle,
  lockedRowBadgeStyle,
} from "@/components/VHC/vhcModalStyles";
import { useConcernLock } from "@/components/VHC/useConcernLock";
import useVhcSectionDraft from "@/hooks/useVhcSectionDraft";

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


export default function ExternalDetailsModal({
  isOpen,
  onClose,
  onComplete,
  initialData,
  locked = false,
  summaryItems = [],
  inlineMode = false,
  // Job identifiers for the per-section camera button. When all three
  // are present the camera button is rendered in the footer.
  jobId = null,
  jobNumber = null,
  userId = null,
  onSectionMediaUploaded = null,
}) {
  const { isConcernLocked, getLockReason } = useConcernLock(summaryItems, "External");
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

  const { readDraft, persistDraft, completeDraft } = useVhcSectionDraft({
    sectionKey: "externalInspection",
    jobId,
    jobNumber,
    userId,
    isOpen,
    onComplete,
  });
  const [data, setData] = useState(() => buildInitialData(readDraft(initialData)));

  useEffect(() => {
    if (!isOpen) return;
    setData(buildInitialData(readDraft(initialData)));
  }, [initialData, isOpen, readDraft]);

  useEffect(() => {
    persistDraft(data);
  }, [data, persistDraft]);

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

  const handleComplete = async () => {
    await completeDraft(data);
  };

  const canShowCamera = Boolean(jobId || jobNumber);

  const modalFooter = (
    <>
      {canShowCamera ? (
        <SectionCameraButton
          sectionKey="external"
          sectionLabel="External"
          vhcData={{ externalInspection: data }}
          jobId={jobId}
          jobNumber={jobNumber}
          userId={userId}
          onUploadComplete={onSectionMediaUploaded}
        />
      ) : null}
      <Button
        variant="secondary"
        size="sm"
        onClick={handleClose}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
      >
        Close
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={handleComplete}
        disabled={locked}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
      >
        Complete
      </Button>
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
      sectionKey="vhc-external"
    >
      <div data-draft-ignore="true" style={contentWrapperStyle} data-dev-section="1" data-dev-section-key="vhc-external-content" data-dev-section-type="content-card" data-dev-section-parent="vhc-external-body">
        <div
          data-dev-section="1"
          data-dev-section-key="vhc-external-layout"
          data-dev-section-type="content-card"
          data-dev-section-parent="vhc-external-content"
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
                  <div className="app-badge app-badge--accent-soft">{loggedCount} logged</div>
                </div>
              </button>
            );
          })}
        </div>
        </div>

      </div>

      {activeConcern.open ? (
        <IssueReportPopup
          isOpen={activeConcern.open}
          title={activeConcern.category}
          onClose={() => setActiveConcern({ open: false, category: "", temp: { issue: "", status: "Red" } })}
        >

          <IssueReportAddSection
            descriptionControl={isMiscCategory(activeConcern.category) ? (
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
            severity={activeConcern.temp.status}
            onSeverityChange={(status) =>
              setActiveConcern((prev) => ({ ...prev, temp: { ...prev.temp, status } }))
            }
            onAdd={addConcern}
            addDisabled={!activeConcern.temp.issue.trim()}
            disabled={locked}
          />
          <IssueReportList count={activeConcernEntries.length} emptyMessage="No issues reported for this location." scroll={shouldScrollConcernEntries}>
            {activeConcernEntries.map((concern, idx) => {
                  const rowLocked = isConcernLocked(concern, activeConcern.category);
                  const lockReason = getLockReason(concern, activeConcern.category);
                  const isDeclined = lockReason === "declined";
                  return (
                    <IssueReportRow
                      key={`${activeConcern.category}-${idx}`}
                      issue={concern}
                      description={isMiscCategory(activeConcern.category) ? (
                        <input type="text" value={concern.issue} onChange={(e) => updateConcern(activeConcern.category, idx, "issue", e.target.value)} readOnly={rowLocked} style={inputStyle} aria-label="Issue description" />
                      ) : (
                        <IssueAutocomplete sectionKey={EXTERNAL_SECTION_KEYS[activeConcern.category] || "external_miscellaneous"} value={concern.issue} onChange={(nextValue) => updateConcern(activeConcern.category, idx, "issue", nextValue)} onSelect={(nextValue) => updateConcern(activeConcern.category, idx, "issue", nextValue)} disabled={rowLocked} placeholder="Describe the issue…" inputStyle={inputStyle} />
                      )}
                      severity={concern.status}
                      onSeverityChange={(status) => updateConcern(activeConcern.category, idx, "status", status)}
                      onDelete={() => deleteConcern(activeConcern.category, idx)}
                      disabled={rowLocked}
                      overlay={rowLocked && lockReason ? (
                        <div style={lockedRowOverlayStyle}>
                          <span style={lockedRowBadgeStyle(isDeclined)}>
                            Row {isDeclined ? "Declined" : "Authorised"}
                          </span>
                        </div>
                      ) : null}
                    />
                  );
                })}
          </IssueReportList>
        </IssueReportPopup>
      ) : null}
    </VHCModalShell>
  );
}
