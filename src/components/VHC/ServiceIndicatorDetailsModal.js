// file location: src/components/VHC/ServiceIndicatorDetailsModal.js
import React, { useEffect, useMemo, useState } from "react";
import VHCModalShell from "@/components/VHC/VHCModalShell";
import SectionCameraButton from "@/components/VHC/mediaCapture/SectionCameraButton";
import Button from "@/components/ui/Button";
import IssueReportPopup, {
  IssueReportAddSection,
  IssueReportList,
  IssueReportRow,
} from "@/components/VHC/IssueReportPopup";
import themeConfig, { vhcModalContentStyles } from "@/styles/appTheme";
import IssueAutocomplete from "@/components/VHC/IssueAutocomplete";
import useVhcSectionDraft from "@/hooks/useVhcSectionDraft";

const palette = themeConfig.palette;

const SERVICE_OPTIONS = [
  { key: "reset", label: "Service Reminder Reset" },
  { key: "not_required", label: "Service Reminder Not Required" },
  { key: "no_reminder", label: "Doesn't Have a Service Reminder" },
  { key: "indicator_on", label: "Service Indicator On" },
];

const OIL_OPTIONS = ["Good", "Bad", "EV"];

const UNDER_BONNET_ITEMS = [
  "Antifreeze Strength",
  "Water/Oil",
  "Fluid Leaks",
  "Alternator Belt/Battery",
  "Power Steering Fluid",
  "Fuel System",
  "Cam Belt",
  "Service reminder/Oil level",
  "Miscellaneous",
];

const SERVICE_CHOICE_STATUS = {
  reset: "Green",
  not_required: "Green",
  no_reminder: "Amber",
  indicator_on: "Amber",
};

const deriveServiceIndicatorStatus = ({ serviceChoice, oilStatus }) => {
  const statuses = [];
  const choiceStatus = serviceChoice ? SERVICE_CHOICE_STATUS[serviceChoice] || null : null;
  if (choiceStatus) statuses.push(choiceStatus);

  if (oilStatus === "Bad") statuses.push("Red");
  else if (oilStatus === "Good" || oilStatus === "EV") statuses.push("Green");

  if (statuses.includes("Red")) return "Red";
  if (statuses.includes("Amber")) return "Amber";
  if (statuses.includes("Green")) return "Green";
  return null;
};

const normaliseOilStatus = (value) => {
  if (!value) return null;
  if (value === "Yes") return "Good";
  if (value === "No") return "Bad";
  return value;
};

const concernTargets = [
  { key: "service", label: "Service Reminder" },
  { key: "oil", label: "Oil Level" },
  ...UNDER_BONNET_ITEMS.map((item) => ({ key: item, label: item })),
];

const resolveServiceSectionKey = (target = "") => {
  if (target === "service") return "service_service_reminder";
  if (target === "oil") return "service_oil_level";
  if (target === "Miscellaneous") return "service_under_bonnet_miscellaneous";
  return "service_under_bonnet_general";
};

