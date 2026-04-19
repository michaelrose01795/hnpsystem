// file location: src/components/VHC/WheelsTyresDetailsModal.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import VHCModalShell from "@/components/VHC/VHCModalShell";
import SectionCameraButton from "@/components/VHC/mediaCapture/SectionCameraButton";
import Button from "@/components/ui/Button";
import themeConfig, {
  vhcModalContentStyles,
  popupOverlayStyles,
  popupCardStyles,
} from "@/styles/appTheme";
import TyreDiagram, { getReadingStatus } from "@/components/VHC/TyreDiagram";
import { DropdownField } from "@/components/ui/dropdownAPI";
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

const tyreSizes = [
  "175/65 R14",
  "185/65 R15",
  "195/65 R15",
  "205/55 R16",
  "205/60 R16",
  "215/55 R17",
  "215/60 R17",
  "225/45 R17",
  "225/40 R18",
  "225/50 R17",
  "235/45 R18",
  "235/40 R19",
  "245/40 R18",
  "255/35 R19",
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

const buildSparePayload = (spare = {}) => {
  const type = spare.type || "spare";
  const concerns = Array.isArray(spare.concerns) ? spare.concerns : [];

  switch (type) {
    case "spare":
      return {
        type,
        concerns,
        details: createWheelEntry(spare.details || {}),
      };
    case "repair_kit":
      return {
        type,
        concerns,
        month: spare.month || "",
        year: spare.year || "",
      };
    case "space_saver":
      return {
        type,
        concerns,
        condition: spare.condition || "",
      };
    case "not_checked":
      return {
        type,
        concerns,
        note: spare.note || "",
      };
    case "boot_full":
    default:
      return {
        type: "boot_full",
        concerns,
      };
  }
};

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
  minHeight: "var(--control-height)",
  padding: "var(--control-padding)",
  borderRadius: "var(--control-radius)",
  border: "none",
  backgroundColor: "var(--control-bg)",
  fontSize: "var(--control-font-size)",
  fontWeight: "var(--control-font-weight)",
  color: "var(--text-primary)",
  outline: "none",
  transition: "background-color 0.18s ease, box-shadow 0.18s ease",
};

const dropdownFieldStyle = {
  width: "100%",
  border: "none",
  padding: 0,
  backgroundColor: "transparent",
};

const pillButton = ({ active = false } = {}) => ({
  minHeight: "var(--control-height-sm)",
  padding: "var(--control-padding-sm)",
  borderRadius: "var(--control-radius)",
  border: "none",
  background: active ? "var(--primary)" : "var(--control-bg)",
  color: active ? "var(--text-inverse)" : "var(--text-primary)",
  fontSize: "var(--control-font-size)",
  fontWeight: 600,
  cursor: "pointer",
  transition: "background-color 0.18s ease, color 0.18s ease",
});

const sectionCardStyle = {
  ...vhcModalContentStyles.baseCard,
  cursor: "default",
  gap: "16px",
  border: "none",
  backgroundColor: "var(--control-bg)",
  borderRadius: "var(--section-card-radius)",
};

const concernBadge = (color) => ({
  ...vhcModalContentStyles.badge,
  backgroundColor: color.background,
  color: color.text,
  border: "none",
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


function AutoCompleteInput({ value, onChange, options, placeholder, onSelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options || [];
    return (options || []).filter((o) => String(o).toLowerCase().includes(q));
  }, [query, options]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target) && !e.target.closest("[data-tyre-menu]")) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const openMenu = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
    }
    setQuery("");
    setOpen(true);
  }, []);

  const handleSelect = useCallback((opt) => {
    onChange(opt);
    setQuery("");
    setOpen(false);
    if (onSelect) onSelect(opt);
  }, [onChange, onSelect]);

  const menu = open && filtered.length > 0 && createPortal(
    <div
      data-tyre-menu=""
      style={{
        position: "fixed",
        top: pos ? `${pos.top}px` : 0,
        left: pos ? `${pos.left}px` : 0,
        width: pos ? `${pos.width}px` : 200,
        maxHeight: "240px",
        overflowY: "auto",
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        zIndex: 99999,
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
      }}
    >
      {filtered.map((opt) => (
        <div
          key={opt}
          onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
          style={{
            padding: "10px 12px",
            fontSize: "14px",
            cursor: "pointer",
            color: "var(--text-primary)",
            backgroundColor: opt === value ? "var(--surface-light)" : "transparent",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--surface-light)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = opt === value ? "var(--surface-light)" : "transparent"; }}
        >
          {opt}
        </div>
      ))}
    </div>,
    document.body
  );

  return (
    <div style={{ width: "100%" }}>
      <input
        ref={inputRef}
        value={open ? query : (value || "")}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) openMenu();
        }}
        onFocus={openMenu}
        placeholder={placeholder}
        style={{ ...baseInputStyle, width: "100%" }}
      />
      {menu}
    </div>
  );
}

