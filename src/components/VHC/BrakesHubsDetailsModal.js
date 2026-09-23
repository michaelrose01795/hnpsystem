// file location: src/components/VHC/BrakesHubsDetailsModal.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import VHCModalShell from "@/components/VHC/VHCModalShell";
import IssueReportPopup, {
  IssueReportAddSection,
  IssueReportList,
  IssueReportRow,
} from "@/components/VHC/IssueReportPopup";
import SectionCameraButton from "@/components/VHC/mediaCapture/SectionCameraButton";
import { buildConcernRef } from "@/components/VHC/mediaCapture/collectSectionConcerns";
import Button from "@/components/ui/Button";
import themeConfig, {
  vhcModalContentStyles,
} from "@/styles/appTheme";
import BrakeDiagram from "@/components/VHC/BrakeDiagram";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import IssueAutocomplete from "@/components/VHC/IssueAutocomplete";
import useVhcSectionDraft from "@/hooks/useVhcSectionDraft";
import { buildBrakeDiagramValues } from "@/lib/vhc/brakeDiagramValues";

const palette = themeConfig.palette;

const sanitizeNumericListInput = (value = "") =>
  value.replace(/[^0-9.,\s]/g, "");

const sanitizeDecimalInput = (value = "") => {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const [integerPart, ...decimalParts] = cleaned.split(".");
  const decimals = decimalParts.length > 0 ? `.${decimalParts.join("")}` : "";
  return `${integerPart}${decimals}`;
};

const normalisePadSection = (pad = {}) => {
  const measurement = sanitizeNumericListInput(pad.measurement ?? "");
  return {
    measurement,
    status: pad.status || "Green",
    concerns: Array.isArray(pad.concerns) ? pad.concerns : [],
  };
};

const normaliseDiscSection = (disc = {}) => {
  const base = {
    tab: "measurements",
    measurements: { values: [""], thickness: "", status: "Green" },
    visual: { status: "Green" },
    concerns: [],
  };

  const merged = {
    ...base,
    ...disc,
    concerns: Array.isArray(disc.concerns) ? disc.concerns : [],
  };

  const measurementSource = disc.measurements || {};

  let values = Array.isArray(measurementSource.values)
    ? measurementSource.values.map((item) => sanitizeDecimalInput(String(item)))
    : [];

  if (values.length === 0 && typeof measurementSource.thickness === "string") {
    values = measurementSource.thickness
      .split(/[, ]+/)
      .map((item) => sanitizeDecimalInput(item.trim()))
      .filter(Boolean);
  }

  if (values.length === 0 && typeof disc.thickness === "string") {
    values = disc.thickness
      .split(/[, ]+/)
      .map((item) => sanitizeDecimalInput(item.trim()))
      .filter(Boolean);
  }

  if (values.length === 0) {
    values = [""];
  }

  const thickness = values.filter((item) => item !== "").join(", ");

  return {
    ...merged,
    tab: merged.tab || "measurements",
    measurements: {
      ...base.measurements,
      ...measurementSource,
      values,
      thickness,
      status: measurementSource.status || "Green",
    },
    visual: {
      ...base.visual,
      ...disc.visual,
      status: disc.visual?.status || base.visual.status,
    },
  };
};

const normaliseBrakesState = (initialData = {}) => {
  const source =
    initialData && typeof initialData === "object" && !Array.isArray(initialData)
      ? initialData
      : {};

  const frontDiscs = normaliseDiscSection(source.frontDiscs);
  const rearDiscs = normaliseDiscSection(source.rearDiscs);

  const data = {
    frontPads: normalisePadSection(source.frontPads),
    rearPads: normalisePadSection(source.rearPads),
    frontDiscs,
    rearDiscs,
    rearDrums: {
      status: source.rearDrums?.status || "",
      concerns: Array.isArray(source.rearDrums?.concerns)
        ? source.rearDrums.concerns
        : [],
    },
    // Preserve the brake type preference
    _brakeType: source._brakeType || null,
  };

  // Determine if we should show drum based on explicit preference or data presence
  let showDrum = false;
  if (source._brakeType === "drum") {
    showDrum = true;
  } else if (source._brakeType === "disc") {
    showDrum = false;
  } else {
    // Fallback to old logic if no explicit preference
    showDrum = !!source.rearDrums?.status && !source.rearDiscs?.measurements;
  }

  return { data, showDrum };
};

const ALL_CONCERN_TARGETS = [
  { key: "frontPads", label: "Front Pads" },
  { key: "rearPads", label: "Rear Pads" },
  { key: "frontDiscs", label: "Front Discs" },
  { key: "rearDiscs", label: "Rear Discs" },
  { key: "rearDrums", label: "Rear Drum" },
];

