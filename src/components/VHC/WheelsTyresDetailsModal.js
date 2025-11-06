// file location: src/components/VHC/WheelsTyresDetailsModal.js
import React, { useMemo, useState } from "react";
import Image from "next/image";
import VHCModalShell, { buildModalButton } from "@/components/VHC/VHCModalShell";
import themeConfig, { createVhcButtonStyle, vhcModalContentStyles } from "@/styles/appTheme";

const palette = themeConfig.palette;

const WHEELS = ["NSF", "OSF", "NSR", "OSR"];

const TREAD_SECTIONS = [
  { key: "outer", label: "Outer" },
  { key: "middle", label: "Middle" },
  { key: "inner", label: "Inner" },
];

const SPARE_TYPES = [
  { key: "spare", label: "Spare Tyre" },
  { key: "repair_kit", label: "Repair Kit" },
  { key: "space_saver", label: "Space Saver" },
  { key: "boot_full", label: "Boot Full" },
  { key: "not_checked", label: "Not Checked" },
];

const CONCERN_STATUS_OPTIONS = ["Amber", "Red"];

const tyreBrands = [
  "Unknown",
  "Michelin",
  "Continental",
  "Goodyear",
  "Pirelli",
  "Bridgestone",
  "Dunlop",
  "Yokohama",
  "Hankook",
  "Kumho",
  "Falken",
  "Toyo",
  "Nexen",
  "Firestone",
];

const months = Array.from({ length: 12 }, (_, i) => `${i + 1}`);
const years = Array.from({ length: 3000 - 2015 + 1 }, (_, i) => `${2015 + i}`);

const baseInputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "12px",
  border: `1px solid ${palette.border}`,
  backgroundColor: palette.surface,
  fontSize: "14px",
  color: palette.textPrimary,
  outline: "none",
  boxShadow: "inset 0 1px 3px rgba(15,23,42,0.06)",
};

const pillButton = ({ active = false } = {}) => ({
  padding: "10px 18px",
  borderRadius: "999px",
  border: `1px solid ${active ? palette.accent : palette.border}`,
  background: active ? palette.accent : palette.surface,
  color: active ? "#ffffff" : palette.textPrimary,
  fontWeight: 600,
  cursor: "pointer",
  transition: "transform 0.2s ease, box-shadow 0.2s ease",
  boxShadow: active ? "0 10px 24px rgba(209,0,0,0.18)" : "0 4px 12px rgba(15,23,42,0.08)",
});

const sectionCardStyle = {
  ...vhcModalContentStyles.baseCard,
  cursor: "default",
  gap: "16px",
};

const concernBadge = (color) => ({
  ...vhcModalContentStyles.badge,
  backgroundColor: color.background,
  color: color.text,
  border: `1px solid ${color.border}`,
});

const statusColors = {
  Amber: { background: "rgba(245,158,11,0.16)", text: palette.warning, border: "rgba(245,158,11,0.32)" },
  Red: { background: "rgba(239,68,68,0.16)", text: palette.danger, border: "rgba(239,68,68,0.32)" },
};

