// file location: src/components/VHC/WheelsTyresDetailsModal.js
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import VHCModalShell, { buildModalButton } from "@/components/VHC/VHCModalShell";
import themeConfig, {
  createVhcButtonStyle,
  vhcModalContentStyles,
  popupOverlayStyles,
  popupCardStyles,
} from "@/styles/appTheme";
import TyreDiagram, { getReadingStatus } from "@/components/VHC/TyreDiagram";
import TyresSection from "@/components/VHC/TyresSection"; // Import shared tyre search component
import { DropdownField } from "@/components/dropdownAPI";
import IssueAutocomplete from "@/components/vhc/IssueAutocomplete";
import { learnIssueSuggestion } from "@/lib/vhc/issueSuggestions";

const palette = themeConfig.palette;

const WHEELS = ["NSF", "OSF", "NSR", "OSR"];
const WHEEL_SECTION_KEYS = {
  NSF: "wheels_nsf",
  OSF: "wheels_osf",
  NSR: "wheels_nsr",
  OSR: "wheels_osr",
  Spare: "wheels_spare",
};

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

const CONCERN_STATUS_OPTIONS = ["Amber", "Red", "Green"];

const TYRE_SEVERITY_RANK = {
  Red: 1,
  Amber: 2,
  Green: 3,
  danger: 1,
  advisory: 2,
  good: 3,
  unknown: 4,
};

const RANK_TO_TYRE_STATUS = {
  1: "danger",
  2: "advisory",
  3: "good",
  4: "unknown",
};

const resolveTyreRank = (value) => TYRE_SEVERITY_RANK[value] ?? 4;
const mapRankToTyreStatus = (rank) => RANK_TO_TYRE_STATUS[rank] ?? "unknown";

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

const defaultTread = { outer: "", middle: "", inner: "" };
const defaultTreadLocked = { outer: false, middle: false, inner: false };

const createWheelEntry = (source = {}) => {
  const concerns = Array.isArray(source.concerns) ? source.concerns : [];
  const tread = { ...defaultTread, ...(source.tread || {}) };
  const treadLocked = { ...defaultTreadLocked, ...(source.treadLocked || {}) };
  return {
    manufacturer: source.manufacturer || "",
    runFlat: source.runFlat ?? source.run_flat ?? false,
    size: source.size || "",
    load: source.load || "",
    speed: source.speed || "",
    costCompany: source.costCompany ?? source.cost_company ?? null,
    costCustomer: source.costCustomer ?? source.cost_customer ?? null,
    availability: source.availability || "",
    tread,
    treadLocked,
    concerns,
  };
};

const createSpareEntry = (source = {}) => ({
  type: source.type || "spare",
  year: source.year || "",
  month: source.month || "",
  condition: source.condition || "",
  note: source.note || "",
  concerns: Array.isArray(source.concerns) ? source.concerns : [],
  details: createWheelEntry(source.details || {}),
});

const buildNormalizedTyres = (source = {}) => {
  const normalized = {};
  WHEELS.forEach((wheel) => {
    normalized[wheel] = createWheelEntry(source?.[wheel] || {});
  });
  normalized.Spare = createSpareEntry(source?.Spare || {});
  return normalized;
};

const baseInputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "12px",
  border: `1px solid ${palette.border}`,
  backgroundColor: palette.surface,
  fontSize: "14px",
  color: palette.textPrimary,
  outline: "none",
};

const dropdownFieldStyle = {
  width: "100%",
  border: "none",
  padding: 0,
  backgroundColor: "transparent",
};