const PadsSection = ({
  title,
  padData = {},
  onMeasurementChange,
  onStatusChange,
  sectionPanelBase,
  fieldLabelStyle,
  inputStyle,
  dropdownFieldStyle,
  enhanceFocus,
  resetFocus,
  panelStyle,
}) => (
  <div data-dev-section="1" data-dev-section-key={`vhc-brakes-pads-${title.toLowerCase().replace(/\s+/g, "-")}`} data-dev-section-type="content-card" data-dev-section-parent="vhc-brakes-sections" style={{ ...sectionPanelBase, ...panelStyle }}>
    <div style={{ display: "flex", alignItems: "center" }}>
      <h3 style={{ fontSize: "16px", fontWeight: 700, color: palette.textPrimary, margin: 0 }}>
        {title}
      </h3>
    </div>

    <label style={fieldLabelStyle}>Pad Measurement (mm)</label>
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={padData.measurement || ""}
        onChange={(e) => onMeasurementChange?.(e.target.value)}
        placeholder="0"
        autoComplete="off"
        style={{ ...inputStyle, width: "8ch", textAlign: "center", fontWeight: 600 }}
        onFocus={enhanceFocus}
        onBlur={resetFocus}
      />
      <DropdownField
        value={padData.status || "Green"}
        onChange={(e) => onStatusChange?.(e.target.value)}
        style={{ ...dropdownFieldStyle, width: "11ch", minWidth: "11ch" }}
        onFocus={enhanceFocus}
        onBlur={resetFocus}
      >
        <option>Red</option>
        <option>Amber</option>
        <option>Green</option>
      </DropdownField>
    </div>
  </div>
);

