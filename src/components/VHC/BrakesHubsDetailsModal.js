// file location: src/components/VHC/BrakesHubsDetailsModal.js
import React, { useEffect, useMemo, useState } from "react";
import VHCModalShell, { buildModalButton } from "@/components/VHC/VHCModalShell";
import themeConfig, {
  createVhcButtonStyle,
  vhcModalContentStyles,
  popupOverlayStyles,
  popupCardStyles,
} from "@/styles/appTheme";
import BrakeDiagram from "@/components/VHC/BrakeDiagram";
import { DropdownField } from "@/components/dropdownAPI";

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

const getPadStatus = (value) => {
  const reading = typeof value === "number" ? value : parseFloat(value);
  if (Number.isNaN(reading)) return { text: "–", status: "unknown" };
  if (reading <= 2) return { text: `${reading.toFixed(1)} mm`, status: "critical" };
  if (reading <= 4) return { text: `${reading.toFixed(1)} mm`, status: "advisory" };
  return { text: `${reading.toFixed(1)} mm`, status: "good" };
};

const DIAGRAM_SEVERITY_RANK = {
  Red: 1,
  Amber: 2,
  Green: 3,
  critical: 1,
  advisory: 2,
  good: 3,
  unknown: 4,
};

const RANK_TO_DIAGRAM_STATUS = {
  1: "critical",
  2: "advisory",
  3: "good",
  4: "unknown",
};

const resolveDiagramRank = (value) => DIAGRAM_SEVERITY_RANK[value] ?? 4;
const mapRankToDiagramStatus = (rank) => RANK_TO_DIAGRAM_STATUS[rank] ?? "unknown";
const getConcernRank = (concerns = []) =>
  (concerns ?? []).reduce((minRank, concern) => {
    return Math.min(minRank, resolveDiagramRank(concern.status));
  }, 4);

const computeAxleSeverityRank = (padSection, discSection) => {
  const measurementStatus = getPadStatus(padSection.measurement).status;
  const measurementRank = resolveDiagramRank(measurementStatus);
  const padRank = resolveDiagramRank(padSection.status);
  const padConcernRank = getConcernRank(padSection.concerns);
  const discMeasurementRank = resolveDiagramRank(discSection.measurements.status);
  const discVisualRank = resolveDiagramRank(discSection.visual.status);
  const discConcernRank = getConcernRank(discSection.concerns);
  return Math.min(
    measurementRank,
    padRank,
    padConcernRank,
    discMeasurementRank,
    discVisualRank,
    discConcernRank,
  );
};