const pillButton = ({ active = false } = {}) => ({
  padding: "10px 18px",
  borderRadius: "999px",
  border: `1px solid ${active ? palette.accent : palette.border}`,
  background: active ? palette.accent : palette.surface,
  color: active ? "var(--surface)" : palette.textPrimary,
  fontWeight: 600,
  cursor: "pointer",
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
  Amber: { background: "rgba(var(--warning-rgb), 0.16)", text: palette.warning, border: "rgba(var(--warning-rgb), 0.32)" },
  Red: { background: "rgba(var(--danger-rgb), 0.16)", text: palette.danger, border: "rgba(var(--danger-rgb), 0.32)" },
  Green: { background: "rgba(var(--success-rgb), 0.16)", text: palette.success, border: "rgba(var(--success-rgb), 0.32)" },
};

const getAverageTreadDepth = (tread = {}) => {
  const readings = ["outer", "middle", "inner"]
    .map((section) => parseFloat(tread?.[section]))
    .filter((value) => !Number.isNaN(value));
  if (readings.length === 0) return null;
  return readings.reduce((sum, value) => sum + value, 0) / readings.length;
};
const formatTreadDisplay = (tread = {}) => {
  const values = ["outer", "middle", "inner"]
    .map((section) => parseFloat(tread?.[section]))
    .filter((value) => !Number.isNaN(value));
  if (values.length === 0) return null;
  const lowest = Math.min(...values);
  return Number.isInteger(lowest) ? String(lowest) : lowest.toFixed(1);
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
        }}
        onBlur={(e) => {
          e.target.style.borderColor = palette.border;
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

export default function WheelsTyresDetailsModal({ isOpen, onClose, onComplete, initialData = null, locked = false, inlineMode = false }) {
  const normalizedInitialTyres = useMemo(() => buildNormalizedTyres(initialData || {}), [initialData]);
  const [tyres, setTyres] = useState(normalizedInitialTyres);

  useEffect(() => {
    setTyres(normalizedInitialTyres);
  }, [normalizedInitialTyres]);

  const [activeWheel, setActiveWheel] = useState("NSF");
  const [copyActive, setCopyActive] = useState(false);
  const [concernTarget, setConcernTarget] = useState(null);
  const [concernInput, setConcernInput] = useState("");
  const [concernStatus, setConcernStatus] = useState("Amber");
  const [concernEditIndex, setConcernEditIndex] = useState(null);

  const allConcerns = useMemo(() => {
    return Object.keys(tyres).reduce(
      (acc, key) => acc + (tyres[key].concerns?.length ?? 0),
      0,
    );
  }, [tyres]);

  const tyreDiagramReadings = useMemo(() => {
    const diagramState = {};
    WHEELS.forEach((wheel) => {
      const entry = tyres[wheel] ?? {};
      const depth = getAverageTreadDepth(entry.tread);
      const displayText = formatTreadDisplay(entry.tread);
      const measurementStatus = getReadingStatus(depth).status;
      const measurementRank = resolveTyreRank(measurementStatus);
      const concernRank = (entry.concerns ?? []).reduce(
        (minRank, concern) => Math.min(minRank, resolveTyreRank(concern.status)),
        4,
      );
      const severityRank = Math.min(measurementRank, concernRank);
      diagramState[wheel.toLowerCase()] = {
        depth,
        severity: mapRankToTyreStatus(severityRank),
        readingText: displayText,
      };
    });
    return diagramState;
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

  const selectedLookupTyre = useMemo(() => {
    if (activeWheel === "Spare") {
      const details = tyres.Spare.details;
      if (!details.manufacturer && !details.size && !details.load && !details.speed) {
        return null; // Avoid returning lookup data when spare fields are empty
      }
      return {
        make: details.manufacturer,
        size: details.size,
        load: details.load,
        speed: details.speed,
        cost_company: details.costCompany ?? null,
        cost_customer: details.costCustomer ?? null,
        availability: details.availability || "",
      }; // Map spare tyre details into lookup format
    }
    const tyre = tyres[activeWheel];
    if (!tyre) {
      return null; // No lookup data when the tyre is undefined
    }
    if (!tyre.manufacturer && !tyre.size && !tyre.load && !tyre.speed) {
      return null; // Skip lookup preview until the tyre has data
    }
    return {
      make: tyre.manufacturer,
      size: tyre.size,
      load: tyre.load,
      speed: tyre.speed,
      cost_company: tyre.costCompany ?? null,
      cost_customer: tyre.costCustomer ?? null,
      availability: tyre.availability || "",
    }; // Map main tyre details into lookup format
  }, [activeWheel, tyres]);

  const hasValue = (value) => {
    if (value === null || value === undefined) return false;
    return String(value).trim() !== "";
  };

  const isTreadComplete = (tyre) =>
    !!tyre && TREAD_SECTIONS.every((section) => hasValue(tyre.tread?.[section.key]));

  const hasTyreSpec = (tyre) =>
    !!tyre &&
    ["manufacturer", "size", "load", "speed"].every((key) => hasValue(tyre[key]));

  const isWheelReady = (tyre) => hasTyreSpec(tyre) && isTreadComplete(tyre);

  const allWheelsComplete = () => {
    const mainComplete = WHEELS.every((wheel) => isWheelReady(tyres[wheel]));
    const spare = tyres.Spare;

    switch (spare.type) {
      case "spare":
        return mainComplete && isWheelReady(spare.details);
      case "repair_kit":
        return mainComplete && hasValue(spare.month) && hasValue(spare.year);
      case "space_saver":
        return mainComplete && hasValue(spare.condition);
      case "not_checked":
        return mainComplete && hasValue(spare.note);
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

  const handleTyreLookupSelect = (tyre) => {
    if (!tyre) {
      return; // No action when no tyre is provided
    }
    const nextValues = {
      manufacturer: tyre.make,
      size: tyre.size,
      load: tyre.load,
      speed: tyre.speed,
      costCompany: tyre.cost_company ?? tyre.costCompany ?? null,
      costCustomer: tyre.cost_customer ?? tyre.costCustomer ?? null,
      availability: tyre.availability ?? "",
    }; // Normalise placeholder tyre data into modal state
    if (activeWheel === "Spare") {
      setTyres((prev) => ({
        ...prev,
        Spare: {
          ...prev.Spare,
          details: {
            ...prev.Spare.details,
            ...nextValues,
          },
        },
      }));
    } else {
      setTyres((prev) => ({
        ...prev,
        [activeWheel]: {
          ...prev[activeWheel],
          ...nextValues,
        },
      }));
    }
  };

  const updateTread = (section, value) => {
    setTyres((prev) => {
      const updated = { ...prev };
      const wheel =
        activeWheel === "Spare" ? updated.Spare?.details : updated[activeWheel];
      if (!wheel) return prev;

      if (section === "outer") {
        const nextTread = {
          ...wheel.tread,
          outer: value,
          middle: wheel.treadLocked.middle ? wheel.tread.middle : value,
          inner: wheel.treadLocked.inner ? wheel.tread.inner : value,
        };
        if (activeWheel === "Spare") {
          updated.Spare = {
            ...updated.Spare,
            details: {
              ...updated.Spare.details,
              tread: nextTread,
              treadLocked: { ...wheel.treadLocked, outer: true },
            },
          };
        } else {
          updated[activeWheel] = {
            ...wheel,
            tread: nextTread,
            treadLocked: { ...wheel.treadLocked, outer: true },
          };
        }
      } else {
        if (activeWheel === "Spare") {
          updated.Spare = {
            ...updated.Spare,
            details: {
              ...updated.Spare.details,
              tread: { ...wheel.tread, [section]: value },
              treadLocked: { ...wheel.treadLocked, [section]: true },
            },
          };
        } else {
          updated[activeWheel] = {
            ...wheel,
            tread: { ...wheel.tread, [section]: value },
            treadLocked: { ...wheel.treadLocked, [section]: true },
          };
        }
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

  const isCopyReady = () => {
    const source = tyres[activeWheel];
    if (!source) return false;
    return Boolean(source.manufacturer && source.size && source.load && source.speed);
  };

  const copyToAll = () => {
    if (copyActive) return;
    if (!isCopyReady()) return;
    setCopyActive(true);

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
    const nextText = concernInput.trim();
    const sectionKey = WHEEL_SECTION_KEYS[concernTarget] || "wheels_nsf";
    setTyres((prev) => {
      const updated = { ...prev };
      const targetWheel = updated[concernTarget];
      const existing = targetWheel.concerns ?? [];
      const next = { text: nextText, status: concernStatus };
      const nextConcerns =
        concernEditIndex === null
          ? [...existing, next]
          : existing.map((c, idx) => (idx === concernEditIndex ? next : c));
      updated[concernTarget] = {
        ...targetWheel,
        concerns: nextConcerns,
      };
      return updated;
    });
    learnIssueSuggestion(sectionKey, nextText);
    setConcernInput("");
    setConcernStatus("Amber");
    setConcernTarget(null);
    setConcernEditIndex(null);
  };

  const deleteConcern = () => {
    if (concernTarget === null || concernEditIndex === null) {
      setConcernTarget(null);
      setConcernInput("");
      setConcernStatus("Amber");
      setConcernEditIndex(null);
      return;
    }
    setTyres((prev) => {
      const updated = { ...prev };
      const targetWheel = updated[concernTarget];
      const existing = targetWheel.concerns ?? [];
      updated[concernTarget] = {
        ...targetWheel,
        concerns: existing.filter((_, idx) => idx !== concernEditIndex),
      };
      return updated;
    });
    setConcernInput("");
    setConcernStatus("Amber");
    setConcernTarget(null);
    setConcernEditIndex(null);
  };

  const currentTyre = tyres[activeWheel];
  const handleClose = () => {
    if (!onClose) return;
    onClose(tyres);
  };
  const contentWrapperStyle = {
    ...vhcModalContentStyles.contentWrapper,
    gap: "20px",
    height: "100%",
  };

  const footer = (
    <>
      <button type="button" onClick={handleClose} style={buildModalButton("ghost")}>
        Close
      </button>
      <button
        type="button"
        onClick={() => onComplete(tyres)}
        style={buildModalButton("primary", { disabled: !allWheelsComplete() })}
        disabled={!allWheelsComplete()}
      >
        Save & Complete
      </button>
    </>
  );

  if (!isOpen) return null;

  return (
    <VHCModalShell
      isOpen={isOpen}
      onClose={handleClose}
      title="Wheels & Tyres"
      locked={locked}
      inlineMode={inlineMode}
      hideCloseButton
      width="1280px"
      height="780px"
      footer={footer}
    >
      <div style={contentWrapperStyle}>
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
                flex: "0 0 360px",
                display: "flex",
                alignItems: "stretch",
                justifyContent: "center",
              }}
            >
              <TyreDiagram
                tyres={tyreDiagramReadings}
                activeTyre={activeWheel === "Spare" ? null : activeWheel}
                onSelect={(key) => {
                  if (!key) return;
                  setActiveWheel(key.toUpperCase());
                }}
                spareActive={activeWheel === "Spare"}
                onSpareSelect={() => setActiveWheel("Spare")}
              />
            </div>

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
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "nowrap",
                gap: "12px",
                overflowX: "auto",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: palette.accent, whiteSpace: "nowrap", flexShrink: 0 }}>
                {activeWheel === "Spare" ? "Spare / Kit Details" : `${activeWheel} Tyre Details`}
              </h2>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "nowrap", flexShrink: 0 }}>
                {activeWheel !== "Spare" ? (
                  <>
                    <button
                      type="button"
                      onClick={copyToAll}
                      disabled={!isCopyReady()}
                      style={{
                        ...pillButton({ active: copyActive }),
                        opacity: !isCopyReady() || copyActive ? 0.6 : 1,
                        cursor: !isCopyReady() || copyActive ? "not-allowed" : "pointer",
                      }}
                    >
                      Copy To All
                    </button>
                    <button type="button" onClick={toggleRunFlat} style={pillButton({ active: currentTyre.runFlat })}>
                      Run Flat: {currentTyre.runFlat ? "Yes" : "No"}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            {activeWheel === "Spare" && (
              <div
                style={{
                  borderRadius: "999px",
                  border: `1px solid ${palette.border}`,
                  background: palette.surface,
                  padding: "6px",
                  width: "100%",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    width: "100%",
                    overflowX: "auto",
                    overflowY: "hidden",
                    scrollbarWidth: "thin",
                    alignItems: "center",
                    flexWrap: "nowrap",
                  }}
                >
                  {SPARE_TYPES.map((type) => {
                    const isActive = tyres.Spare.type === type.key;
                    return (
                      <button
                        key={type.key}
                        type="button"
                        onClick={() =>
                          setTyres((prev) => ({
                            ...prev,
                            Spare: { ...prev.Spare, type: type.key },
                          }))
                        }
                        style={{
                          flex: "0 0 auto",
                          borderRadius: "999px",
                          border: "1px solid transparent",
                          padding: "10px 16px",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          background: isActive ? "var(--primary)" : "transparent",
                          color: isActive ? "var(--text-inverse)" : palette.textPrimary,
                          transition: "all 0.15s ease",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "18px",
                overflowY: "auto",
                paddingRight: "8px",
                minHeight: 0,
              }}
            >
              {activeWheel !== "Spare" && (
                <TyresSection
                  contextLabel={`${activeWheel} Tyre Lookup`}
                  selectedTyre={selectedLookupTyre}
                  onTyreSelected={handleTyreLookupSelect}
                />
              )}
              {activeWheel !== "Spare" ? (
                <>
                  <div style={sectionCardStyle}>
                    <span style={{ fontSize: "13px", color: palette.textMuted, fontWeight: 600 }}>Tyre Details</span>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "nowrap",
                        gap: "12px",
                        marginTop: "10px",
                        alignItems: "flex-end",
                        overflowX: "auto",
                        paddingBottom: "2px",
                      }}
                    >
                      <div style={{ flex: "0 0 190px", minWidth: "190px" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: palette.textMuted }}>
                          <span style={{ fontWeight: 700, color: palette.textPrimary }}>Make</span>
                          <AutoCompleteInput
                            value={currentTyre.manufacturer}
                            onChange={(value) => updateTyre("manufacturer", value)}
                            options={tyreBrands}
                            placeholder="Select manufacturer"
                          />
                        </label>
                      </div>
                      <div style={{ display: "flex", flexWrap: "nowrap", gap: "12px", alignItems: "flex-end" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: palette.textMuted }}>
                          Size
                          <input
                            value={currentTyre.size}
                            onChange={(event) => updateTyre("size", event.target.value)}
                            placeholder="e.g. 205/55 R16"
                            style={{ ...baseInputStyle, width: "150px", minWidth: "150px" }}
                          />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: palette.textMuted }}>
                          Load Index
                          <input
                            value={currentTyre.load}
                            onChange={(event) => updateTyre("load", event.target.value)}
                            placeholder="e.g. 91"
                            style={{ ...baseInputStyle, width: "110px", minWidth: "110px" }}
                          />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: palette.textMuted }}>
                          Speed Rating
                          <input
                            value={currentTyre.speed}
                            onChange={(event) => updateTyre("speed", event.target.value)}
                            placeholder="e.g. V"
                            style={{ ...baseInputStyle, width: "110px", minWidth: "110px" }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div style={sectionCardStyle}>
                    <span style={{ fontSize: "13px", color: palette.textMuted, fontWeight: 600 }}>Tread Depth (mm)</span>
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
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
                            flex: "1 1 120px",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {tyres.Spare.type === "spare" ? (
                    <>
                      <div style={sectionCardStyle}>
                        <span style={{ fontSize: "13px", color: palette.textMuted, fontWeight: 600 }}>Spare Details</span>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "nowrap",
                            gap: "12px",
                            marginTop: "10px",
                            alignItems: "flex-end",
                            overflowX: "auto",
                            paddingBottom: "2px",
                          }}
                        >
                          <div style={{ flex: "0 0 190px", minWidth: "190px" }}>
                            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: palette.textMuted }}>
                              <span style={{ fontWeight: 700, color: palette.textPrimary }}>Make</span>
                              <AutoCompleteInput
                                value={tyres.Spare.details.manufacturer}
                                onChange={(value) => updateTyre("manufacturer", value)}
                                options={tyreBrands}
                                placeholder="Select manufacturer"
                              />
                            </label>
                          </div>
                          <div style={{ display: "flex", flexWrap: "nowrap", gap: "12px", alignItems: "flex-end" }}>
                            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: palette.textMuted }}>
                              Size
                              <input
                                value={tyres.Spare.details.size}
                                onChange={(event) => updateTyre("size", event.target.value)}
                                placeholder="e.g. 205/55 R16"
                                style={{ ...baseInputStyle, width: "150px", minWidth: "150px" }}
                              />
                            </label>
                            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: palette.textMuted }}>
                              Load Index
                              <input
                                value={tyres.Spare.details.load}
                                onChange={(event) => updateTyre("load", event.target.value)}
                                placeholder="e.g. 91"
                                style={{ ...baseInputStyle, width: "110px", minWidth: "110px" }}
                              />
                            </label>
                            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: palette.textMuted }}>
                              Speed Rating
                              <input
                                value={tyres.Spare.details.speed}
                                onChange={(event) => updateTyre("speed", event.target.value)}
                                placeholder="e.g. V"
                                style={{ ...baseInputStyle, width: "110px", minWidth: "110px" }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      <div style={sectionCardStyle}>
                        <span style={{ fontSize: "13px", color: palette.textMuted, fontWeight: 600 }}>
                          Spare Tread Depth (mm)
                        </span>
                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                          {TREAD_SECTIONS.map((section) => (
                            <input
                              key={`spare-${section.key}`}
                              value={tyres.Spare.details.tread?.[section.key] || ""}
                              onChange={(event) => updateTread(section.key, event.target.value)}
                              placeholder={section.label}
                              style={{
                                ...baseInputStyle,
                                textAlign: "center",
                                fontWeight: 600,
                                flex: "1 1 120px",
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}

                  {tyres.Spare.type === "repair_kit" ? (
                    <div style={sectionCardStyle}>
                      <span style={{ fontSize: "13px", color: palette.textMuted, fontWeight: 600 }}>Repair Kit Date</span>
                      <div style={{ display: "flex", gap: "12px" }}>
                        <DropdownField
                          value={tyres.Spare.month}
                          onChange={(event) =>
                            setTyres((prev) => ({
                              ...prev,
                              Spare: { ...prev.Spare, month: event.target.value },
                            }))
                          }
                          style={dropdownFieldStyle}
                        >
                          <option value="">Month</option>
                          {months.map((month) => (
                            <option key={month} value={month}>
                              {month}
                            </option>
                          ))}
                        </DropdownField>
                        <DropdownField
                          value={tyres.Spare.year}
                          onChange={(event) =>
                            setTyres((prev) => ({
                              ...prev,
                              Spare: { ...prev.Spare, year: event.target.value },
                            }))
                          }
                          style={dropdownFieldStyle}
                        >
                          <option value="">Year</option>
                          {years.map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </DropdownField>
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

              <div style={{ ...sectionCardStyle, flex: "0 0 auto" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: palette.accent }}>
                    Logged Concerns ({activeWheel})
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setConcernTarget(activeWheel);
                        setConcernInput("");
                        setConcernStatus("Amber");
                        setConcernEditIndex(null);
                      }}
                      style={createVhcButtonStyle("ghost")}
                    >
                      + Add Concern
                    </button>
                    <div style={concernBadge(statusColors.Amber)}>{(currentTyre.concerns ?? []).length} total</div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    maxHeight: "180px",
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
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setConcernTarget(activeWheel);
                          setConcernInput(concern.text || "");
                          setConcernStatus(concern.status || "Amber");
                          setConcernEditIndex(idx);
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
      </div>

      {concernTarget && typeof document !== "undefined"
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
            <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: palette.accent }}>
                {concernTarget} Concern
              </h3>
            </div>

            <IssueAutocomplete
              sectionKey={WHEEL_SECTION_KEYS[concernTarget] || "wheels_nsf"}
              value={concernInput}
              onChange={setConcernInput}
              onSelect={setConcernInput}
              disabled={locked}
              placeholder="Describe concern..."
              inputStyle={baseInputStyle}
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

            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "6px", flexWrap: "wrap" }}>
              {concernEditIndex !== null && (
                <button
                  type="button"
                  onClick={deleteConcern}
                  style={{ ...createVhcButtonStyle("ghost"), color: palette.danger }}
                >
                  Delete
                </button>
              )}
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setConcernTarget(null);
                    setConcernInput("");
                    setConcernStatus("Amber");
                    setConcernEditIndex(null);
                  }}
                  style={{ ...createVhcButtonStyle("ghost") }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={addConcern}
                  disabled={locked}
                  style={{ ...createVhcButtonStyle("primary") }}
                >
                  {concernEditIndex !== null ? "Save" : "Add Concern"}
                </button>
              </div>
            </div>
          </div>
        </div>,
          document.body
        )
        : null}
    </VHCModalShell>
  );
}
