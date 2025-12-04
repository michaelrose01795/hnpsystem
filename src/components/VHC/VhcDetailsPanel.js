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
  brakesHubs: [],
  serviceIndicator: { serviceChoice: "", oilStatus: "", concerns: [] },
  externalInspection: [],
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

const buildVhcPayload = (source = {}) => {
  const base = baseVhcPayload();
  return {
    wheelsTyres: source.wheelsTyres || null,
    brakesHubs: normaliseConcernEntries(source.brakesHubs),
    serviceIndicator: {
      serviceChoice: source.serviceIndicator?.serviceChoice || "",
      oilStatus: source.serviceIndicator?.oilStatus || "",
      concerns: ensureArray(source.serviceIndicator?.concerns),
    },
    externalInspection: normaliseConcernEntries(source.externalInspection),
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
  red: { background: "var(--danger-surface)", border: "var(--danger-surface)", text: "var(--danger)" },
  amber: { background: "var(--warning-surface)", border: "var(--warning-surface)", text: "var(--danger-dark)" },
  green: { background: "var(--success-surface)", border: "var(--success)", text: "var(--info-dark)" },
  grey: { background: "var(--info-surface)", border: "var(--accent-purple-surface)", text: "var(--info-dark)" },
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

export default function VhcDetailsPanel({ jobNumber, showNavigation = true, readOnly = false }) {
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

        const { vhc_checks = [], parts_job_items = [], job_files = [], ...jobFields } = jobRow;
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
        const status = normalisePartStatus(part.status);
        return status.includes("authorized") || status.includes("approved");
      }),
    [jobParts]
  );
  const partsOnOrder = useMemo(
    () =>
      jobParts.filter((part) => {
        const status = normalisePartStatus(part.status);
        return status.includes("order");
      }),
    [jobParts]
  );
  const partsCostByVhcItem = useMemo(() => {
    const map = new Map();
    partsIdentified.forEach((part) => {
      if (!part?.vhc_item_id) return;
      const qtyValue = Number(part.quantity_requested);
      const resolvedQty = Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 1;
      const unitPriceValue = Number(part.unit_price ?? part.part?.unit_price ?? 0);
      if (!Number.isFinite(unitPriceValue)) return;
      const key = String(part.vhc_item_id);
      const subtotal = resolvedQty * unitPriceValue;
      map.set(key, (map.get(key) || 0) + subtotal);
    });
    return map;
  }, [partsIdentified]);
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

    const locationRanks = new Map();
    items.forEach((item) => {
      if (!item.location) return;
      const rank = SEVERITY_RANK[item.rawSeverity] || 0;
      const prev = locationRanks.get(item.location) || 0;
      if (rank > prev) {
        locationRanks.set(item.location, rank);
      }
    });

    items.forEach((item) => {
      if (!item.location) {
        item.displaySeverity = item.rawSeverity;
        return;
      }
      const locRank = locationRanks.get(item.location) || 0;
      const itemRank = SEVERITY_RANK[item.rawSeverity] || 0;
      item.displaySeverity = locRank > itemRank ? "red" : item.rawSeverity;
    });

    const categoryRanks = new Map();
    items.forEach((item) => {
      const categoryId = item.category?.id;
      if (!categoryId || ISOLATED_SUMMARY_CATEGORIES.has(categoryId)) return;
      const rank = SEVERITY_RANK[item.displaySeverity || item.rawSeverity] ?? 0;
      const prev = categoryRanks.get(categoryId) ?? -1;
      if (rank > prev) {
        categoryRanks.set(categoryId, rank);
      }
    });

    items.forEach((item) => {
      const categoryId = item.category?.id;
      if (!categoryId || ISOLATED_SUMMARY_CATEGORIES.has(categoryId)) return;
      const categoryRank = categoryRanks.get(categoryId);
      if (typeof categoryRank !== "number") return;
      const currentRank = SEVERITY_RANK[item.displaySeverity || item.rawSeverity] ?? -1;
      if (categoryRank > currentRank) {
        item.displaySeverity = RANK_TO_SEVERITY[categoryRank] || item.displaySeverity || "red";
      }
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
  const ensureEntryValue = (state, itemId) =>
    state[itemId] || { partsCost: "", laborHours: "", totalOverride: "", status: null };

  const updateEntryValue = (itemId, field, value) => {
    setItemEntries((prev) => ({
      ...prev,
      [itemId]: { ...ensureEntryValue(prev, itemId), [field]: value },
    }));
  };

  const getEntryForItem = (itemId) => ensureEntryValue(itemEntries, itemId);

  const parseNumericValue = (value) => {
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : 0;
  };

  const computeLabourCost = (hours) => parseNumericValue(hours) * LABOUR_RATE;

  const resolvePartsCost = (itemId, entry) => {
    if (partsCostByVhcItem.has(itemId)) {
      return partsCostByVhcItem.get(itemId);
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

  const determineStatusColor = (entry, resolvedPartsCost) => {
    if (entry.status === "authorized") return "var(--success)";
    if (entry.status === "declined") return "var(--danger)";
    const hasLabour = parseNumericValue(entry.laborHours) > 0;
    const hasCosts =
      (resolvedPartsCost ?? parseNumericValue(entry.partsCost)) > 0 || parseNumericValue(entry.totalOverride) > 0;
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
                <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "180px" }}>Parts (Cost £)</th>
                <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "160px" }}>Labour</th>
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
                const statusColor = determineStatusColor(entry, resolvedPartsCost);
                const locationLabel = item.location
                  ? LOCATION_LABELS[item.location] || item.location.replace(/_/g, " ")
                  : null;
                const isChecked = selectedSet.has(item.id);
                const rowSeverity = item.displaySeverity || severity;
                const rowTheme = SEVERITY_THEME[rowSeverity] || {};
                const detailLabel = item.label || item.sectionName || "Recorded item";
                const concernDetail = item.concernText || "";
                const detailContent = concernDetail || item.notes || "";
                const severityLabel =
                  item.rawSeverity ? item.rawSeverity.charAt(0).toUpperCase() + item.rawSeverity.slice(1) : null;
                const severityBadge = severityLabel ? buildSeverityBadgeStyles(item.rawSeverity) : null;

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
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={partsDisplayValue}
                          placeholder="Add via parts tab"
                          style={{
                            width: "160px",
                            padding: "8px",
                            borderRadius: "8px",
                            border: "1px solid var(--accent-purple-surface)",
                            backgroundColor: "var(--info-surface)",
                          }}
                          disabled
                          readOnly
                        />
                        <a href="#parts-identified" style={{ fontSize: "12px", color: "var(--warning)", textDecoration: "none" }}>
                          View parts tab
                        </a>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={entry.laborHours ?? ""}
                          onChange={(event) => updateEntryValue(item.id, "laborHours", event.target.value)}
                          placeholder="0.0"
                          style={{
                            width: "140px",
                            padding: "8px",
                            borderRadius: "8px",
                            border: "1px solid var(--accent-purple-surface)",
                          }}
                          disabled={readOnly}
                        />
                        <span style={{ fontSize: "12px", color: "var(--info)" }}>£{labourCost.toFixed(2)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={totalDisplayValue}
                          onChange={(event) => updateEntryValue(item.id, "totalOverride", event.target.value)}
                          placeholder="Override total"
                          style={{
                            width: "160px",
                            padding: "8px",
                            borderRadius: "8px",
                            border: "1px solid var(--accent-purple-surface)",
                          }}
                          disabled={readOnly}
                        />
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
        background: "var(--surface)",
        border: "1px solid var(--accent-purple-surface)",
        borderRadius: "16px",
        padding: "16px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "12px",
        alignItems: "center",
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

  return (
    <div style={{ padding: containerPadding, display: "flex", flexDirection: "column", gap: "16px" }}>
      {showNavigation ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
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
      ) : null}

      {showNavigation && jobHeader}

      <div style={{ display: "flex", borderBottom: "1px solid var(--accent-purple-surface)", gap: "8px" }}>
        {TAB_OPTIONS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                border: "none",
                background: "transparent",
                padding: "10px 14px",
                borderBottom: isActive ? "3px solid var(--primary)" : "3px solid transparent",
                color: isActive ? "var(--accent-purple)" : "var(--info)",
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

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
                  boxShadow: "0 12px 30px rgba(var(--shadow-rgb),0.08)",
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
          {renderPartsPanel("Parts Identified", partsIdentified, "No VHC-linked parts have been identified yet.")}
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
    </div>
  );
}
