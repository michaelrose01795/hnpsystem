// file location: src/components/VHC/VhcDetailsPanel.js
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { summariseTechnicianVhc } from "@/lib/vhc/summary";
import { saveChecksheet } from "@/lib/database/jobs";
import WheelsTyresDetailsModal from "@/components/VHC/WheelsTyresDetailsModal";
import BrakesHubsDetailsModal from "@/components/VHC/BrakesHubsDetailsModal";
import ServiceIndicatorDetailsModal from "@/components/VHC/ServiceIndicatorDetailsModal";
import ExternalDetailsModal from "@/components/VHC/ExternalDetailsModal";
import InternalElectricsDetailsModal from "@/components/VHC/InternalElectricsDetailsModal";
import UndersideDetailsModal from "@/components/VHC/UndersideDetailsModal";
import PartSearchModal from "@/components/VHC/PartSearchModal";
import PrePickLocationModal from "@/components/VHC/PrePickLocationModal";

const STATUS_BADGES = {
  red: "var(--danger)",
  amber: "var(--warning)",
  green: "var(--info)",
  grey: "var(--info)",
};

const TAB_OPTIONS = [
  { id: "summary", label: "Summary" },
  { id: "health-check", label: "Health Check" },
  { id: "parts-identified", label: "Parts Identified" },
  { id: "parts-authorized", label: "Parts Authorized" },
  { id: "parts-on-order", label: "Parts On Order" },
  { id: "photos", label: "Photos" },
  { id: "videos", label: "Videos" },
];

const HEALTH_SECTION_CONFIG = [
  {
    key: "wheelsTyres",
    label: "Wheels & Tyres",
    aliases: ["Wheels & Tyres"],
  },
  {
    key: "brakesHubs",
    label: "Brakes & Hubs",
    aliases: ["Brakes & Hubs"],
  },
  {
    key: "serviceIndicator",
    label: "Service Indicator & Under Bonnet",
    aliases: ["Service Indicator & Under Bonnet"],
  },
  {
    key: "externalInspection",
    label: "External",
    aliases: ["External", "External / Drive-in Inspection"],
  },
  {
    key: "internalElectrics",
    label: "Internal",
    aliases: ["Internal / Lamps / Electrics"],
  },
  {
    key: "underside",
    label: "Underside",
    aliases: ["Underside", "Underside Inspection"],
  },
];

const createDefaultInternalElectrics = () => ({
  "Lights Front": { concerns: [] },
  "Lights Rear": { concerns: [] },
  "Lights Interior": { concerns: [] },
  "Horn/Washers/Wipers": { concerns: [] },
  "Air Con/Heating/Ventilation": { concerns: [] },
  "Warning Lamps": { concerns: [] },
  Seatbelt: { concerns: [] },
  Miscellaneous: { concerns: [] },
});

const createDefaultUnderside = () => ({
  "Exhaust System/Catalyst": { concerns: [] },
  Steering: { concerns: [] },
  "Front Suspension": { concerns: [] },
  "Rear Suspension": { concerns: [] },
  "Driveshafts/Oil Leaks": { concerns: [] },
  Miscellaneous: { concerns: [] },
});

const baseVhcPayload = () => ({
  wheelsTyres: null,
  brakesHubs: null,
  serviceIndicator: { serviceChoice: "", oilStatus: "", concerns: [] },
  externalInspection: null,
  internalElectrics: createDefaultInternalElectrics(),
  underside: createDefaultUnderside(),
});

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const normaliseConcernEntries = (list) =>
  ensureArray(list).map((entry) => ({
    ...entry,
    concerns: ensureArray(entry?.concerns),
  }));

const mergeEntries = (baseEntries, source) => {
  const next = { ...baseEntries };
  if (source && typeof source === "object") {
    Object.entries(source).forEach(([key, entry]) => {
      next[key] = {
        ...(entry || {}),
        concerns: ensureArray(entry?.concerns),
      };
    });
  }
  return next;
};

const normaliseBrakesPayload = (source) => {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }

  const normalisePad = (pad) => {
    if (!pad || typeof pad !== "object") return null;
    return {
      ...pad,
      measurement: pad.measurement ?? "",
      concerns: ensureArray(pad.concerns),
    };
  };

  const normaliseDisc = (disc) => {
    if (!disc || typeof disc !== "object") return null;
    return {
      ...disc,
      measurements: {
        ...(disc.measurements || {}),
        values: ensureArray(disc.measurements?.values),
      },
      visual: {
        ...(disc.visual || {}),
      },
      concerns: ensureArray(disc.concerns),
    };
  };

  const next = {};
  const frontPads = normalisePad(source.frontPads);
  if (frontPads) next.frontPads = frontPads;
  const rearPads = normalisePad(source.rearPads);
  if (rearPads) next.rearPads = rearPads;
  const frontDiscs = normaliseDisc(source.frontDiscs);
  if (frontDiscs) next.frontDiscs = frontDiscs;
  const rearDiscs = normaliseDisc(source.rearDiscs);
  if (rearDiscs) next.rearDiscs = rearDiscs;
  if (source.rearDrums && typeof source.rearDrums === "object") {
    next.rearDrums = {
      ...source.rearDrums,
      concerns: ensureArray(source.rearDrums.concerns),
    };
  }
  if (source._brakeType) {
    next._brakeType = source._brakeType;
  }
  return Object.keys(next).length > 0 ? next : null;
};

const normaliseExternalInspectionPayload = (source) => {
  if (!source) return null;
  if (Array.isArray(source)) {
    const mapped = {};
    source.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") return;
      const heading = entry.heading || entry.title || entry.name || `Item ${index + 1}`;
      mapped[heading] = {
        ...entry,
        concerns: ensureArray(entry.concerns),
      };
    });
    return Object.keys(mapped).length > 0 ? mapped : null;
  }
  if (typeof source === "object") {
    const mapped = {};
    Object.entries(source).forEach(([key, entry]) => {
      mapped[key] = {
        ...(entry || {}),
        concerns: ensureArray(entry?.concerns),
      };
    });
    return mapped;
  }
  return null;
};

const buildVhcPayload = (source = {}) => {
  const base = baseVhcPayload();
  const brakesHubs = normaliseBrakesPayload(source.brakesHubs);
  return {
    wheelsTyres: source.wheelsTyres || null,
    brakesHubs: brakesHubs ?? normaliseConcernEntries(source.brakesHubs),
    serviceIndicator: {
      serviceChoice: source.serviceIndicator?.serviceChoice || "",
      oilStatus: source.serviceIndicator?.oilStatus || "",
      concerns: ensureArray(source.serviceIndicator?.concerns),
    },
    externalInspection: normaliseExternalInspectionPayload(source.externalInspection),
    internalElectrics: mergeEntries(base.internalElectrics, source.internalElectrics),
    underside: mergeEntries(base.underside, source.underside),
  };
};

const WHEEL_POSITION_KEYS = ["NSF", "OSF", "NSR", "OSR"];
const ISOLATED_SUMMARY_CATEGORIES = new Set([
  "wheels_tyres",
  "external_inspection",
  "internal_electrics",
  "underside",
]);

const CATEGORY_DEFINITIONS = [
  {
    id: "wheels_tyres",
    label: "Wheels & Tyres",
    keywords: ["wheel", "tyre", "tire", "rim", "alloy", "wheels", "tyres"],
  },
  {
    id: "brakes_hubs",
    label: "Brakes & Hubs",
    keywords: ["brake", "pad", "disc", "hub", "caliper"],
  },
  {
    id: "service_indicator",
    label: "Service Indicator & Under Bonnet",
    keywords: ["service indicator", "under bonnet", "bonnet", "engine", "under-bonnet"],
  },
  {
    id: "external_inspection",
    label: "External",
    keywords: ["external", "drive-in", "drive in", "bodywork", "exterior"],
  },
  {
    id: "internal_electrics",
    label: "Internal",
    keywords: ["internal", "lamp", "lamp", "electrics", "interior", "dashboard"],
  },
  {
    id: "underside",
    label: "Underside",
    keywords: ["underside", "under side", "underbody", "under-body"],
  },
];

const LOCATION_TOKENS = [
  { key: "front_left", terms: ["front left", "nearside front", "nsf", "left front"] },
  { key: "front_right", terms: ["front right", "offside front", "osf", "right front"] },
  { key: "rear_left", terms: ["rear left", "nearside rear", "nsr", "left rear"] },
  { key: "rear_right", terms: ["rear right", "offside rear", "osr", "right rear"] },
  { key: "front", terms: ["front"] },
  { key: "rear", terms: ["rear"] },
];
const LOCATION_LABELS = {
  front_left: "Nearside Front",
  front_right: "Offside Front",
  rear_left: "Nearside Rear",
  rear_right: "Offside Rear",
  front: "Front",
  rear: "Rear",
};

const SEVERITY_RANK = { red: 3, amber: 2, grey: 1, green: 0 };
const RANK_TO_SEVERITY = {
  3: "red",
  2: "amber",
  1: "grey",
  0: "green",
};
const LABOUR_RATE = 155;
const SEVERITY_META = {
  red: { title: "Red Repairs", description: "", accent: "var(--danger)" },
  amber: { title: "Amber Repairs", description: "Advisory items that should be considered soon.", accent: "var(--warning)" },
};

const COLOUR_CLASS = {
  red: "var(--danger-surface)",
  amber: "var(--warning-surface)",
  green: "var(--success-surface)",
  grey: "var(--info-surface)",
};

const SEVERITY_THEME = {
  red: { background: "var(--danger-surface)", border: "var(--danger-surface)", text: "var(--danger)", hover: "#ffd4d4" },
  amber: { background: "var(--warning-surface)", border: "var(--warning-surface)", text: "var(--danger-dark)", hover: "#ffe6cc" },
  green: { background: "var(--success-surface)", border: "var(--success)", text: "var(--info-dark)", hover: "var(--success-surface)" },
  grey: { background: "var(--info-surface)", border: "var(--accent-purple-surface)", text: "var(--info-dark)", hover: "var(--accent-purple-surface)" },
};

const PANEL_SECTION_STYLE = {
  background: "var(--surface)",
  borderRadius: "18px",
  border: "1px solid var(--surface-light)",
  boxShadow: "none",
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};
const TAB_ROW_STYLE = {
  display: "flex",
  borderBottom: "1px solid var(--accent-purple-surface)",
  gap: "8px",
  flexWrap: "wrap",
};
const TAB_CONTENT_STYLE = {
  display: "flex",
  flexDirection: "column",
  gap: "24px",
};

const normalizeText = (value = "") => value.toString().toLowerCase();

const resolveCategoryForItem = (sectionName = "", itemLabel = "") => {
  const reference = normalizeText(`${sectionName} ${itemLabel}`);
  for (const definition of CATEGORY_DEFINITIONS) {
    if (definition.keywords.some((keyword) => reference.includes(keyword))) {
      return { id: definition.id, label: definition.label };
    }
  }
  const fallbackId = normalizeText(sectionName).replace(/\s+/g, "-") || "general";
  return {
    id: `general-${fallbackId}`,
    label: sectionName || "General",
  };
};

const resolveLocationKey = (item = {}) => {
  const haystack = normalizeText(
    `${item.label || ""} ${item.issue_title || ""} ${item.notes || item.issue_description || ""}`
  );
  for (const token of LOCATION_TOKENS) {
    if (token.terms.some((term) => haystack.includes(term))) {
      return token.key;
    }
  }
  return null;
};

const deriveBrakeLocationKey = (item = {}) => {
  const locationReference = normalizeText(item.location || "");
  if (locationReference.includes("front")) return "front";
  if (locationReference.includes("rear")) return "rear";
  const labelReference = normalizeText(item.label || item.sectionName || "");
  if (labelReference.includes("front")) return "front";
  if (labelReference.includes("rear")) return "rear";
  return null;
};

const resolveWheelPositionFromItem = (item = {}) => {
  if (item.wheelKey) {
    return item.wheelKey.toString().toUpperCase();
  }
  const label = (item.label || item.sectionName || "").toUpperCase();
  const resolved = WHEEL_POSITION_KEYS.find((key) => label.includes(key));
  return resolved ? resolved.toUpperCase() : null;
};

