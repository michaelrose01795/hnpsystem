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
  red: "#ef4444",
  amber: "#f59e0b",
  green: "#10b981",
  grey: "#6b7280",
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
    description: "Tyre tread readings, wheel condition, and spare/repair kit notes.",
  },
  {
    key: "brakesHubs",
    label: "Brakes & Hubs",
    description: "Pad and disc measurements along with hub inspection comments.",
  },
  {
    key: "serviceIndicator",
    label: "Service Indicator & Under Bonnet",
    description: "Service reminders, oil level/condition, and under-bonnet checks.",
  },
  {
    key: "externalInspection",
    label: "External / Drive-in Inspection",
    description: "Bodywork, glass, and drive-in observations recorded by the technician.",
  },
  {
    key: "internalElectrics",
    label: "Internal Electrics",
    description: "Interior lighting, horn, wipers, HVAC, and warning lamp checks.",
  },
  {
    key: "underside",
    label: "Underside Inspection",
    description: "Suspension, steering, exhaust, and leak inspections underneath the vehicle.",
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
    label: "External / Drive-in Inspection",
    keywords: ["external", "drive-in", "drive in", "bodywork", "exterior"],
  },
  {
    id: "internal_electrics",
    label: "Internal / Lamps / Electrics",
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
const LABOUR_RATE = 155;
const SEVERITY_META = {
  red: { title: "Red Repairs", description: "Critical safety issues that require immediate authorization.", accent: "#b91c1c" },
  amber: { title: "Amber Repairs", description: "Advisory items that should be considered soon.", accent: "#d97706" },
};

const COLOUR_CLASS = {
  red: "#fee2e2",
  amber: "#fef3c7",
  green: "#ecfdf5",
  grey: "#f3f4f6",
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

const deriveSectionSeverity = (metrics = {}) => {
  if ((metrics.red || 0) > 0) return "red";
  if ((metrics.amber || 0) > 0) return "amber";
  if ((metrics.grey || 0) > 0) return "grey";
  if ((metrics.total || 0) > 0) return "green";
  return null;
};

const buildSeverityBadgeStyles = (status) => {
  const colour = normaliseColour(status);
  return {
    background: COLOUR_CLASS[colour] || "#f3f4f6",
    color: STATUS_BADGES[colour] || "#374151",
  };
};

const mapRows = (rows = []) => {
  if (!Array.isArray(rows)) return [];
  return rows.filter((entry) => typeof entry === "string" && entry.trim().length > 0);
};

const HealthSectionCard = ({ config, section, onOpen }) => {
  const metrics = section?.metrics || {};
  const severity = deriveSectionSeverity(metrics);
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
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    color: "#4b5563",
  };

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "16px",
        background: "#fff",
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
          <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", letterSpacing: "0.16em" }}>
            Section
          </p>
          <h3 style={{ margin: "4px 0 6px", fontSize: "18px", fontWeight: 700, color: "#111827" }}>
            {config.label}
          </h3>
          <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>{config.description}</p>
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
              border: "1px solid #d10000",
              background: "#d10000",
              color: "#fff",
              fontWeight: 600,
              cursor: onOpen ? "pointer" : "not-allowed",
              opacity: onOpen ? 1 : 0.6,
            }}
            disabled={!onOpen}
          >
            Open Section
          </button>
        </div>
      </div>

      {hasItems ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {items.map((item, idx) => {
            const rows = mapRows(item.rows);
            const concerns = Array.isArray(item.concerns) ? item.concerns.filter(Boolean) : [];
            return (
              <div
                key={`${config.key}-${idx}-${item.heading || item.label || "item"}`}
                style={{
                  border: "1px solid #f3f4f6",
                  borderRadius: "12px",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  background: "#f9fafb",
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
                    <strong style={{ color: "#111827", fontSize: "14px" }}>
                      {item.heading || item.label || `Item ${idx + 1}`}
                    </strong>
                    {item.notes ? (
                      <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "13px" }}>{item.notes}</p>
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
                  <ul style={{ margin: 0, paddingLeft: "18px", color: "#374151", fontSize: "13px" }}>
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
                          color: "#374151",
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
            border: "1px dashed #cbd5f5",
            borderRadius: "12px",
            padding: "16px",
            background: "#f8fafc",
            color: "#64748b",
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
  const [categorySelections, setCategorySelections] = useState({});
  const [activeSection, setActiveSection] = useState(null);
  const [sectionSaveStatus, setSectionSaveStatus] = useState("idle");
  const [sectionSaveError, setSectionSaveError] = useState("");
  const [lastSectionSavedAt, setLastSectionSavedAt] = useState(null);

  const containerPadding = showNavigation ? "24px" : "0";
  const renderStatusMessage = (message, color = "#6b7280") => (
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
              request_notes,
              created_at,
              updated_at,
              part:part_id(
                id,
                part_number,
                name
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
    setCategorySelections({});
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
    }));
  }, [sections]);
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
      ? "#b91c1c"
      : sectionSaveStatus === "saving"
      ? "#d97706"
      : "#6b7280";
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
        const category = resolveCategoryForItem(sectionName, item.label || item.issue_title);
        const location = resolveLocationKey(item);
        items.push({
          id: String(id),
          label: item.label || item.issue_title || "Recorded item",
          notes: item.notes || item.issue_description || "",
          measurement: formatMeasurement(item.measurement),
          sectionName,
          category,
          location,
          rawSeverity: severity,
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

    return items;
  }, [sections]);

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

  const computeRowTotal = (entry) => {
    if (entry.totalOverride !== "" && entry.totalOverride !== null) {
      const override = parseNumericValue(entry.totalOverride);
      if (override > 0) {
        return override;
      }
    }
    return parseNumericValue(entry.partsCost) + computeLabourCost(entry.laborHours);
  };

  const determineStatusColor = (entry) => {
    if (entry.status === "authorized") return "#16a34a";
    if (entry.status === "declined") return "#dc2626";
    const hasLabour = parseNumericValue(entry.laborHours) > 0;
    const hasCosts =
      parseNumericValue(entry.partsCost) > 0 || parseNumericValue(entry.totalOverride) > 0;
    if (!hasLabour || !hasCosts) return "#ea580c";
    return "#facc15";
  };

  const toggleRowSelection = (blockKey, itemId) => {
    setCategorySelections((prev) => {
      const existing = new Set(prev[blockKey] || []);
      if (existing.has(itemId)) {
        existing.delete(itemId);
      } else {
        existing.add(itemId);
      }
      return { ...prev, [blockKey]: Array.from(existing) };
    });
  };

  const handleSelectAll = (blockKey, items, checked) => {
    setCategorySelections((prev) => ({
      ...prev,
      [blockKey]: checked ? items.map((item) => item.id) : [],
    }));
  };

  const handleBulkStatus = (blockKey, status) => {
    const selectedIds = categorySelections[blockKey] || [];
    if (selectedIds.length === 0) return;
    setItemEntries((prev) => {
      const next = { ...prev };
      selectedIds.forEach((id) => {
        const current = ensureEntryValue(next, id);
        next[id] = { ...current, status };
      });
      return next;
    });
    setCategorySelections((prev) => ({ ...prev, [blockKey]: [] }));
  };

  const renderCategoryTable = (severity, category, items) => {
    const blockKey = `${severity}:${category.id}`;
    const selectedIds = categorySelections[blockKey] || [];
    const selectedSet = new Set(selectedIds);
    const allChecked = items.length > 0 && selectedSet.size === items.length;
    const selectionEnabled = !readOnly;
    return (
      <div
        key={blockKey}
        style={{
          border: "1px solid #f1f5f9",
          borderRadius: "16px",
          background: "#fff",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px",
            borderBottom: "1px solid #f1f5f9",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>{category.label}</h3>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
              Concerns grouped under {category.label.toLowerCase()}.
            </p>
          </div>
          {selectionEnabled && (
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#374151" }}>
              <input
                type="checkbox"
                checked={allChecked}
                onChange={(event) => handleSelectAll(blockKey, items, event.target.checked)}
              />
              Select all
            </label>
          )}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr
                style={{
                  background: "#f9fafb",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "#94a3b8",
                  fontSize: "11px",
                }}
              >
                <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "220px" }}>Item Details</th>
                <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "180px" }}>Parts (Cost £)</th>
                <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "160px" }}>Labour</th>
                <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "160px" }}>Total</th>
                <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "130px" }}>Status</th>
                {selectionEnabled && (
                  <th style={{ textAlign: "center", padding: "12px 16px", minWidth: "90px" }}>Select</th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const entry = getEntryForItem(item.id);
                const labourCost = computeLabourCost(entry.laborHours);
                const totalCost = computeRowTotal(entry);
                const statusColor = determineStatusColor(entry);
                const locationLabel = item.location
                  ? LOCATION_LABELS[item.location] || item.location.replace(/_/g, " ")
                  : null;
                const isChecked = selectedSet.has(item.id);

                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px", color: "#111827" }}>
                      <div style={{ fontWeight: 600 }}>{item.label}</div>
                      {item.notes ? (
                        <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>{item.notes}</div>
                      ) : null}
                      {item.measurement ? (
                        <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>{item.measurement}</div>
                      ) : null}
                      {locationLabel ? (
                        <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>Location: {locationLabel}</div>
                      ) : null}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={entry.partsCost ?? ""}
                          onChange={(event) => updateEntryValue(item.id, "partsCost", event.target.value)}
                          placeholder="0.00"
                          style={{
                            width: "160px",
                            padding: "8px",
                            borderRadius: "8px",
                            border: "1px solid #e5e7eb",
                          }}
                          disabled={readOnly}
                        />
                        <a href="#parts-identified" style={{ fontSize: "12px", color: "#b45309", textDecoration: "none" }}>
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
                            border: "1px solid #e5e7eb",
                          }}
                          disabled={readOnly}
                        />
                        <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                          = £{labourCost.toFixed(2)} ({entry.laborHours || 0}h × £{LABOUR_RATE} after VAT)
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={entry.totalOverride ?? ""}
                          onChange={(event) => updateEntryValue(item.id, "totalOverride", event.target.value)}
                          placeholder="Override total"
                          style={{
                            width: "160px",
                            padding: "8px",
                            borderRadius: "8px",
                            border: "1px solid #e5e7eb",
                          }}
                          disabled={readOnly}
                        />
                        <span style={{ fontSize: "12px", color: "#9ca3af" }}>Calculated: £{totalCost.toFixed(2)}</span>
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
                        <span style={{ fontSize: "12px", color: "#4b5563" }}>
                          {entry.status ? entry.status.charAt(0).toUpperCase() + entry.status.slice(1) : "Pending"}
                        </span>
                      </div>
                    </td>
                    {selectionEnabled && (
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRowSelection(blockKey, item.id)}
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
              borderTop: "1px solid #f1f5f9",
            }}
          >
            <button
              type="button"
              onClick={() => handleBulkStatus(blockKey, "declined")}
              disabled={selectedSet.size === 0}
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: "1px solid #dc2626",
                backgroundColor: selectedSet.size === 0 ? "#fee2e2" : "#fff",
                color: "#dc2626",
                fontWeight: 600,
                cursor: selectedSet.size === 0 ? "not-allowed" : "pointer",
              }}
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatus(blockKey, "authorized")}
              disabled={selectedSet.size === 0}
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: "1px solid #16a34a",
                backgroundColor: selectedSet.size === 0 ? "#dcfce7" : "#16a34a",
                color: selectedSet.size === 0 ? "#16a34a" : "#fff",
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
    return renderStatusMessage(error, "#b91c1c");
  }

  const jobHeader = (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "16px",
        padding: "16px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "12px",
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ fontSize: "12px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.16em" }}>Job</div>
        <div style={{ fontSize: "20px", fontWeight: 700 }}>{job?.job_number || "—"}</div>
      </div>
      <div>
        <div style={{ fontSize: "12px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.16em" }}>Reg</div>
        <div style={{ fontSize: "20px", fontWeight: 700 }}>{job?.vehicle?.registration || job?.vehicle_reg || "—"}</div>
      </div>
      <div>
        <div style={{ fontSize: "12px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.16em" }}>Customer</div>
        <div style={{ fontSize: "15px", fontWeight: 600 }}>{customerName}</div>
      </div>
      <div>
        <div style={{ fontSize: "12px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.16em" }}>Mileage</div>
        <div style={{ fontSize: "15px", fontWeight: 600 }}>{job?.vehicle?.mileage ? `${job.vehicle.mileage} mi` : job?.mileage ? `${job.mileage} mi` : "—"}</div>
      </div>
      <div>
        <div style={{ fontSize: "12px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.16em" }}>Submitted</div>
        <div style={{ fontSize: "15px", fontWeight: 600 }}>{formatDateTime(workflow?.vhc_sent_at || workflow?.last_sent_at || job?.created_at)}</div>
      </div>
      <div style={{ justifySelf: "end" }}>
        <span
          style={{
            padding: "6px 12px",
            borderRadius: "999px",
            background: "#111827",
            color: "#fff",
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
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              padding: "8px 14px",
              background: "#fff",
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
              border: "1px solid #d10000",
              borderRadius: "10px",
              padding: "8px 18px",
              background: "#d10000",
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

      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", gap: "8px" }}>
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
                borderBottom: isActive ? "3px solid #d10000" : "3px solid transparent",
                color: isActive ? "#111827" : "#6b7280",
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
            return (
              <div key={severity} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: meta.accent }}>{meta.title}</h2>
                  <p style={{ margin: "4px 0 0", color: "#6b7280" }}>{meta.description}</p>
                </div>
                {Array.from(section.values()).map(({ category, items }) =>
                  renderCategoryTable(severity, category, items)
                )}
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
              <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#111827" }}>
                Health check sections
              </h3>
              <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#6b7280" }}>
                Open a section to review the full technician modal and make adjustments without leaving this job card.
              </p>
            </div>
            {sectionSaveMessage ? (
              <span style={{ fontSize: "12px", fontWeight: 600, color: sectionSaveColor }}>
                {sectionSaveMessage}
              </span>
            ) : null}
          </div>

          {orderedHealthSections.map(({ config, data }) => (
            <HealthSectionCard
              key={config.key}
              config={config}
              section={data}
              onOpen={handleOpenSection}
            />
          ))}

          {!hasHealthData && (
            <div
              style={{
                border: "1px dashed #e5e7eb",
                borderRadius: "14px",
                padding: "20px",
                background: "#fff",
                color: "#6b7280",
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
          onClose={() => setActiveSection(null)}
          onComplete={(data) => handleSectionComplete("externalInspection", data)}
        />
      )}
      {activeSection === "internalElectrics" && (
        <InternalElectricsDetailsModal
          isOpen
          initialData={vhcData.internalElectrics}
          onClose={() => setActiveSection(null)}
          onComplete={(data) => handleSectionComplete("internalElectrics", data)}
        />
      )}
      {activeSection === "underside" && (
        <UndersideDetailsModal
          isOpen
          initialData={vhcData.underside}
          onClose={() => setActiveSection(null)}
          onComplete={(data) => handleSectionComplete("underside", data)}
        />
      )}
    </div>
  );
}