function AutoCompleteInput({ value, onChange, options, placeholder }) {
  const [filtered, setFiltered] = useState([]);

  const handleChange = (event) => {
    const next = event.target.value;
    onChange(next);
    setFiltered(
      options.filter((option) => option.toLowerCase().includes(next.toLowerCase())),
    );
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        style={baseInputStyle}
        onFocus={(e) => {
          e.target.style.borderColor = palette.accent;
          e.target.style.boxShadow = "0 0 0 3px rgba(209,0,0,0.12)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = palette.border;
          e.target.style.boxShadow = "inset 0 1px 3px rgba(15,23,42,0.06)";
        }}
      />
      {filtered.length > 0 ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            borderRadius: "14px",
            border: `1px solid ${palette.border}`,
            background: palette.surface,
            boxShadow: "0 14px 32px rgba(15,23,42,0.18)",
            maxHeight: "160px",
            overflowY: "auto",
            zIndex: 14,
          }}
        >
          {filtered.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={() => {
                onChange(option);
                setFiltered([]);
              }}
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                textAlign: "left",
                padding: "10px 16px",
                fontSize: "13px",
                color: palette.textPrimary,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = palette.accentSurface;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function WheelsTyresDetailsModal({ isOpen, onClose, onComplete }) {
  const initialTyre = {
    manufacturer: "",
    runFlat: false,
    size: "",
    load: "",
    speed: "",
    tread: { outer: "", middle: "", inner: "" },
    treadLocked: { outer: false, middle: false, inner: false },
    concerns: [],
  };

  const [tyres, setTyres] = useState({
    NSF: { ...initialTyre },
    OSF: { ...initialTyre },
    NSR: { ...initialTyre },
    OSR: { ...initialTyre },
    Spare: {
      type: "spare",
      year: "",
      month: "",
      condition: "",
      details: { ...initialTyre },
      concerns: [],
      note: "",
    },
  });

  const [activeWheel, setActiveWheel] = useState("NSF");
  const [copyActive, setCopyActive] = useState(false);
  const [concernTarget, setConcernTarget] = useState(null);
  const [concernInput, setConcernInput] = useState("");
  const [concernStatus, setConcernStatus] = useState("Amber");

  const allConcerns = useMemo(() => {
    return Object.keys(tyres).reduce(
      (acc, key) => acc + (tyres[key].concerns?.length ?? 0),
      0,
    );
  }, [tyres]);

  const concernStatusTotals = useMemo(() => {
    const totals = Object.keys(statusColors).reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
    Object.keys(tyres).forEach((wheel) => {
      (tyres[wheel].concerns ?? []).forEach(({ status }) => {
        if (status in totals) {
          totals[status] += 1;
        }
      });
    });
    return totals;
  }, [tyres]);

  const allWheelsComplete = () => {
    const checkTyre = (tyre) => tyre.manufacturer && tyre.size && tyre.load && tyre.speed;
    const mainComplete = WHEELS.every((wheel) => checkTyre(tyres[wheel]));
    const spare = tyres.Spare;

    switch (spare.type) {
      case "spare":
        return mainComplete && checkTyre(spare.details);
      case "repair_kit":
        return mainComplete && spare.month && spare.year;
      case "space_saver":
        return mainComplete && spare.condition !== "";
      case "not_checked":
        return mainComplete && spare.note.trim() !== "";
      case "boot_full":
        return mainComplete;
      default:
        return mainComplete;
    }
  };

  const updateTyre = (field, value) => {
    if (activeWheel === "Spare") {
      setTyres((prev) => ({
        ...prev,
        Spare: {
          ...prev.Spare,
          details: {
            ...prev.Spare.details,
            [field]: value,
          },
        },
      }));
    } else {
      setTyres((prev) => ({
        ...prev,
        [activeWheel]: {
          ...prev[activeWheel],
          [field]: value,
        },
      }));
    }
  };

  const updateTread = (section, value) => {
    setTyres((prev) => {
      const updated = { ...prev };
      const wheel = updated[activeWheel];
      if (!wheel) return prev;

      if (section === "outer") {
        const nextTread = {
          ...wheel.tread,
          outer: value,
          middle: wheel.treadLocked.middle ? wheel.tread.middle : value,
          inner: wheel.treadLocked.inner ? wheel.tread.inner : value,
        };
        updated[activeWheel] = {
          ...wheel,
          tread: nextTread,
          treadLocked: { ...wheel.treadLocked, outer: true },
        };
      } else {
        updated[activeWheel] = {
          ...wheel,
          tread: { ...wheel.tread, [section]: value },
          treadLocked: { ...wheel.treadLocked, [section]: true },
        };
      }
      return updated;
    });
  };

  const toggleRunFlat = () => {
    if (activeWheel === "Spare") {
      setTyres((prev) => ({
        ...prev,
        Spare: {
          ...prev.Spare,
          details: { ...prev.Spare.details, runFlat: !prev.Spare.details.runFlat },
        },
      }));
    } else {
      setTyres((prev) => ({
        ...prev,
        [activeWheel]: {
          ...prev[activeWheel],
          runFlat: !prev[activeWheel].runFlat,
        },
      }));
    }
  };

  const copyToAll = () => {
    setCopyActive((prev) => !prev);
    if (copyActive) return;

    const source = tyres[activeWheel];
    setTyres((prev) => {
      const updated = { ...prev };
      WHEELS.forEach((wheel) => {
        updated[wheel] = {
          ...updated[wheel],
          manufacturer: source.manufacturer,
          runFlat: source.runFlat,
          size: source.size,
          load: source.load,
          speed: source.speed,
        };
      });

      if (updated.Spare.type === "spare") {
        updated.Spare = {
          ...updated.Spare,
          details: {
            ...updated.Spare.details,
            manufacturer: source.manufacturer,
            runFlat: source.runFlat,
            size: source.size,
            load: source.load,
            speed: source.speed,
          },
        };
      }
      return updated;
    });
  };

  const addConcern = () => {
    if (!concernTarget || !concernInput.trim()) return;
    setTyres((prev) => {
      const updated = { ...prev };
      const targetWheel = updated[concernTarget];
      const existing = targetWheel.concerns ?? [];
      updated[concernTarget] = {
        ...targetWheel,
        concerns: [...existing, { text: concernInput.trim(), status: concernStatus }],
      };
      return updated;
    });
    setConcernInput("");
    setConcernStatus("Amber");
    setConcernTarget(null);
  };

  const currentTyre = tyres[activeWheel];
  const contentWrapperStyle = {
    ...vhcModalContentStyles.contentWrapper,
    gap: "20px",
  };
  const summaryCardStyle = vhcModalContentStyles.summaryCard;
  const summaryTextBlockStyle = vhcModalContentStyles.summaryTextBlock;
  const summaryBadgesStyle = vhcModalContentStyles.summaryBadges;
  const summaryBadgeBase = vhcModalContentStyles.badge;

  const footer = (
    <>
      <button type="button" onClick={onClose} style={buildModalButton("ghost")}>
        Close
      </button>
      <button
        type="button"
        onClick={() => onComplete(tyres)}
        style={buildModalButton("primary", { disabled: !allWheelsComplete() })}
        disabled={!allWheelsComplete()}
      >
        Save Tyre Details
      </button>
    </>
  );

  if (!isOpen) return null;

  return (
    <VHCModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Wheels & Tyres"
      subtitle="Detailed tyre measurements and concerns styled to mirror the dashboard."
      footer={footer}
    >
      <div style={contentWrapperStyle}>
        <div style={summaryCardStyle}>
          <div style={summaryTextBlockStyle}>
            <span style={vhcModalContentStyles.summaryTitle}>Concern Summary</span>
            <span style={vhcModalContentStyles.summaryMetric}>{allConcerns} tyre issues logged</span>
          </div>
          <div style={summaryBadgesStyle}>
            {["Red", "Amber"].map((status) => {
              const value = concernStatusTotals[status];
              if (!value) return null;
              const color = statusColors[status];
              return (
                <div
                  key={status}
                  style={{
                    ...summaryBadgeBase,
                    backgroundColor: color.background,
                    color: color.text,
                    border: `1px solid ${color.border}`,
                  }}
                >
                  {value} {status}
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "20px",
            height: "100%",
            minHeight: 0,
            position: "relative",
          }}
        >
          <div
            style={{
              flex: "0 0 320px",
              borderRadius: "22px",
              border: `1px solid ${palette.border}`,
              background: "linear-gradient(160deg, #ffffff, #fff7f7)",
              boxShadow: "0 16px 32px rgba(209,0,0,0.12)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
              overflowY: "auto",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: palette.accent }}>Wheel Selection</h3>
              <p style={{ margin: "6px 0 0", fontSize: "13px", color: palette.textMuted }}>
                Choose a wheel to update tyre details or log concerns.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(120px, 1fr))",
                gap: "20px",
              }}
            >
              {WHEELS.map((wheel) => {
                const isActive = activeWheel === wheel;
                const concernCount = tyres[wheel].concerns?.length ?? 0;
                return (
                  <button
                    key={wheel}
                    type="button"
                    onClick={() => setActiveWheel(wheel)}
                    style={{
                      borderRadius: "18px",
                      border: `1px solid ${isActive ? palette.accent : palette.border}`,
                      padding: "16px",
                      background: isActive ? palette.accentSoft : palette.surface,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "10px",
                      cursor: "pointer",
                      position: "relative",
                      boxShadow: isActive ? "0 12px 28px rgba(209,0,0,0.18)" : "0 6px 18px rgba(15,23,42,0.08)",
                      transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-3px)";
                      e.currentTarget.style.boxShadow = "0 16px 32px rgba(209,0,0,0.18)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = isActive
                        ? "0 12px 28px rgba(209,0,0,0.18)"
                        : "0 6px 18px rgba(15,23,42,0.08)";
                    }}
                  >
                    <span style={{ fontWeight: 700, color: palette.accent, fontSize: "14px" }}>{wheel}</span>
                    <Image src="/images/Tyres2.png" alt={wheel} width={80} height={80} />
                    {concernCount > 0 ? (
                      <span
                        style={{
                          position: "absolute",
                          top: "12px",
                          right: "12px",
                          ...concernBadge(statusColors.Amber),
                          padding: "4px 10px",
                        }}
                      >
                        {concernCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                borderRadius: "18px",
                border: `1px solid ${activeWheel === "Spare" ? palette.accent : palette.border}`,
                padding: "18px",
                background: activeWheel === "Spare" ? palette.accentSoft : palette.surface,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                boxShadow: activeWheel === "Spare" ? "0 12px 28px rgba(209,0,0,0.18)" : "0 6px 18px rgba(15,23,42,0.08)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
              onClick={() => setActiveWheel("Spare")}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow = "0 16px 32px rgba(209,0,0,0.18)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  activeWheel === "Spare" ? "0 12px 28px rgba(209,0,0,0.18)" : "0 6px 18px rgba(15,23,42,0.08)";
              }}
            >
              <span style={{ fontWeight: 700, color: palette.accent, fontSize: "14px" }}>Spare / Kit</span>
              <Image src="/images/Spare.png" alt="Spare Tyre" width={86} height={86} />
              {tyres.Spare.concerns?.length ? (
                <span style={{ ...concernBadge(statusColors.Amber), padding: "4px 10px" }}>
                  {tyres.Spare.concerns.length}
                </span>
              ) : null}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: palette.accent }}>
              {activeWheel === "Spare" ? "Spare / Kit Details" : `${activeWheel} Tyre Details`}
            </h2>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button type="button" onClick={() => setConcernTarget(activeWheel)} style={createVhcButtonStyle("ghost")}>
                + Add Concern
              </button>
              {activeWheel !== "Spare" ? (
                <>
                  <button type="button" onClick={copyToAll} style={pillButton({ active: copyActive })}>
                    Copy To All
                  </button>
                  <button type="button" onClick={toggleRunFlat} style={pillButton({ active: currentTyre.runFlat })}>
                    Run Flat: {currentTyre.runFlat ? "Yes" : "No"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={toggleRunFlat}
                  style={pillButton({ active: currentTyre.details.runFlat })}
                >
                  Run Flat: {currentTyre.details.runFlat ? "Yes" : "No"}
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: activeWheel === "Spare" ? "1fr" : "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "18px",
              alignItems: "flex-start",
              overflowY: "auto",
              paddingRight: "6px",
            }}
          >
            {activeWheel !== "Spare" ? (
              <>
                <div style={sectionCardStyle}>
                  <span style={{ fontSize: "13px", color: palette.textMuted, fontWeight: 600 }}>Manufacturer</span>
                  <AutoCompleteInput
                    value={currentTyre.manufacturer}
                    onChange={(value) => updateTyre("manufacturer", value)}
                    options={tyreBrands}
                    placeholder="Select manufacturer"
                  />
                  <span style={{ fontSize: "12px", color: palette.textMuted }}>
                    Autocomplete keeps data entry quick and on-brand.
                  </span>
                </div>

                <div style={sectionCardStyle}>
                  <span style={{ fontSize: "13px", color: palette.textMuted, fontWeight: 600 }}>Tyre Size</span>
                  <input
                    value={currentTyre.size}
                    onChange={(event) => updateTyre("size", event.target.value)}
                    placeholder="e.g. 205/55 R16"
                    style={baseInputStyle}
                  />
                  <span style={{ fontSize: "13px", color: palette.textMuted, fontWeight: 600 }}>Load Index</span>
                  <input
                    value={currentTyre.load}
                    onChange={(event) => updateTyre("load", event.target.value)}
                    placeholder="e.g. 91"
                    style={baseInputStyle}
                  />
                  <span style={{ fontSize: "13px", color: palette.textMuted, fontWeight: 600 }}>Speed Rating</span>
                  <input
                    value={currentTyre.speed}
                    onChange={(event) => updateTyre("speed", event.target.value)}
                    placeholder="e.g. V"
                    style={baseInputStyle}
                  />
                </div>

                <div style={sectionCardStyle}>
                  <span style={{ fontSize: "13px", color: palette.textMuted, fontWeight: 600 }}>Tread Depth (mm)</span>
                  <div style={{ display: "flex", gap: "12px" }}>
                    {TREAD_SECTIONS.map((section) => (
                      <input
                        key={section.key}
                        value={currentTyre.tread[section.key]}
                        onChange={(event) => updateTread(section.key, event.target.value)}
                        placeholder={section.label}
                        style={{
                          ...baseInputStyle,
                          textAlign: "center",
                          fontWeight: 600,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={sectionCardStyle}>
                  <span style={{ fontSize: "13px", color: palette.textMuted, fontWeight: 600 }}>Spare Type</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                    {SPARE_TYPES.map((type) => (
                      <button
                        key={type.key}
                        type="button"
                        onClick={() =>
                          setTyres((prev) => ({
                            ...prev,
                            Spare: { ...prev.Spare, type: type.key },
                          }))
                        }
                        style={pillButton({ active: tyres.Spare.type === type.key })}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {tyres.Spare.type === "spare" ? (
                  <div style={sectionCardStyle}>
                    <span style={{ fontSize: "13px", color: palette.textMuted, fontWeight: 600 }}>Spare Details</span>
                    <AutoCompleteInput
                      value={tyres.Spare.details.manufacturer}
                      onChange={(value) => updateTyre("manufacturer", value)}
                      options={tyreBrands}
                      placeholder="Manufacturer"
                    />
                    <input
                      value={tyres.Spare.details.size}
                      onChange={(event) => updateTyre("size", event.target.value)}
                      placeholder="Size"
                      style={baseInputStyle}
                    />
                    <input
                      value={tyres.Spare.details.load}
                      onChange={(event) => updateTyre("load", event.target.value)}
                      placeholder="Load"
                      style={baseInputStyle}
                    />
                    <input
                      value={tyres.Spare.details.speed}
                      onChange={(event) => updateTyre("speed", event.target.value)}
                      placeholder="Speed"
                      style={baseInputStyle}
                    />
                  </div>
                ) : null}

                {tyres.Spare.type === "repair_kit" ? (
                  <div style={sectionCardStyle}>
                    <span style={{ fontSize: "13px", color: palette.textMuted, fontWeight: 600 }}>Repair Kit Date</span>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <select
                        value={tyres.Spare.month}
                        onChange={(event) =>
                          setTyres((prev) => ({
                            ...prev,
                            Spare: { ...prev.Spare, month: event.target.value },
                          }))
                        }
                        style={baseInputStyle}
                      >
                        <option value="">Month</option>
                        {months.map((month) => (
                          <option key={month} value={month}>
                            {month}
                          </option>
                        ))}
                      </select>
                      <select
                        value={tyres.Spare.year}
                        onChange={(event) =>
                          setTyres((prev) => ({
                            ...prev,
                            Spare: { ...prev.Spare, year: event.target.value },
                          }))
                        }
                        style={baseInputStyle}
                      >
                        <option value="">Year</option>
                        {years.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}

                {tyres.Spare.type === "space_saver" ? (
                  <div style={sectionCardStyle}>
                    <span style={{ fontSize: "13px", color: palette.textMuted, fontWeight: 600 }}>
                      Space Saver Condition
                    </span>
                    <div style={{ display: "flex", gap: "12px" }}>
                      {["Good", "Bad"].map((condition) => (
                        <button
                          key={condition}
                          type="button"
                          onClick={() =>
                            setTyres((prev) => ({
                              ...prev,
                              Spare: { ...prev.Spare, condition },
                            }))
                          }
                          style={pillButton({ active: tyres.Spare.condition === condition })}
                        >
                          {condition}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {tyres.Spare.type === "not_checked" ? (
                  <div style={sectionCardStyle}>
                    <span style={{ fontSize: "13px", color: palette.textMuted, fontWeight: 600 }}>Notes</span>
                    <textarea
                      value={tyres.Spare.note}
                      onChange={(event) =>
                        setTyres((prev) => ({
                          ...prev,
                          Spare: { ...prev.Spare, note: event.target.value },
                        }))
                      }
                      placeholder="Explain why a spare check was not completed."
                      rows={4}
                      style={{
                        ...baseInputStyle,
                        resize: "vertical",
                      }}
                    />
                  </div>
                ) : null}

                {tyres.Spare.type === "boot_full" ? (
                  <div style={sectionCardStyle}>
                    <span style={{ fontSize: "13px", color: palette.textMuted }}>
                      Boot contents prevented inspection. No extra data required.
                    </span>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div style={{ ...sectionCardStyle, flex: "0 0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: palette.accent }}>
                Logged Concerns
              </h3>
              <div style={{ display: "flex", gap: "12px" }}>
                <div style={concernBadge(statusColors.Amber)}>{allConcerns} total</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {[...WHEELS, "Spare"].map((wheel) => {
                const count = tyres[wheel].concerns?.length ?? 0;
                if (count === 0) return null;
                return (
                  <div key={wheel} style={{ ...concernBadge(statusColors.Amber), backgroundColor: palette.surfaceAlt }}>
                    {wheel}: {count}
                  </div>
                );
              })}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                maxHeight: "160px",
                overflowY: "auto",
              }}
            >
              {(currentTyre.concerns ?? []).length === 0 ? (
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
                  No concerns logged for {activeWheel}. Use “Add Concern” to capture issues for this wheel.
                </div>
              ) : (
                currentTyre.concerns.map((concern, idx) => (
                  <div
                    key={`${activeWheel}-concern-${idx}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderRadius: "16px",
                      border: `1px solid ${palette.border}`,
                      padding: "12px 16px",
                      background: palette.surface,
                      boxShadow: "0 6px 18px rgba(15,23,42,0.08)",
                    }}
                  >
                    <span style={{ fontSize: "13px", fontWeight: 600, color: palette.textPrimary }}>{concern.text}</span>
                    <span style={concernBadge(statusColors[concern.status] || statusColors.Amber)}>
                      {concern.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      </div>

      {concernTarget ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            backdropFilter: "blur(6px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 20,
          }}
        >
          <div
            style={{
              width: "420px",
              maxWidth: "92%",
              borderRadius: "20px",
              border: `1px solid ${palette.border}`,
              background: palette.surface,
              boxShadow: "0 18px 36px rgba(15,23,42,0.20)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: palette.accent }}>
                {concernTarget} Concern
              </h3>
              <button
                type="button"
                onClick={() => {
                  setConcernTarget(null);
                  setConcernInput("");
                  setConcernStatus("Amber");
                }}
                style={{ ...createVhcButtonStyle("ghost"), padding: "6px 14px" }}
              >
                Close
              </button>
            </div>

            <input
              value={concernInput}
              onChange={(event) => setConcernInput(event.target.value)}
              placeholder="Describe concern..."
              style={baseInputStyle}
              onFocus={(e) => {
                e.target.style.borderColor = palette.accent;
                e.target.style.boxShadow = "0 0 0 3px rgba(209,0,0,0.12)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = palette.border;
                e.target.style.boxShadow = "inset 0 1px 3px rgba(15,23,42,0.06)";
              }}
            />

            <div style={{ display: "flex", gap: "10px" }}>
              {CONCERN_STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setConcernStatus(status)}
                  style={pillButton({ active: concernStatus === status })}
                >
                  {status}
                </button>
              ))}
            </div>

            <button type="button" onClick={addConcern} style={{ ...createVhcButtonStyle("primary"), alignSelf: "flex-end" }}>
              Add Concern
            </button>
          </div>
        </div>
      ) : null}
    </VHCModalShell>
  );
}