const formatStatusLabel = (status) => {
  if (!status) return null;
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

const safeJsonParse = (payload) => {
  if (!payload) return null;
  if (typeof payload === "object") return payload;
  try {
    return JSON.parse(payload);
  } catch (_err) {
    return null;
  }
};

const emptyPlaceholder = (value) => (value || value === 0 ? value : "—");

const normaliseColour = (value) => {
  if (!value) return null;
  const colour = value.toString().toLowerCase();
  if (colour.includes("red")) return "red";
  if (colour.includes("amber") || colour.includes("yellow")) return "amber";
  if (colour.includes("green")) return "green";
  if (colour.includes("grey") || colour.includes("gray")) return "grey";
  return null;
};

const deriveHighestSeverity = (statuses = []) => {
  let highest = null;
  statuses.forEach((status) => {
    const colour = normaliseColour(status);
    if (!colour) return;
    if (!highest || (SEVERITY_RANK[colour] ?? -1) > (SEVERITY_RANK[highest] ?? -1)) {
      highest = colour;
    }
  });
  return highest;
};

const formatPlainTreadReadings = (tread = {}) => {
  const segments = ["outer", "middle", "inner"].map((key) => {
    const reading = tread?.[key];
    if (reading === null || reading === undefined || reading === "") return null;
    const numeric = Number.parseFloat(reading);
    if (Number.isFinite(numeric)) {
      const fixed = numeric.toFixed(1).replace(/\.0$/, "");
      return `${fixed}mm`;
    }
    const text = reading.toString().trim();
    if (!text) return null;
    return text.endsWith("mm") ? text : `${text}mm`;
  });
  return segments.filter(Boolean);
};

const formatTreadDepthSummary = (tread = {}) => {
  const segments = [
    ["outer", "Outer"],
    ["middle", "Middle"],
    ["inner", "Inner"],
  ]
    .map(([key, label]) => {
      const raw = tread?.[key];
      if (raw === null || raw === undefined || raw === "") return null;
      const numeric = Number.parseFloat(raw);
      const formatted = Number.isFinite(numeric)
        ? `${numeric.toFixed(1).replace(/\.0$/, "")}mm`
        : raw.toString().trim();
      if (!formatted) return null;
      const safeValue = formatted.toLowerCase().includes("mm") ? formatted : `${formatted}mm`;
      return `${label} ${safeValue}`;
    })
    .filter(Boolean);
  return segments.length > 0 ? segments.join(" • ") : null;
};

const formatMeasurement = (value) => {
  if (!value && value !== 0) return null;
  if (Array.isArray(value)) {
    const merged = value.filter(Boolean).map((item) => item.toString().trim()).join(" / ");
    return merged || null;
  }
  if (typeof value === "object") {
    const merged = Object.values(value)
      .filter(Boolean)
      .map((item) => item.toString().trim())
      .join(" / ");
    return merged || null;
  }
  return value.toString();
};

const collectStatusesFromItems = (items = []) => {
  const statuses = [];
  items.forEach((item) => {
    const itemStatus = normaliseColour(item?.status);
    if (itemStatus) statuses.push(itemStatus);
    (Array.isArray(item?.concerns) ? item.concerns : []).forEach((concern) => {
      const concernStatus = normaliseColour(concern?.status);
      if (concernStatus) statuses.push(concernStatus);
    });
  });
  return statuses;
};

const collectStatusesFromRawData = (rawData) => {
  if (!rawData) return [];
  const entries = Array.isArray(rawData)
    ? rawData
    : typeof rawData === "object"
    ? Array.isArray(rawData.concerns)
      ? [rawData]
      : Object.values(rawData)
    : [];
  const statuses = [];
  entries.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const entryStatus = normaliseColour(entry.status);
    if (entryStatus) statuses.push(entryStatus);
    (Array.isArray(entry.concerns) ? entry.concerns : []).forEach((concern) => {
      const concernStatus = normaliseColour(concern?.status);
      if (concernStatus) statuses.push(concernStatus);
    });
  });
  return statuses;
};

const deriveSectionSeverity = (section = {}, rawData = null) => {
  const metrics = section?.metrics || {};
  if ((metrics.red || 0) > 0) return "red";
  if ((metrics.amber || 0) > 0) return "amber";
  if ((metrics.grey || 0) > 0) return "grey";
  if ((metrics.total || 0) > 0) return "green";

  const items = Array.isArray(section?.items) ? section.items : [];
  const statuses = [...collectStatusesFromItems(items), ...collectStatusesFromRawData(rawData)];
  if (statuses.length === 0) return null;

  if (statuses.includes("red")) return "red";
  if (statuses.includes("amber")) return "amber";
  if (statuses.includes("grey")) return "grey";
  if (statuses.includes("green")) return "green";
  return null;
};

const buildSeverityBadgeStyles = (status) => {
  const colour = normaliseColour(status);
  return {
    background: (colour && SEVERITY_THEME[colour]?.background) || COLOUR_CLASS[colour] || "var(--info-surface)",
    color: (colour && SEVERITY_THEME[colour]?.text) || STATUS_BADGES[colour] || "var(--info-dark)",
  };
};

const mapRows = (rows = []) => {
  if (!Array.isArray(rows)) return [];
  return rows.filter((entry) => typeof entry === "string" && entry.trim().length > 0);
};

const determineItemSeverity = (item = {}) => {
  const direct = normaliseColour(item.status);
  if (direct === "red" || direct === "amber") return direct;
  const concernSeverity = (item.concerns || [])
    .map((concern) => normaliseColour(concern?.status))
    .find((status) => status === "red" || status === "amber");
  if (concernSeverity) return concernSeverity;
  if (direct) return direct;
  return null;
};

