// file location: src/components/VHC/ServiceIndicatorDetailsModal.js
import React, { useEffect, useMemo, useState } from "react";
import VHCModalShell, { buildModalButton } from "@/components/VHC/VHCModalShell";
import themeConfig, {
  createVhcButtonStyle,
  vhcModalContentStyles,
  popupOverlayStyles,
  popupCardStyles,
} from "@/styles/appTheme";
import { DropdownField } from "@/components/dropdownAPI";

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

const statusPillStyles = {
  Red: { background: "rgba(var(--danger-rgb), 0.16)", color: palette.danger, border: "rgba(var(--danger-rgb), 0.32)" },
  Amber: { background: "rgba(var(--warning-rgb), 0.16)", color: palette.warning, border: "rgba(var(--warning-rgb), 0.32)" },
  Green: { background: "rgba(var(--info-rgb), 0.16)", color: palette.success, border: "rgba(var(--info-rgb), 0.32)" },
};

const concernTargets = [
  { key: "service", label: "Service Reminder" },
  { key: "oil", label: "Oil Level" },
  ...UNDER_BONNET_ITEMS.map((item) => ({ key: item, label: item })),
];

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
              {concernsList.length} issue{concernsList.length === 1 ? "" : "s"} logged
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
    setShowConcernModal(false);
    setActiveConcernTarget(null);
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
      inlineMode={inlineMode}
      title="Service Indicator & Under Bonnet"
      locked={locked}
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
                const count = concerns.filter((concern) => concern.source === item).length;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setActiveConcernTarget(item);
                      setShowConcernModal(true);
                    }}
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
                    {item}
                    {count > 0 ? (
                      <span
                        style={{
                          position: "absolute",
                          top: "12px",
                          right: "12px",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          background: palette.accentSurface,
                          border: `1px solid ${palette.border}`,
                          fontSize: "11px",
                          fontWeight: 600,
                          color: palette.accent,
                        }}
                      >
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <ConcernPanel
              label="Under Bonnet"
              concernsList={concernsBySource.underBonnet}
              onAdd={() => openConcernFor(UNDER_BONNET_ITEMS[0])}
              showSource
            />
          </div>
        </div>
      </div>

      {showConcernModal ? (
        <div
          style={{
            ...popupOverlayStyles,
            zIndex: 1300,
            padding: "24px",
          }}
        >
          <div
            style={{
              ...popupCardStyles,
              width: "min(460px, 92%)",
              maxHeight: "86%",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: palette.accent }}>
                Add Concern
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
              <span style={{ fontSize: "13px", color: palette.textMuted }}>
                Target: {activeConcernLabel}
              </span>

              <textarea
                value={newConcern}
                onChange={(e) => setNewConcern(e.target.value)}
                placeholder="Describe concern..."
                style={{
                  minHeight: "110px",
                  resize: "vertical",
                  borderRadius: "16px",
                  border: `1px solid ${palette.border}`,
                  padding: "12px",
                  fontSize: "14px",
                  color: palette.textPrimary,
                  outline: "none",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = palette.accent;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = palette.border;
                }}
              />

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {STATUS_OPTIONS.map((status) => {
                  const paletteStyles = statusPillStyles[status];
                  const isActive = concernStatus === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setConcernStatus(status)}
                      style={{
                        padding: "10px 18px",
                        borderRadius: "999px",
                        border: `1px solid ${isActive ? palette.accent : paletteStyles.border}`,
                        background: isActive ? palette.accent : paletteStyles.background,
                        color: isActive ? "var(--text-inverse)" : paletteStyles.color,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {status}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addConcern}
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
                overflowY: "auto",
                paddingRight: "4px",
              }}
            >
              {concerns.length === 0 ? (
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
                  No concerns logged yet. Captured issues will appear here for quick edits.
                </div>
              ) : (
                concerns.map((concern, idx) => (
                  <div
                    key={`${concern.source}-${idx}`}
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
                      <span style={{ fontSize: "13px", fontWeight: 600, color: palette.textMuted }}>{concern.source}</span>
                      <DropdownField
                        value={concern.status}
                        onChange={(e) => updateConcern(idx, { status: e.target.value })}
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
                    <textarea
                      value={getConcernText(concern)}
                      onChange={(e) => updateConcern(idx, { text: e.target.value })}
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
                    <button
                      type="button"
                      onClick={() => deleteConcern(idx)}
                      style={{ ...createVhcButtonStyle("ghost"), color: palette.danger, borderColor: palette.border }}
                    >
                      Remove
                    </button>
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
