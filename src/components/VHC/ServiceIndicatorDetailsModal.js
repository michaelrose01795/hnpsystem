// file location: src/components/VHC/ServiceIndicatorDetailsModal.js
import React, { useEffect, useMemo, useState } from "react";
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
  "Miscellaneous",
  "Service reminder/Oil level",
];

const STATUS_OPTIONS = ["Red", "Amber", "Green"];

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

export default function ServiceIndicatorDetailsModal({ isOpen, initialData, onClose, onComplete, locked = false, inlineMode = false }) {
  const contentWrapperStyle = {
    ...vhcModalContentStyles.contentWrapper,
    gap: "20px",
    height: "100%",
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

  const [serviceChoice, setServiceChoice] = useState(initialData?.serviceChoice ?? null);
  const [oilStatus, setOilStatus] = useState(normaliseOilStatus(initialData?.oilStatus ?? null));
  const [concerns, setConcerns] = useState(() => initialData?.concerns ?? []);
  const [showConcernModal, setShowConcernModal] = useState(false);
  const [activeConcernTarget, setActiveConcernTarget] = useState(null);
  const [newConcern, setNewConcern] = useState("");
  const [concernStatus, setConcernStatus] = useState("Red");
  const getConcernText = (concern) =>
    (concern?.text ?? concern?.description ?? concern?.issue ?? "").toString();

  useEffect(() => {
    if (!initialData) return;
    setServiceChoice(initialData.serviceChoice ?? null);
    setOilStatus(normaliseOilStatus(initialData.oilStatus ?? null));
    setConcerns(initialData.concerns ?? []);
  }, [initialData]);

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
            <button
              type="button"
              onClick={onAdd}
              style={{ ...createVhcButtonStyle("ghost"), gap: "6px" }}
            >
              + Add Concern
            </button>
            <span
              style={{
                padding: "6px 12px",
                borderRadius: "999px",
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
                borderRadius: "999px",
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
                borderRadius: "999px",
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
                borderRadius: "12px",
                border: `1px solid ${palette.border}`,
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
  const shouldScrollConcernEntries = activeConcernEntries.length > 2;

  const canComplete = !!serviceChoice && !!oilStatus;

  const handleClose = () => {
    if (!onClose) return;
    onClose({
      serviceChoice,
      oilStatus,
      concerns,
      status: deriveServiceIndicatorStatus({ serviceChoice, oilStatus }),
    });
  };

  const footer = (
    <>
      <button type="button" onClick={handleClose} style={buildModalButton("ghost")}>
        Close
      </button>
      <button
        type="button"
        onClick={() =>
          onComplete({
            serviceChoice,
            oilStatus,
            concerns,
            status: deriveServiceIndicatorStatus({ serviceChoice, oilStatus }),
          })
        }
        style={buildModalButton("primary", { disabled: !canComplete })}
        disabled={!canComplete}
      >
        Save & Complete
      </button>
    </>
  );

  return (
    <VHCModalShell
      isOpen={isOpen}
      title="Service Indicator & Under Bonnet"
      locked={locked}
      inlineMode={inlineMode}
      onClose={handleClose}
      hideCloseButton
      width="1280px"
      height="780px"
      footer={footer}
    >
      <div style={contentWrapperStyle}>
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateRows: "1fr 1fr 1.8fr",
            gap: "20px",
            minHeight: 0,
          }}
        >
          <div style={cardShellStyle}>
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
                      borderRadius: "16px",
                      padding: "14px 16px",
                      border: `1px solid ${isActive ? toneColor : palette.border}`,
                      background: isActive ? toneColor : palette.surface,
                      color: isActive ? "var(--text-inverse)" : palette.textPrimary,
                      fontWeight: 600,
                      fontSize: "14px",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
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

          <div style={cardShellStyle}>
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
                      padding: "12px 20px",
                      borderRadius: "999px",
                      border: `1px solid ${isActive ? optionBorder : palette.border}`,
                      background: isActive ? optionBorder : palette.surface,
                      color: isActive ? "var(--text-inverse)" : palette.textPrimary,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
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

          <div style={{ ...cardShellStyle, gap: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: palette.accent }}>
              Under Bonnet Items
            </h3>
            <div
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
                      padding: "12px",
                      borderRadius: "14px",
                      border: `1px solid ${palette.border}`,
                      background: palette.surface,
                      color: palette.textPrimary,
                      fontWeight: 600,
                      fontSize: "13px",
                      textAlign: "left",
                      position: "relative",
                      cursor: "pointer",
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

      {showConcernModal && typeof document !== "undefined"
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
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: palette.accent }}>
                {activeConcernLabel}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowConcernModal(false);
                  setActiveConcernTarget(null);
                  setNewConcern("");
                  setConcernStatus("Red");
                }}
                style={{ ...createVhcButtonStyle("ghost"), padding: "6px 14px" }}
              >
                Close
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <label style={{ fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: palette.textMuted }}>
                Issue
              </label>

              {activeConcernTarget === "Miscellaneous" ? (
                <input
                  type="text"
                  value={newConcern}
                  onChange={(event) => setNewConcern(event.target.value)}
                  placeholder="Describe concern..."
                  readOnly={locked}
                  style={{
                    width: "100%",
                    borderRadius: "16px",
                    border: `1px solid ${palette.border}`,
                    padding: "12px",
                    fontSize: "14px",
                    color: palette.textPrimary,
                    outline: "none",
                    background: palette.surface,
                  }}
                />
              ) : (
                <IssueAutocomplete
                  sectionKey={resolveServiceSectionKey(activeConcernTarget)}
                  value={newConcern}
                  onChange={setNewConcern}
                  onSelect={setNewConcern}
                  disabled={locked}
                  placeholder="Describe concern..."
                  inputStyle={{
                    borderRadius: "16px",
                    border: `1px solid ${palette.border}`,
                    padding: "12px",
                    fontSize: "14px",
                    color: palette.textPrimary,
                    outline: "none",
                  }}
                />
              )}

              <label style={{ fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: palette.textMuted }}>
                Status
              </label>
              <DropdownField
                value={concernStatus}
                onChange={(e) => setConcernStatus(e.target.value)}
                className="vhc-concern-dropdown"
                style={{
                  borderRadius: "14px",
                  border: `1px solid ${palette.border}`,
                  padding: "10px 12px",
                  background: palette.surface,
                  fontSize: "14px",
                  color: palette.textPrimary,
                }}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </DropdownField>

              <button
                type="button"
                onClick={addConcern}
                disabled={locked}
                style={{ ...createVhcButtonStyle("primary"), alignSelf: "flex-end" }}
              >
                Save Concern
              </button>
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
                  No concerns logged yet for this item.
                </div>
              ) : (
                activeConcernEntries.map((concern) => (
                  <div
                    key={`${concern.source}-${concern._globalIndex}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      padding: "16px",
                      borderRadius: "18px",
                      border: `1px solid ${palette.border}`,
                      background: palette.surface,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: palette.textMuted }}>{activeConcernLabel}</span>
                      <DropdownField
                        value={concern.status}
                        onChange={(e) => updateConcern(concern._globalIndex, { status: e.target.value })}
                        className="vhc-concern-dropdown"
                        style={{
                          borderRadius: "999px",
                          padding: "6px 12px",
                          border: `1px solid ${palette.border}`,
                          background: palette.surfaceAlt,
                          fontSize: "13px",
                          fontWeight: 600,
                          color: palette.textPrimary,
                        }}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </DropdownField>
                    </div>
                    {activeConcernTarget === "Miscellaneous" ? (
                      <textarea
                        value={getConcernText(concern)}
                        onChange={(e) => updateConcern(concern._globalIndex, { text: e.target.value })}
                        rows={3}
                        style={{
                          borderRadius: "14px",
                          border: `1px solid ${palette.border}`,
                          padding: "10px 12px",
                          fontSize: "14px",
                          color: palette.textPrimary,
                          outline: "none",
                        }}
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
                          borderRadius: "14px",
                          border: `1px solid ${palette.border}`,
                          padding: "10px 12px",
                          fontSize: "14px",
                          color: palette.textPrimary,
                          outline: "none",
                        }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => deleteConcern(concern._globalIndex)}
                      style={{ ...createVhcButtonStyle("ghost"), color: palette.danger, borderColor: palette.border }}
                    >
                      Remove
                    </button>
                  </div>
                ))
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