const HealthSectionCard = ({ config, section, rawData, onOpen }) => {
  const metrics = section?.metrics || {};
  const severity = deriveSectionSeverity(section, rawData);
  const severityLabel = severity
    ? `${severity.charAt(0).toUpperCase()}${severity.slice(1)} ${
        severity === "green" ? "status" : "issues"
      }`
    : "No status";
  const items = Array.isArray(section?.items) ? section.items : [];
  const hasItems = items.length > 0;

  const headerBadgeBase = {
    padding: "4px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
    border: "1px solid var(--accent-purple-surface)",
    background: "var(--info-surface)",
    color: "var(--info-dark)",
  };

  return (
    <div
      style={{
        border: "1px solid var(--accent-purple-surface)",
        borderRadius: "16px",
        background: "var(--surface)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ flex: 1, minWidth: "220px" }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--accent-purple)" }}>
            {config.label}
          </h3>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            alignItems: "flex-end",
            minWidth: "200px",
          }}
        >
          <span
            style={{
              ...headerBadgeBase,
              ...(severity ? buildSeverityBadgeStyles(severity) : {}),
              textTransform: "capitalize",
            }}
          >
            {severity ? severityLabel : "No issues"}
          </span>
          <span style={headerBadgeBase}>
            {(metrics.total ?? 0).toString()} item{(metrics.total ?? 0) === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={() => onOpen && onOpen(config.key)}
            style={{
              padding: "8px 14px",
              borderRadius: "10px",
              border: "1px solid var(--primary)",
              background: "var(--primary)",
              color: "var(--surface)",
              fontWeight: 600,
              cursor: onOpen ? "pointer" : "not-allowed",
              opacity: onOpen ? 1 : 0.6,
            }}
            disabled={!onOpen}
          >
            Open
          </button>
        </div>
      </div>

      {hasItems ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {items.map((item, idx) => {
            const rows = mapRows(item.rows);
            const concerns = Array.isArray(item.concerns) ? item.concerns.filter(Boolean) : [];
            const itemSeverity = determineItemSeverity(item);
            const theme = itemSeverity ? SEVERITY_THEME[itemSeverity] : null;
            return (
              <div
                key={`${config.key}-${idx}-${item.heading || item.label || "item"}`}
                style={{
                  border: `1px solid ${theme?.border || "var(--info-surface)"}`,
                  borderRadius: "12px",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  background: theme?.background || "var(--info-surface)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: "200px" }}>
                    <strong style={{ color: "var(--accent-purple)", fontSize: "14px" }}>
                      {item.heading || item.label || `Item ${idx + 1}`}
                    </strong>
                    {item.notes ? (
                      <p style={{ margin: "4px 0 0", color: "var(--info)", fontSize: "13px" }}>{item.notes}</p>
                    ) : null}
                  </div>
                  {item.status ? (
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 600,
                        textTransform: "capitalize",
                        ...buildSeverityBadgeStyles(item.status),
                      }}
                    >
                      {normaliseColour(item.status) || item.status}
                    </span>
                  ) : null}
                </div>
                {rows.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: "18px", color: "var(--info-dark)", fontSize: "13px" }}>
                    {rows.map((row, rowIdx) => (
                      <li key={`${config.key}-${idx}-row-${rowIdx}`} style={{ marginBottom: "4px" }}>
                        {row}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {concerns.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {concerns.map((concern, concernIdx) => (
                      <div
                        key={`${config.key}-${idx}-concern-${concernIdx}`}
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "flex-start",
                          fontSize: "13px",
                          color: "var(--info-dark)",
                          background: SEVERITY_THEME[normaliseColour(concern.status)]?.background || "var(--surface)",
                          borderRadius: "10px",
                          padding: "8px 10px",
                        }}
                      >
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "8px",
                            fontSize: "11px",
                            fontWeight: 600,
                            textTransform: "capitalize",
                            ...buildSeverityBadgeStyles(concern.status),
                          }}
                        >
                          {normaliseColour(concern.status) || concern.status || "note"}
                        </span>
                        <span>{concern.text || concern.notes || "Concern recorded"}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            border: "1px dashed var(--accent-purple)",
            borderRadius: "12px",
            padding: "16px",
            background: "var(--info-surface)",
            color: "var(--info)",
            fontSize: "13px",
          }}
        >
          No technician entries have been captured for this section yet.
        </div>
      )}
    </div>
  );
};

export default function VhcDetailsPanel({ jobNumber, showNavigation = true, readOnly = false, customActions = null, onCheckboxesComplete = null }) {
  const router = useRouter();
  const resolvedJobNumber = jobNumber || router.query?.jobNumber;

  const [job, setJob] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [vhcData, setVhcData] = useState(baseVhcPayload());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [itemEntries, setItemEntries] = useState({});
  const [severitySelections, setSeveritySelections] = useState({ red: [], amber: [] });
  const [activeSection, setActiveSection] = useState(null);
  const [sectionSaveStatus, setSectionSaveStatus] = useState("idle");
  const [sectionSaveError, setSectionSaveError] = useState("");
  const [lastSectionSavedAt, setLastSectionSavedAt] = useState(null);
  const [partsNotRequired, setPartsNotRequired] = useState(new Set());
  const [selectedVhcItem, setSelectedVhcItem] = useState(null);
  const [isPartSearchModalOpen, setIsPartSearchModalOpen] = useState(false);
  const [isPrePickModalOpen, setIsPrePickModalOpen] = useState(false);
  const [selectedPartForJob, setSelectedPartForJob] = useState(null);
  const [addingPartToJob, setAddingPartToJob] = useState(false);
  const [expandedVhcItems, setExpandedVhcItems] = useState(new Set());
  const [partDetails, setPartDetails] = useState({});
  const [vhcIdAliases, setVhcIdAliases] = useState({});
  const [vhcItemAliasRecords, setVhcItemAliasRecords] = useState([]);
  const [removingPartIds, setRemovingPartIds] = useState(new Set());

  const resolveCanonicalVhcId = useCallback(
    (vhcId) => {
      if (vhcId === null || vhcId === undefined) return "";
      const key = String(vhcId);
      const alias = vhcIdAliases[key];
      return alias ? String(alias) : key;
    },
    [vhcIdAliases]
  );

  const canonicalToDisplayMap = useMemo(() => {
    const map = new Map();
    Object.entries(vhcIdAliases).forEach(([displayId, canonicalId]) => {
      if (canonicalId === null || canonicalId === undefined) return;
      const canonicalKey = String(canonicalId);
      if (!canonicalKey) return;
      map.set(canonicalKey, displayId);
    });
    return map;
  }, [vhcIdAliases]);

  const upsertVhcItemAlias = useCallback(
    async (displayId, canonicalId) => {
      if (!displayId || canonicalId === null || canonicalId === undefined) return;
      const canonicalValue = String(canonicalId);

      setVhcIdAliases((prev) => {
        if (prev[displayId] === canonicalValue) return prev;
        return { ...prev, [displayId]: canonicalValue };
      });

      if (!job?.id) return;

      try {
        const response = await fetch("/api/vhc/item-aliases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: job.id,
            displayId,
            vhcItemId: canonicalValue,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Failed to persist VHC alias");
        }

        if (data.alias) {
          setVhcItemAliasRecords((prev) => {
            const others = prev.filter((entry) => entry.display_id !== data.alias.display_id);
            return [...others, data.alias];
          });
        }
      } catch (error) {
        console.error("Failed to persist VHC alias:", error);
      }
    },
    [job?.id]
  );

  const removeVhcItemAlias = useCallback(
    async (displayId, canonicalId = null) => {
      if (!displayId) return;
      setVhcIdAliases((prev) => {
        if (!prev[displayId]) return prev;
        const next = { ...prev };
        delete next[displayId];
        return next;
      });
      setVhcItemAliasRecords((prev) => prev.filter((entry) => entry.display_id !== displayId));

      if (!job?.id) return;

      try {
        const response = await fetch("/api/vhc/item-aliases", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: job.id,
            displayId,
            vhcItemId: canonicalId ? String(canonicalId) : null,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Failed to remove VHC alias");
        }
      } catch (error) {
        console.error("Failed to remove VHC alias:", error);
      }
    },
    [job?.id]
  );

  const warrantyRows = useMemo(() => {
    const rows = new Set();
    Object.entries(partDetails).forEach(([key, detail]) => {
      if (!detail || detail.warranty !== true) return;
      const [vhcKey] = key.split("-");
      if (vhcKey) {
        rows.add(vhcKey);
      }
    });
    return rows;
  }, [partDetails]);

  const containerPadding = showNavigation ? "24px" : "0";
  const renderStatusMessage = (message, color = "var(--info)") => (
    <div style={{ padding: containerPadding, color }}>{message}</div>
  );

  const persistVhcSections = useCallback(
    async (payload) => {
      if (!resolvedJobNumber) return false;
      try {
        setSectionSaveStatus("saving");
        setSectionSaveError("");
        const result = await saveChecksheet(resolvedJobNumber, payload);
        if (!result?.success) {
          setSectionSaveStatus("error");
          setSectionSaveError(result?.error?.message || "Failed to save VHC data.");
          return false;
        }
        setSectionSaveStatus("saved");
        setLastSectionSavedAt(new Date());
        return true;
      } catch (err) {
        console.error("Failed to save VHC sections", err);
        setSectionSaveStatus("error");
        setSectionSaveError(err.message || "Failed to save VHC data.");
        return false;
      }
    },
    [resolvedJobNumber]
  );

  useEffect(() => {
    if (!resolvedJobNumber) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const jobPromise = supabase
          .from("jobs")
          .select(
            `*,
            customer:customer_id(*),
            vehicle:vehicle_id(*),
            technician:assigned_to(user_id, first_name, last_name, email, role, phone),
            vhc_checks(vhc_id, section, issue_description, issue_title, measurement, created_at, updated_at),
            parts_job_items(
              id,
              part_id,
              quantity_requested,
              quantity_allocated,
              quantity_fitted,
              status,
              origin,
              vhc_item_id,
              unit_cost,
              unit_price,
              request_notes,
              created_at,
              updated_at,
              authorised,
              stock_status,
              pre_pick_location,
              storage_location,
              eta_date,
              eta_time,
              supplier_reference,
              labour_hours,
              part:part_id(
                id,
                part_number,
                name,
                unit_price
              )
            ),
            vhc_item_aliases(display_id, vhc_item_id),
            job_files(
              file_id,
              file_name,
              file_url,
              file_type,
              folder,
              uploaded_at,
              uploaded_by
            )`
          )
          .eq("job_number", resolvedJobNumber)
          .maybeSingle();

        const workflowPromise = supabase
          .from("vhc_workflow_status")
          .select("*")
          .eq("job_number", resolvedJobNumber)
          .maybeSingle();

        const [{ data: jobRow, error: jobError }, { data: workflowRow, error: workflowError }] = await Promise.all([
          jobPromise,
          workflowPromise,
        ]);

        if (jobError) throw jobError;
        if (workflowError && workflowError.message !== "Row not found") throw workflowError;

        if (!jobRow) {
          setError("Job not found for the supplied job number.");
          setJob(null);
          setBuilderData(null);
          setWorkflow(workflowRow || null);
          return;
        }

        const {
          vhc_checks = [],
          parts_job_items = [],
          job_files = [],
          vhc_item_aliases: aliasRows = [],
          ...jobFields
        } = jobRow;
        const sanitizedAliasRows = Array.isArray(aliasRows) ? aliasRows.filter(Boolean) : [];
        const aliasMapFromDb = {};
        sanitizedAliasRows.forEach((alias) => {
          if (!alias?.display_id || alias.vhc_item_id === null || alias.vhc_item_id === undefined) return;
          aliasMapFromDb[String(alias.display_id)] = String(alias.vhc_item_id);
        });

        console.log("🔧 Initial page load - Parts from DB:", parts_job_items?.filter(p => p.origin === 'vhc').map(p => ({
          id: p.id,
          part: p.part?.name,
          vhc_item_id: p.vhc_item_id
        })));
        console.log("🔧 Initial page load - Aliases:", aliasMapFromDb);

        setVhcItemAliasRecords(sanitizedAliasRows);
        setVhcIdAliases(aliasMapFromDb);
        setJob({
          ...jobFields,
          parts_job_items: parts_job_items || [],
          job_files: job_files || [],
        });
        setWorkflow(workflowRow || null);

        const builderRecord = vhc_checks.find(
          (check) => check.section === "VHC_CHECKSHEET"
        );
        const parsedPayload = safeJsonParse(builderRecord?.issue_description || builderRecord?.data) || {};
        setVhcData(buildVhcPayload(parsedPayload));
      } catch (err) {
        console.error("Failed to load VHC details", err);
        setError("Unable to load VHC details for this job.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [resolvedJobNumber]);

  useEffect(() => {
    setItemEntries({});
    setSeveritySelections({ red: [], amber: [] });
  }, [resolvedJobNumber]);

  useEffect(() => {
    setSectionSaveStatus("idle");
    setSectionSaveError("");
    setLastSectionSavedAt(null);
  }, [resolvedJobNumber]);

  useEffect(() => {
    if (!job?.id) return;
    const channel = supabase
      .channel(`vhc-checksheet-${job.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vhc_checks",
          filter: `job_id=eq.${job.id}`,
        },
        (payload) => {
          const record = payload.new || payload.old;
          if (!record || record.section !== "VHC_CHECKSHEET") return;
          const parsed = safeJsonParse(record.issue_description || record.data);
          if (!parsed) return;
          setVhcData(buildVhcPayload(parsed));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [job?.id]);

  // Initialize part details for existing parts
  useEffect(() => {
    if (!job?.parts_job_items) return;

    setPartDetails((prevDetails) => {
      const newPartDetails = { ...prevDetails };
      let hasChanges = false;

      job.parts_job_items.forEach((part) => {
        if (part.vhc_item_id && part.origin?.toLowerCase().includes("vhc")) {
          const vhcId = String(part.vhc_item_id);
          const displayId = canonicalToDisplayMap.get(vhcId) || vhcId;
          const partKey = `${displayId}-${part.id}`;

          // Only initialize if not already present
          if (!newPartDetails[partKey]) {
            const unitPrice = Number(part.unit_price || part.part?.unit_price || 0);
            const unitCost = Number(part.unit_cost || part.part?.unit_cost || 0);
            const vatAmount = unitPrice * 0.2;
            const priceWithVat = unitPrice + vatAmount;

            newPartDetails[partKey] = {
              partNumber: part.part?.part_number || "",
              partName: part.part?.name || "",
              costToCustomer: unitPrice,
              costToCompany: unitCost,
              vat: vatAmount,
              totalWithVat: priceWithVat,
              inStock: (part.part?.qty_in_stock || 0) > 0,
              backOrder: false,
              warranty: false,
            };
            hasChanges = true;
          }
        }
      });

      return hasChanges ? newPartDetails : prevDetails;
    });
  }, [job?.parts_job_items, canonicalToDisplayMap]);

  const jobParts = useMemo(
    () =>
      Array.isArray(job?.parts_job_items)
        ? job.parts_job_items.filter(Boolean)
        : [],
    [job]
  );
  const normalisePartStatus = (value = "") =>
    value.toString().toLowerCase();
  const partsIdentified = useMemo(
    () =>
      jobParts.filter((part) =>
        normalisePartStatus(part.origin).includes("vhc")
      ),
    [jobParts]
  );
  const partsAuthorized = useMemo(
    () =>
      jobParts.filter((part) => {
        // Part must be from VHC and marked as authorised
        const isVhc = normalisePartStatus(part.origin).includes("vhc");
        const isAuthorised = part.authorised === true;
        // Exclude parts that are on_order
        const notOnOrder = normalisePartStatus(part.status) !== "on_order";
        return isVhc && isAuthorised && notOnOrder;
      }),
    [jobParts]
  );
  const partsOnOrder = useMemo(
    () =>
      jobParts.filter((part) => {
        // Part must be from VHC, authorised, and have status on_order
        const isVhc = normalisePartStatus(part.origin).includes("vhc");
        const isAuthorised = part.authorised === true;
        const isOnOrder = normalisePartStatus(part.status) === "on_order";
        return isVhc && isAuthorised && isOnOrder;
      }),
    [jobParts]
  );
  const jobFiles = useMemo(
    () =>
      Array.isArray(job?.job_files) ? job.job_files.filter(Boolean) : [],
    [job]
  );
  const builderSummary = useMemo(
    () => summariseTechnicianVhc(vhcData || {}),
    [vhcData]
  );
  const sections = builderSummary.sections || [];
  const wheelTreadLookup = useMemo(() => {
    const lookup = new Map();
    const tyres = vhcData?.wheelsTyres;
    if (!tyres || typeof tyres !== "object") return lookup;
    WHEEL_POSITION_KEYS.forEach((key) => {
      const entry = tyres?.[key];
      if (!entry || typeof entry !== "object") return;
      const readings = formatPlainTreadReadings(entry.tread || {});
      if (readings.length > 0) {
        lookup.set(key.toUpperCase(), readings.join(" "));
      }
    });
    return lookup;
  }, [vhcData]);
  const orderedHealthSections = useMemo(() => {
    const keyedSections = new Map();
    sections.forEach((section) => {
      if (section?.key) {
        keyedSections.set(section.key, section);
      }
    });
    return HEALTH_SECTION_CONFIG.map((config) => ({
      config,
      data:
        keyedSections.get(config.key) ||
        sections.find((section) => section.title === config.label) ||
        null,
      rawData: vhcData?.[config.key] || null,
    }));
  }, [sections, vhcData]);
  const hasHealthData = useMemo(
    () =>
      orderedHealthSections.some(
        ({ data }) => Array.isArray(data?.items) && data.items.length > 0
      ),
    [orderedHealthSections]
  );
  const sectionSaveMessage = useMemo(() => {
    if (sectionSaveStatus === "saving") return "Saving section…";
    if (sectionSaveStatus === "saved") {
      if (!lastSectionSavedAt) return "Saved";
      return `Saved ${lastSectionSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (sectionSaveStatus === "error") {
      return sectionSaveError || "Failed to save";
    }
    return "";
  }, [sectionSaveStatus, lastSectionSavedAt, sectionSaveError]);
  const sectionSaveColor =
    sectionSaveStatus === "error"
      ? "var(--danger)"
      : sectionSaveStatus === "saving"
      ? "var(--warning)"
      : "var(--info)";
  const handleOpenSection = useCallback((sectionKey) => {
    setActiveSection(sectionKey);
  }, []);

  const handleSectionDismiss = useCallback(
    (sectionKey, draftData) => {
      setActiveSection(null);
      if (!sectionKey || draftData === undefined || draftData === null) return;
      setVhcData((prev) => ({ ...prev, [sectionKey]: draftData }));
    },
    []
  );

  const handleSectionComplete = useCallback(
    async (sectionKey, sectionPayload) => {
      if (!sectionKey) return;
      const next = { ...vhcData, [sectionKey]: sectionPayload };
      setVhcData(next);
      setActiveSection(null);
      await persistVhcSections(next);
    },
    [vhcData, persistVhcSections]
  );
  const summaryItems = useMemo(() => {
    const items = [];
    sections.forEach((section) => {
      const sectionName = section.name || section.title || "Vehicle Health Check";
      (section.items || []).forEach((item, index) => {
        const severity = normaliseColour(item.colour || item.status || section.colour);
        if (!severity || (severity !== "red" && severity !== "amber")) {
          return;
        }
        const id = item.vhc_id || `${sectionName}-${index}`;
        const heading =
          item.heading || item.label || item.issue_title || item.name || item.title || sectionName;
        const category = resolveCategoryForItem(sectionName, heading);
        const location = resolveLocationKey(item);
        const concerns = Array.isArray(item.concerns) ? item.concerns : [];
        const primaryConcern =
          concerns.find((concern) => normaliseColour(concern.status) === severity) || concerns[0] || null;
        items.push({
          id: String(id),
          label: heading || "Recorded item",
          notes: item.notes || item.issue_description || "",
          measurement: formatMeasurement(item.measurement),
          concernText: primaryConcern?.text || "",
          sectionName,
          category,
          location,
          rawSeverity: severity,
          concerns,
          wheelKey: item.wheelKey || null,
        });
      });
    });

    items.forEach((item) => {
      item.displaySeverity = item.rawSeverity;
    });

    items.forEach((item) => {
      if (item.category?.id !== "wheels_tyres") return;
      const wheelKey = (item.wheelKey || "").toString().toUpperCase();
      const treadLabel = wheelKey ? wheelTreadLookup.get(wheelKey) : null;
      if (wheelKey && treadLabel) {
        item.label = `${wheelKey} - ${treadLabel}`;
      } else if (wheelKey) {
        item.label = wheelKey;
      }
    });

    return items;
  }, [sections, wheelTreadLookup]);

  const brakeSupplementaryByLocation = useMemo(() => {
    const map = new Map();
    const brakes = vhcData?.brakesHubs;
    if (!brakes || typeof brakes !== "object") return map;
    const ensureLocation = (location) => {
      if (!location) return null;
      if (!map.has(location)) {
        map.set(location, { entries: [], hasRed: false });
      }
      return map.get(location);
    };
    const pushEntry = (location, entry) => {
      if (!location || !entry) return;
      const context = ensureLocation(location);
      if (!context) return;
      context.entries.push(entry);
      if (entry.status === "red") {
        context.hasRed = true;
      }
    };

    const padConfigs = [
      { key: "frontPads", label: "Front Pads", location: "front" },
      { key: "rearPads", label: "Rear Pads", location: "rear" },
    ];
    padConfigs.forEach(({ key, label, location }) => {
      const pad = brakes[key];
      if (!pad || typeof pad !== "object") return;
      const measurement = formatMeasurement(pad.measurement);
      const padStatus = normaliseColour(pad.status);
      const concernStatuses = Array.isArray(pad.concerns)
        ? pad.concerns.map((concern) => normaliseColour(concern?.status)).filter(Boolean)
        : [];
      const status = deriveHighestSeverity([padStatus, ...concernStatuses]) || padStatus || null;
      if (!measurement && !status) return;
      pushEntry(location, {
        id: `${location}-${key}`,
        label,
        measurement: measurement ? `Pad thickness: ${measurement}` : null,
        status,
      });
    });

    const discConfigs = [
      { key: "frontDiscs", label: "Front Discs", location: "front" },
      { key: "rearDiscs", label: "Rear Discs", location: "rear" },
    ];
    discConfigs.forEach(({ key, label, location }) => {
      const disc = brakes[key];
      if (!disc || typeof disc !== "object") return;
      const measurement =
        formatMeasurement(
          disc.measurements?.values || disc.measurements?.thickness || disc.measurements
        ) || null;
      const measurementStatus = normaliseColour(disc.measurements?.status);
      const visualStatus = normaliseColour(disc.visual?.status);
      const directStatus = normaliseColour(disc.status);
      const concernStatuses = Array.isArray(disc.concerns)
        ? disc.concerns.map((concern) => normaliseColour(concern?.status)).filter(Boolean)
        : [];
      const status =
        deriveHighestSeverity([measurementStatus, visualStatus, directStatus, ...concernStatuses]) ||
        measurementStatus ||
        visualStatus ||
        directStatus ||
        null;
      const note = (disc.visual?.notes || disc.visual?.note || "").trim();
      if (!measurement && !status && !note) return;
      pushEntry(location, {
        id: `${location}-${key}`,
        label,
        measurement: measurement ? `Disc thickness: ${measurement}` : null,
        status,
        note: note || null,
      });
    });

    return map;
  }, [vhcData?.brakesHubs]);

  const tyreSupplementaryByWheel = useMemo(() => {
    const map = new Map();
    const tyres = vhcData?.wheelsTyres;
    if (!tyres || typeof tyres !== "object") return map;
    WHEEL_POSITION_KEYS.forEach((key) => {
      const entry = tyres[key];
      if (!entry || typeof entry !== "object") return;
      const depthSummary = formatTreadDepthSummary(entry.tread);
      if (!depthSummary) return;
      const status = normaliseColour(entry.status) || normaliseColour(entry.treadStatus);
      map.set(key.toUpperCase(), {
        id: `tyre-${key}`,
        label: `${key} Tyre`,
        measurement: `Tread depths: ${depthSummary}`,
        status,
      });
    });
    return map;
  }, [vhcData?.wheelsTyres]);

  const getBrakeSupplementaryRows = useCallback(
    (item) => {
      if (!item || item.categoryId !== "brakes_hubs") return [];
      const locationKey = deriveBrakeLocationKey(item);
      if (!locationKey) return [];
      const context = brakeSupplementaryByLocation.get(locationKey);
      if (!context || context.entries.length === 0) return [];
      const shouldShow = context.entries.length > 1 || context.hasRed || item.displaySeverity === "red";
      return shouldShow ? context.entries : [];
    },
    [brakeSupplementaryByLocation]
  );

  const getTyreSupplementaryRows = useCallback(
    (item) => {
      if (!item || item.categoryId !== "wheels_tyres") return [];
      const wheelKey = resolveWheelPositionFromItem(item);
      if (!wheelKey) return [];
      const context = tyreSupplementaryByWheel.get(wheelKey);
      if (!context) return [];
      return [context];
    },
    [tyreSupplementaryByWheel]
  );

  const severitySections = useMemo(() => {
    const base = { red: new Map(), amber: new Map() };
    summaryItems.forEach((item) => {
      const severity = item.displaySeverity;
      if (!base[severity]) return;
      const categoryId = item.category.id;
      if (!base[severity].has(categoryId)) {
        base[severity].set(categoryId, { category: item.category, items: [] });
      }
      base[severity].get(categoryId).items.push(item);
    });
    return base;
  }, [summaryItems]);
  const severityLists = useMemo(() => {
    const lists = { red: [], amber: [] };
    ["red", "amber"].forEach((severity) => {
      const section = severitySections[severity];
      if (!section) return;
      Array.from(section.values()).forEach(({ category, items }) => {
        items.forEach((item) => {
          lists[severity].push({
            ...item,
            categoryLabel: category.label,
            categoryId: category.id,
          });
        });
      });
    });
    return lists;
  }, [severitySections]);

  // Combined VHC items with their parts for Parts Identified section
  const vhcItemsWithParts = useMemo(() => {
    if (!summaryItems || summaryItems.length === 0) return [];

    const items = [];
    const processedCanonicalIds = new Set();

    const partsByVhcId = new Map();
    partsIdentified.forEach((part) => {
      if (!part?.vhc_item_id) {
        console.log("⚠️ Part without vhc_item_id:", part);
        return;
      }
      const key = String(part.vhc_item_id);
      if (!partsByVhcId.has(key)) {
        partsByVhcId.set(key, []);
      }
      partsByVhcId.get(key).push(part);
    });
    console.log("📦 Parts grouped by VHC ID:", Object.fromEntries(partsByVhcId));
    console.log("📋 VHC ID Aliases:", vhcIdAliases);

    summaryItems.forEach((summaryItem) => {
      const displayVhcId = String(summaryItem.id);
      const canonicalVhcId = resolveCanonicalVhcId(displayVhcId);
      const linkedParts = partsByVhcId.get(canonicalVhcId) || [];

      if (linkedParts.length > 0 || displayVhcId !== canonicalVhcId) {
        console.log(`🔍 Item ${displayVhcId} -> canonical ${canonicalVhcId} -> ${linkedParts.length} parts`);
      }

      items.push({
        vhcItem: summaryItem,
        linkedParts,
        vhcId: displayVhcId,
        canonicalVhcId,
      });

      processedCanonicalIds.add(canonicalVhcId);
    });

    partsIdentified.forEach((part) => {
      if (!part?.vhc_item_id) return;
      const canonicalVhcId = String(part.vhc_item_id);
      if (processedCanonicalIds.has(canonicalVhcId)) return;

      items.push({
        vhcItem: null,
        linkedParts: [part],
        vhcId: canonicalVhcId,
        canonicalVhcId,
      });
      processedCanonicalIds.add(canonicalVhcId);
    });

    return items;
  }, [summaryItems, partsIdentified, resolveCanonicalVhcId]);

  const partsCostByVhcItem = useMemo(() => {
    const map = new Map();
    const canonicalNotRequired = new Set();

    partsNotRequired.forEach((rawId) => {
      const key = String(rawId);
      const alias = vhcIdAliases[key];
      canonicalNotRequired.add(alias ? String(alias) : key);
    });

    partsIdentified.forEach((part) => {
      if (!part?.vhc_item_id) return;
      const key = String(part.vhc_item_id);

      if (canonicalNotRequired.has(key)) {
        map.set(key, 0);
        return;
      }

      const qtyValue = Number(part.quantity_requested);
      const resolvedQty = Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 1;
      const unitPriceValue = Number(part.unit_price ?? part.part?.unit_price ?? 0);
      if (!Number.isFinite(unitPriceValue)) return;
      const subtotal = resolvedQty * unitPriceValue;
      map.set(key, (map.get(key) || 0) + subtotal);
    });

    summaryItems.forEach((item) => {
      const displayId = String(item.id);
      if (!partsNotRequired.has(displayId)) return;
      const canonicalId = vhcIdAliases[displayId] ? String(vhcIdAliases[displayId]) : displayId;
      if (!map.has(canonicalId)) {
        map.set(canonicalId, 0);
      }
    });

    return map;
  }, [partsIdentified, partsNotRequired, summaryItems, vhcIdAliases]);

  const ensureEntryValue = (state, itemId) =>
    state[itemId] || { partsCost: "", laborHours: "", totalOverride: "", status: null, labourComplete: false, partsComplete: false };

  const updateEntryValue = (itemId, field, value) => {
    setItemEntries((prev) => ({
      ...prev,
      [itemId]: { ...ensureEntryValue(prev, itemId), [field]: value },
    }));
  };

  const getEntryForItem = (itemId) => ensureEntryValue(itemEntries, itemId);

  // Auto-update partsComplete checkbox based on parts being added or marked as not required
  useEffect(() => {
    setItemEntries((prev) => {
      const updated = { ...prev };
      let hasChanges = false;

      // Check each item in the summary
      severityLists.red?.forEach((item) => {
        const itemId = item.id;
        const canonicalId = resolveCanonicalVhcId(itemId);
        const hasParts = partsCostByVhcItem.has(canonicalId);
        const isNotRequired = partsNotRequired.has(String(itemId));
        const shouldBeComplete = hasParts || isNotRequired;

        const entry = ensureEntryValue(prev, itemId);
        if (entry.partsComplete !== shouldBeComplete) {
          updated[itemId] = { ...entry, partsComplete: shouldBeComplete };
          hasChanges = true;
        }
      });

      severityLists.amber?.forEach((item) => {
        const itemId = item.id;
        const canonicalId = resolveCanonicalVhcId(itemId);
        const hasParts = partsCostByVhcItem.has(canonicalId);
        const isNotRequired = partsNotRequired.has(String(itemId));
        const shouldBeComplete = hasParts || isNotRequired;

        const entry = ensureEntryValue(prev, itemId);
        if (entry.partsComplete !== shouldBeComplete) {
          updated[itemId] = { ...entry, partsComplete: shouldBeComplete };
          hasChanges = true;
        }
      });

      return hasChanges ? updated : prev;
    });
  }, [partsCostByVhcItem, partsNotRequired, severityLists, resolveCanonicalVhcId]);

  // Check if all checkboxes are complete and notify parent
  useEffect(() => {
    if (!onCheckboxesComplete) return;

    const allItems = [...(severityLists.red || []), ...(severityLists.amber || [])];
    if (allItems.length === 0) {
      onCheckboxesComplete(false);
      return;
    }

    const allComplete = allItems.every((item) => {
      const entry = getEntryForItem(item.id);
      return entry.partsComplete && entry.labourComplete;
    });

    onCheckboxesComplete(allComplete);
  }, [itemEntries, severityLists, onCheckboxesComplete]);

  const parseNumericValue = (value) => {
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : 0;
  };

  const computeLabourCost = (hours) => parseNumericValue(hours) * LABOUR_RATE;

  const resolvePartsCost = (itemId, entry) => {
    const canonicalId = resolveCanonicalVhcId(itemId);
    if (partsCostByVhcItem.has(canonicalId)) {
      return partsCostByVhcItem.get(canonicalId);
    }
    if (entry.partsCost !== "" && entry.partsCost !== null && entry.partsCost !== undefined) {
      return parseNumericValue(entry.partsCost);
    }
    return undefined;
  };

  const computeRowTotal = (entry, resolvedPartsCost) => {
    if (entry.totalOverride !== "" && entry.totalOverride !== null) {
      const override = parseNumericValue(entry.totalOverride);
      if (override > 0) {
        return override;
      }
    }
    const partsCost =
      resolvedPartsCost !== undefined ? resolvedPartsCost : parseNumericValue(entry.partsCost);
    return partsCost + computeLabourCost(entry.laborHours);
  };

  const determineStatusColor = (entry, resolvedPartsCost, itemId) => {
    if (entry.status === "authorized") return "var(--success)";
    if (entry.status === "declined") return "var(--danger)";

    // Labour is considered "added" if:
    // 1. Labour hours is set to any value (including 0), OR
    // 2. The labourComplete checkbox is checked
    const labourValue = entry.laborHours;
    const hasLabour = (labourValue !== null && labourValue !== undefined && labourValue !== "") || entry.labourComplete;

    // Parts/costs are considered "added" if:
    // 1. Parts have a cost > 0, OR
    // 2. Total override > 0, OR
    // 3. Parts are marked as "not required"
    const isPartsNotRequired = partsNotRequired.has(String(itemId));
    const hasCosts =
      (resolvedPartsCost ?? parseNumericValue(entry.partsCost)) > 0 ||
      parseNumericValue(entry.totalOverride) > 0 ||
      isPartsNotRequired;

    if (!hasLabour || !hasCosts) return "var(--danger)";
    return "var(--warning)";
  };

  const toggleRowSelection = (severity, itemId) => {
    if (readOnly) return;
    setSeveritySelections((prev) => {
      const existing = new Set(prev[severity] || []);
      if (existing.has(itemId)) {
        existing.delete(itemId);
      } else {
        existing.add(itemId);
      }
      return { ...prev, [severity]: Array.from(existing) };
    });
  };

  const handleSelectAll = (severity, items, checked) => {
    if (readOnly) return;
    setSeveritySelections((prev) => ({
      ...prev,
      [severity]: checked ? items.map((item) => item.id) : [],
    }));
  };

  const handleBulkStatus = useCallback(
    (severity, status) => {
      const selectedIds = severitySelections[severity] || [];
      if (selectedIds.length === 0) return;
      setItemEntries((prev) => {
        const next = { ...prev };
        selectedIds.forEach((id) => {
          const current = ensureEntryValue(next, id);
          next[id] = { ...current, status };
        });
        return next;
      });
      setSeveritySelections((prev) => ({ ...prev, [severity]: [] }));
    },
    [severitySelections]
  );

  const renderSeverityTable = (severity) => {
    const items = severityLists[severity] || [];
    if (items.length === 0) {
      return (
        <div
          style={{
            padding: "18px",
            border: "1px solid var(--info-surface)",
            borderRadius: "12px",
            background: "var(--info-surface)",
            color: "var(--info)",
            fontSize: "13px",
          }}
        >
          No {severity} items recorded.
        </div>
      );
    }
    const selectionEnabled = !readOnly;
    const selectedIds = severitySelections[severity] || [];
    const selectedSet = new Set(selectedIds);
    const allChecked = items.length > 0 && selectedSet.size === items.length;
    const theme = SEVERITY_THEME[severity] || { border: "var(--info-surface)" };

    return (
      <div
        style={{
          border: `1px solid ${theme.border}`,
          borderRadius: "16px",
          background: "var(--surface)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr
                style={{
                  background: "var(--info-surface)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--info)",
                  fontSize: "11px",
                }}
              >
                <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "260px" }}>Item Details</th>
                <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "120px" }}>Parts</th>
                <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "130px" }}>Labour</th>
                <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "160px" }}>Total</th>
                <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "130px" }}>Status</th>
                {selectionEnabled && (
                  <th style={{ textAlign: "center", padding: "12px 16px", minWidth: "90px" }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(event) => handleSelectAll(severity, items, event.target.checked)}
                    />
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const entry = getEntryForItem(item.id);
                const resolvedPartsCost = resolvePartsCost(item.id, entry);
                const labourCost = computeLabourCost(entry.laborHours);
                const totalCost = computeRowTotal(entry, resolvedPartsCost);
                const totalDisplayValue =
                  entry.totalOverride !== "" && entry.totalOverride !== null
                    ? entry.totalOverride
                    : totalCost.toFixed(2);
                const partsDisplayValue =
                  resolvedPartsCost !== undefined ? resolvedPartsCost.toFixed(2) : "";
                const statusColor = determineStatusColor(entry, resolvedPartsCost, item.id);
                const locationLabel = item.location
                  ? LOCATION_LABELS[item.location] || item.location.replace(/_/g, " ")
                  : null;
                const isChecked = selectedSet.has(item.id);
                const isWarranty = warrantyRows.has(String(item.id));
                const rowSeverity = item.displaySeverity || severity;
                const rowTheme = SEVERITY_THEME[rowSeverity] || {};
                const detailLabel = item.label || item.sectionName || "Recorded item";
                const concernDetail = item.concernText || "";
                const detailContent = concernDetail || item.notes || "";
                const severityLabel =
                  item.rawSeverity ? item.rawSeverity.charAt(0).toUpperCase() + item.rawSeverity.slice(1) : null;
                const severityBadge = severityLabel ? buildSeverityBadgeStyles(item.rawSeverity) : null;
                const supplementaryRows = [
                  ...getBrakeSupplementaryRows(item),
                  ...getTyreSupplementaryRows(item),
                ];

                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: "1px solid var(--info-surface)",
                      background: rowTheme.background || "var(--surface)",
                      transition: "background 0.2s ease",
                    }}
                  >
                    <td style={{ padding: "12px 16px", color: "var(--accent-purple)", width: "32%" }}>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                        {item.categoryLabel || "Recorded Section"}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--accent-purple)", marginTop: "2px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        <span>{detailLabel}</span>
                        {detailContent ? (
                          <span style={{ fontWeight: 500, color: "var(--info-dark)" }}>- {detailContent}</span>
                        ) : null}
                      </div>
                      {severityBadge ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            marginTop: "4px",
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "2px 10px",
                            background: severityBadge.background,
                            color: severityBadge.color,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                          }}
                        >
                          {severityLabel}
                        </span>
                      ) : null}
                      {item.measurement ? (
                        <div style={{ fontSize: "12px", color: "var(--info)", marginTop: "4px" }}>Measurement: {item.measurement}</div>
                      ) : null}
                      {locationLabel ? (
                        <div style={{ fontSize: "12px", color: "var(--info)", marginTop: "4px" }}>Location: {locationLabel}</div>
                      ) : null}
                      {supplementaryRows.length > 0 ? (
                        <div
                          style={{
                            marginTop: "8px",
                            borderRadius: "12px",
                            background: "var(--surface-light)",
                            padding: "10px 12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          {supplementaryRows.map((entry) => {
                            const entryStatusLabel = formatStatusLabel(entry.status);
                            const badgeStyles = entry.status ? buildSeverityBadgeStyles(entry.status) : null;
                            return (
                              <div
                                key={entry.id || `${entry.label}-${entry.measurement}`}
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "8px",
                                  alignItems: "center",
                                  fontSize: "12px",
                                  color: "var(--info-dark)",
                                }}
                              >
                                <span style={{ fontWeight: 600, color: "var(--accent-purple)" }}>{entry.label}</span>
                                {entry.measurement ? <span>{entry.measurement}</span> : null}
                                {entryStatusLabel && badgeStyles ? (
                                  <span
                                    style={{
                                      padding: "2px 10px",
                                      borderRadius: "999px",
                                      fontSize: "11px",
                                      fontWeight: 600,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.08em",
                                      background: badgeStyles.background,
                                      color: badgeStyles.color,
                                    }}
                                  >
                                    {entryStatusLabel}
                                  </span>
                                ) : null}
                                {entry.note ? <span style={{ color: "var(--info)" }}>{entry.note}</span> : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input
                          type="checkbox"
                          checked={entry.partsComplete || false}
                          disabled={true}
                          title={entry.partsComplete ? "Parts added or marked as not required" : "Add parts or mark as not required"}
                        />
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent-purple)" }}>
                          {partsDisplayValue ? `£${partsDisplayValue}` : "—"}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input
                          type="checkbox"
                          checked={entry.labourComplete || false}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            updateEntryValue(item.id, "labourComplete", isChecked);
                            if (isChecked && (!entry.laborHours || entry.laborHours === "")) {
                              updateEntryValue(item.id, "laborHours", "0");
                            }
                          }}
                          disabled={readOnly || (entry.status === "authorized" || entry.status === "declined")}
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={entry.laborHours ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateEntryValue(item.id, "laborHours", value);
                            // Auto-check the checkbox if a number is entered
                            if (value && value !== "" && value !== "0") {
                              updateEntryValue(item.id, "labourComplete", true);
                            }
                          }}
                          placeholder="0.0"
                          style={{
                            width: "60px",
                            padding: "6px 8px",
                            borderRadius: "8px",
                            border: "1px solid var(--accent-purple-surface)",
                            fontSize: "14px",
                          }}
                          disabled={readOnly || (entry.status === "authorized" || entry.status === "declined")}
                        />
                        <span style={{ fontSize: "12px", color: "var(--info)", whiteSpace: "nowrap" }}>£{labourCost.toFixed(2)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={totalDisplayValue}
                          onChange={(event) => updateEntryValue(item.id, "totalOverride", event.target.value)}
                          placeholder="0.00"
                          style={{
                            width: "80px",
                            padding: "6px 8px",
                            borderRadius: "8px",
                            border: "1px solid var(--accent-purple-surface)",
                            fontSize: "14px",
                          }}
                          disabled={readOnly || (entry.status === "authorized" || entry.status === "declined")}
                        />
                        {isWarranty && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "24px",
                              height: "24px",
                              borderRadius: "4px",
                              background: "var(--primary)",
                              color: "var(--surface)",
                              fontSize: "12px",
                              fontWeight: 700,
                              letterSpacing: "0.05em",
                            }}
                            title="Warranty"
                          >
                            W
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            width: "14px",
                            height: "14px",
                            borderRadius: "999px",
                            backgroundColor: statusColor,
                            display: "inline-block",
                          }}
                        />
                        <span style={{ fontSize: "12px", color: "var(--info-dark)" }}>
                          {entry.status ? entry.status.charAt(0).toUpperCase() + entry.status.slice(1) : "Pending"}
                        </span>
                      </div>
                    </td>
                    {selectionEnabled && (
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRowSelection(severity, item.id)}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {selectionEnabled && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              padding: "16px",
              borderTop: "1px solid var(--info-surface)",
            }}
          >
            <button
              type="button"
              onClick={() => handleBulkStatus(severity, "declined")}
              disabled={selectedSet.size === 0}
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: "1px solid var(--danger)",
                backgroundColor: selectedSet.size === 0 ? "var(--danger-surface)" : "var(--surface)",
                color: "var(--danger)",
                fontWeight: 600,
                cursor: selectedSet.size === 0 ? "not-allowed" : "pointer",
              }}
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatus(severity, "authorized")}
              disabled={selectedSet.size === 0}
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: "1px solid var(--success)",
                backgroundColor: selectedSet.size === 0 ? "var(--success-surface)" : "var(--success)",
                color: selectedSet.size === 0 ? "var(--success)" : "var(--surface)",
                fontWeight: 600,
                cursor: selectedSet.size === 0 ? "not-allowed" : "pointer",
              }}
            >
              Authorise
            </button>
          </div>
        )}
      </div>
    );
  };
  const photoFiles = useMemo(() => {
    const isImage = (file = {}) => {
      const type = (file.file_type || "").toLowerCase();
      const name = (file.file_name || "").toLowerCase();
      return (
        type.startsWith("image") ||
        /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(name)
      );
    };
    return jobFiles.filter((file) => isImage(file));
  }, [jobFiles]);
  const videoFiles = useMemo(() => {
    const isVideo = (file = {}) => {
      const type = (file.file_type || "").toLowerCase();
      const name = (file.file_name || "").toLowerCase();
      return (
        type.startsWith("video") || /\.(mp4|mov|avi|mkv|webm)$/i.test(name)
      );
    };
    return jobFiles.filter((file) => isVideo(file));
  }, [jobFiles]);

  const customerName = useMemo(() => {
    if (!job?.customer) return "—";
    if (job.customer.name) return job.customer.name;
    const first = job.customer.firstname || job.customer.first_name;
    const last = job.customer.lastname || job.customer.last_name;
    const combined = [first, last].filter(Boolean).join(" ").trim();
    return combined || job.customer.email || "—";
  }, [job]);

  // Handler for updating part status and location
  const handlePartStatusUpdate = useCallback(async (partItemId, updates) => {
    try {
      const response = await fetch("/api/parts/update-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partItemId, ...updates }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update part status");
      }

      const result = await response.json();

      // Refresh job data to reflect changes
      if (result.success && job?.id) {
        const { data: updatedJob, error: fetchError } = await supabase
          .from("jobs")
          .select(`
            *,
            customer:customer_id(*),
            vehicle:vehicle_id(*),
            technician:assigned_to(user_id, first_name, last_name, email, role, phone),
            vhc_checks(vhc_id, section, issue_description, issue_title, measurement, created_at, updated_at),
            parts_job_items(
              id,
              part_id,
              quantity_requested,
              quantity_allocated,
              quantity_fitted,
              status,
              origin,
              vhc_item_id,
              unit_cost,
              unit_price,
              request_notes,
              created_at,
              updated_at,
              authorised,
              stock_status,
              pre_pick_location,
              eta_date,
              eta_time,
              supplier_reference,
              labour_hours,
              part:part_id(
                id,
                part_number,
                name,
                unit_price
              )
            ),
            job_files(
              file_id,
              file_name,
              file_url,
              file_type,
              folder,
              uploaded_at,
              uploaded_by
            )
          `)
          .eq("job_number", resolvedJobNumber)
          .maybeSingle();

        if (!fetchError && updatedJob) {
          const { vhc_checks = [], parts_job_items = [], job_files = [], ...jobFields } = updatedJob;
          setJob({
            ...jobFields,
            parts_job_items: parts_job_items || [],
            job_files: job_files || [],
          });
        }
      }

      return result;
    } catch (err) {
      console.error("Error updating part status:", err);
      throw err;
    }
  }, [job, resolvedJobNumber]);

  // Handler for Pre-Pick Location dropdown change
  const handlePrePickLocationChange = useCallback(async (partItemId, location) => {
    if (location === "on_order") {
      // Move to Parts On Order section
      await handlePartStatusUpdate(partItemId, {
        prePickLocation: "on_order",
        status: "on_order",
        stockStatus: null,
      });
      return;
    }

    const sanitizedLocation = location || null;

    // Update pre-pick location
    await handlePartStatusUpdate(partItemId, {
      prePickLocation: sanitizedLocation,
      stockStatus: sanitizedLocation ? "in_stock" : null,
      status: sanitizedLocation ? "pre_picked" : "pending",
    });
  }, [handlePartStatusUpdate]);

  // Handler for "Here" button click (moves part back from On Order to Authorised)
  const handlePartArrived = useCallback(async (partItemId) => {
    await handlePartStatusUpdate(partItemId, {
      status: "stock",
      stockStatus: "in_stock",
      etaDate: null,
      etaTime: null,
    });
  }, [handlePartStatusUpdate]);

  // Handler for "Parts Not Required" toggle
  const handlePartsNotRequiredToggle = useCallback((vhcItemId) => {
    setPartsNotRequired((prev) => {
      const next = new Set(prev);
      if (next.has(vhcItemId)) {
        next.delete(vhcItemId);
      } else {
        next.add(vhcItemId);
      }
      return next;
    });
  }, []);

  // Handler for opening part search modal
  const handleVhcItemRowClick = useCallback((vhcId) => {
    setExpandedVhcItems((prev) => {
      const wasExpanded = prev.has(vhcId);
      if (wasExpanded) {
        // If clicking an already expanded item, just close it
        const newSet = new Set(prev);
        newSet.delete(vhcId);
        return newSet;
      } else {
        // If opening a new item, close all others and open only this one
        const newSet = new Set();
        newSet.add(vhcId);
        return newSet;
      }
    });
  }, []);

  const handleAddPartButtonClick = useCallback((vhcItemData, e) => {
    e.stopPropagation();
    setSelectedVhcItem(vhcItemData);
    setIsPartSearchModalOpen(true);
  }, []);

  // Handler for updating part detail fields
  const handlePartDetailChange = useCallback((partKey, field, value) => {
    setPartDetails((prev) => ({
      ...prev,
      [partKey]: {
        ...(prev[partKey] || {}),
        [field]: value,
      },
    }));
  }, []);

  // Handler for closing part search modal
  const handleClosePartSearchModal = useCallback(() => {
    setIsPartSearchModalOpen(false);
    setSelectedVhcItem(null);
  }, []);

  // Handler for when a part is added
  const selectedVhcRowId = selectedVhcItem?.vhcId ? String(selectedVhcItem.vhcId) : null;

  const handlePartAdded = useCallback(async (payload) => {
    const partData = payload?.jobPart || payload;
    const sourceVhcId = payload?.sourceVhcId ? String(payload.sourceVhcId) : selectedVhcRowId;
    console.log("🔍 handlePartAdded called with:", {
      partData,
      sourceVhcId,
      vhc_item_id: partData?.vhc_item_id,
      selectedVhcItem
    });

    if (sourceVhcId && partData?.vhc_item_id) {
      console.log("📝 Creating alias:", sourceVhcId, "=>", partData.vhc_item_id);
      await upsertVhcItemAlias(sourceVhcId, partData.vhc_item_id);
    } else {
      console.warn("⚠️ Missing data for alias creation - sourceVhcId:", sourceVhcId, "vhc_item_id:", partData?.vhc_item_id);
    }

    // Refresh job data to show the new part
    if (resolvedJobNumber) {
      const { data: updatedJob, error: fetchError } = await supabase
        .from("jobs")
        .select(`
          *,
          customer:customer_id(*),
          vehicle:vehicle_id(*),
          technician:assigned_to(user_id, first_name, last_name, email, role, phone),
          vhc_checks(vhc_id, section, issue_description, issue_title, measurement, created_at, updated_at),
          parts_job_items(
            id,
            part_id,
            quantity_requested,
            quantity_allocated,
            quantity_fitted,
            status,
            origin,
            vhc_item_id,
            unit_cost,
            unit_price,
            request_notes,
            created_at,
            updated_at,
            authorised,
            stock_status,
            pre_pick_location,
            storage_location,
            eta_date,
            eta_time,
            supplier_reference,
            labour_hours,
            part:part_id(
              id,
              part_number,
              name,
              unit_price,
              unit_cost,
              qty_in_stock
            )
          ),
          vhc_item_aliases(display_id, vhc_item_id),
          job_files(
            file_id,
            file_name,
            file_url,
            file_type,
            folder,
            uploaded_at,
            uploaded_by
          )
        `)
        .eq("job_number", resolvedJobNumber)
        .maybeSingle();

      console.log("🔍 Fetched updated job:", updatedJob);
      console.log("🔍 Parts in updated job:", updatedJob?.parts_job_items);

      if (!fetchError && updatedJob) {
        const {
          vhc_checks = [],
          parts_job_items = [],
          job_files = [],
          vhc_item_aliases: aliasRows = [],
          ...jobFields
        } = updatedJob;
        const sanitizedAliasRows = Array.isArray(aliasRows) ? aliasRows.filter(Boolean) : [];
        const aliasMapFromDb = {};
        sanitizedAliasRows.forEach((alias) => {
          if (!alias?.display_id || alias.vhc_item_id === null || alias.vhc_item_id === undefined) return;
          aliasMapFromDb[String(alias.display_id)] = String(alias.vhc_item_id);
        });
        setVhcItemAliasRecords(sanitizedAliasRows);
        setVhcIdAliases(aliasMapFromDb);
        setJob((prevJob) => {
          const existingParts = Array.isArray(prevJob?.parts_job_items) ? prevJob.parts_job_items : [];
          const mergedPartsMap = new Map();
          existingParts.forEach((part) => {
            if (part?.id) {
              mergedPartsMap.set(part.id, part);
            }
          });
          (Array.isArray(parts_job_items) ? parts_job_items : []).forEach((part) => {
            if (part?.id) {
              mergedPartsMap.set(part.id, part);
            }
          });
          if (partData?.id) {
            const current = mergedPartsMap.get(partData.id) || {};
            mergedPartsMap.set(partData.id, { ...current, ...partData });
          }
          const mergedParts = Array.from(mergedPartsMap.values());
          return {
            ...(prevJob || {}),
            ...jobFields,
            parts_job_items: mergedParts,
            job_files: job_files || [],
          };
        });

        // Update VHC data if the builder record is present
        // This ensures that any newly created vhc_checks records are reflected in the UI
        const builderRecord = vhc_checks.find(
          (check) => check.section === "VHC_CHECKSHEET"
        );
        if (builderRecord) {
          const parsedPayload = safeJsonParse(builderRecord?.issue_description || builderRecord?.data) || {};
          setVhcData(buildVhcPayload(parsedPayload));
        }

        // Auto-populate part details for the newly added part
        if (partData && partData.vhc_item_id) {
          const canonicalVhcId = String(partData.vhc_item_id);
          const displayVhcId = sourceVhcId || canonicalVhcId;
          const part = partData.part || {};
          const partKey = `${displayVhcId}-${partData.id}`;

          console.log("🔍 Creating part details for key:", partKey);
          console.log("🔍 Part data:", part);

          // Calculate VAT (20%)
          const unitPrice = Number(partData.unit_price || part.unit_price || 0);
          const unitCost = Number(partData.unit_cost || part.unit_cost || 0);
          const vatAmount = unitPrice * 0.2;
          const priceWithVat = unitPrice + vatAmount;

          const newPartDetail = {
            partNumber: part.part_number || "",
            partName: part.name || "",
            costToCustomer: unitPrice,
            costToCompany: unitCost,
            vat: vatAmount,
            totalWithVat: priceWithVat,
            inStock: (part.qty_in_stock || 0) > 0,
            backOrder: false,
            warranty: false,
          };

          console.log("🔍 New part detail:", newPartDetail);

          setPartDetails((prev) => {
            console.log("🔍 Previous partDetails:", prev);
            const updated = {
              ...prev,
              [partKey]: newPartDetail,
            };
            console.log("🔍 Updated partDetails:", updated);
            return updated;
          });

          // Expand the row to show the newly added part
          setExpandedVhcItems((prev) => {
            const newSet = new Set(prev);
            newSet.add(displayVhcId);
            console.log("🔍 Expanded VHC items:", Array.from(newSet));
            return newSet;
          });
        }
      }
    }

    if (partData) {
      setJob((prev) => {
        if (!prev) return prev;
        const existingParts = Array.isArray(prev.parts_job_items) ? [...prev.parts_job_items] : [];
        if (existingParts.some((part) => part.id === partData.id)) {
          return prev;
        }
        return {
          ...prev,
          parts_job_items: [...existingParts, partData],
        };
      });
    }
  }, [resolvedJobNumber, selectedVhcRowId, upsertVhcItemAlias]);

  const handleRemovePart = useCallback(
    async (partItem, displayVhcId) => {
      if (!partItem?.id) return;
      const confirmRemove =
        typeof window !== "undefined"
          ? window.confirm(`Remove ${partItem.part?.name || "this part"} from the VHC item?`)
          : true;
      if (!confirmRemove) return;

      const canonicalId = partItem?.vhc_item_id
        ? String(partItem.vhc_item_id)
        : resolveCanonicalVhcId(displayVhcId);
      const otherPartsBeforeRemoval =
        Array.isArray(job?.parts_job_items) && canonicalId
          ? job.parts_job_items.filter(
              (item) => item.id !== partItem.id && String(item?.vhc_item_id || "") === canonicalId
            )
          : [];

      setRemovingPartIds((prev) => {
        const next = new Set(prev);
        next.add(partItem.id);
        return next;
      });

      try {
        const response = await fetch(`/api/parts/job-items/${partItem.id}`, {
          method: "DELETE",
        });
        const data = await response.json();
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || data?.message || "Failed to remove part");
        }

        setJob((prev) => {
          if (!prev) return prev;
          const remainingParts = Array.isArray(prev.parts_job_items)
            ? prev.parts_job_items.filter((item) => item.id !== partItem.id)
            : [];
          return {
            ...prev,
            parts_job_items: remainingParts,
          };
        });

        setPartDetails((prev) => {
          if (!prev) return prev;
          const partKey = `${displayVhcId}-${partItem.id}`;
          if (!prev[partKey]) return prev;
          const next = { ...prev };
          delete next[partKey];
          return next;
        });

        if (canonicalId && otherPartsBeforeRemoval.length === 0) {
          await removeVhcItemAlias(displayVhcId, canonicalId);
        }
      } catch (error) {
        console.error("Failed to remove part from VHC row:", error);
        alert(`Failed to remove part: ${error.message || "Unknown error"}`);
      } finally {
        setRemovingPartIds((prev) => {
          const next = new Set(prev);
          next.delete(partItem.id);
          return next;
        });
      }
    },
    [job?.parts_job_items, removeVhcItemAlias, resolveCanonicalVhcId]
  );

  // Handler for "Add to Job" button click
  const handleAddToJobClick = useCallback((partItem) => {
    setSelectedPartForJob(partItem);
    setIsPrePickModalOpen(true);
  }, []);

  // Handler for confirming pre-pick location and adding part to job
  const handleConfirmPrePickLocation = useCallback(async (prePickLocation) => {
    if (!selectedPartForJob || !job?.id) return;

    setAddingPartToJob(true);
    try {
      const part = selectedPartForJob.part || {};
      const response = await fetch("/api/parts/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          partId: part.id,
          quantityRequested: selectedPartForJob.quantity_requested || 1,
          allocateFromStock: true,
          prePickLocation: prePickLocation || null,
          storageLocation: selectedPartForJob.storage_location || part.storage_location || null,
          unitCost: selectedPartForJob.unit_cost || part.unit_cost || 0,
          unitPrice: selectedPartForJob.unit_price || part.unit_price || 0,
          requestNotes: `Added from VHC Parts Authorized - Job #${resolvedJobNumber}`,
          origin: "vhc",
          vhcItemId: selectedPartForJob.vhc_item_id || null,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to add part to job");
      }

      // Refresh job data
      await handlePartAdded();

      // Close modal and reset state
      setIsPrePickModalOpen(false);
      setSelectedPartForJob(null);

      // Show success message (could use a toast notification here)
      alert(`${part.name || "Part"} has been added to the job successfully!`);
    } catch (error) {
      console.error("Failed to add part to job:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setAddingPartToJob(false);
    }
  }, [selectedPartForJob, job, resolvedJobNumber, handlePartAdded]);

  // Handler for closing the pre-pick modal
  const handleClosePrePickModal = useCallback(() => {
    setIsPrePickModalOpen(false);
    setSelectedPartForJob(null);
  }, []);

  // Render VHC items panel for Parts Identified (shows all red/amber VHC items)
  const renderVhcItemsPanel = useCallback(() => {
    console.log("🎨 Rendering VHC items panel");
    console.log("🎨 vhcItemsWithParts:", vhcItemsWithParts);
    console.log("🎨 partDetails:", partDetails);
    console.log("🎨 expandedVhcItems:", Array.from(expandedVhcItems));

    if (!vhcItemsWithParts || vhcItemsWithParts.length === 0) {
      return (
        <div
          style={{
            padding: "18px",
            border: "1px solid var(--info-surface)",
            borderRadius: "12px",
            background: "var(--info-surface)",
            color: "var(--info)",
            fontSize: "13px",
          }}
        >
          No VHC red or amber repairs have been recorded yet.
        </div>
      );
    }

    return (
      <div
        style={{
          border: "1px solid var(--accent-purple-surface)",
          borderRadius: "16px",
          background: "var(--surface)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr
                style={{
                  background: "var(--info-surface)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--info)",
                  fontSize: "11px",
                }}
              >
                <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "280px" }}>VHC Item</th>
                <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "200px" }}>Linked Parts</th>
                <th style={{ textAlign: "right", padding: "12px 16px", minWidth: "120px" }}>Parts Cost</th>
                <th style={{ textAlign: "center", padding: "12px 16px", minWidth: "100px" }}>Warranty</th>
                <th style={{ textAlign: "center", padding: "12px 16px", minWidth: "180px" }}>Parts Not Required</th>
              </tr>
            </thead>
            <tbody>
              {vhcItemsWithParts.map((item) => {
                const { vhcItem, linkedParts, vhcId, canonicalVhcId } = item;
                const isPartsNotRequired = partsNotRequired.has(vhcId);
                const isWarranty = warrantyRows.has(vhcId);
                const partsCost = partsCostByVhcItem.get(canonicalVhcId || vhcId) || 0;
                const hasParts = linkedParts.length > 0;

                // VHC item details
                const vhcLabel = vhcItem?.label || "VHC Item";
                const vhcNotes = vhcItem?.notes || vhcItem?.concernText || "";
                const vhcSeverity = vhcItem?.rawSeverity || vhcItem?.displaySeverity;
                const vhcCategory = vhcItem?.categoryLabel || vhcItem?.category?.label || "";
                const locationLabel = vhcItem?.location
                  ? LOCATION_LABELS[vhcItem.location] || vhcItem.location.replace(/_/g, " ")
                  : null;

                const severityBadgeStyles = vhcSeverity ? buildSeverityBadgeStyles(vhcSeverity) : null;

                const isExpanded = expandedVhcItems.has(vhcId);

                // Check if row is locked (authorized or declined)
                const entry = getEntryForItem(vhcId);
                const isLocked = entry.status === "authorized" || entry.status === "declined";

                return (
                  <React.Fragment key={vhcId}>
                  <tr
                    onClick={() => handleVhcItemRowClick(vhcId)}
                    style={{
                      borderBottom: isExpanded ? "none" : "1px solid var(--info-surface)",
                      background: vhcSeverity ? SEVERITY_THEME[vhcSeverity]?.background : "var(--surface)",
                      cursor: "pointer",
                      transition: "background 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      const hoverColor = vhcSeverity && SEVERITY_THEME[vhcSeverity]?.hover
                        ? SEVERITY_THEME[vhcSeverity].hover
                        : "var(--accent-purple-surface)";
                      e.currentTarget.style.background = hoverColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = vhcSeverity ? SEVERITY_THEME[vhcSeverity]?.background : "var(--surface)";
                    }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <div>
                        <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                          {vhcCategory}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--accent-purple)", marginTop: "2px" }}>
                          {vhcLabel}
                        </div>
                        {vhcNotes && (
                          <div style={{ fontSize: "12px", color: "var(--info-dark)", marginTop: "4px" }}>
                            {vhcNotes}
                          </div>
                        )}
                        {locationLabel && (
                          <div style={{ fontSize: "11px", color: "var(--info)", marginTop: "4px" }}>
                            Location: {locationLabel}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {hasParts ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {linkedParts.map((part) => (
                            <div key={part.id} style={{ fontSize: "12px", color: "var(--info-dark)" }}>
                              <div style={{ fontWeight: 600, color: "var(--accent-purple)" }}>
                                {part.part?.name || "Part"}
                              </div>
                              <div style={{ fontSize: "11px", color: "var(--info)" }}>
                                {part.part?.part_number || "—"} × {part.quantity_requested || 1}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: "12px", color: "var(--info)", fontStyle: "italic" }}>
                          No parts added yet
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: 700,
                          color: isPartsNotRequired ? "var(--info)" : "var(--accent-purple)",
                          textDecoration: isPartsNotRequired ? "line-through" : "none",
                        }}
                      >
                        £{partsCost.toFixed(2)}
                      </div>
                      {!hasParts && !isPartsNotRequired && (
                        <div style={{ fontSize: "11px", color: "var(--warning)", marginTop: "2px" }}>
                          Add parts via Parts tab
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      {isWarranty ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "26px",
                            height: "26px",
                            borderRadius: "6px",
                            background: "var(--primary)",
                            color: "var(--surface)",
                            fontWeight: 700,
                            fontSize: "13px",
                            letterSpacing: "0.06em",
                          }}
                          title="Warranty part linked"
                        >
                          W
                        </span>
                      ) : (
                        <span style={{ color: "var(--info-light)", fontSize: "12px" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!isLocked) {
                            handlePartsNotRequiredToggle(vhcId);
                          }
                        }}
                        disabled={isLocked}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "8px",
                          border: isPartsNotRequired ? "1px solid var(--success)" : "1px solid var(--accent-purple-surface)",
                          background: isPartsNotRequired ? "var(--success)" : "var(--surface)",
                          color: isPartsNotRequired ? "var(--surface)" : "var(--info-dark)",
                          fontWeight: 600,
                          cursor: isLocked ? "not-allowed" : "pointer",
                          fontSize: "12px",
                          transition: "all 0.2s ease",
                          opacity: isLocked ? 0.5 : 1,
                        }}
                        title={isLocked ? "Cannot modify authorized or declined items" : ""}
                      >
                        {isPartsNotRequired ? "✓ Not Required" : "Mark Not Required"}
                      </button>
                    </td>
                  </tr>

                  {/* Expandable Details Row */}
                  {isExpanded && (
                    <tr>
                      <td colSpan="5" style={{ padding: "0", borderBottom: "1px solid var(--info-surface)" }}>
                        <div style={{ padding: "24px", background: "var(--surface-light)" }}>
                          {/* Add Part Button */}
                          <div style={{ marginBottom: "20px" }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                if (!isLocked) {
                                  handleAddPartButtonClick(item, e);
                                }
                              }}
                              disabled={isLocked}
                              style={{
                                padding: "10px 20px",
                                borderRadius: "8px",
                                border: "1px solid var(--primary)",
                                background: isLocked ? "var(--surface-light)" : "var(--primary)",
                                color: isLocked ? "var(--info)" : "var(--surface)",
                                fontWeight: 600,
                                cursor: isLocked ? "not-allowed" : "pointer",
                                fontSize: "13px",
                                transition: "all 0.2s ease",
                                opacity: isLocked ? 0.5 : 1,
                              }}
                              title={isLocked ? "Cannot add parts to authorized or declined items" : ""}
                            >
                              + Add New Part
                            </button>
                          </div>

                          {/* Part Details Sections */}
                          {linkedParts.length === 0 ? (
                            <div style={{
                              padding: "24px",
                              borderRadius: "12px",
                              background: "var(--info-surface)",
                              border: "1px solid var(--accent-purple-surface)",
                              textAlign: "center",
                              color: "var(--info)",
                              fontSize: "13px",
                            }}>
                              No parts added yet. Click "Add New Part" to add parts to this VHC item.
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                              {linkedParts.map((part) => {
                                const partKey = `${vhcId}-${part.id}`;
                                const details = partDetails[partKey] || {};
                                const partNumber = details.partNumber || part.part?.part_number || "";
                                const partName = details.partName || part.part?.name || "";
                                const costToCustomer = details.costToCustomer !== undefined ? details.costToCustomer : (Number(part.unit_price || part.part?.unit_price || 0));
                                const costToCompany = details.costToCompany !== undefined ? details.costToCompany : (Number(part.unit_cost || part.part?.unit_cost || 0));
                                const vat = details.vat !== undefined ? details.vat : (costToCustomer * 0.2);
                                const totalWithVat = details.totalWithVat !== undefined ? details.totalWithVat : (costToCustomer + vat);
                                const inStock = details.inStock !== undefined ? details.inStock : ((part.part?.qty_in_stock || 0) > 0);
                                const backOrder = details.backOrder || false;
                                const warranty = details.warranty || false;
                                const isRemovingPart = removingPartIds.has(part.id);

                                return (
                                  <div
                                    key={partKey}
                                    style={{
                                      padding: "20px",
                                      borderRadius: "12px",
                                      background: "var(--surface)",
                                      border: "1px solid var(--accent-purple-surface)",
                                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                                    }}
                                  >
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                                      {/* Part Number */}
                                      <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--info)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                          Part Number
                                        </label>
                                        <input
                                          type="text"
                                          value={partNumber}
                                          readOnly
                                          style={{
                                            width: "100%",
                                            padding: "10px",
                                            borderRadius: "8px",
                                            border: "1px solid var(--accent-purple-surface)",
                                            background: "var(--info-surface)",
                                            fontSize: "13px",
                                            color: "var(--info-dark)",
                                          }}
                                        />
                                      </div>

                                      {/* Part Name */}
                                      <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--info)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                          Part Name
                                        </label>
                                        <input
                                          type="text"
                                          value={partName}
                                          readOnly
                                          style={{
                                            width: "100%",
                                            padding: "10px",
                                            borderRadius: "8px",
                                            border: "1px solid var(--accent-purple-surface)",
                                            background: "var(--info-surface)",
                                            fontSize: "13px",
                                            color: "var(--info-dark)",
                                          }}
                                        />
                                      </div>

                                      {/* Cost to Customer */}
                                      <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--info)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                          Cost to Customer (ex VAT)
                                        </label>
                                        <input
                                          type="text"
                                          value={`£${costToCustomer.toFixed(2)}`}
                                          readOnly
                                          style={{
                                            width: "100%",
                                            padding: "10px",
                                            borderRadius: "8px",
                                            border: "1px solid var(--accent-purple-surface)",
                                            background: "var(--info-surface)",
                                            fontSize: "13px",
                                            fontWeight: 600,
                                            color: "var(--accent-purple)",
                                          }}
                                        />
                                      </div>

                                      {/* Cost to Company */}
                                      <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--info)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                          Cost to Company
                                        </label>
                                        <input
                                          type="text"
                                          value={`£${costToCompany.toFixed(2)}`}
                                          readOnly
                                          style={{
                                            width: "100%",
                                            padding: "10px",
                                            borderRadius: "8px",
                                            border: "1px solid var(--accent-purple-surface)",
                                            background: "var(--info-surface)",
                                            fontSize: "13px",
                                            color: "var(--info-dark)",
                                          }}
                                        />
                                      </div>

                                      {/* VAT (20%) */}
                                      <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--info)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                          VAT (20%)
                                        </label>
                                        <input
                                          type="text"
                                          value={`£${vat.toFixed(2)}`}
                                          readOnly
                                          style={{
                                            width: "100%",
                                            padding: "10px",
                                            borderRadius: "8px",
                                            border: "1px solid var(--accent-purple-surface)",
                                            background: "var(--info-surface)",
                                            fontSize: "13px",
                                            color: "var(--info-dark)",
                                          }}
                                        />
                                      </div>

                                    </div>
                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                        gap: "16px",
                                        marginTop: "16px",
                                        alignItems: "end",
                                      }}
                                    >
                                      <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--info)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                          Total (inc VAT)
                                        </label>
                                        <input
                                          type="text"
                                          value={`£${totalWithVat.toFixed(2)}`}
                                          readOnly
                                          style={{
                                            width: "100%",
                                            padding: "10px",
                                            borderRadius: "8px",
                                            border: "1px solid var(--primary)",
                                            background: "var(--accent-purple-surface)",
                                            fontSize: "13px",
                                            fontWeight: 700,
                                            color: "var(--primary)",
                                          }}
                                        />
                                      </div>
                                      <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--info)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                          Stock Status
                                        </label>
                                        <label style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "8px",
                                          padding: "10px",
                                          cursor: "pointer",
                                          userSelect: "none",
                                          border: "1px solid var(--accent-purple-surface)",
                                          borderRadius: "8px",
                                        }}>
                                          <input
                                            type="checkbox"
                                            checked={inStock}
                                            onChange={(e) => handlePartDetailChange(partKey, "inStock", e.target.checked)}
                                          />
                                          <span style={{
                                            fontSize: "13px",
                                            fontWeight: 600,
                                            color: inStock ? "var(--success)" : "var(--info-dark)",
                                          }}>
                                            {inStock ? "In Stock" : "Out of Stock"}
                                          </span>
                                        </label>
                                      </div>
                                      <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--info)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                          Order Status
                                        </label>
                                        <label style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "8px",
                                          padding: "10px",
                                          cursor: "pointer",
                                          userSelect: "none",
                                          border: "1px solid var(--accent-purple-surface)",
                                          borderRadius: "8px",
                                        }}>
                                          <input
                                            type="checkbox"
                                            checked={backOrder}
                                            onChange={(e) => handlePartDetailChange(partKey, "backOrder", e.target.checked)}
                                          />
                                          <span style={{
                                            fontSize: "13px",
                                            fontWeight: 600,
                                            color: backOrder ? "var(--warning)" : "var(--info-dark)",
                                          }}>
                                            {backOrder ? "On Back Order" : "Regular Order"}
                                          </span>
                                        </label>
                                      </div>
                                      <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--info)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                          Warranty
                                        </label>
                                        <label style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "8px",
                                          padding: "10px",
                                          cursor: "pointer",
                                          userSelect: "none",
                                          borderRadius: "8px",
                                          border: "1px solid var(--accent-purple-surface)",
                                        }}>
                                          <input
                                            type="checkbox"
                                            checked={warranty}
                                            onChange={(e) => handlePartDetailChange(partKey, "warranty", e.target.checked)}
                                          />
                                          <span style={{
                                            fontSize: "13px",
                                            fontWeight: 600,
                                            color: warranty ? "var(--primary)" : "var(--info-dark)",
                                          }}>
                                            {warranty ? "Warranty Item" : "Standard Item"}
                                          </span>
                                        </label>
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          justifyContent: "flex-end",
                                          alignItems: "flex-end",
                                        }}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!isLocked) {
                                              handleRemovePart(part, vhcId);
                                            }
                                          }}
                                          disabled={isRemovingPart || isLocked}
                                          style={{
                                            padding: "10px 18px",
                                            borderRadius: "8px",
                                            border: "1px solid var(--danger)",
                                            background: (isRemovingPart || isLocked) ? "var(--danger-surface)" : "var(--surface)",
                                            color: "var(--danger)",
                                            fontWeight: 600,
                                            cursor: (isRemovingPart || isLocked) ? "not-allowed" : "pointer",
                                            transition: "all 0.2s ease",
                                            opacity: isLocked ? 0.5 : 1,
                                          }}
                                          title={isLocked ? "Cannot remove parts from authorized or declined items" : ""}
                                        >
                                          {isRemovingPart ? "Removing…" : "Remove"}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }, [vhcItemsWithParts, partsNotRequired, warrantyRows, partsCostByVhcItem, handlePartsNotRequiredToggle, handleVhcItemRowClick, expandedVhcItems, partDetails, handleAddPartButtonClick, handlePartDetailChange, handleRemovePart, removingPartIds]);

  // Render parts panel with table
  const renderPartsPanel = useCallback((title, parts, emptyMessage) => {
    if (!parts || parts.length === 0) {
      return (
        <div
          style={{
            padding: "18px",
            border: "1px solid var(--info-surface)",
            borderRadius: "12px",
            background: "var(--info-surface)",
            color: "var(--info)",
            fontSize: "13px",
          }}
        >
          {emptyMessage}
        </div>
      );
    }

    const isAuthorisedSection = title === "Parts Authorized";
    const isOnOrderSection = title === "Parts On Order";

    return (
      <div
        style={{
          border: "1px solid var(--accent-purple-surface)",
          borderRadius: "16px",
          background: "var(--surface)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr
                style={{
                  background: "var(--info-surface)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--info)",
                  fontSize: "11px",
                }}
              >
                <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "200px" }}>Part Name</th>
                <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "140px" }}>Part Number</th>
                <th style={{ textAlign: "center", padding: "12px 16px", minWidth: "80px" }}>Quantity</th>
                <th style={{ textAlign: "right", padding: "12px 16px", minWidth: "100px" }}>Price</th>
                {isAuthorisedSection && (
                  <>
                    <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "140px" }}>Stock Status</th>
                    <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "120px" }}>Location</th>
                    <th style={{ textAlign: "center", padding: "12px 16px", minWidth: "100px" }}>Labour (hrs)</th>
                    <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "180px" }}>Pre-Pick Location</th>
                    <th style={{ textAlign: "center", padding: "12px 16px", minWidth: "120px" }}>Action</th>
                  </>
                )}
                {isOnOrderSection && (
                  <>
                    <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "120px" }}>ETA Date</th>
                    <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "100px" }}>ETA Time</th>
                    <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "140px" }}>Supplier Ref</th>
                    <th style={{ textAlign: "center", padding: "12px 16px", minWidth: "100px" }}>Action</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {parts.map((partItem) => {
                const part = partItem.part || {};
                const price = partItem.unit_price ?? part.unit_price ?? 0;
                const stockStatusBadge = partItem.stock_status || "—";
                const prePickLocation = partItem.pre_pick_location || "";

                return (
                  <tr
                    key={partItem.id}
                    style={{
                      borderBottom: "1px solid var(--info-surface)",
                      background: "var(--surface)",
                    }}
                  >
                    <td style={{ padding: "12px 16px", color: "var(--accent-purple)", fontWeight: 600 }}>
                      {part.name || "—"}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--info-dark)" }}>
                      {part.part_number || "—"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", color: "var(--info-dark)" }}>
                      {partItem.quantity_requested || 1}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--info-dark)", fontWeight: 600 }}>
                      £{Number(price).toFixed(2)}
                    </td>
                    {isAuthorisedSection && (
                      <>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 600,
                              background:
                                stockStatusBadge === "in_stock"
                                  ? "var(--success-surface)"
                                  : stockStatusBadge === "no_stock"
                                  ? "var(--danger-surface)"
                                  : "var(--warning-surface)",
                              color:
                                stockStatusBadge === "in_stock"
                                  ? "var(--success)"
                                  : stockStatusBadge === "no_stock"
                                  ? "var(--danger)"
                                  : "var(--warning)",
                            }}
                          >
                            {stockStatusBadge === "in_stock"
                              ? "In Stock"
                              : stockStatusBadge === "no_stock"
                              ? "No Stock"
                              : stockStatusBadge === "back_order"
                              ? "Back Order"
                              : "—"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--info-dark)" }}>
                          {partItem.storage_location || "—"}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center", color: "var(--info-dark)" }}>
                          {partItem.labour_hours ?? "—"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <select
                            value={prePickLocation}
                            onChange={(e) => handlePrePickLocationChange(partItem.id, e.target.value)}
                            style={{
                              padding: "8px 12px",
                              borderRadius: "8px",
                              border: "1px solid var(--accent-purple-surface)",
                              background: "var(--surface)",
                              color: "var(--accent-purple)",
                              fontWeight: 500,
                              cursor: "pointer",
                              width: "100%",
                            }}
                          >
                            <option value="">Select Location</option>
                            <option value="service_rack_1">Service Rack 1</option>
                            <option value="service_rack_2">Service Rack 2</option>
                            <option value="service_rack_3">Service Rack 3</option>
                            <option value="service_rack_4">Service Rack 4</option>
                            <option value="no_pick">No Pick</option>
                            <option value="on_order">On Order</option>
                          </select>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleAddToJobClick(partItem)}
                            disabled={readOnly}
                            style={{
                              padding: "8px 16px",
                              borderRadius: "8px",
                              border: "1px solid var(--primary)",
                              background: readOnly ? "var(--surface-light)" : "var(--primary)",
                              color: readOnly ? "var(--info)" : "var(--surface)",
                              fontWeight: 600,
                              cursor: readOnly ? "not-allowed" : "pointer",
                              fontSize: "12px",
                              opacity: readOnly ? 0.5 : 1,
                            }}
                          >
                            Add to Job
                          </button>
                        </td>
                      </>
                    )}
                    {isOnOrderSection && (
                      <>
                        <td style={{ padding: "12px 16px", color: "var(--info-dark)" }}>
                          {partItem.eta_date || "—"}
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--info-dark)" }}>
                          {partItem.eta_time || "—"}
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--info-dark)" }}>
                          {partItem.supplier_reference || "—"}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => handlePartArrived(partItem.id)}
                            style={{
                              padding: "8px 16px",
                              borderRadius: "8px",
                              border: "1px solid var(--success)",
                              background: "var(--success)",
                              color: "var(--surface)",
                              fontWeight: 600,
                              cursor: "pointer",
                              fontSize: "12px",
                            }}
                          >
                            Here
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }, [handlePrePickLocationChange, handlePartArrived]);

  // Render file gallery (photos/videos)
  const renderFileGallery = useCallback((title, files, emptyMessage, fileType) => {
    if (!files || files.length === 0) {
      return (
        <div
          style={{
            padding: "18px",
            border: "1px solid var(--info-surface)",
            borderRadius: "12px",
            background: "var(--info-surface)",
            color: "var(--info)",
            fontSize: "13px",
          }}
        >
          {emptyMessage}
        </div>
      );
    }

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        {files.map((file) => (
          <div
            key={file.file_id}
            style={{
              border: "1px solid var(--accent-purple-surface)",
              borderRadius: "12px",
              overflow: "hidden",
              background: "var(--surface)",
            }}
          >
            {fileType === "photo" ? (
              <img
                src={file.file_url}
                alt={file.file_name}
                style={{
                  width: "100%",
                  height: "150px",
                  objectFit: "cover",
                }}
              />
            ) : (
              <video
                src={file.file_url}
                controls
                style={{
                  width: "100%",
                  height: "150px",
                }}
              />
            )}
            <div style={{ padding: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "8px" }}>
                <div style={{ fontSize: "12px", color: "var(--accent-purple)", fontWeight: 600, flex: 1 }}>
                  {file.file_name}
                </div>
                {file.visible_to_customer !== undefined && (
                  <span
                    style={{
                      fontSize: "14px",
                      flexShrink: 0,
                    }}
                    title={file.visible_to_customer ? "Visible to customer" : "Internal only"}
                  >
                    {file.visible_to_customer ? "👁️" : "🔒"}
                  </span>
                )}
              </div>
              <div style={{ fontSize: "11px", color: "var(--info)", marginTop: "4px" }}>
                {formatDateTime(file.uploaded_at)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }, []);

  if (!resolvedJobNumber) {
    return renderStatusMessage("Provide a job number to view VHC details.");
  }

  if (loading) {
    return renderStatusMessage("Loading VHC details…");
  }

  if (error) {
    return renderStatusMessage(error, "var(--danger)");
  }

  const jobHeader = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "12px",
        alignItems: "center",
        width: "100%",
      }}
    >
      <div>
        <div style={{ fontSize: "12px", color: "var(--info)", textTransform: "uppercase", letterSpacing: "0.16em" }}>Job</div>
        <div style={{ fontSize: "20px", fontWeight: 700 }}>{job?.job_number || "—"}</div>
      </div>
      <div>
        <div style={{ fontSize: "12px", color: "var(--info)", textTransform: "uppercase", letterSpacing: "0.16em" }}>Reg</div>
        <div style={{ fontSize: "20px", fontWeight: 700 }}>{job?.vehicle?.registration || job?.vehicle_reg || "—"}</div>
      </div>
      <div>
        <div style={{ fontSize: "12px", color: "var(--info)", textTransform: "uppercase", letterSpacing: "0.16em" }}>Customer</div>
        <div style={{ fontSize: "15px", fontWeight: 600 }}>{customerName}</div>
      </div>
      <div>
        <div style={{ fontSize: "12px", color: "var(--info)", textTransform: "uppercase", letterSpacing: "0.16em" }}>Mileage</div>
        <div style={{ fontSize: "15px", fontWeight: 600 }}>{job?.vehicle?.mileage ? `${job.vehicle.mileage} mi` : job?.mileage ? `${job.mileage} mi` : "—"}</div>
      </div>
      <div>
        <div style={{ fontSize: "12px", color: "var(--info)", textTransform: "uppercase", letterSpacing: "0.16em" }}>Submitted</div>
        <div style={{ fontSize: "15px", fontWeight: 600 }}>{formatDateTime(workflow?.vhc_sent_at || workflow?.last_sent_at || job?.created_at)}</div>
      </div>
      <div style={{ justifySelf: "end" }}>
        <span
          style={{
            padding: "6px 12px",
            borderRadius: "999px",
            background: "var(--accent-purple)",
            color: "var(--surface)",
            fontWeight: 600,
            textTransform: "capitalize",
          }}
        >
          {workflow?.status || job?.status || "—"}
        </span>
      </div>
    </div>
  );

  const pageWrapperStyle = {
    padding: containerPadding,
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  };

  return (
    <div style={pageWrapperStyle}>
      {showNavigation && (
        <div style={PANEL_SECTION_STYLE}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => router.push("/vhc/dashboard")}
              style={{
                border: "1px solid var(--accent-purple-surface)",
                borderRadius: "10px",
                padding: "8px 14px",
                background: "var(--surface)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ← Back
            </button>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              {/* Button to redirect to car and key tracking page with job details pre-filled */}
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams({
                    jobNumber: job?.job_number || "",
                    reg: job?.vehicle?.reg || job?.vehicle?.registration || "",
                    customer: job?.customer?.name || `${job?.customer?.firstname || ""} ${job?.customer?.lastname || ""}`.trim() || "",
                    makeModel: job?.vehicle?.make_model || `${job?.vehicle?.make || ""} ${job?.vehicle?.model || ""}`.trim() || "",
                    colour: job?.vehicle?.colour || "",
                    openPopup: "true"
                  });
                  router.push(`/tracking?${params.toString()}`);
                }}
                style={{
                  border: "1px solid var(--accent-purple)",
                  borderRadius: "10px",
                  padding: "8px 18px",
                  background: "var(--accent-purple)",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                disabled={!job?.job_number}
              >
                Car and Key Tracker
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = job?.job_number ? `/job-cards/${encodeURIComponent(job.job_number)}` : "/job-cards";
                  router.push(target);
                }}
                style={{
                  border: "1px solid var(--primary)",
                  borderRadius: "10px",
                  padding: "8px 18px",
                  background: "var(--primary)",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                disabled={!job?.job_number}
              >
                View job card →
              </button>
            </div>
          </div>
          {jobHeader}
        </div>
      )}

      <div style={PANEL_SECTION_STYLE}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <nav
            style={{
              borderRadius: "999px",
              border: "1px solid var(--surface-light)",
              background: "var(--surface)",
              padding: "6px",
              display: "flex",
              gap: "6px",
              overflowX: "auto",
              scrollbarWidth: "thin",
              scrollbarColor: "var(--scrollbar-thumb) transparent",
              scrollBehavior: "smooth",
              WebkitOverflowScrolling: "touch",
            }}
            className="vhc-tabs-scroll-container"
            aria-label="VHC tabs"
          >
            {TAB_OPTIONS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: "0 0 auto",
                    borderRadius: "999px",
                    border: "1px solid transparent",
                    padding: "10px 20px",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: isActive ? "var(--primary)" : "transparent",
                    color: isActive ? "var(--text-inverse)" : "var(--text-primary)",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
          {customActions && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {typeof customActions === "function" ? customActions(activeTab) : customActions}
            </div>
          )}
        </div>
        <div style={TAB_CONTENT_STYLE}>
          {activeTab === "summary" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {["red", "amber"].map((severity) => {
                const section = severitySections[severity];
                if (!section || section.size === 0) return null;
                const meta = SEVERITY_META[severity];
                const severityTheme = SEVERITY_THEME[severity] || { border: "var(--info-surface)", background: "var(--danger-surface)" };
                return (
                  <div
                    key={severity}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                      border: `2px solid ${severityTheme.border}`,
                      borderRadius: "18px",
                      padding: "18px",
                      background: "var(--surface)",
                      boxShadow: "none",
                    }}
                  >
                    <div
                      style={{
                        borderBottom: `1px solid ${severityTheme.border}`,
                        paddingBottom: "10px",
                      }}
                    >
                      <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: meta.accent }}>{meta.title}</h2>
                      {meta.description ? (
                        <p style={{ margin: "4px 0 0", color: "var(--info)" }}>{meta.description}</p>
                      ) : null}
                    </div>
                    {renderSeverityTable(severity)}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "health-check" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flex: 1, minWidth: "240px" }}>
                  <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--accent-purple)" }}>
                    Health check
                  </h3>
                </div>
                {sectionSaveMessage ? (
                  <span style={{ fontSize: "12px", fontWeight: 600, color: sectionSaveColor }}>
                    {sectionSaveMessage}
                  </span>
                ) : null}
              </div>

              {orderedHealthSections.map(({ config, data, rawData }) => (
                <HealthSectionCard
                  key={config.key}
                  config={config}
                  section={data}
                  rawData={rawData}
                  onOpen={handleOpenSection}
                />
              ))}

              {!hasHealthData && (
                <div
                  style={{
                    border: "1px dashed var(--accent-purple-surface)",
                    borderRadius: "14px",
                    padding: "20px",
                    background: "var(--surface)",
                    color: "var(--info)",
                    fontSize: "13px",
                    textAlign: "center",
                  }}
                >
                  Technicians have not recorded any VHC data yet. Use the section buttons above to open the full builder
                  forms and start a health check for this job.
                </div>
              )}
            </div>
          )}

          {activeTab === "parts-identified" && (
            <div id="parts-identified">
              {renderVhcItemsPanel()}
            </div>
          )}

          {activeTab === "parts-authorized" &&
            renderPartsPanel("Parts Authorized", partsAuthorized, "No parts awaiting authorization or approvals recorded.")}

          {activeTab === "parts-on-order" &&
            renderPartsPanel("Parts On Order", partsOnOrder, "No parts have been raised with the parts department yet.")}

          {activeTab === "photos" &&
            renderFileGallery("Photos", photoFiles, "No customer-facing photos have been attached.", "photo")}

          {activeTab === "videos" &&
            renderFileGallery("Videos", videoFiles, "No customer-facing videos have been attached.", "video")}
        </div>
      </div>

      {activeSection === "wheelsTyres" && (
        <WheelsTyresDetailsModal
          isOpen
          initialData={vhcData.wheelsTyres}
          onClose={(draft) => handleSectionDismiss("wheelsTyres", draft)}
          onComplete={(data) => handleSectionComplete("wheelsTyres", data)}
        />
      )}
      {activeSection === "brakesHubs" && (
        <BrakesHubsDetailsModal
          isOpen
          initialData={vhcData.brakesHubs}
          onClose={(draft) => handleSectionDismiss("brakesHubs", draft)}
          onComplete={(data) => handleSectionComplete("brakesHubs", data)}
        />
      )}
      {activeSection === "serviceIndicator" && (
        <ServiceIndicatorDetailsModal
          isOpen
          initialData={vhcData.serviceIndicator}
          onClose={(draft) => handleSectionDismiss("serviceIndicator", draft)}
          onComplete={(data) => handleSectionComplete("serviceIndicator", data)}
        />
      )}
      {activeSection === "externalInspection" && (
        <ExternalDetailsModal
          isOpen
          initialData={vhcData.externalInspection}
          onClose={(draft) => handleSectionDismiss("externalInspection", draft)}
          onComplete={(data) => handleSectionComplete("externalInspection", data)}
        />
      )}
      {activeSection === "internalElectrics" && (
        <InternalElectricsDetailsModal
          isOpen
          initialData={vhcData.internalElectrics}
          onClose={(draft) => handleSectionDismiss("internalElectrics", draft)}
          onComplete={(data) => handleSectionComplete("internalElectrics", data)}
        />
      )}
      {activeSection === "underside" && (
        <UndersideDetailsModal
          isOpen
          initialData={vhcData.underside}
          onClose={(draft) => handleSectionDismiss("underside", draft)}
          onComplete={(data) => handleSectionComplete("underside", data)}
        />
      )}

      {/* Part Search Modal */}
      <PartSearchModal
        isOpen={isPartSearchModalOpen}
        onClose={handleClosePartSearchModal}
        vhcItemData={selectedVhcItem}
        jobNumber={resolvedJobNumber}
        onPartSelected={handlePartAdded}
      />

      {/* Pre-Pick Location Modal */}
      <PrePickLocationModal
        isOpen={isPrePickModalOpen}
        onClose={handleClosePrePickModal}
        onConfirm={handleConfirmPrePickLocation}
        partName={selectedPartForJob?.part?.name || "Part"}
        initialLocation=""
        allowSkip={true}
      />

      <style jsx global>{`
        .vhc-tabs-scroll-container::-webkit-scrollbar {
          height: 6px;
        }

        .vhc-tabs-scroll-container::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 999px;
        }

        .vhc-tabs-scroll-container::-webkit-scrollbar-thumb {
          background: var(--scrollbar-thumb);
          border-radius: 999px;
        }

        .vhc-tabs-scroll-container::-webkit-scrollbar-thumb:hover {
          background: var(--scrollbar-thumb-hover);
        }
      `}</style>
    </div>
  );
}