const DiscsSection = ({
  title,
  discData = {},
  onTabChange,
  onMeasurementChange,
  onMeasurementStatusChange,
  onVisualStatusChange,
  showDrumButton,
  onSwitchToDrum,
  showSwitchInTabs = false,
  sectionPanelBase,
  fieldLabelStyle,
  inputStyle,
  dropdownFieldStyle,
  enhanceFocus,
  resetFocus,
  panelStyle,
}) => {
  const activeTab = discData.tab || "measurements";
  return (
    <div data-dev-section="1" data-dev-section-key={`vhc-brakes-discs-${title.toLowerCase().replace(/\s+/g, "-")}`} data-dev-section-type="content-card" data-dev-section-parent="vhc-brakes-sections" style={{ ...sectionPanelBase, ...panelStyle }}>
      <div data-dev-section="1" data-dev-section-key={`vhc-brakes-discs-${title.toLowerCase().replace(/\s+/g, "-")}-toolbar`} data-dev-section-type="toolbar" data-dev-section-parent={`vhc-brakes-discs-${title.toLowerCase().replace(/\s+/g, "-")}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: palette.textPrimary, margin: 0 }}>
          {title}
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <TabGroup
            items={[
              { value: "measurements", label: "Measurements" },
              { value: "visual", label: "Visual" },
            ]}
            value={activeTab}
            onChange={onTabChange}
            ariaLabel={`${title} inspection method`}
            devSectionKey={`vhc-brakes-discs-${title.toLowerCase().replace(/\s+/g, "-")}-tabs`}
            devSectionParent={`vhc-brakes-discs-${title.toLowerCase().replace(/\s+/g, "-")}-toolbar`}
          />
          {showDrumButton && showSwitchInTabs ? (
            <Button variant="secondary" size="sm" onClick={onSwitchToDrum}>
              Switch to Drum Brakes
            </Button>
          ) : null}
        </div>
      </div>

      {activeTab === "measurements" && (
        <>
          <label style={fieldLabelStyle}>Disc Thickness (mm)</label>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={discData.measurements?.values?.[0] || ""}
              onChange={(e) => onMeasurementChange?.(e.target.value)}
              placeholder="0"
              autoComplete="off"
              style={{ ...inputStyle, width: "8ch", textAlign: "center", fontWeight: 600 }}
              onFocus={enhanceFocus}
              onBlur={resetFocus}
            />
            <DropdownField
              value={discData.measurements?.status || "Green"}
              onChange={(e) => onMeasurementStatusChange?.(e.target.value)}
              style={{ ...dropdownFieldStyle, width: "11ch", minWidth: "11ch" }}
              onFocus={enhanceFocus}
              onBlur={resetFocus}
            >
              <option>Red</option>
              <option>Amber</option>
              <option>Green</option>
            </DropdownField>
          </div>
        </>
      )}

      {activeTab === "visual" && (
        <>
          <label style={fieldLabelStyle}>Visual Inspection</label>
          <DropdownField
            value={discData.visual?.status || "Green"}
            onChange={(e) => onVisualStatusChange?.(e.target.value)}
            style={{ ...dropdownFieldStyle, width: "11ch", minWidth: "11ch" }}
            onFocus={enhanceFocus}
            onBlur={resetFocus}
          >
            <option>Red</option>
            <option>Amber</option>
            <option>Green</option>
          </DropdownField>
        </>
      )}

      {showDrumButton && !showSwitchInTabs && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onSwitchToDrum}
        >
          Switch to Drum Brakes
        </Button>
      )}
    </div>
  );
};

const DrumBrakesSection = ({
  status,
  onStatusChange,
  onSwitchToDisc,
  sectionPanelBase,
  panelStyle,
}) => (
    <div data-dev-section="1" data-dev-section-key="vhc-brakes-drums" data-dev-section-type="content-card" data-dev-section-parent="vhc-brakes-sections" style={{ ...sectionPanelBase, ...panelStyle }}>
      <div data-dev-section="1" data-dev-section-key="vhc-brakes-drums-toolbar" data-dev-section-type="toolbar" data-dev-section-parent="vhc-brakes-drums" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: palette.textPrimary, margin: 0 }}>
          Drum Brakes
        </h3>
        <Button variant="secondary" size="sm" onClick={onSwitchToDisc}>
          Switch to Disc Brakes
        </Button>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          marginTop: "8px",
        }}
      >
        {["Good", "Monitor", "Replace"].map((label) => {
          const active = status === label;
          return (
            <Button
              key={label}
              variant={active ? "primary" : "ghost"}
              size="sm"
              onClick={() => onStatusChange?.(label)}
              style={{
                backgroundColor: active ? palette.accent : "var(--control-bg)",
                color: active ? "var(--text-2)" : "var(--text-1)",
                border: "none",
              }}
            >
              {label}
            </Button>
          );
        })}
      </div>

    </div>
);

export default function BrakesHubsDetailsModal({
  isOpen,
  onClose,
  onComplete,
  initialData,
  locked = false,
  inlineMode = false,
  jobId = null,
  jobNumber = null,
  userId = null,
  onSectionMediaUploaded = null,
}) {
  const { readDraft, persistDraft, completeDraft } = useVhcSectionDraft({
    sectionKey: "brakesHubs",
    jobId,
    jobNumber,
    userId,
    isOpen,
    onComplete,
  });
  const normalisedInitial = useMemo(() => {
    const storedDraft = readDraft(null);
    if (storedDraft?.data && typeof storedDraft.data === "object") {
      return {
        data: storedDraft.data,
        showDrum: Boolean(storedDraft.showDrum),
      };
    }
    return normaliseBrakesState(initialData);
  }, [initialData, readDraft]);

  const [data, setData] = useState(normalisedInitial.data);
  const [showDrum, setShowDrum] = useState(normalisedInitial.showDrum);
  const [showValidation, setShowValidation] = useState(false);
  const [activeSide, setActiveSide] = useState("front");
  const [stableSectionHeight, setStableSectionHeight] = useState(null);
  const hasInitializedRef = useRef(false);
  const sectionsContainerRef = useRef(null);
  const [concernPopup, setConcernPopup] = useState({
    open: false,
    category: "frontPads",
    tempConcern: { issue: "", status: "Red" },
    editIndex: null,
  });

  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
      return;
    }
    if (hasInitializedRef.current) return;
    setData(normalisedInitial.data);
    setShowDrum(normalisedInitial.showDrum);
    setShowValidation(false);
    hasInitializedRef.current = true;
  }, [isOpen, normalisedInitial]);

  useEffect(() => {
    persistDraft({ data, showDrum });
  }, [data, persistDraft, showDrum]);

  useEffect(() => {
    const container = sectionsContainerRef.current;
    const isRearDrumView = activeSide === "rear" && showDrum;
    if (!container || isRearDrumView || typeof ResizeObserver === "undefined") return undefined;

    const rememberHeight = () => {
      const nextHeight = container.getBoundingClientRect().height;
      setStableSectionHeight((currentHeight) =>
        Math.abs((currentHeight ?? 0) - nextHeight) > 0.5 ? nextHeight : currentHeight,
      );
    };

    rememberHeight();
    const observer = new ResizeObserver(rememberHeight);
    observer.observe(container);
    return () => observer.disconnect();
  }, [activeSide, showDrum]);

  const padLabels = { frontPads: "Front Pads", rearPads: "Rear Pads" };
  const discLabels = { frontDiscs: "Front Discs", rearDiscs: "Rear Discs" };

  const contentWrapperStyle = {
    ...vhcModalContentStyles.contentWrapper,
    gap: "24px",
  };
  const sectionPanelBase = {
    ...vhcModalContentStyles.baseCard,
    flex: "0 0 auto",
    minHeight: "0",
    gap: "12px",
    alignItems: "stretch",
    cursor: "default",
    overflow: "visible",
  };

  const activeConcernKeySet = useMemo(() => {
    if (activeSide === "front") return ["frontPads", "frontDiscs"];
    if (showDrum) return ["rearDrums"];
    return ["rearPads", "rearDiscs"];
  }, [activeSide, showDrum]);

  const resolveActiveConcernCategory = () => {
    if (activeSide === "front") return "frontPads";
    if (showDrum) return "rearDrums";
    return "rearPads";
  };

  const defaultConcernCategory = resolveActiveConcernCategory();

  const areaLabels = {
    ...padLabels,
    ...discLabels,
    rearDrums: "Rear Drum",
  };

  const areaSuggestionKeys = {
    frontPads: "brakes_front_pads",
    rearPads: "brakes_rear_pads",
    frontDiscs: "brakes_front_discs",
    rearDiscs: "brakes_rear_discs",
    rearDrums: "brakes_rear_drum",
  };

  const activeIssueEntries = useMemo(() => {
    return activeConcernKeySet.flatMap((key) => {
      const concerns = data[key]?.concerns ?? [];
      return concerns.map((concern, idx) => ({
        ...concern,
        area: areaLabels[key] || key,
        categoryKey: key,
        index: idx,
      }));
    });
  }, [activeConcernKeySet, data, areaLabels]);

  const severityBadgeStyle = (status) => ({
    padding: "4px 10px",
    borderRadius: "var(--radius-pill)",
    fontSize: "12px",
    fontWeight: 700,
    background:
      status === "Red"
        ? "var(--danger-surface)"
        : status === "Green"
          ? "var(--success-surface)"
          : "var(--warning-surface)",
    color:
      status === "Red"
        ? palette.danger
        : status === "Green"
          ? palette.success
          : palette.warning,
  });

  const resetConcernPopup = () =>
    setConcernPopup({
      open: false,
      category: defaultConcernCategory,
      tempConcern: { issue: "", status: "Red" },
      editIndex: null,
    });

  const openConcernPopup = () =>
    setConcernPopup({
      open: true,
      category: defaultConcernCategory,
      tempConcern: { issue: "", status: "Red" },
      editIndex: null,
    });

  useEffect(() => {
    if (concernPopup.open) return;
    setConcernPopup((prev) => ({ ...prev, category: defaultConcernCategory }));
  }, [defaultConcernCategory, concernPopup.open]);

  const handleClose = () => {
    resetConcernPopup();
    if (!onClose) return;
    // Save the brake type preference when closing
    const dataWithBrakeType = {
      ...data,
      _brakeType: showDrum ? "drum" : "disc",
    };
    onClose(dataWithBrakeType);
  };

  const severityPriority = { Green: 1, Amber: 2, Red: 3 };
  const getPriority = (value) => severityPriority[value?.trim()] || 0;

  const getHighestConcernSeverity = (concerns = []) => {
    let best = null;
    concerns.forEach(({ status }) => {
      const candidate = (status || "").trim();
      if (!candidate) return;
      if (!severityPriority[candidate]) return;
      if (!best || severityPriority[candidate] > severityPriority[best]) {
        best = candidate;
      }
    });
    if (!best || best === "Green") return null;
    return best;
  };

  const escalatePadSeverity = (section, severity) => {
    const current = section.status;
    if (getPriority(severity) <= getPriority(current)) return section;
    return { ...section, status: severity };
  };

  const escalateDiscSeverity = (section, severity) => {
    const measurementStatus = section.measurements.status;
    const visualStatus = section.visual.status;
    const nextMeasurementStatus =
      getPriority(severity) > getPriority(measurementStatus) ? severity : measurementStatus;
    const nextVisualStatus =
      getPriority(severity) > getPriority(visualStatus) ? severity : visualStatus;
    if (
      nextMeasurementStatus === measurementStatus &&
      nextVisualStatus === visualStatus
    ) {
      return section;
    }
    return {
      ...section,
      measurements: {
        ...section.measurements,
        status: nextMeasurementStatus,
      },
      visual: {
        ...section.visual,
        status: nextVisualStatus,
      },
    };
  };

  const fieldLabelStyle = {
    fontSize: "12px",
    fontWeight: 600,
    color: palette.textMuted,
    letterSpacing: "0.2px",
    marginTop: "4px",
  };

  const selectBaseStyle = {
    padding: "var(--control-padding)",
    borderRadius: "var(--control-radius)",
    border: "none",
    backgroundColor: "var(--control-bg)",
    color: "var(--text-1)",
    fontSize: "var(--control-font-size)",
    outline: "none",
  };

  const dropdownFieldStyle = {
    width: "100%",
  };

  const inputStyle = { width: "100%" };

  const enhanceFocus = (event) => {
    event.target.style.backgroundColor = "var(--control-bg-hover)";
    event.target.style.boxShadow = "var(--control-ring)";
  };

  const resetFocus = (event) => {
    event.target.style.backgroundColor = "var(--control-bg)";
    event.target.style.boxShadow = "none";
  };

  const updatePadStatus = (category, value) => {
    setData((prev) => ({ ...prev, [category]: { ...prev[category], status: value } }));
  };

  const updatePadMeasurement = (category, value) => {
    const sanitized = sanitizeDecimalInput(value);

    setData((prev) => {
      const parsed = parseFloat(sanitized);
      const currentStatus = prev[category]?.status || "Green";
      const nextStatus = Number.isNaN(parsed)
        ? currentStatus
        : parsed <= 2
          ? "Red"
          : parsed < 4
            ? "Amber"
            : "Green";

      return {
        ...prev,
        [category]: {
          ...prev[category],
          measurement: sanitized,
          status: nextStatus,
        },
      };
    });
  };

  const updateDisc = (category, field, value) => {
    setData((prev) => {
      const section = prev[category];
      if (!section) return prev;

      if (field === "measurements") {
        const incomingValues = Array.isArray(value.values) ? value.values : section.measurements.values;
        const sanitizedValues = incomingValues.map((item) => sanitizeDecimalInput(String(item)));
        const measurements = {
          ...section.measurements,
          ...value,
          values: sanitizedValues,
          thickness: sanitizedValues.filter((item) => item !== "").join(", "),
        };

        return {
          ...prev,
          [category]: {
            ...section,
            measurements,
          },
        };
      }

      return {
        ...prev,
        [category]: {
          ...section,
          [field]: { ...section[field], ...value },
        },
      };
    });
  };

  const updateDiscMeasurementValue = (category, value) => {
    const sanitized = sanitizeDecimalInput(value);

    setData((prev) => {
      const section = prev[category];
      if (!section) return prev;

      return {
        ...prev,
        [category]: {
          ...section,
          measurements: {
            ...section.measurements,
            values: [sanitized],
            thickness: sanitized,
          },
        },
      };
    });
  };

  const updateDiscTab = (category, tab) => {
    setData((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        tab,
      },
    }));
  };

  const addConcern = (category, concern, index = null) => {
    setData((prev) => {
      const section = prev[category];
      if (!section) return prev;
      const existing = section.concerns || [];
      const nextConcerns =
        index === null
          ? [...existing, concern]
          : existing.map((c, idx) => (idx === index ? concern : c));
      const severity = getHighestConcernSeverity(nextConcerns);
      let nextSection = { ...section, concerns: nextConcerns };
      if (category === "rearDrums") {
        return { ...prev, rearDrums: nextSection };
      }
      if (severity) {
        nextSection =
          category === "frontPads" || category === "rearPads"
            ? escalatePadSeverity(nextSection, severity)
            : escalateDiscSeverity(nextSection, severity);
      }
      return { ...prev, [category]: nextSection };
    });
  };

  const deleteConcern = (category, index) => {
    setData((prev) => {
      const section = prev[category];
      if (!section) return prev;
      const existing = section.concerns || [];
      const nextConcerns = existing.filter((_, idx) => idx !== index);
      const severity = getHighestConcernSeverity(nextConcerns);
      let nextSection = { ...section, concerns: nextConcerns };
      if (category === "rearDrums") {
        return { ...prev, rearDrums: nextSection };
      }
      if (severity) {
        nextSection =
          category === "frontPads" || category === "rearPads"
            ? escalatePadSeverity(nextSection, severity)
            : escalateDiscSeverity(nextSection, severity);
      }
      return { ...prev, [category]: nextSection };
    });
  };

  const updateConcernStatus = (category, index, status) => {
    setData((prev) => {
      const section = prev[category];
      if (!section) return prev;
      const nextConcerns = [...section.concerns];
      nextConcerns[index] = { ...nextConcerns[index], status };
      const severity = getHighestConcernSeverity(nextConcerns);
      let nextSection = { ...section, concerns: nextConcerns };
      if (category === "rearDrums") {
        return { ...prev, rearDrums: nextSection };
      }
      if (severity) {
        nextSection =
          category === "frontPads" || category === "rearPads"
            ? escalatePadSeverity(nextSection, severity)
            : escalateDiscSeverity(nextSection, severity);
      }
      return { ...prev, [category]: nextSection };
    });
  };

  const buildPayload = () => {
    const next = { ...data };
    ["frontDiscs", "rearDiscs"].forEach((category) => {
      if (!next[category]) return;
      const values = next[category].measurements.values || [];
      next[category] = {
        ...next[category],
        measurements: {
          ...next[category].measurements,
          thickness: values[0] ? values[0].replace(/[,\s]+$/g, "") : "",
        },
      };
    });

    // Save the brake type preference so it's remembered when reopening
    next._brakeType = showDrum ? "drum" : "disc";

    // Smart data persistence: Only save relevant data based on brake type
    if (showDrum) {
      // When drum brakes are selected, exclude rear pads and rear discs from save
      // But keep them in component state for potential switching back
      const { rearPads, rearDiscs, ...rest } = next;
      return rest;
    } else {
      // When disc brakes are selected, exclude drum data from save
      // But keep it in component state for potential switching back
      const { rearDrums, ...rest } = next;
      return rest;
    }
  };

  const brakeDiagramValues = useMemo(() => {
    return buildBrakeDiagramValues(data, showDrum);
  }, [data, showDrum]);

  const discComplete = (section) => {
    if (!section) return false;
    const hasMeasurementValues = section.measurements.values?.some((value) => value && value.trim() !== "");
    const measurementReady = hasMeasurementValues && section.measurements.status;
    const visualReady = section.visual.status;
    return section.tab === "visual" ? Boolean(visualReady) : Boolean(measurementReady);
  };

  const missingSections = useMemo(() => {
    const frontPadMeasurement = (data.frontPads.measurement || "").trim();
    const rearPadMeasurement = (data.rearPads.measurement || "").trim();
    const missing = {
      frontPads: !(frontPadMeasurement !== "" && data.frontPads.status !== ""),
      frontDiscs: !discComplete(data.frontDiscs),
      rearPads: false,
      rearDiscs: false,
      rearDrums: false,
    };

    if (showDrum) {
      missing.rearDrums = data.rearDrums.status === "";
    } else {
      missing.rearPads = !(rearPadMeasurement !== "" && data.rearPads.status !== "");
      missing.rearDiscs = !discComplete(data.rearDiscs);
    }

    return missing;
  }, [data, showDrum]);

  const canComplete = !Object.values(missingSections).some(Boolean);

  const invalidBrakePositions = useMemo(() => {
    if (!showValidation) return [];
    const invalid = [];
    const frontMissing = missingSections.frontPads || missingSections.frontDiscs;
    const rearMissing = showDrum
      ? missingSections.rearDrums
      : missingSections.rearPads || missingSections.rearDiscs;
    if (frontMissing) invalid.push("nsf", "osf");
    if (rearMissing) invalid.push("nsr", "osr");
    return invalid;
  }, [missingSections, showDrum, showValidation]);

  const requiredPanelStyle = {
    border: "none",
    background: "var(--danger-surface)",
  };

  const handleSaveComplete = async () => {
    if (!canComplete) {
      setShowValidation(true);
      if (missingSections.frontPads || missingSections.frontDiscs) {
        setActiveSide("front");
      } else {
        setActiveSide("rear");
        if (missingSections.rearDrums) setShowDrum(true);
      }
      return;
    }
    await completeDraft(buildPayload());
  };

  if (!isOpen) return null;

  const rearDiscChecks = (
    <>
      <PadsSection
        title={padLabels.rearPads}
        padData={data.rearPads}
        onMeasurementChange={(value) => updatePadMeasurement("rearPads", value)}
        onStatusChange={(value) => updatePadStatus("rearPads", value)}
        sectionPanelBase={sectionPanelBase}
        fieldLabelStyle={fieldLabelStyle}
        inputStyle={inputStyle}
        dropdownFieldStyle={dropdownFieldStyle}
        enhanceFocus={enhanceFocus}
        resetFocus={resetFocus}
        panelStyle={showValidation && missingSections.rearPads ? requiredPanelStyle : null}
      />
      <DiscsSection
        title={discLabels.rearDiscs}
        discData={data.rearDiscs}
        onTabChange={(tab) => updateDiscTab("rearDiscs", tab)}
        onMeasurementChange={(value) => updateDiscMeasurementValue("rearDiscs", value)}
        onMeasurementStatusChange={(value) =>
          updateDisc("rearDiscs", "measurements", { status: value })
        }
        onVisualStatusChange={(value) =>
          updateDisc("rearDiscs", "visual", { status: value })
        }
        showDrumButton
        onSwitchToDrum={() => setShowDrum(true)}
        showSwitchInTabs
        sectionPanelBase={sectionPanelBase}
        fieldLabelStyle={fieldLabelStyle}
        inputStyle={inputStyle}
        dropdownFieldStyle={dropdownFieldStyle}
        enhanceFocus={enhanceFocus}
        resetFocus={resetFocus}
        panelStyle={showValidation && missingSections.rearDiscs ? requiredPanelStyle : null}
      />
    </>
  );

  return (
    <VHCModalShell
      isOpen={isOpen}
      title="Brakes & Hubs"
      locked={locked}
      inlineMode={inlineMode}
      adaptiveHeight
      width="1280px"
      hideCloseButton
      onClose={handleClose}
      sectionKey="vhc-brakes"
      footer={
        <>
          {(jobId || jobNumber) ? (
            <SectionCameraButton
              sectionKey="brakes"
              sectionLabel="Brakes & Hubs"
              vhcData={{ brakesHubs: data }}
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
      }
    >
      <div data-draft-ignore="true" style={contentWrapperStyle} data-dev-section="1" data-dev-section-key="vhc-brakes-content" data-dev-section-type="content-card" data-dev-section-parent="vhc-brakes-body">

        <div
          data-dev-section="1"
          data-dev-section-key="vhc-brakes-layout"
          data-dev-section-type="content-card"
          data-dev-section-parent="vhc-brakes-content"
          style={{
            display: "flex",
            gap: "20px",
            minHeight: 0,
            position: "relative",
          }}
        >
          <div
            data-dev-section="1"
            data-dev-section-key="vhc-brakes-diagram"
            data-dev-section-type="content-card"
            data-dev-section-parent="vhc-brakes-layout"
            style={{
              flex: "0 0 360px",
              display: "flex",
              alignItems: "stretch",
              justifyContent: "center",
            }}
          >
            <BrakeDiagram
              brakes={brakeDiagramValues}
              activeBrake={activeSide}
              invalidPositions={invalidBrakePositions}
              onSelect={(side) => {
                if (side === "front") {
                  setActiveSide("front");
                } else {
                  setActiveSide("rear");
                  // Don't change showDrum here - let it maintain its state
                }
              }}
            />
          </div>

          <div
            data-dev-section="1"
            data-dev-section-key="vhc-brakes-details"
            data-dev-section-type="content-card"
            data-dev-section-parent="vhc-brakes-layout"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              position: "relative",
              minHeight: 0,
            }}
          >
            <div data-dev-section="1" data-dev-section-key="vhc-brakes-toolbar" data-dev-section-type="toolbar" data-dev-section-parent="vhc-brakes-details" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: palette.accent }}>
                {activeSide === "front" ? "Front Axle Checks" : showDrum ? "Rear Drum Checks" : "Rear Axle Checks"}
              </h2>
              {showValidation && !canComplete ? (
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--danger)" }}>
                  Complete all highlighted brake sections to continue.
                </span>
              ) : null}
            </div>

            <div
              ref={sectionsContainerRef}
              data-dev-section="1"
              data-dev-section-key="vhc-brakes-sections"
              data-dev-section-type="content-card"
              data-dev-section-parent="vhc-brakes-body"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: activeSide === "rear" && showDrum ? "10px" : "18px",
                flex: 1,
                overflowY: "auto",
                paddingRight: "8px",
                minHeight:
                  activeSide === "rear" && showDrum && stableSectionHeight
                    ? `${stableSectionHeight}px`
                    : 0, // Preserve the normal checks footprint while drum content is visible.
              }}
            >
              {activeSide === "front" && (
                <>
                  <PadsSection
                    title={padLabels.frontPads}
                    padData={data.frontPads}
                    onMeasurementChange={(value) => updatePadMeasurement("frontPads", value)}
                    onStatusChange={(value) => updatePadStatus("frontPads", value)}
                    sectionPanelBase={sectionPanelBase}
                    fieldLabelStyle={fieldLabelStyle}
                    inputStyle={inputStyle}
                    dropdownFieldStyle={dropdownFieldStyle}
                    enhanceFocus={enhanceFocus}
                    resetFocus={resetFocus}
                    panelStyle={showValidation && missingSections.frontPads ? requiredPanelStyle : null}
                  />
                  <DiscsSection
                    title={discLabels.frontDiscs}
                    discData={data.frontDiscs}
                    onTabChange={(tab) => updateDiscTab("frontDiscs", tab)}
                    onMeasurementChange={(value) => updateDiscMeasurementValue("frontDiscs", value)}
                    onMeasurementStatusChange={(value) =>
                      updateDisc("frontDiscs", "measurements", { status: value })
                    }
                    onVisualStatusChange={(value) =>
                      updateDisc("frontDiscs", "visual", { status: value })
                    }
                    showDrumButton={false}
                    onSwitchToDrum={() => setShowDrum(true)}
                    sectionPanelBase={sectionPanelBase}
                    fieldLabelStyle={fieldLabelStyle}
                    inputStyle={inputStyle}
                    dropdownFieldStyle={dropdownFieldStyle}
                    enhanceFocus={enhanceFocus}
                    resetFocus={resetFocus}
                    panelStyle={showValidation && missingSections.frontDiscs ? requiredPanelStyle : null}
                  />
                </>
              )}

              {activeSide === "rear" && !showDrum ? rearDiscChecks : null}

              {activeSide === "rear" && showDrum && (
                <DrumBrakesSection
                  status={data.rearDrums.status}
                  onStatusChange={(value) =>
                    setData((prev) => ({
                      ...prev,
                      rearDrums: {
                        ...prev.rearDrums,
                        status: value,
                      },
                    }))
                  }
                  onSwitchToDisc={() => setShowDrum(false)}
                  sectionPanelBase={sectionPanelBase}
                  panelStyle={showValidation && missingSections.rearDrums ? requiredPanelStyle : null}
                />
              )}

              <div data-dev-section="1" data-dev-section-key="vhc-brakes-issues" data-dev-section-type="content-card" data-dev-section-parent="vhc-brakes-sections" style={{ ...sectionPanelBase, flex: "1 1 auto", minHeight: 0 }}>
                <div
                  data-dev-section="1"
                  data-dev-section-key="vhc-brakes-issues-toolbar"
                  data-dev-section-type="toolbar"
                  data-dev-section-parent="vhc-brakes-issues"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Issues Logged</h3>
                  <Button variant="ghost" size="sm" onClick={openConcernPopup} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    + Add Concern
                  </Button>
                </div>
                {activeIssueEntries.length === 0 ? (
                  <span style={{ fontSize: "13px", color: palette.textMuted, marginTop: "10px" }}>
                    No concerns recorded yet.
                  </span>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px", flex: 1, minHeight: 0, overflowY: "auto", paddingRight: "4px" }}>
                    {activeIssueEntries.map((issue, idx) => (
                      <div
                        key={`${issue.area}-${idx}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderRadius: "var(--section-card-radius)",
                          border: "none",
                          padding: "var(--control-padding)",
                          background: "var(--control-bg)",
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          setConcernPopup({
                            open: true,
                            category: issue.categoryKey,
                            tempConcern: { issue: issue.text || issue.issue || "", status: issue.status || "Red" },
                            editIndex: issue.index ?? idx,
                          })
                        }
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ fontSize: "13px", color: palette.textPrimary }}>{issue.text || issue.issue}</span>
                          <span style={{ fontSize: "11px", color: palette.textMuted }}>
                            {issue.area}
                          </span>
                        </div>
                        <span style={severityBadgeStyle(issue.status)}>{issue.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {concernPopup.open ? (
            <IssueReportPopup
              isOpen={concernPopup.open}
              title={areaLabels[concernPopup.category] || concernPopup.category}
              width="640px"
              onClose={resetConcernPopup}
            >
              <IssueReportAddSection
                heading={concernPopup.editIndex !== null ? "Update Issue" : "Add Issue"}
                addLabel={concernPopup.editIndex !== null ? "Save Issue" : "Add Issue"}
                descriptionControl={(
                  <IssueAutocomplete
                  sectionKey={areaSuggestionKeys[concernPopup.category] || "brakes_front_pads"}
                  value={concernPopup.tempConcern.issue}
                  onChange={(nextValue) =>
                    setConcernPopup((prev) => ({
                      ...prev,
                      tempConcern: { ...prev.tempConcern, issue: nextValue },
                    }))
                  }
                  onSelect={(nextValue) =>
                    setConcernPopup((prev) => ({
                      ...prev,
                      tempConcern: { ...prev.tempConcern, issue: nextValue },
                    }))
                  }
                  disabled={locked}
                  placeholder="Describe the issue…"
                  inputStyle={{
                    ...selectBaseStyle,
                    width: "100%",
                  }}
                />
                )}
                severity={concernPopup.tempConcern.status}
                onSeverityChange={(status) =>
                  setConcernPopup((prev) => ({ ...prev, tempConcern: { ...prev.tempConcern, status } }))
                }
                onAdd={() => {
                  if (!concernPopup.tempConcern.issue.trim()) return;
                  addConcern(concernPopup.category, concernPopup.tempConcern, concernPopup.editIndex);
                  resetConcernPopup();
                }}
                addDisabled={!concernPopup.tempConcern.issue.trim()}
                disabled={locked}
              />
              <IssueReportList
                count={activeIssueEntries.filter((issue) => issue.categoryKey === concernPopup.category).length}
                emptyMessage="No issues reported for this location."
              >
                {activeIssueEntries
                  .filter((issue) => issue.categoryKey === concernPopup.category)
                  .map((issue) => (
                    <IssueReportRow
                      key={`${issue.categoryKey}-${issue.index}`}
                      issue={issue}
                      description={issue.text || issue.issue}
                      severity={issue.status}
                      onSeverityChange={(status) => updateConcernStatus(issue.categoryKey, issue.index, status)}
                      onDelete={() => deleteConcern(issue.categoryKey, issue.index)}
                      disabled={locked}
                      mediaAction={(jobId || jobNumber) ? (
                        <SectionCameraButton
                          iconOnly
                          sectionKey="brakes"
                          concern={buildConcernRef({
                            section: "brakes",
                            category: issue.categoryKey,
                            categoryLabel: issue.areaLabel || issue.area || issue.categoryKey,
                            index: issue.index,
                            concern: issue,
                          })}
                          jobId={jobId}
                          jobNumber={jobNumber}
                          userId={userId}
                          disabled={locked}
                          onUploadComplete={onSectionMediaUploaded}
                        />
                      ) : null}
                    />
                  ))}
              </IssueReportList>
            </IssueReportPopup>
          ) : null}
        </div>
      </div>
    </VHCModalShell>
  );
}