function TyreSpecInputRow({ children }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        marginTop: "10px",
        alignItems: "flex-end",
        paddingBottom: "2px",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Format a raw numeric tyre size string into standard format.
 * e.g. "2255518" → "225/55R18", "1956515" → "195/65R15"
 */
function formatTyreSize(raw) {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 7) return raw || "";
  const width = digits.slice(0, 3);
  const profile = digits.slice(3, 5);
  const rim = digits.slice(5);
  return `${width}/${profile}R${rim}`;
}

function TyreSpecFields({ tyre, onFieldChange }) {
  const sizeRef = useRef(null);
  const loadRef = useRef(null);
  const speedRef = useRef(null);

  // Raw size input state (digits only while typing)
  const [rawSize, setRawSize] = useState("");
  const sizeInitialised = useRef(false);

  // Keep rawSize empty until user starts typing — show formatted value as placeholder context
  useEffect(() => {
    if (!sizeInitialised.current && tyre.size) {
      sizeInitialised.current = true;
    }
  }, [tyre.size]);

  const handleSizeInput = useCallback((e) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (digits.length <= 7) {
      setRawSize(digits);
    }
    // Once we have 7 digits, format and advance to load index
    if (digits.length >= 7) {
      const formatted = formatTyreSize(digits);
      onFieldChange("size", formatted);
      setRawSize("");
      setTimeout(() => {
        loadRef.current?.focus();
      }, 50);
    }
  }, [onFieldChange]);

  const handleSizeBlur = useCallback(() => {
    // If user leaves with partial input, try to format what we have
    if (rawSize.length > 0 && rawSize.length < 7) {
      onFieldChange("size", rawSize);
      setRawSize("");
    }
  }, [rawSize, onFieldChange]);

  const handleLoadChange = useCallback((e) => {
    const val = e.target.value;
    onFieldChange("load", val);
    // Auto-advance to speed rating after 2-3 digit load index
    if (val.length >= 2 && /^\d{2,3}$/.test(val)) {
      setTimeout(() => {
        speedRef.current?.focus();
      }, 50);
    }
  }, [onFieldChange]);

  const handleSpeedChange = useCallback((e) => {
    onFieldChange("speed", e.target.value.toUpperCase());
  }, [onFieldChange]);

  const labelStyle = { display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: palette.textMuted };

  return (
    <TyreSpecInputRow>
      {/* Make + Size group — stay together on narrow screens */}
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flex: "1 1 360px", minWidth: 0 }}>
        <div style={{ flex: "1 1 210px", minWidth: "160px" }}>
          <label style={labelStyle}>
            <span style={{ fontWeight: 700, color: palette.textPrimary }}>Make</span>
            <AutoCompleteInput
              value={tyre.manufacturer}
              onChange={(value) => onFieldChange("manufacturer", value)}
              onSelect={() => {
                setTimeout(() => { sizeRef.current?.focus(); }, 50);
              }}
              options={tyreBrands}
              placeholder="Type to search make"
            />
          </label>
        </div>
        <div style={{ flex: "0 0 140px", minWidth: "140px", maxWidth: "140px" }}>
          <label style={labelStyle}>
            <span style={{ fontWeight: 700, color: palette.textPrimary }}>Size</span>
            <input
              ref={sizeRef}
              value={rawSize || tyre.size || ""}
              onChange={handleSizeInput}
              onBlur={handleSizeBlur}
              onFocus={() => { if (tyre.size && !rawSize) setRawSize(""); }}
              placeholder={tyre.size || "e.g. 2255518"}
              inputMode="numeric"
              style={{ ...baseInputStyle, width: "100%" }}
            />
          </label>
        </div>
      </div>
      {/* Load + Speed group — stay together on narrow screens */}
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flex: "0 1 auto" }}>
        <label style={labelStyle}>
          <span style={{ fontWeight: 700, color: palette.textPrimary }}>Load Index</span>
          <input
            ref={loadRef}
            value={tyre.load}
            onChange={handleLoadChange}
            placeholder="e.g. 91"
            inputMode="numeric"
            style={{ ...baseInputStyle, width: "110px", minWidth: "110px" }}
          />
        </label>
        <label style={labelStyle}>
          <span style={{ fontWeight: 700, color: palette.textPrimary }}>Speed Rating</span>
          <input
            ref={speedRef}
            value={tyre.speed}
            onChange={handleSpeedChange}
            placeholder="e.g. V"
            maxLength={2}
            style={{ ...baseInputStyle, width: "110px", minWidth: "110px" }}
          />
        </label>
      </div>
    </TyreSpecInputRow>
  );
}