export default function BrakesHubsDetailsModal({ isOpen, onClose, onComplete, initialData }) {
  const normalisedInitial = useMemo(() => normaliseBrakesState(initialData), [initialData]);

  const [data, setData] = useState(normalisedInitial.data);
  const [showDrum, setShowDrum] = useState(normalisedInitial.showDrum);
  const [activeSide, setActiveSide] = useState("front");
  const [concernPopup, setConcernPopup] = useState({
    open: false,
    category: "frontPads",
    tempConcern: { issue: "", status: "Red" },
    editIndex: null,
  });

  useEffect(() => {
    setData(normalisedInitial.data);
    setShowDrum(normalisedInitial.showDrum);
  }, [normalisedInitial]);

  const padLabels = { frontPads: "Front Pads", rearPads: "Rear Pads" };
  const discLabels = { frontDiscs: "Front Discs", rearDiscs: "Rear Discs" };

  const contentWrapperStyle = {
    ...vhcModalContentStyles.contentWrapper,
    gap: "24px",
    height: "100%",
  };
  const sectionPanelBase = {
    ...vhcModalContentStyles.baseCard,
    flex: 1,
    gap: "12px",
    alignItems: "stretch",
    cursor: "default",
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
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
    background: status === "Red" ? "var(--danger-surface)" : "var(--warning-surface)",
    color: status === "Red" ? palette.danger : palette.warning,
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
    padding: "10px 12px",
    borderRadius: "12px",
    border: `1px solid ${palette.border}`,
    backgroundColor: palette.surface,
    color: palette.textPrimary,
    fontSize: "14px",
    outline: "none",
  };

  const dropdownFieldStyle = {
    width: "100%",
    border: "none",
    padding: 0,
    backgroundColor: "transparent",
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "12px",
    border: `1px solid ${palette.border}`,
    backgroundColor: palette.surface,
    color: palette.textPrimary,
    fontSize: "14px",
    outline: "none",
  };

  const concernItemStyle = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "12px",
    backgroundColor: palette.accentSurface,
    border: `1px solid ${palette.border}`,
  };

  const popupOverlayStyle = {
    ...popupOverlayStyles,
    zIndex: 1200,
    padding: "24px",
  };

  const popupCardStyle = {
    ...popupCardStyles,
    width: "min(360px, 90vw)",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  };

  const enhanceFocus = (event) => {
    event.target.style.borderColor = palette.accent;
  };

  const resetFocus = (event) => {
    event.target.style.borderColor = palette.border;
  };

  const updatePadMeasurement = (category, value) => {
    const sanitized = sanitizeNumericListInput(value);

    // Only calculate status if there's actual numeric content
    // This prevents premature status changes while typing
    const numbers = sanitized
      .replace(/[,\s]+$/g, "")
      .split(/[, ]+/)
      .map((v) => parseFloat(v.trim()))
      .filter((v) => !Number.isNaN(v));

    let newStatus = "Green";
    if (numbers.length > 0) {
      const min = Math.min(...numbers);
      if (min < 3) newStatus = "Red";
      else if (min < 5) newStatus = "Amber";
      else newStatus = "Green";
    }

    // Use functional setState to ensure we don't lose focus
    setData((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        measurement: sanitized,
        status: newStatus
      },
    }));
  };

  const updatePadStatus = (category, value) => {
    setData((prev) => ({ ...prev, [category]: { ...prev[category], status: value } }));
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

  const handleDiscMeasurementValue = (category, value) => {
    const sanitized = sanitizeNumericListInput(value);

    // Use functional setState to ensure consistent state updates
    setData((prev) => {
      const section = prev[category];
      if (!section) return prev;

      const nextValues = [sanitized];
      const thickness = sanitized.replace(/[,\s]+$/g, "");

      return {
        ...prev,
        [category]: {
          ...section,
          measurements: {
            ...section.measurements,
            values: nextValues,
            thickness,
          },
        },
      };
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

  const parsePadValue = (measurement) => {
    const first = (measurement || "")
      .split(/[, ]+/)
      .map((val) => val.trim())
      .find((val) => val !== "");
    const parsed = parseFloat(first);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const brakeDiagramValues = useMemo(() => {
    const frontSeverityRank = computeAxleSeverityRank(data.frontPads, data.frontDiscs);
    const frontValue = parsePadValue(data.frontPads.measurement);

    let rearValue, rearSeverityRank;

    if (showDrum) {
      // Map drum status to diagram severity
      const drumStatus = data.rearDrums.status;
      let drumSeverity = "unknown";
      if (drumStatus === "Good") drumSeverity = "good";
      else if (drumStatus === "Monitor") drumSeverity = "advisory";
      else if (drumStatus === "Replace") drumSeverity = "critical";

      rearValue = "drum";
      rearSeverityRank = resolveDiagramRank(drumSeverity);
    } else {
      rearSeverityRank = computeAxleSeverityRank(data.rearPads, data.rearDiscs);
      rearValue = parsePadValue(data.rearPads.measurement);
    }

    return {
      nsf: { value: frontValue, severity: mapRankToDiagramStatus(frontSeverityRank) },
      osf: { value: frontValue, severity: mapRankToDiagramStatus(frontSeverityRank) },
      nsr: { value: rearValue, severity: mapRankToDiagramStatus(rearSeverityRank), isDrum: showDrum },
      osr: { value: rearValue, severity: mapRankToDiagramStatus(rearSeverityRank), isDrum: showDrum },
    };
  }, [data, showDrum]);

  // ✅ New completion logic
  const isCompleteEnabled = () => {
    const discComplete = (section) => {
      if (!section) return false;
      const hasMeasurementValues = section.measurements.values?.some((value) => value && value.trim() !== "");
      const measurementReady = hasMeasurementValues && section.measurements.status;
      const visualReady = section.visual.status;
      return section.tab === "visual" ? Boolean(visualReady) : Boolean(measurementReady);
    };

    const frontPadMeasurement = (data.frontPads.measurement || "").trim();

    const frontPadsDone =
      frontPadMeasurement !== "" && data.frontPads.status !== "";
    const frontDiscsDone = discComplete(data.frontDiscs);

    if (!frontPadsDone || !frontDiscsDone) return false;

    // For drum brake mode: only require front pads + front discs + drum status
    if (showDrum) {
      return data.rearDrums.status !== "";
    }

    // For disc brake mode: require front pads + front discs + rear pads + rear discs
    const rearPadMeasurement = (data.rearPads.measurement || "").trim();
    const rearPadsDone = rearPadMeasurement !== "" && data.rearPads.status !== "";
    return rearPadsDone && discComplete(data.rearDiscs);
  };

  if (!isOpen) return null;

  const PadsSection = ({ category }) => {
    const padData = data[category];
    const title = padLabels[category] || "Pads";

    return (
      <div style={sectionPanelBase}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: palette.textPrimary, margin: 0 }}>
          {title}
        </h3>
      </div>

        <label style={fieldLabelStyle}>Pad Measurement (mm)</label>
        <input
          type="text"
          inputMode="decimal"
          value={padData.measurement}
          onChange={(e) => updatePadMeasurement(category, e.target.value)}
          placeholder="Enter readings (e.g. 6.0, 5.5, 5.0)"
          autoComplete="off"
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "12px",
            border: `1px solid ${palette.border}`,
            backgroundColor: palette.surface,
            fontSize: "14px",
            color: palette.textPrimary,
            outline: "none",
          }}
          onFocus={enhanceFocus}
          onBlur={resetFocus}
        />

        <label style={fieldLabelStyle}>Status</label>
        <DropdownField
          value={padData.status}
          onChange={(e) => updatePadStatus(category, e.target.value)}
          style={dropdownFieldStyle}
          onFocus={enhanceFocus}
          onBlur={resetFocus}
        >
          <option>Red</option>
          <option>Amber</option>
          <option>Green</option>
        </DropdownField>
      </div>
    );
  };

  // ✅ Discs Section
  const DiscsSection = ({ category, showDrumButton }) => {
    const discData = data[category];
    const title = discLabels[category] || "Discs";

    const tabWrapperStyle = {
      display: "inline-flex",
      gap: "8px",
      padding: "4px",
      borderRadius: "999px",
      backgroundColor: palette.accentSurface,
      marginTop: "8px",
    };

    const tabButtonStyle = (active) => ({
      ...createVhcButtonStyle(active ? "primary" : "ghost"),
      backgroundColor: active ? palette.accent : "transparent",
      color: active ? "var(--surface)" : palette.textPrimary,
      padding: "8px 16px",
      fontSize: "12px",
      border: active ? "none" : "1px solid transparent",
    });

    return (
      <div style={sectionPanelBase}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: palette.textPrimary, margin: 0 }}>
          {title}
        </h3>
      </div>

        <div style={tabWrapperStyle}>
          {["measurements", "visual"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() =>
                setData((prev) => ({
                  ...prev,
                  [category]: { ...prev[category], tab },
                }))
              }
              style={tabButtonStyle(discData.tab === tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {discData.tab === "measurements" && (
          <>
            <label style={fieldLabelStyle}>Disc Thickness (mm)</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input
                type="text"
                value={discData.measurements.values?.[0] || ""}
                onChange={(e) => handleDiscMeasurementValue(category, e.target.value)}
                placeholder="Enter readings separated by commas or spaces"
                inputMode="decimal"
                autoComplete="off"
                style={inputStyle}
                onFocus={enhanceFocus}
                onBlur={resetFocus}
              />
            </div>

            <label style={fieldLabelStyle}>Status</label>
            <DropdownField
              value={discData.measurements.status}
              onChange={(e) =>
                updateDisc(category, "measurements", { status: e.target.value })
              }
              style={dropdownFieldStyle}
              onFocus={enhanceFocus}
              onBlur={resetFocus}
            >
              <option>Red</option>
              <option>Amber</option>
              <option>Green</option>
            </DropdownField>
          </>
        )}

        {discData.tab === "visual" && (
          <>
            <label style={fieldLabelStyle}>Visual Inspection</label>
            <DropdownField
              value={discData.visual.status}
              onChange={(e) =>
                updateDisc(category, "visual", { status: e.target.value })
              }
              style={dropdownFieldStyle}
              onFocus={enhanceFocus}
              onBlur={resetFocus}
            >
              <option>Red</option>
              <option>Amber</option>
              <option>Green</option>
            </DropdownField>
          </>
        )}

        {showDrumButton && (
          <button
            type="button"
            onClick={() => setShowDrum(true)}
            style={{
              ...buildModalButton("ghost"),
              border: `1px dashed ${palette.accent}`,
              color: palette.accent,
              background: "transparent",
              padding: "10px 16px",
              marginTop: "8px",
            }}
          >
            Switch to Drum Brakes
          </button>
        )}
      </div>
    );
  };

  // ✅ Drum Brakes Section
  const DrumBrakesSection = () => (
    <div style={sectionPanelBase}>
      <h3 style={{ fontSize: "16px", fontWeight: 700, color: palette.textPrimary, margin: 0 }}>
        Drum Brakes
      </h3>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          marginTop: "8px",
        }}
      >
        {["Good", "Monitor", "Replace"].map((label) => {
          const active = data.rearDrums.status === label;
          return (
            <button
              key={label}
              type="button"
              onClick={() =>
        setData((prev) => ({
          ...prev,
          rearDrums: {
            ...prev.rearDrums,
            status: label,
          },
        }))
              }
              style={{
                ...createVhcButtonStyle(active ? "primary" : "ghost"),
                padding: "10px 18px",
                backgroundColor: active ? palette.accent : palette.surface,
                color: active ? "var(--surface)" : palette.textPrimary,
                border: active ? "none" : `1px solid ${palette.border}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowDrum(false)}
        style={{
          ...buildModalButton("ghost"),
          alignSelf: "flex-start",
          padding: "10px 18px",
          color: palette.accent,
          border: `1px dashed ${palette.accent}`,
          background: "transparent",
          marginTop: "8px",
        }}
      >
        Switch to Disc Brakes
      </button>
    </div>
  );

  return (
    <VHCModalShell
      isOpen={isOpen}
      title="Brakes & Hubs"
      width="1280px"
      height="780px"
      hideCloseButton
      onClose={handleClose}
      footer={
        <>
          <button type="button" onClick={handleClose} style={buildModalButton("secondary")}>
            Close
          </button>
          <button
            type="button"
            onClick={() => onComplete(buildPayload())}
            disabled={!isCompleteEnabled()}
            style={buildModalButton("primary", { disabled: !isCompleteEnabled() })}
          >
            Save & Complete
          </button>
        </>
      }
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
            <BrakeDiagram
              brakes={brakeDiagramValues}
              activeBrake={activeSide}
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
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              position: "relative",
              minHeight: 0,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: palette.accent }}>
                {activeSide === "front" ? "Front Axle Checks" : showDrum ? "Rear Drum Checks" : "Rear Axle Checks"}
              </h2>
            </div>

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
              {activeSide === "front" && (
                <>
                  <PadsSection category="frontPads" />
                  <DiscsSection category="frontDiscs" />
                </>
              )}

              {activeSide === "rear" && !showDrum && (
                <>
                  <PadsSection category="rearPads" />
                  <DiscsSection category="rearDiscs" showDrumButton />
                </>
              )}

              {activeSide === "rear" && showDrum && <DrumBrakesSection />}

              <div style={{ ...sectionPanelBase, flex: "0 0 auto" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Issues Logged</h3>
                  <button type="button" onClick={openConcernPopup} style={{ ...buildModalButton("ghost"), gap: "8px" }}>
                    + Add Concern
                  </button>
                </div>
                {activeIssueEntries.length === 0 ? (
                  <span style={{ fontSize: "13px", color: palette.textMuted, marginTop: "10px" }}>
                    No concerns recorded yet.
                  </span>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                    {activeIssueEntries.map((issue, idx) => (
                      <div
                        key={`${issue.area}-${idx}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderRadius: "12px",
                          border: `1px solid ${palette.border}`,
                          padding: "10px 12px",
                          background: palette.surface,
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

          {concernPopup.open && (
            <div style={popupOverlayStyle}>
              <div style={popupCardStyle}>
                <h4 style={{ fontSize: "16px", fontWeight: 700, color: palette.textPrimary, margin: 0 }}>
                  {concernPopup.editIndex !== null ? "Edit Concern" : "Add Concern"}
                </h4>
                <span style={{ ...fieldLabelStyle, display: "block" }}>
                  Area:{" "}
                  <strong style={{ color: palette.textPrimary }}>
                    {areaLabels[concernPopup.category] || concernPopup.category}
                  </strong>
                </span>
                <label style={fieldLabelStyle}>Concern</label>
                <input
                  type="text"
                  value={concernPopup.tempConcern.issue}
                  onChange={(e) =>
                    setConcernPopup((prev) => ({
                      ...prev,
                      tempConcern: { ...prev.tempConcern, issue: e.target.value },
                    }))
                  }
                  placeholder="Describe the issue…"
                  style={{
                    ...selectBaseStyle,
                    width: "100%",
                  }}
                  onFocus={enhanceFocus}
                  onBlur={resetFocus}
                />

                <label style={fieldLabelStyle}>Severity</label>
                <DropdownField
                  value={concernPopup.tempConcern.status}
                  onChange={(e) =>
                    setConcernPopup((prev) => ({
                      ...prev,
                      tempConcern: { ...prev.tempConcern, status: e.target.value },
                    }))
                  }
                  style={dropdownFieldStyle}
                  onFocus={enhanceFocus}
                  onBlur={resetFocus}
                >
                  <option>Red</option>
                  <option>Amber</option>
                </DropdownField>

                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginTop: "16px", flexWrap: "wrap" }}>
                  {concernPopup.editIndex !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        deleteConcern(concernPopup.category, concernPopup.editIndex);
                        resetConcernPopup();
                      }}
                      style={{ ...buildModalButton("ghost"), color: palette.danger }}
                    >
                      Delete
                    </button>
                  )}
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button type="button" onClick={resetConcernPopup} style={buildModalButton("ghost")}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!concernPopup.tempConcern.issue.trim()) return;
                        addConcern(concernPopup.category, concernPopup.tempConcern, concernPopup.editIndex);
                        resetConcernPopup();
                      }}
                      style={buildModalButton("primary")}
                    >
                      {concernPopup.editIndex !== null ? "Save" : "Add Concern"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </VHCModalShell>
  );
}