export default function ServiceIndicatorDetailsModal({
  isOpen,
  initialData,
  onClose,
  onComplete,
  locked = false,
  inlineMode = false,
  jobId = null,
  jobNumber = null,
  userId = null,
  onSectionMediaUploaded = null,
}) {
  const { readDraft, persistDraft, completeDraft } = useVhcSectionDraft({
    sectionKey: "serviceIndicator",
    jobId,
    jobNumber,
    userId,
    isOpen,
    onComplete,
  });
  const restoredInitialData = readDraft(initialData || {});
  const contentWrapperStyle = {
    ...vhcModalContentStyles.contentWrapper,
    gap: "20px",
  };
  const cardShellStyle = {
    ...vhcModalContentStyles.baseCard,
    cursor: "default",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  };
  const concernCardStyle = {
    ...cardShellStyle,
    padding: "16px 20px",
  };

  const [serviceChoice, setServiceChoice] = useState(restoredInitialData?.serviceChoice ?? null);
  const [oilStatus, setOilStatus] = useState(normaliseOilStatus(restoredInitialData?.oilStatus ?? null));
  const [concerns, setConcerns] = useState(() => restoredInitialData?.concerns ?? []);
  const [showConcernModal, setShowConcernModal] = useState(false);
  const [activeConcernTarget, setActiveConcernTarget] = useState(null);
  const [newConcern, setNewConcern] = useState("");
  const [concernStatus, setConcernStatus] = useState("Red");
  const [showValidation, setShowValidation] = useState(false);
  const getConcernText = (concern) =>
    (concern?.text ?? concern?.description ?? concern?.issue ?? "").toString();

  useEffect(() => {
    if (!isOpen) return;
    const nextData = readDraft(initialData || {});
    setServiceChoice(nextData?.serviceChoice ?? null);
    setOilStatus(normaliseOilStatus(nextData?.oilStatus ?? null));
    setConcerns(nextData?.concerns ?? []);
    setShowValidation(false);
  }, [initialData, isOpen, readDraft]);

  useEffect(() => {
    persistDraft({ serviceChoice, oilStatus, concerns });
  }, [concerns, oilStatus, persistDraft, serviceChoice]);

  const openConcernFor = (source) => {
    setActiveConcernTarget(source);
    setShowConcernModal(true);
  };

  const concernsBySource = useMemo(() => {
    const buckets = {
      service: [],
      oil: [],
      underBonnet: [],
    };
    concerns.forEach((concernItem) => {
      if (concernItem.source === "service") {
        buckets.service.push(concernItem);
      } else if (concernItem.source === "oil") {
        buckets.oil.push(concernItem);
      } else if (UNDER_BONNET_ITEMS.includes(concernItem.source)) {
        buckets.underBonnet.push(concernItem);
      }
    });
    return buckets;
  }, [concerns]);

  const ConcernPanel = ({ label, concernsList = [], onAdd, showSource = false }) => {
    if (!concernsList.length) return null;
    const redCount = concernsList.filter((concernItem) => concernItem.status === "Red").length;
    const amberCount = concernsList.filter((concernItem) => concernItem.status === "Amber").length;
    const greenCount = concernsList.filter((concernItem) => concernItem.status === "Green").length;
    return (
      <div style={concernCardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "12px", letterSpacing: "0.2em", color: palette.textMuted }}>
              {label} Concerns
            </span>
            <span style={{ fontSize: "18px", fontWeight: 700, color: palette.textPrimary }}>
              {concernsList.length} total
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={onAdd}
              style={{ gap: "6px" }}
            >
              + Add Concern
            </Button>
            <span
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-pill)",
                background: "var(--danger-surface)",
                color: palette.danger,
                fontWeight: 600,
                fontSize: "12px",
              }}
            >
              Red {redCount}
            </span>
            <span
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-pill)",
                background: "var(--warning-surface)",
                color: palette.warning,
                fontWeight: 600,
                fontSize: "12px",
              }}
            >
              Amber {amberCount}
            </span>
            <span
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-pill)",
                background: "var(--success-surface)",
                color: palette.success,
                fontWeight: 600,
                fontSize: "12px",
              }}
            >
              Green {greenCount}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {concernsList.map((concernItem, idx) => (
            <div
              key={`${concernItem.source}-${idx}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderRadius: "var(--radius-sm)",
                border: "none",
                padding: "10px 12px",
                background: palette.surface,
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: palette.textPrimary }}>
                  {getConcernText(concernItem)}
                </span>
                {showSource && (
                  <span style={{ fontSize: "11px", color: palette.textMuted }}>
                    {concernItem.source}
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color:
                    concernItem.status === "Red"
                      ? palette.danger
                      : concernItem.status === "Green"
                        ? palette.success
                        : palette.warning,
                }}
              >
                {concernItem.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const addConcern = () => {
    if (newConcern.trim() === "" || !activeConcernTarget) return;
    setConcerns((prev) => [
      ...prev,
      {
        text: newConcern.trim(),
        description: newConcern.trim(),
        status: concernStatus,
        source: activeConcernTarget,
      },
    ]);
    setNewConcern("");
    setConcernStatus("Red");
  };

  const closeConcernModal = () => {
    setShowConcernModal(false);
    setActiveConcernTarget(null);
    setNewConcern("");
    setConcernStatus("Red");
  };

  const updateConcern = (idx, updates) => {
    setConcerns((prev) =>
      prev.map((concern, concernIdx) => {
        if (concernIdx !== idx) return concern;
        const next = { ...concern, ...updates };
        if (Object.prototype.hasOwnProperty.call(updates, "text")) {
          next.description = updates.text;
        }
        if (Object.prototype.hasOwnProperty.call(updates, "description")) {
          next.text = updates.description;
        }
        return next;
      })
    );
  };

  const deleteConcern = (idx) => {
    setConcerns((prev) => prev.filter((_, concernIdx) => concernIdx !== idx));
  };

  const activeConcernLabel =
    concernTargets.find((target) => target.key === activeConcernTarget)?.label || activeConcernTarget || "selected area";
  const activeConcernEntries = concerns
    .map((concern, index) => ({ ...concern, _globalIndex: index }))
    .filter((concern) => concern.source === activeConcernTarget);
  const canComplete = !!serviceChoice && !!oilStatus;
  const missingServiceChoice = !serviceChoice;
  const missingOilStatus = !oilStatus;
  const requiredCardStyle = {
    border: "none",
    background: "var(--danger-surface)",
  };

  const handleClose = () => {
    if (!onClose) return;
    onClose({
      serviceChoice,
      oilStatus,
      concerns,
      status: deriveServiceIndicatorStatus({ serviceChoice, oilStatus }),
    });
  };

  const handleSaveComplete = async () => {
    if (!canComplete) {
      setShowValidation(true);
      return;
    }
    await completeDraft({
      serviceChoice,
      oilStatus,
      concerns,
      status: deriveServiceIndicatorStatus({ serviceChoice, oilStatus }),
    });
  };

  const canShowCamera = Boolean(jobId || jobNumber);

  const footer = (
    <>
      {canShowCamera ? (
        <SectionCameraButton
          sectionKey="service"
          sectionLabel="Service Indicator & Under Bonnet"
          vhcData={{ serviceIndicator: { concerns } }}
          jobId={jobId}
          jobNumber={jobNumber}
          userId={userId}
          onUploadComplete={onSectionMediaUploaded}
        />
      ) : null}
      <Button variant="secondary" size="sm" onClick={handleClose} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
        Close
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={handleSaveComplete}
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
      title="Service Indicator & Under Bonnet"
      locked={locked}
      inlineMode={inlineMode}
      adaptiveHeight
      onClose={handleClose}
      hideCloseButton
      width="1280px"
      footer={footer}
      sectionKey="vhc-service"
    >
      <div data-draft-ignore="true" style={contentWrapperStyle} data-dev-section="1" data-dev-section-key="vhc-service-content" data-dev-section-type="content-card" data-dev-section-parent="vhc-service-body">
        <div
          data-dev-section="1"
          data-dev-section-key="vhc-service-layout"
          data-dev-section-type="content-card"
          data-dev-section-parent="vhc-service-content"
          style={{
            flex: 1,
            display: "grid",
            gridTemplateRows: showValidation && !canComplete ? "auto auto auto minmax(0, 1fr)" : "auto auto minmax(0, 1fr)",
            gap: "20px",
            minHeight: 0,
          }}
        >
          {showValidation && !canComplete ? (
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--danger)" }}>
              Complete all highlighted sections to continue.
            </div>
          ) : null}
          <div data-dev-section="1" data-dev-section-key="vhc-service-reminder" data-dev-section-type="content-card" data-dev-section-parent="vhc-service-layout" style={showValidation && missingServiceChoice ? { ...cardShellStyle, ...requiredCardStyle } : cardShellStyle}>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: palette.accent }}>
              Service Reminder
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
              {SERVICE_OPTIONS.map((option) => {
                const isActive = serviceChoice === option.key;
                const optionStatus = SERVICE_CHOICE_STATUS[option.key] || "Amber";
                const toneColor = optionStatus === "Green" ? palette.success : palette.warning;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setServiceChoice(option.key)}
                    style={{
                      borderRadius: "var(--control-radius)",
                      padding: "var(--control-padding)",
                      border: "none",
                      background: isActive ? toneColor : "var(--control-bg)",
                      color: isActive ? "var(--text-2)" : "var(--text-1)",
                      fontWeight: 600,
                      fontSize: "var(--control-font-size)",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "background-color 0.18s ease, color 0.18s ease",
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <ConcernPanel
              label="Service Reminder"
              concernsList={concernsBySource.service}
              onAdd={() => openConcernFor("service")}
            />
          </div>

          <div data-dev-section="1" data-dev-section-key="vhc-service-oil" data-dev-section-type="content-card" data-dev-section-parent="vhc-service-layout" style={showValidation && missingOilStatus ? { ...cardShellStyle, ...requiredCardStyle } : cardShellStyle}>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: palette.accent }}>
              Oil Level
            </h3>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {OIL_OPTIONS.map((option) => {
                const isActive = oilStatus === option;
                const isPositive = option === "Good" || option === "EV";
                const optionBorder = isPositive ? palette.success : palette.danger;
                const optionSurface = isPositive ? "var(--success-surface)" : "var(--danger-surface)";
                const optionText = isPositive ? palette.success : palette.danger;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setOilStatus(option)}
                    style={{
                      padding: "var(--control-padding)",
                      borderRadius: "var(--control-radius)",
                      border: "none",
                      background: isActive ? optionBorder : "var(--control-bg)",
                      color: isActive ? "var(--text-2)" : "var(--text-1)",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "background-color 0.18s ease, color 0.18s ease",
                    }}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            <ConcernPanel
              label="Oil Level"
              concernsList={concernsBySource.oil}
              onAdd={() => openConcernFor("oil")}
            />
          </div>

          <div data-dev-section="1" data-dev-section-key="vhc-service-underbonnet" data-dev-section-type="content-card" data-dev-section-parent="vhc-service-layout" style={{ ...cardShellStyle, gap: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: palette.accent }}>
              Under Bonnet Items
            </h3>
            <div
              data-dev-section="1"
              data-dev-section-key="vhc-service-underbonnet-grid"
              data-dev-section-type="content-card"
              data-dev-section-parent="vhc-service-underbonnet"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gridAutoRows: "minmax(90px, 1fr)",
                gap: "16px",
                alignContent: "stretch",
                flex: 1,
              }}
            >
              {UNDER_BONNET_ITEMS.map((item) => {
                const itemConcerns = concerns.filter((concern) => concern.source === item);
                const count = itemConcerns.length;
                const redCount = itemConcerns.filter((concern) => concern.status === "Red").length;
                const amberCount = itemConcerns.filter((concern) => concern.status === "Amber").length;
                const greenCount = itemConcerns.filter((concern) => concern.status === "Green").length;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => openConcernFor(item)}
                    style={{
                      padding: "var(--control-padding)",
                      borderRadius: "var(--section-card-radius)",
                      border: "none",
                      background: "var(--control-bg)",
                      color: "var(--text-1)",
                      fontWeight: 600,
                      fontSize: "var(--control-font-size)",
                      textAlign: "left",
                      position: "relative",
                      cursor: "pointer",
                      transition: "background-color 0.18s ease",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <span>{item}</span>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "11px", color: palette.textMuted, fontWeight: 600 }}>
                          {count} total
                        </span>
                        {redCount > 0 ? (
                          <span style={{ fontSize: "11px", color: palette.danger, fontWeight: 700 }}>
                            Red {redCount}
                          </span>
                        ) : null}
                        {amberCount > 0 ? (
                          <span style={{ fontSize: "11px", color: palette.warning, fontWeight: 700 }}>
                            Amber {amberCount}
                          </span>
                        ) : null}
                        {greenCount > 0 ? (
                          <span style={{ fontSize: "11px", color: palette.success, fontWeight: 700 }}>
                            Green {greenCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showConcernModal ? (
        <IssueReportPopup
          isOpen={showConcernModal}
          title={activeConcernLabel}
          onClose={closeConcernModal}
          width="760px"
        >
          <IssueReportAddSection
            descriptionControl={activeConcernTarget === "Miscellaneous" ? (
                    <textarea
                      value={newConcern}
                      onChange={(event) => setNewConcern(event.target.value)}
                      placeholder="Describe where the issue is and what you observed..."
                      readOnly={locked}
                      rows={3}
                      style={{ width: "100%" }}
                    />
                  ) : (
                    <IssueAutocomplete
                      sectionKey={resolveServiceSectionKey(activeConcernTarget)}
                      value={newConcern}
                      onChange={setNewConcern}
                      onSelect={setNewConcern}
                      disabled={locked}
                      placeholder="Describe the issue..."
                    />
                  )}
            severity={concernStatus}
            onSeverityChange={setConcernStatus}
            onAdd={addConcern}
            addDisabled={newConcern.trim() === ""}
            disabled={locked}
          />
          <IssueReportList count={activeConcernEntries.length} emptyMessage="No issues reported for this location." scroll={activeConcernEntries.length > 2}>
            {activeConcernEntries.map((concern) => (
                  <IssueReportRow
                    key={`${concern.source}-${concern._globalIndex}`}
                    issue={concern}
                    description={activeConcernTarget === "Miscellaneous" ? (
                      <textarea
                        value={getConcernText(concern)}
                        onChange={(e) => updateConcern(concern._globalIndex, { text: e.target.value })}
                        rows={2}
                        style={{ width: "100%" }}
                        readOnly={locked}
                      />
                    ) : (
                      <IssueAutocomplete
                        sectionKey={resolveServiceSectionKey(activeConcernTarget)}
                        value={getConcernText(concern)}
                        onChange={(nextValue) => updateConcern(concern._globalIndex, { text: nextValue })}
                        onSelect={(nextValue) => updateConcern(concern._globalIndex, { text: nextValue })}
                        disabled={locked}
                        placeholder="Describe concern..."
                        inputStyle={{
                          borderRadius: "var(--radius-md)",
                          border: "none",
                          padding: "10px 12px",
                          fontSize: "14px",
                          color: palette.textPrimary,
                          outline: "none",
                        }}
                      />
                    )}
                    severity={concern.status}
                    onSeverityChange={(status) => updateConcern(concern._globalIndex, { status })}
                    onDelete={() => deleteConcern(concern._globalIndex)}
                    disabled={locked}
                  />
                ))}
          </IssueReportList>
        </IssueReportPopup>
      ) : null}
    </VHCModalShell>
  );
}
