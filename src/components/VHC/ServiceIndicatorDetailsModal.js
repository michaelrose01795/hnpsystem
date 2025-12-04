// file location: src/components/VHC/ServiceIndicatorDetailsModal.js
import React, { useEffect, useMemo, useState } from "react";
import VHCModalShell, { buildModalButton } from "@/components/VHC/VHCModalShell";
import themeConfig, { createVhcButtonStyle, vhcModalContentStyles } from "@/styles/appTheme";

const palette = themeConfig.palette;

const SERVICE_OPTIONS = [
  { key: "reset", label: "Service Reminder Reset" },
  { key: "not_required", label: "Service Reminder Not Required" },
  { key: "no_reminder", label: "Doesn’t Have a Service Reminder" },
  { key: "indicator_on", label: "Service Indicator On" },
];

const OIL_OPTIONS = ["Yes", "No", "EV"];

const UNDER_BONNET_ITEMS = [
  "Antifreeze Strength",
  "Water/Oil",
  "Fluid Leaks",
  "Alternator Belt/Battery",
  "Power Steering Fluid",
  "Fuel System",
  "Cam Belt",
  "Miscellaneous",
];

const STATUS_OPTIONS = ["Red", "Amber", "Green"];

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

export default function ServiceIndicatorDetailsModal({ isOpen, initialData, onClose, onComplete }) {
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
  const [oilStatus, setOilStatus] = useState(initialData?.oilStatus ?? null);
  const [concerns, setConcerns] = useState(() => initialData?.concerns ?? []);
  const [showConcernModal, setShowConcernModal] = useState(false);
  const [activeConcernTarget, setActiveConcernTarget] = useState(null);
  const [newConcern, setNewConcern] = useState("");
  const [concernStatus, setConcernStatus] = useState("Red");

  useEffect(() => {
    if (!initialData) return;
    setServiceChoice(initialData.serviceChoice ?? null);
    setOilStatus(initialData.oilStatus ?? null);
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
                  {concernItem.text}
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
                  color: concernItem.status === "Red" ? palette.danger : palette.warning,
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
      { text: newConcern.trim(), status: concernStatus, source: activeConcernTarget },
    ]);
    setNewConcern("");
    setConcernStatus("Red");
    setShowConcernModal(false);
    setActiveConcernTarget(null);
  };

  const updateConcern = (idx, updates) => {
    setConcerns((prev) => prev.map((concern, concernIdx) => (concernIdx === idx ? { ...concern, ...updates } : concern)));
  };

  const deleteConcern = (idx) => {
    setConcerns((prev) => prev.filter((_, concernIdx) => concernIdx !== idx));
  };

  const activeConcernLabel =
    concernTargets.find((target) => target.key === activeConcernTarget)?.label || activeConcernTarget || "selected area";

  const canComplete =
    !!serviceChoice &&
    (oilStatus === "Yes" || oilStatus === "EV" || (oilStatus === "No" && concerns.some((c) => c.source === "oil")));

  const handleClose = () => {
    if (!onClose) return;
    onClose({ serviceChoice, oilStatus, concerns });
  };

  const footer = (
    <>
      <button type="button" onClick={handleClose} style={buildModalButton("ghost")}>
        Close
      </button>
      <button
        type="button"
        onClick={() => onComplete({ serviceChoice, oilStatus, concerns })}
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
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setServiceChoice(option.key)}
                    style={{
                      borderRadius: "16px",
                      padding: "14px 16px",
                      border: `1px solid ${isActive ? palette.accent : palette.border}`,
                      background: isActive ? palette.accent : palette.surface,
                      color: isActive ? "var(--surface)" : palette.textPrimary,
                      fontWeight: 600,
                      fontSize: "14px",
                      textAlign: "left",
                      boxShadow: isActive ? "0 10px 24px rgba(var(--primary-rgb),0.20)" : "0 4px 12px rgba(var(--shadow-rgb),0.08)",
                      cursor: "pointer",
                      transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (isActive) return;
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 10px 24px rgba(var(--primary-rgb),0.15)";
                    }}
                    onMouseLeave={(e) => {
                      if (isActive) return;
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(var(--shadow-rgb),0.08)";
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
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setOilStatus(option)}
                    style={{
                      padding: "12px 20px",
                      borderRadius: "999px",
                      border: `1px solid ${isActive ? palette.accent : palette.border}`,
                      background: isActive ? palette.accent : palette.surface,
                      color: isActive ? "var(--surface)" : palette.textPrimary,
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: isActive ? "0 8px 20px rgba(var(--primary-rgb),0.18)" : "0 4px 12px rgba(var(--shadow-rgb),0.08)",
                      transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (isActive) return;
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 8px 20px rgba(var(--primary-rgb),0.16)";
                    }}
                    onMouseLeave={(e) => {
                      if (isActive) return;
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(var(--shadow-rgb),0.08)";
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
                      boxShadow: "0 4px 12px rgba(var(--shadow-rgb),0.08)",
                      cursor: "pointer",
                      transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-3px)";
                      e.currentTarget.style.boxShadow = "0 12px 24px rgba(var(--primary-rgb),0.14)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(var(--shadow-rgb),0.08)";
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
            position: "absolute",
            inset: 0,
            background: "rgba(var(--shadow-rgb),0.55)",
            backdropFilter: "blur(6px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: "460px",
              maxWidth: "92%",
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
                  boxShadow: "inset 0 1px 3px rgba(var(--shadow-rgb),0.05)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = palette.accent;
                  e.target.style.boxShadow = "0 0 0 3px rgba(var(--primary-rgb),0.12)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = palette.border;
                  e.target.style.boxShadow = "inset 0 1px 3px rgba(var(--shadow-rgb),0.05)";
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
                        color: isActive ? "var(--surface)" : paletteStyles.color,
                        fontWeight: 600,
                        cursor: "pointer",
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
                      boxShadow: "0 4px 14px rgba(var(--shadow-rgb),0.08)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: palette.textMuted }}>{concern.source}</span>
                      <select
                        value={concern.status}
                        onChange={(e) => updateConcern(idx, { status: e.target.value })}
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
                      </select>
                    </div>
                    <textarea
                      value={concern.text}
                      onChange={(e) => updateConcern(idx, { text: e.target.value })}
                      rows={3}
                      style={{
                        borderRadius: "14px",
                        border: `1px solid ${palette.border}`,
                        padding: "10px 12px",
                        fontSize: "14px",
                        color: palette.textPrimary,
                        outline: "none",
                        boxShadow: "inset 0 1px 3px rgba(var(--shadow-rgb),0.05)",
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