export default function WheelsTyresDetailsModal({
  isOpen,
  onClose,
  onComplete,
  initialData = null,
  locked = false,
  inlineMode = false,
  jobId = null,
  jobNumber = null,
  userId = null,
  onSectionMediaUploaded = null,
}) {
  const normalizedInitialTyres = useMemo(() => buildNormalizedTyres(initialData || {}), [initialData]);
  const [tyres, setTyres] = useState(normalizedInitialTyres);

  useEffect(() => {
    setTyres(normalizedInitialTyres);
  }, [normalizedInitialTyres]);

  const [activeWheel, setActiveWheel] = useState("NSF");
  const [copyActive, setCopyActive] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [concernTarget, setConcernTarget] = useState(null);
  const [concernInput, setConcernInput] = useState("");
  const [concernStatus, setConcernStatus] = useState("Amber");
  const [concernEditIndex, setConcernEditIndex] = useState(null);


  useEffect(() => {
    setShowValidation(false);
  }, [normalizedInitialTyres]);

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

  const getMissingWheelKeys = () => {
    const missing = WHEELS.filter((wheel) => !isWheelReady(tyres[wheel]));
    const spare = tyres.Spare;
    let spareComplete = true;

    switch (spare.type) {
      case "spare":
        spareComplete = isWheelReady(spare.details);
        break;
      case "repair_kit":
        spareComplete = hasValue(spare.month) && hasValue(spare.year);
        break;
      case "space_saver":
        spareComplete = hasValue(spare.condition);
        break;
      case "not_checked":
        spareComplete = hasValue(spare.note);
        break;
      case "boot_full":
      default:
        spareComplete = true;
        break;
    }

    if (!spareComplete) {
      missing.push("Spare");
    }

    return missing;
  };

  const missingWheelKeys = getMissingWheelKeys();
  const canComplete = missingWheelKeys.length === 0;

  const handleSaveComplete = () => {
    if (!canComplete) {
      setShowValidation(true);
      const firstMissing = missingWheelKeys[0];
      if (firstMissing) setActiveWheel(firstMissing);
      return;
    }
    onComplete({
      NSF: createWheelEntry(tyres.NSF),
      OSF: createWheelEntry(tyres.OSF),
      NSR: createWheelEntry(tyres.NSR),
      OSR: createWheelEntry(tyres.OSR),
      Spare: buildSparePayload(tyres.Spare),
    });
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
    onClose({
      NSF: createWheelEntry(tyres.NSF),
      OSF: createWheelEntry(tyres.OSF),
      NSR: createWheelEntry(tyres.NSR),
      OSR: createWheelEntry(tyres.OSR),
      Spare: buildSparePayload(tyres.Spare),
    });
  };
  const contentWrapperStyle = {
    ...vhcModalContentStyles.contentWrapper,
    gap: "20px",
  };

  const canShowCamera = Boolean(jobId || jobNumber);

  const footer = (
    <>
      {canShowCamera ? (
        <SectionCameraButton
          sectionKey="wheels"
          sectionLabel="Wheels & Tyres"
          vhcData={{ wheelsTyres: tyres }}
          jobId={jobId}
          jobNumber={jobNumber}
          userId={userId}
          onUploadComplete={onSectionMediaUploaded}
        />
      ) : null}
      <Button variant="ghost" size="sm" onClick={handleClose} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
        Close
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={handleSaveComplete}
        disabled={locked}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
      >
        Save & Complete
      </Button>
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
      adaptiveHeight
      hideCloseButton
      width="1280px"
      footer={footer}
      sectionKey="vhc-wheels"
    >
      <div style={contentWrapperStyle} data-dev-section="1" data-dev-section-key="vhc-wheels-content" data-dev-section-type="content-card" data-dev-section-parent="vhc-wheels-body">
          <div
            data-dev-section="1"
            data-dev-section-key="vhc-wheels-layout"
            data-dev-section-type="content-card"
            data-dev-section-parent="vhc-wheels-content"
            style={{
              display: "flex",
              gap: "20px",
              minHeight: 0,
              position: "relative",
            }}
          >
            <div
              data-dev-section="1"
              data-dev-section-key="vhc-wheels-diagram"
              data-dev-section-type="content-card"
              data-dev-section-parent="vhc-wheels-layout"
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
                invalidTyres={showValidation ? missingWheelKeys.filter((wheel) => wheel !== "Spare") : []}
                invalidSpare={showValidation && missingWheelKeys.includes("Spare")}
                onSelect={(key) => {
                  if (!key) return;
                  setActiveWheel(key.toUpperCase());
                }}
                spareActive={activeWheel === "Spare"}
                onSpareSelect={() => setActiveWheel("Spare")}
              />
            </div>

          <div
            data-dev-section="1"
            data-dev-section-key="vhc-wheels-details"
            data-dev-section-type="content-card"
            data-dev-section-parent="vhc-wheels-layout"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              minHeight: 0,
            }}
          >
            <div
              data-dev-section="1"
              data-dev-section-key="vhc-wheels-toolbar"
              data-dev-section-type="toolbar"
              data-dev-section-parent="vhc-wheels-details"
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
              {showValidation && !canComplete ? (
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--danger)", whiteSpace: "nowrap" }}>
                  Complete all highlighted wheel sections to continue.
                </span>
              ) : null}
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
                  borderRadius: "var(--control-radius)",
                  border: "none",
                  background: "var(--tab-container-bg)",
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
                          borderRadius: "var(--control-radius-xs)",
                          border: "none",
                          minHeight: "var(--control-height-xs)",
                          padding: "var(--control-padding-xs)",
                          fontSize: "0.86rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          background: isActive ? "var(--primary)" : "transparent",
                          color: isActive ? "var(--text-inverse)" : "var(--text-primary)",
                          transition: "background-color 0.18s ease, color 0.18s ease",
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
              data-dev-section="1"
              data-dev-section-key="vhc-wheels-sections"
              data-dev-section-type="content-card"
              data-dev-section-parent="vhc-wheels-details"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "18px",
                flex: 1,
                overflowY: "auto",
                paddingRight: "8px",
                minHeight: 0,
              }}
            >
              {activeWheel !== "Spare" ? (
                <>
                  <div style={sectionCardStyle} data-dev-section="1" data-dev-section-key="vhc-wheels-tyre-details" data-dev-section-type="content-card" data-dev-section-parent="vhc-wheels-sections">
                    <span style={{ fontSize: "13px", color: palette.textMuted, fontWeight: 600 }}>Tyre Details</span>
                    <TyreSpecFields tyre={currentTyre} onFieldChange={updateTyre} />
                  </div>

                  <div style={sectionCardStyle} data-dev-section="1" data-dev-section-key="vhc-wheels-tread-depth" data-dev-section-type="content-card" data-dev-section-parent="vhc-wheels-sections">
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
                        <TyreSpecFields tyre={tyres.Spare.details} onFieldChange={updateTyre} />
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

              <div style={{ ...sectionCardStyle, flex: "1 1 auto", minHeight: 0 }} data-dev-section="1" data-dev-section-key="vhc-wheels-concerns" data-dev-section-type="content-card" data-dev-section-parent="vhc-wheels-sections">
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setConcernTarget(activeWheel);
                        setConcernInput("");
                        setConcernStatus("Amber");
                        setConcernEditIndex(null);
                      }}
                    >
                      + Add Concern
                    </Button>
                    <div style={concernBadge(statusColors.Amber)}>{(currentTyre.concerns ?? []).length} total</div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                  }}
                >
                  {(currentTyre.concerns ?? []).length === 0 ? (
                    <div
                      style={{
                        padding: "16px",
                        borderRadius: "var(--radius-md)",
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
                          borderRadius: "var(--radius-md)",
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deleteConcern}
                  style={{ color: "var(--danger)" }}
                >
                  Delete
                </Button>
              )}
              <div style={{ display: "flex", gap: "10px" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setConcernTarget(null);
                    setConcernInput("");
                    setConcernStatus("Amber");
                    setConcernEditIndex(null);
                  }}
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={addConcern}
                  disabled={locked}
                >
                  {concernEditIndex !== null ? "Save" : "Add Concern"}
                </Button>
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
