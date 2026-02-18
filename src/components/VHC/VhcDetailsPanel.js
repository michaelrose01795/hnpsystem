// file location: src/components/VHC/VhcDetailsPanel.js
"use client";

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { summariseTechnicianVhc } from "@/lib/vhc/summary";
import { buildVhcQuoteLinesModel } from "@/lib/vhc/quoteLines";
import { saveChecksheet } from "@/lib/database/jobs";
import { useUser } from "@/context/UserContext";
import { useConfirmation } from "@/context/ConfirmationContext";
import WheelsTyresDetailsModal from "@/components/VHC/WheelsTyresDetailsModal";
import BrakesHubsDetailsModal from "@/components/VHC/BrakesHubsDetailsModal";
import ServiceIndicatorDetailsModal from "@/components/VHC/ServiceIndicatorDetailsModal";
import ExternalDetailsModal from "@/components/VHC/ExternalDetailsModal";
import InternalElectricsDetailsModal from "@/components/VHC/InternalElectricsDetailsModal";
import UndersideDetailsModal from "@/components/VHC/UndersideDetailsModal";
import PrePickLocationModal from "@/components/VHC/PrePickLocationModal";
import VHCModalShell from "@/components/VHC/VHCModalShell";
import { buildVhcRowStatusView, normaliseDecisionStatus, resolveSeverityKey } from "@/lib/vhc/summaryStatus";
import { getSlotCode, makeLineKey, resolveLineType } from "@/lib/vhc/slotIdentity";
import {
  EmptyStateMessage,
  SeverityBadge,
  VhcItemCell,
  extractVhcItemData,
  FinancialTotalsGrid,
  StockStatusBadge,
  PartRowCells,
} from "@/components/VHC/VhcSharedComponents";
import { isValidUuid } from "@/features/labour-times/normalization";
import { buildStableDisplayId, formatMeasurement, resolveLocationKey, normalizeText, hashString, LOCATION_TOKENS } from "@/lib/vhc/displayId";

const LABOUR_SUGGEST_DEBUG = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEBUG_LABOUR_SUGGESTIONS === "1";

const STATUS_BADGES = {
  red: "var(--danger)",
  amber: "var(--warning)",
  green: "var(--info)",
  grey: "var(--info)",
};

const PART_META_PREFIX = "VHC_META:";

const createDefaultNewPartForm = () => ({
  partNumber: "",
  quantity: 1,
  binLocation: "",
  discountCode: "",
  description: "",
  retailPrice: "",
  costPrice: "",
});

const extractPartMeta = (requestNotes) => {
  if (!requestNotes || typeof requestNotes !== "string") return {};
  const markerIndex = requestNotes.indexOf(PART_META_PREFIX);
  if (markerIndex === -1) return {};
  const raw = requestNotes.slice(markerIndex + PART_META_PREFIX.length).trim();
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
};

const buildRequestNotesWithMeta = (baseNotes, meta) => {
  const cleanBase = typeof baseNotes === "string" ? baseNotes.split(PART_META_PREFIX)[0].trim() : "";
  const metaPayload = JSON.stringify(meta || {});
  return cleanBase
    ? `${cleanBase} | ${PART_META_PREFIX}${metaPayload}`
    : `${PART_META_PREFIX}${metaPayload}`;
};

const TAB_OPTIONS = [
  { id: "summary", label: "Summary" },
  { id: "health-check", label: "Health Check" },
  { id: "parts-identified", label: "Parts Identified" },
  { id: "parts-authorized", label: "Parts Authorized" },
  { id: "photos", label: "Photos" },
  { id: "videos", label: "Videos" },
];

const normalizeInlineText = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s*[-|:]\s*/g, " - ")
    .trim();

const trimDisplayText = (value = "", max = 88) => {
  const text = normalizeInlineText(value);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
};

const buildLabourSuggestionDescription = ({
  detailLabel = "",
  detailContent = "",
  detailRows = [],
  measurement = "",
  locationLabel = "",
}) => {
  return [detailLabel, detailContent, ...(detailRows || []), measurement, locationLabel]
    .map((part) => normalizeInlineText(part || ""))
    .filter(Boolean)
    .join(" ");
};

const resolveAddPartsTitleDetail = (target = {}) => {
  if (!target || typeof target !== "object") return "VHC Item";
  const label = normalizeInlineText(target.label || "");
  const detail = normalizeInlineText(target.detail || target.concern || target.notes || "");
  const section = normalizeInlineText(target.section || target.sectionName || "");
  const rows = Array.isArray(target.rows)
    ? target.rows.map((row) => normalizeInlineText(row)).filter(Boolean)
    : [];

  const candidates = [detail, ...rows, label, section].filter(Boolean);
  const picked = candidates.find((candidate) => {
    if (!label) return true;
    const candidateLower = candidate.toLowerCase();
    const labelLower = label.toLowerCase();
    return !candidateLower.includes(labelLower) || candidate.length > label.length + 8;
  });

  return trimDisplayText(picked || label || section || "VHC Item");
};

const PARTS_SEARCH_STOP_WORDS = new Set([
  "add",
  "parts",
  "part",
  "near",
  "off",
  "side",
  "front",
  "rear",
  "left",
  "right",
  "requires",
  "require",
  "replace",
  "replacing",
  "replacement",
  "issue",
  "check",
  "item",
  "vehicle",
  "split",
  "worn",
  "and",
  "the",
  "for",
  "with",
]);

const PARTS_PREDICTION_RULES = [
  { match: /wiper|washer|screenwash|windscreen|rear\s*wipe|blade/i, terms: ["wiper blade", "washer jet", "washer pump", "screen wash"] },
  { match: /horn/i, terms: ["horn", "horn switch", "horn relay"] },
  { match: /tyre|tire|tread|puncture|wheel/i, terms: ["tyre", "valve", "wheel balance", "alloy wheel"] },
  { match: /brake|pad|disc|caliper|hub/i, terms: ["brake pads", "brake disc", "caliper", "hub bearing"] },
  { match: /battery|charging|alternator/i, terms: ["battery", "alternator", "battery terminal"] },
  { match: /bulb|lamp|light|headlight|taillight/i, terms: ["bulb", "headlight", "tail light", "indicator bulb"] },
  { match: /exhaust|catalyst|cat\b|silencer/i, terms: ["exhaust", "catalytic converter", "silencer"] },
  { match: /suspension|shock|spring|strut/i, terms: ["suspension arm", "shock absorber", "spring"] },
  { match: /steering|track rod|rack/i, terms: ["track rod end", "steering rack", "steering joint"] },
  { match: /air\s*con|a\/c|heating|ventilation|blower/i, terms: ["cabin filter", "blower motor", "air con condenser"] },
  { match: /service reminder|service indicator|oil/i, terms: ["engine oil", "oil filter", "service kit"] },
];

const buildPredictedPartSearchTerms = (target = {}, title = "") => {
  const sourceText = normalizeInlineText(
    `${title} ${target?.label || ""} ${target?.detail || target?.notes || ""} ${target?.section || ""}`
  );
  const collected = [];

  PARTS_PREDICTION_RULES.forEach((rule) => {
    if (rule.match.test(sourceText)) {
      collected.push(...rule.terms);
    }
  });

  const fallbackTokens = sourceText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !PARTS_SEARCH_STOP_WORDS.has(token));

  collected.push(...fallbackTokens.slice(0, 4));

  return Array.from(new Set(collected)).slice(0, 8);
};

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
  serviceIndicator: { serviceChoice: "", oilStatus: "", concerns: [], status: "" },
  externalInspection: null,
  internalElectrics: createDefaultInternalElectrics(),
  underside: createDefaultUnderside(),
  partsNotRequired: [],
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
      status: source.serviceIndicator?.status || "",
    },
    externalInspection: normaliseExternalInspectionPayload(source.externalInspection),
    internalElectrics: mergeEntries(base.internalElectrics, source.internalElectrics),
    underside: mergeEntries(base.underside, source.underside),
    partsNotRequired: Array.isArray(source.partsNotRequired) ? source.partsNotRequired : [],
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

// LOCATION_TOKENS — imported from @/lib/vhc/displayId
const LOCATION_LABELS = {
  front_left: "Nearside Front",
  front_right: "Offside Front",
  rear_left: "Nearside Rear",
  rear_right: "Offside Rear",
  front: "Front",
  rear: "Rear",
};

const SERVICE_CHOICE_LABELS = {
  reset: "Service Reminder Reset",
  not_required: "Service Reminder Not Required",
  no_reminder: "Doesn't Have a Service Reminder",
  indicator_on: "Service Indicator On",
};

const SEVERITY_RANK = { red: 3, amber: 2, grey: 1, green: 0 };
const RANK_TO_SEVERITY = {
  3: "red",
  2: "amber",
  1: "grey",
  0: "green",
};
const LABOUR_RATE = 150;
const QUOTE_LABOUR_RATE = 85;
const LABOUR_COST_DEFAULT_GBP = 150;
const LABOUR_VAT_RATE = 0.2;
const SEVERITY_META = {
  red: { title: "Red Repairs", description: "", accent: "var(--danger)" },
  amber: { title: "Amber Repairs", description: "", accent: "var(--warning)" },
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
  authorized: { background: "var(--success-surface)", border: "var(--success)", text: "var(--success)", hover: "var(--success-surface)" },
  declined: { background: "var(--danger-surface)", border: "var(--danger)", text: "var(--danger)", hover: "#ffd4d4" },
};

// Tyre wear calculation: 8mm = 0% worn (new), 0mm = 100% worn
const TYRE_NEW_DEPTH = 8;
const calculateTyreWearPercent = (depthMm) => {
  const depth = Number(depthMm);
  if (!Number.isFinite(depth) || depth < 0) return null;
  const wornPercent = Math.round(((TYRE_NEW_DEPTH - Math.min(depth, TYRE_NEW_DEPTH)) / TYRE_NEW_DEPTH) * 100);
  return Math.max(0, Math.min(100, wornPercent));
};

// Brake pad wear calculation: 10mm = 0% worn (new), 0mm = 100% worn
const PAD_NEW_THICKNESS = 10;
const calculatePadWearPercent = (thicknessMm) => {
  const thickness = Number(thicknessMm);
  if (!Number.isFinite(thickness) || thickness < 0) return null;
  const wornPercent = Math.round(((PAD_NEW_THICKNESS - Math.min(thickness, PAD_NEW_THICKNESS)) / PAD_NEW_THICKNESS) * 100);
  return Math.max(0, Math.min(100, wornPercent));
};

// Extract average tread depth from measurement string like "Tread depths: 5mm • 5mm • 5mm"
const extractTreadDepth = (text) => {
  if (!text) return null;
  const treadMatch = text.match(/tread\s*depths?[:\s]*([^•\n]+(?:•[^•\n]+)*)/i);
  if (treadMatch) {
    const depthSection = treadMatch[1];
    const mmMatches = depthSection.match(/(\d+(?:\.\d+)?)\s*mm/gi);
    if (mmMatches && mmMatches.length > 0) {
      const values = mmMatches.map((m) => parseFloat(m));
      const validValues = values.filter((v) => Number.isFinite(v) && v >= 0);
      if (validValues.length > 0) {
        return validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
      }
    }
  }
  const mmMatches = text.match(/(\d+(?:\.\d+)?)\s*mm/gi);
  if (mmMatches && mmMatches.length > 0) {
    const values = mmMatches.map((m) => parseFloat(m));
    const validValues = values.filter((v) => Number.isFinite(v) && v >= 0 && v <= 12);
    if (validValues.length > 0) {
      return validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
    }
  }
  return null;
};

// Extract pad thickness from measurement string like "Pad thickness: 8mm" or "Pad thickness: 8"
const extractPadThickness = (text) => {
  if (!text) return null;
  const padMatch = text.match(/pad\s*thickness[:\s]*(\d+(?:\.\d+)?)\s*(?:mm)?/i);
  if (padMatch) {
    return parseFloat(padMatch[1]);
  }
  const numMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:mm)?/i);
  if (numMatch) {
    const val = parseFloat(numMatch[1]);
    if (val >= 0 && val <= 15) {
      return val;
    }
  }
  return null;
};

// Get wear percentage color based on percentage
const getWearColor = (wornPercent) => {
  if (wornPercent >= 75) return "var(--danger)";
  if (wornPercent >= 50) return "var(--warning)";
  return "var(--success)";
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

// normalizeText, hashString — imported from @/lib/vhc/displayId

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

// resolveLocationKey — imported from @/lib/vhc/displayId

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
  return status.toString().toUpperCase();
};

const formatBrakeConditionLabel = (status) => {
  const raw = String(status || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === "good" || lower.includes("green")) return "Good";
  if (lower === "monitor" || lower.includes("amber") || lower.includes("yellow")) return "Monitor";
  if (lower === "replace" || lower.includes("red")) return "Replace";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const mapBrakeConditionFromSeverity = (status) => {
  const colour = normaliseColour(status);
  if (colour === "green") return "Good";
  if (colour === "amber") return "Monitor";
  if (colour === "red") return "Replace";
  return null;
};

const normaliseBrakeConditionSeverity = (status) => {
  const raw = String(status || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "good" || raw.includes("green")) return "green";
  if (raw === "monitor" || raw.includes("amber") || raw.includes("yellow")) return "amber";
  if (raw === "replace" || raw.includes("red")) return "red";
  return normaliseColour(status);
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

const normaliseLookupToken = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

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
  const segments = ["outer", "middle", "inner"]
    .map((key) => {
      const raw = tread?.[key];
      if (raw === null || raw === undefined || raw === "") return null;
      const numeric = Number.parseFloat(raw);
      const formatted = Number.isFinite(numeric)
        ? `${numeric.toFixed(1).replace(/\.0$/, "")}mm`
        : raw.toString().trim();
      if (!formatted) return null;
      return formatted.toLowerCase().includes("mm") ? formatted : `${formatted}mm`;
    })
    .filter(Boolean);
  return segments.length > 0 ? segments.join(" • ") : null;
};

const buildTyreSpecLines = (tyre) => {
  if (!tyre || typeof tyre !== "object") return [];
  const specs = [];
  if (tyre.manufacturer) specs.push(`Make: ${tyre.manufacturer}`);
  if (tyre.size) {
    const loadPart = tyre.load ? ` ${tyre.load}` : "";
    const speedPart = tyre.speed ? ` ${tyre.speed}` : "";
    specs.push(`Size: ${tyre.size}${loadPart}${speedPart}`.trim());
  }
  if (typeof tyre.runFlat === "boolean") {
    specs.push(`Run Flat: ${tyre.runFlat ? "Yes" : "No"}`);
  }
  return specs;
};

// formatMeasurement — imported from @/lib/vhc/displayId

// buildStableDisplayId — imported from @/lib/vhc/displayId

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

const splitRowKeyValue = (row = "") => {
  const text = String(row || "").trim();
  if (!text) return { key: "", value: "" };
  const colonIndex = text.indexOf(":");
  if (colonIndex === -1) return { key: "", value: text };
  const key = text.slice(0, colonIndex).trim();
  const value = text.slice(colonIndex + 1).trim();
  return { key, value };
};

const groupWheelSpecRows = (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const specRows = [];
  const otherRows = [];

  rows.forEach((row) => {
    const lower = String(row || "").toLowerCase().trim();
    if (lower.startsWith("make:") || lower.startsWith("size:") || lower.startsWith("load ")) {
      specRows.push(String(row).trim());
    } else {
      otherRows.push(row);
    }
  });

  if (specRows.length === 0) return rows;
  return [{ type: "wheel_spec_group", title: "Tyre Spec", rows: specRows }, ...otherRows];
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

const formatDiscMeasurementSummary = (disc = {}) => {
  const value = formatMeasurement(
    disc?.measurements?.values || disc?.measurements?.thickness || disc?.measurements
  );
  return value ? `Disc thickness: ${value}` : null;
};

const buildBrakeSecondaryRow = (disc = {}) => {
  const discMeasurement = formatDiscMeasurementSummary(disc);
  if (discMeasurement) return discMeasurement;
  const visualStatus = mapBrakeConditionFromSeverity(disc?.visual?.status);
  if (visualStatus) return `Visual check: ${visualStatus}`;
  return "Visual check: Not recorded";
};

const buildBrakeHealthCardItems = (items = [], brakesRaw = {}) => {
  if (!Array.isArray(items) || items.length === 0) return items;
  if (!brakesRaw || typeof brakesRaw !== "object") return items;

  const pushConcernMetrics = (item = {}, concerns = []) => {
    const normalized = concerns.filter(Boolean);
    if (normalized.length > 0) {
      item.concerns = normalized;
    }
    return item;
  };

  const frontPad = brakesRaw.frontPads || {};
  const frontDisc = brakesRaw.frontDiscs || {};
  const rearPad = brakesRaw.rearPads || {};
  const rearDisc = brakesRaw.rearDiscs || {};
  const rearDrum = brakesRaw.rearDrums || {};

  const frontConcerns = [
    ...(Array.isArray(frontPad.concerns) ? frontPad.concerns : []),
    ...(Array.isArray(frontDisc.concerns) ? frontDisc.concerns : []),
  ];
  const rearDiscConcerns = [
    ...(Array.isArray(rearPad.concerns) ? rearPad.concerns : []),
    ...(Array.isArray(rearDisc.concerns) ? rearDisc.concerns : []),
  ];
  const rearDrumConcerns = Array.isArray(rearDrum.concerns) ? rearDrum.concerns : [];

  const frontSeverity = deriveHighestSeverity([
    normaliseBrakeConditionSeverity(frontPad.status),
    normaliseBrakeConditionSeverity(frontDisc.measurements?.status),
    normaliseBrakeConditionSeverity(frontDisc.visual?.status),
    ...frontConcerns.map((concern) => normaliseBrakeConditionSeverity(concern?.status)),
  ]);
  const rearDiscSeverity = deriveHighestSeverity([
    normaliseBrakeConditionSeverity(rearPad.status),
    normaliseBrakeConditionSeverity(rearDisc.measurements?.status),
    normaliseBrakeConditionSeverity(rearDisc.visual?.status),
    ...rearDiscConcerns.map((concern) => normaliseBrakeConditionSeverity(concern?.status)),
  ]);
  const rearDrumSeverity = deriveHighestSeverity([
    normaliseBrakeConditionSeverity(rearDrum.status),
    ...rearDrumConcerns.map((concern) => normaliseBrakeConditionSeverity(concern?.status)),
  ]);

  const frontRows = [];
  const frontPadMeasurement = formatMeasurement(frontPad.measurement);
  frontRows.push(`Pad thickness: ${frontPadMeasurement || "Not recorded"}`);
  frontRows.push(buildBrakeSecondaryRow(frontDisc));

  const rearDiscRows = [];
  const rearPadMeasurement = formatMeasurement(rearPad.measurement);
  rearDiscRows.push(`Pad thickness: ${rearPadMeasurement || "Not recorded"}`);
  rearDiscRows.push(buildBrakeSecondaryRow(rearDisc));

  const displayItems = [];
  if (frontRows.length > 0 || frontSeverity || frontConcerns.length > 0) {
    displayItems.push(
      pushConcernMetrics(
        {
          heading: "Front Brakes",
          status: frontSeverity || "green",
          statusLabel: mapBrakeConditionFromSeverity(frontSeverity || "green") || "Good",
          rows: frontRows,
        },
        frontConcerns,
      ),
    );
  }

  const rawRearDrumStatusLabel = formatBrakeConditionLabel(rearDrum.status);
  const useRearDrum =
    brakesRaw._brakeType === "drum" ||
    Boolean(rawRearDrumStatusLabel) ||
    rearDrumConcerns.length > 0 ||
    (!brakesRaw.rearPads && !brakesRaw.rearDiscs && rearDrum && typeof rearDrum === "object");

  if (useRearDrum) {
    if (rawRearDrumStatusLabel || rearDrumSeverity || rearDrumConcerns.length > 0) {
      displayItems.push(
        pushConcernMetrics(
          {
            heading: "Rear Drums",
            status: rearDrumSeverity || normaliseBrakeConditionSeverity(rearDrum.status) || "green",
            statusLabel: rawRearDrumStatusLabel || mapBrakeConditionFromSeverity(rearDrumSeverity || "green") || "Good",
            rows: [],
          },
          rearDrumConcerns,
        ),
      );
    }
  } else if (rearDiscRows.length > 0 || rearDiscSeverity || rearDiscConcerns.length > 0) {
    displayItems.push(
      pushConcernMetrics(
        {
          heading: "Rear Brakes",
          status: rearDiscSeverity || "green",
          statusLabel: mapBrakeConditionFromSeverity(rearDiscSeverity || "green") || "Good",
          rows: rearDiscRows,
        },
        rearDiscConcerns,
      ),
    );
  }

  return displayItems.length > 0 ? displayItems : items;
};

const HealthSectionCard = ({ config, section, rawData, onOpen }) => {
  const rawItems = Array.isArray(section?.items) ? section.items : [];
  const items = config.key === "brakesHubs" ? buildBrakeHealthCardItems(rawItems, rawData) : rawItems;
  const hasItems = items.length > 0;

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
            const displayRows = config.key === "wheelsTyres" ? groupWheelSpecRows(rows) : rows;
            const concerns = Array.isArray(item.concerns) ? item.concerns.filter(Boolean) : [];
            const itemSeverity = determineItemSeverity(item);
            const theme = itemSeverity ? SEVERITY_THEME[itemSeverity] : null;
            const isBrakeSummaryItem =
              config.key === "brakesHubs" && /brake/i.test(String(item.heading || item.label || ""));
            const wheelRowsSeverity =
              config.key === "wheelsTyres"
                ? (normaliseColour(item.status) || itemSeverity || "green")
                : null;
            const wheelRowsTint =
              wheelRowsSeverity === "red"
                ? {
                    blockBg: "var(--danger-surface)",
                    blockBorder: "var(--danger)",
                    tileBg: "var(--surface)",
                    tileBorder: "rgba(var(--danger-rgb), 0.35)",
                    keyColor: "var(--danger)",
                  }
                : wheelRowsSeverity === "amber"
                  ? {
                      blockBg: "var(--warning-surface)",
                      blockBorder: "var(--warning)",
                      tileBg: "var(--surface)",
                      tileBorder: "rgba(var(--warning-rgb), 0.35)",
                      keyColor: "var(--warning-dark)",
                    }
                  : {
                      blockBg: "var(--success-surface)",
                      blockBorder: "var(--success)",
                      tileBg: "var(--surface)",
                      tileBorder: "rgba(var(--success-rgb), 0.35)",
                      keyColor: "var(--success-dark)",
                    };
            const brakeRowsSeverity = isBrakeSummaryItem
              ? (normaliseColour(item.status) || itemSeverity || "green")
              : null;
            const brakeRowsTint =
              brakeRowsSeverity === "red"
                ? {
                    blockBg: "var(--danger-surface)",
                    blockBorder: "var(--danger)",
                    tileBg: "var(--surface)",
                    tileBorder: "rgba(var(--danger-rgb), 0.35)",
                    keyColor: "var(--danger)",
                  }
                : brakeRowsSeverity === "amber"
                  ? {
                      blockBg: "var(--warning-surface)",
                      blockBorder: "var(--warning)",
                      tileBg: "var(--surface)",
                      tileBorder: "rgba(var(--warning-rgb), 0.35)",
                      keyColor: "var(--warning-dark)",
                    }
                  : {
                      blockBg: "var(--success-surface)",
                      blockBorder: "var(--success)",
                      tileBg: "var(--surface)",
                      tileBorder: "rgba(var(--success-rgb), 0.35)",
                      keyColor: "var(--success-dark)",
                    };
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
                  <div style={{ minWidth: "220px" }}>
                    <strong style={{ color: "var(--accent-purple)", fontSize: "15px" }}>
                      {item.heading || item.label || `Item ${idx + 1}`}
                    </strong>
                    {item.notes ? (
                      <p style={{ margin: "6px 0 0", color: "var(--info)", fontSize: "13px" }}>{item.notes}</p>
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
                      {item.statusLabel || normaliseColour(item.status) || item.status}
                    </span>
                  ) : null}
                </div>
                {displayRows.length > 0 ? (
                  <div
                    style={{
                      borderRadius: "12px",
                      border: `1px solid ${
                        config.key === "wheelsTyres"
                          ? wheelRowsTint.blockBorder
                          : isBrakeSummaryItem
                            ? brakeRowsTint.blockBorder
                            : "var(--accent-purple-surface)"
                      }`,
                      background:
                        config.key === "wheelsTyres"
                          ? wheelRowsTint.blockBg
                          : isBrakeSummaryItem
                            ? brakeRowsTint.blockBg
                            : "var(--surface)",
                      padding: "12px",
                      display: "grid",
                      gridTemplateColumns:
                        config.key === "brakesHubs" && /brake/i.test(String(item.heading || item.label || ""))
                          ? "repeat(2, minmax(0, 1fr))"
                          : "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: "10px",
                    }}
                  >
                    {displayRows.map((row, rowIdx) => {
                      if (row && typeof row === "object" && row.type === "wheel_spec_group") {
                        return (
                          <div
                            key={`${config.key}-${idx}-row-group-${rowIdx}`}
                            style={{
                              borderRadius: "10px",
                              background: config.key === "wheelsTyres" ? wheelRowsTint.tileBg : "var(--info-surface)",
                              border: `1px solid ${config.key === "wheelsTyres" ? wheelRowsTint.tileBorder : "var(--accent-purple-surface)"}`,
                              padding: "10px 12px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "6px",
                              minHeight: "64px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "11px",
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                color: config.key === "wheelsTyres" ? wheelRowsTint.keyColor : "var(--info)",
                                fontWeight: 700,
                              }}
                            >
                              {row.title}
                            </span>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              {row.rows.map((line, lineIdx) => (
                                <span key={`${config.key}-${idx}-row-group-${rowIdx}-line-${lineIdx}`} style={{ fontSize: "13px", color: "var(--info-dark)", fontWeight: 600, lineHeight: 1.45 }}>
                                  {line}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      const kv = splitRowKeyValue(row);
                      return (
                        <div
                          key={`${config.key}-${idx}-row-${rowIdx}`}
                          style={{
                            borderRadius: "10px",
                            background:
                              config.key === "wheelsTyres"
                                ? wheelRowsTint.tileBg
                                : isBrakeSummaryItem
                                  ? brakeRowsTint.tileBg
                                  : "var(--info-surface)",
                            border: `1px solid ${
                              config.key === "wheelsTyres"
                                ? wheelRowsTint.tileBorder
                                : isBrakeSummaryItem
                                  ? brakeRowsTint.tileBorder
                                  : "var(--accent-purple-surface)"
                            }`,
                            padding: "10px 12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            minHeight: "64px",
                          }}
                        >
                          {kv.key ? (
                            <span
                              style={{
                                fontSize: "11px",
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                color:
                                  config.key === "wheelsTyres"
                                    ? wheelRowsTint.keyColor
                                    : isBrakeSummaryItem
                                      ? brakeRowsTint.keyColor
                                      : "var(--info)",
                                fontWeight: 700,
                              }}
                            >
                              {kv.key}
                            </span>
                          ) : null}
                          <span style={{ fontSize: "13px", color: "var(--info-dark)", fontWeight: 600, lineHeight: 1.45 }}>
                            {kv.value || row}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {concerns.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      borderRadius: "12px",
                      border: "1px solid var(--accent-purple-surface)",
                      background: "var(--surface)",
                      padding: "10px",
                    }}
                  >
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
                          border: `1px solid ${SEVERITY_THEME[normaliseColour(concern.status)]?.border || "var(--accent-purple-surface)"}`,
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

export default function VhcDetailsPanel({
  jobNumber,
  showNavigation = true,
  readOnly = false,
  customActions = null,
  onCheckboxesComplete = null,
  onCheckboxesLockReason = null,
  onFinancialTotalsChange = null,
  onJobDataRefresh = null,
  viewMode = "full",
  enableTabs = false,
}) {
  const isCustomerView = viewMode === "customer";
  const router = useRouter();
  const { authUserId, dbUserId } = useUser() || {};
  const { confirm } = useConfirmation();
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
  const [isPrePickModalOpen, setIsPrePickModalOpen] = useState(false);
  const [selectedPartForJob, setSelectedPartForJob] = useState(null);
  const [addingPartToJob, setAddingPartToJob] = useState(false);
  const [expandedVhcItems, setExpandedVhcItems] = useState(new Set());
  const [partDetails, setPartDetails] = useState({});
  const [vhcIdAliases, setVhcIdAliases] = useState({});
  const [vhcItemAliasRecords, setVhcItemAliasRecords] = useState([]);
  const [removingPartIds, setRemovingPartIds] = useState(new Set());
  const [hoveredStatusId, setHoveredStatusId] = useState(null);
  const [vhcChecksData, setVhcChecksData] = useState([]);
  const [authorizedViewRows, setAuthorizedViewRows] = useState([]);
  const [authorizedViewLoaded, setAuthorizedViewLoaded] = useState(false);
  const [isAddPartsModalOpen, setIsAddPartsModalOpen] = useState(false);


  const [addPartsTarget, setAddPartsTarget] = useState(null);
  const [addPartsSearch, setAddPartsSearch] = useState("");
  const [addPartsResults, setAddPartsResults] = useState([]);
  const [addPartsLoading, setAddPartsLoading] = useState(false);
  const [addPartsError, setAddPartsError] = useState("");
  const [selectedParts, setSelectedParts] = useState([]);
  const [addingParts, setAddingParts] = useState(false);
  const [addPartsMessage, setAddPartsMessage] = useState("");
  const [partsSearchSuggestions, setPartsSearchSuggestions] = useState([]);
  const [partsSearchSuggestionsLoading, setPartsSearchSuggestionsLoading] = useState(false);
  const [selectedSuggestionQuery, setSelectedSuggestionQuery] = useState("");
  const [partsLearningSavedAt, setPartsLearningSavedAt] = useState(null);
  const [showNewPartForm, setShowNewPartForm] = useState(false);
  const [newPartSaving, setNewPartSaving] = useState(false);
  const [newPartError, setNewPartError] = useState("");
  const [newPartForm, setNewPartForm] = useState(() => createDefaultNewPartForm());
  const [labourSuggestionsByItem, setLabourSuggestionsByItem] = useState({});
  const [labourSuggestionsLoadingByItem, setLabourSuggestionsLoadingByItem] = useState({});
  const [openLabourSuggestionItemId, setOpenLabourSuggestionItemId] = useState(null);
  const [, setSelectedLabourSuggestionByItem] = useState({});
  const [savedLabourOverrideByItem, setSavedLabourOverrideByItem] = useState({});
  const [labourCostModal, setLabourCostModal] = useState({
    open: false,
    itemId: null,
    costInput: String(LABOUR_COST_DEFAULT_GBP),
  });
  const labourOverrideDebounceRef = useRef({});
  const labourSuggestionRequestRef = useRef({});
  const labourEditSessionRef = useRef({});
  const partsLearningDebounceRef = useRef(null);
  const refreshJobData = useCallback(
    (...args) => {
      if (typeof onJobDataRefresh !== "function") {
        return null;
      }
      try {
        return onJobDataRefresh(...args);
      } catch (refreshError) {
        console.warn("[JOB REFRESH] Failed to refresh job data:", refreshError);
        return null;
      }
    },
    [onJobDataRefresh]
  );

  useEffect(() => {
    const requestedTab = router.query?.vhcTab;
    if (!requestedTab || typeof requestedTab !== "string") return;
    const isValid = TAB_OPTIONS.some((tab) => tab.id === requestedTab);
    if (isValid && requestedTab !== activeTab) {
      setActiveTab(requestedTab);
    }
  }, [router.query?.vhcTab, activeTab]);

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
    Object.values(partDetails).forEach((detail) => {
      if (!detail || detail.warranty !== true) return;
      const vhcKey = detail.vhcId ? String(detail.vhcId) : "";
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

  const fetchJobPartsViaApi = useCallback(async (jobId) => {
    if (!jobId) return null;
    try {
      const response = await fetch(`/api/parts/job-items?job_id=${encodeURIComponent(jobId)}`);
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        return null;
      }
      return Array.isArray(data.data) ? data.data : [];
    } catch (error) {
      console.error("[VHC] Fallback parts fetch error", error);
      return null;
    }
  }, []);

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
            vhc_checks(vhc_id, section, issue_description, issue_title, measurement, created_at, updated_at, approval_status, display_status, severity, approved_by, approved_at, labour_hours, parts_cost, total_override, labour_complete, parts_complete, display_id),
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
          ...jobFields
        } = jobRow;
        let resolvedParts = Array.isArray(parts_job_items) ? parts_job_items : [];
        if (resolvedParts.length === 0 && jobRow?.id) {
          const fallbackParts = await fetchJobPartsViaApi(jobRow.id);
          if (Array.isArray(fallbackParts) && fallbackParts.length > 0) {
            resolvedParts = fallbackParts;
          }
        }
        // Build alias map from display_id on vhc_checks (consolidated from vhc_item_aliases)
        const aliasMapFromDb = {};
        const sanitizedAliasRows = [];
        (vhc_checks || []).forEach((check) => {
          if (!check?.display_id || check.vhc_id === null || check.vhc_id === undefined) return;
          aliasMapFromDb[String(check.display_id)] = String(check.vhc_id);
          sanitizedAliasRows.push({ display_id: check.display_id, vhc_item_id: check.vhc_id });
        });

        setVhcItemAliasRecords(sanitizedAliasRows);
        setVhcIdAliases(aliasMapFromDb);
        setJob({
          ...jobFields,
          parts_job_items: resolvedParts,
          job_files: job_files || [],
        });
        setWorkflow(workflowRow || null);

        // Store all VHC checks data for approval status lookup
        setVhcChecksData(vhc_checks || []);

        // Derive authorized view rows from vhc_checks (consolidated — no separate table needed)
        const authorizedRows = (vhc_checks || []).filter(
          (check) => check.approval_status === "authorized" || check.approval_status === "completed"
        );
        setAuthorizedViewRows(authorizedRows);
        setAuthorizedViewLoaded(true);

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
  }, [fetchJobPartsViaApi, resolvedJobNumber]);

  const authorizedViewIds = useMemo(() => {
    const ids = new Set();
    (authorizedViewRows || []).forEach((row) => {
      if (row?.vhc_item_id || row?.vhc_id) {
        ids.add(String(row.vhc_item_id ?? row.vhc_id));
      }
    });
    return ids;
  }, [authorizedViewRows]);

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
    const stored = Array.isArray(vhcData?.partsNotRequired) ? vhcData.partsNotRequired : [];
    setPartsNotRequired(new Set(stored.map((value) => String(value))));
  }, [vhcData?.partsNotRequired]);

  useEffect(() => {
    if (!job?.id) return;
    const checksChannel = supabase
      .channel(`vhc-checksheet-${job.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vhc_checks",
          filter: `job_id=eq.${job.id}`,
        },
        async (payload) => {
          const record = payload.new || payload.old;
          if (record?.section === "VHC_CHECKSHEET") {
            const parsed = safeJsonParse(record.issue_description || record.data);
            if (parsed) setVhcData(buildVhcPayload(parsed));
          }
          // Refresh authorized view rows from vhc_checks (consolidated)
          try {
            const { data } = await supabase
              .from("vhc_checks")
              .select("*")
              .eq("job_id", job.id)
              .in("approval_status", ["authorized", "completed"])
              .order("approved_at", { ascending: false });
            setAuthorizedViewRows(Array.isArray(data) ? data : []);
          } catch (e) {
            console.warn("[VHC] failed to refresh authorized items via realtime", e);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(checksChannel);
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

          const existing = newPartDetails[partKey];
          const needsInit = !existing || existing.vhcId !== displayId;

          // Only initialize if not already present (or missing vhcId)
          if (needsInit) {
            const unitPrice = Number(part.unit_price || part.part?.unit_price || 0);
            const unitCost = Number(part.unit_cost || part.part?.unit_cost || 0);
            const vatAmount = unitPrice * 0.2;
            const priceWithVat = unitPrice + vatAmount;
            const meta = extractPartMeta(part.request_notes || "");

            newPartDetails[partKey] = {
              vhcId: displayId,
              partNumber: existing?.partNumber ?? part.part?.part_number ?? "",
              partName: existing?.partName ?? part.part?.name ?? "",
              costToCustomer: existing?.costToCustomer ?? unitPrice,
              costToCompany: existing?.costToCompany ?? unitCost,
              vat: existing?.vat ?? vatAmount,
              totalWithVat: existing?.totalWithVat ?? priceWithVat,
              inStock: existing?.inStock ?? (part.part?.qty_in_stock || 0) > 0,
              backOrder: existing?.backOrder ?? Boolean(meta.backOrder),
              warranty: existing?.warranty ?? Boolean(meta.warranty),
              surcharge: existing?.surcharge ?? Boolean(meta.surcharge),
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
  const summaryQuoteModel = useMemo(
    () =>
      buildVhcQuoteLinesModel({
        job,
        sections,
        vhcChecksData,
        partsJobItems: jobParts,
        vhcIdAliases,
        authorizedViewRows,
        labourRate: QUOTE_LABOUR_RATE,
        mode: "withPlaceholders",
      }),
    [job, sections, vhcChecksData, jobParts, vhcIdAliases, authorizedViewRows]
  );
  const quoteSeverityLists = summaryQuoteModel.severityLists || {};
  const quoteTotals = summaryQuoteModel.totals || { red: 0, amber: 0, green: 0, authorized: 0, declined: 0 };
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
  // Create lookup map from vhc_id to approval data
  const vhcApprovalLookup = useMemo(() => {
    const map = new Map();
    vhcChecksData.forEach((check) => {
      if (check.vhc_id) {
        map.set(String(check.vhc_id), {
          approvalStatus: normaliseDecisionStatus(check.approval_status) || "pending",
          displayStatus: check.display_status || null,
          approvedBy: check.approved_by,
          approvedAt: check.approved_at,
          labourHours: check.labour_hours,
          partsCost: check.parts_cost,
          totalOverride: check.total_override,
          labourComplete: check.labour_complete,
          partsComplete: check.parts_complete,
        });
      }
    });
    return map;
  }, [vhcChecksData]);

  const partsAuthorized = useMemo(
    () => {
      return jobParts.filter((part) => {
        // Part must be from VHC
        const isVhc = normalisePartStatus(part.origin).includes("vhc");
        if (!isVhc) return false;

        // Check if the part is linked to an authorized VHC item
        if (part.vhc_item_id) {
          const canonicalId = String(part.vhc_item_id);
          const approvalData = vhcApprovalLookup.get(canonicalId);
          if (approvalData) {
            return approvalData.approvalStatus === "authorized";
          }
        }

        // Also include parts that are marked as authorised in the old way (no VHC status)
        return part.authorised === true;
      });
    },
    [jobParts, vhcApprovalLookup]
  );

  const partsOnOrder = useMemo(
    () => {
      return jobParts.filter((part) => {
        // Part must be from VHC and have status on_order or stock (parts that have arrived)
        const isVhc = normalisePartStatus(part.origin).includes("vhc");
        const partStatus = normalisePartStatus(part.status);
        const isOnOrderOrStock = partStatus === "on_order" || partStatus === "stock";

        if (!isVhc || !isOnOrderOrStock) return false;

        // Check if part is linked to an authorized VHC item OR has authorised flag
        if (part.vhc_item_id) {
          const canonicalId = String(part.vhc_item_id);
          const approvalData = vhcApprovalLookup.get(canonicalId);
          if (approvalData && approvalData.approvalStatus === "authorized") {
            return true;
          }
        }

        // Also include parts that are marked as authorised in the old way
        return part.authorised === true;
      });
    },
    [jobParts, vhcApprovalLookup]
  );

  const bookedPartNumbers = useMemo(() => {
    const numbers = new Set();
    jobParts.forEach((part) => {
      const partNumber =
        part.part?.part_number || part.part?.partNumber || part.part_number || part.partNumber;
      if (!partNumber) return;
      const status = normalisePartStatus(part.status);
      const stockStatus = normalisePartStatus(part.stock_status || part.stockStatus);
      if (status === "stock" || stockStatus === "in_stock") {
        numbers.add(partNumber.toLowerCase());
      }
    });
    return numbers;
  }, [jobParts, normalisePartStatus]);

  const summaryItems = useMemo(() => {
    const items = [];
    sections.forEach((section) => {
      // Skip internal VHC_CHECKSHEET metadata section
      if (section.key === "VHC_CHECKSHEET" || section.title === "VHC_CHECKSHEET") {
        return;
      }
      const sectionName = section.name || section.title || "Vehicle Health Check";
      (section.items || []).forEach((item, index) => {
        const severity = normaliseColour(item.colour || item.status || section.colour);
        if (!severity || (severity !== "red" && severity !== "amber")) {
          return;
        }
        const legacyId = `${sectionName}-${index}`;
        const id = item.vhc_id
          ? String(item.vhc_id)
          : vhcIdAliases[legacyId]
          ? legacyId
          : buildStableDisplayId(sectionName, item, index);
        const heading =
          item.heading || item.label || item.issue_title || item.name || item.title || sectionName;
        const category = resolveCategoryForItem(sectionName, heading);
        const location = resolveLocationKey(item);
        const concerns = Array.isArray(item.concerns) ? item.concerns : [];
        const primaryConcern =
          concerns.find((concern) => normaliseColour(concern.status) === severity) || concerns[0] || null;

        // Get approval status from database - resolve display ID to canonical vhc_id first
        const canonicalId = vhcIdAliases[String(id)] || String(id);
        const approvalData = vhcApprovalLookup.get(canonicalId) || {};
        const decisionKey = normaliseDecisionStatus(approvalData.approvalStatus) || "pending";
        const severityKey = resolveSeverityKey(severity, approvalData.displayStatus);

        items.push({
          id: String(id),
          sourceIssueTitle: heading || "Recorded item",
          label: heading || "Recorded item",
          notes: item.notes || item.issue_description || "",
          measurement: formatMeasurement(item.measurement),
          concernText: primaryConcern?.text || "",
          rows: Array.isArray(item.rows) ? item.rows : [],
          sectionName,
          category,
          location,
          rawSeverity: severity,
          concerns,
          wheelKey: item.wheelKey || null,
          approvalStatus: decisionKey,
          displayStatus: approvalData.displayStatus,
          severityKey,
          approvedBy: approvalData.approvedBy,
          approvedAt: approvalData.approvedAt,
        });
      });
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

    items.forEach(item => {
    });

    return items;
  }, [sections, wheelTreadLookup, vhcApprovalLookup, vhcIdAliases]);

  const summaryItemLookup = useMemo(() => {
    return new Map(summaryItems.map((item) => [String(item.id), item]));
  }, [summaryItems]);

  const greenItems = useMemo(() => {
    const items = [];
    sections.forEach((section) => {
      // Skip internal VHC_CHECKSHEET metadata section
      if (section.key === "VHC_CHECKSHEET" || section.title === "VHC_CHECKSHEET") {
        return;
      }
      const sectionName = section.name || section.title || "Vehicle Health Check";
      (section.items || []).forEach((item, index) => {
        const severity = normaliseColour(item.colour || item.status || section.colour);
        if (severity !== "green") return;
        const legacyId = `${sectionName}-ok-${index}`;
        const id = item.vhc_id
          ? String(item.vhc_id)
          : vhcIdAliases[legacyId]
          ? legacyId
          : buildStableDisplayId(sectionName, item, index);
        const heading =
          item.heading || item.label || item.issue_title || item.name || item.title || sectionName;
        const category = resolveCategoryForItem(sectionName, heading);
        const location = resolveLocationKey(item);
        items.push({
          id: String(id),
          label: heading || "Recorded item",
          notes: item.notes || item.issue_description || "",
          measurement: formatMeasurement(item.measurement),
          rows: Array.isArray(item.rows) ? item.rows : [],
          sectionName,
          category,
          location,
          wheelKey: item.wheelKey || null,
        });
      });
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
      const wheelData = wheelKey && vhcData?.wheelsTyres ? vhcData.wheelsTyres[wheelKey] : null;
      const treadSummary = formatTreadDepthSummary(wheelData?.tread);
      if (treadSummary) {
        item.measurement = `Tread depths: ${treadSummary}`;
      }
      const spec = buildTyreSpecLines(wheelData);
      if (spec.length > 0) {
        item.spec = spec;
      }
    });

    const brakes = vhcData?.brakesHubs;
    if (brakes && typeof brakes === "object") {
      const padMeasurement = (padData, label) => {
        const measurement = formatMeasurement(padData?.measurement);
        return measurement ? `${label}: ${measurement}` : null;
      };
      const discMeasurement = (discData, label) => {
        const measurement =
          formatMeasurement(discData?.measurements?.values || discData?.measurements?.thickness || discData?.measurements) ||
          null;
        return measurement ? `${label}: ${measurement}` : null;
      };

      items.forEach((item) => {
        if (item.category?.id !== "brakes_hubs") return;
        const lowerLabel = (item.label || "").toLowerCase();
        if (lowerLabel.includes("front pad")) {
          const value = padMeasurement(brakes.frontPads, "Pad thickness");
          if (value) item.measurement = value;
        } else if (lowerLabel.includes("rear pad")) {
          const value = padMeasurement(brakes.rearPads, "Pad thickness");
          if (value) item.measurement = value;
        } else if (lowerLabel.includes("front disc")) {
          const value = discMeasurement(brakes.frontDiscs, "Disc thickness");
          if (value) item.measurement = value;
        } else if (lowerLabel.includes("rear disc")) {
          const value = discMeasurement(brakes.rearDiscs, "Disc thickness");
          if (value) item.measurement = value;
        }
      });
    }

    return items;
  }, [sections, wheelTreadLookup, vhcData?.wheelsTyres, vhcData?.brakesHubs]);

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

    const rearDrums = brakes.rearDrums;
    if (rearDrums && typeof rearDrums === "object") {
      const rawStatusLabel = formatBrakeConditionLabel(rearDrums.status);
      const concernStatuses = Array.isArray(rearDrums.concerns)
        ? rearDrums.concerns.map((concern) => normaliseBrakeConditionSeverity(concern?.status)).filter(Boolean)
        : [];
      const status = deriveHighestSeverity([
        normaliseBrakeConditionSeverity(rearDrums.status),
        ...concernStatuses,
      ]);
      if (rawStatusLabel || status || concernStatuses.length > 0) {
        pushEntry("rear", {
          id: "rear-rearDrums",
          label: "Rear Drums",
          measurement: null,
          status: status || normaliseBrakeConditionSeverity(rearDrums.status) || "green",
          statusLabel: rawStatusLabel || mapBrakeConditionFromSeverity(status || "green") || "Good",
        });
      }
    }

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
      const status = normaliseColour(entry.status) || normaliseColour(entry.treadStatus);
      const spec = buildTyreSpecLines(entry);
      if (!depthSummary && spec.length === 0 && !status) return;
      map.set(key.toUpperCase(), {
        id: `tyre-${key}`,
        label: `${key} Tyre`,
        measurement: depthSummary ? `Tread depths: ${depthSummary}` : null,
        status,
        spec,
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
      const shouldShow = context.entries.length > 1 || context.hasRed || item.severityKey === "red";
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

  // Combined severity sections and lists into single memo for better performance
  const severityLists = useMemo(() => {
    const lists = { red: [], amber: [], authorized: [], declined: [] };
    const sections = { red: new Map(), amber: new Map(), authorized: new Map(), declined: new Map() };

    // Build sections map
    summaryItems.forEach((item) => {
      const entryStatus = normaliseDecisionStatus(itemEntries[item.id]?.status);
      let decisionKey = entryStatus || normaliseDecisionStatus(item.approvalStatus) || "pending";
      if (!entryStatus && (decisionKey === "authorized" || decisionKey === "completed")) {
        const canonicalId = resolveCanonicalVhcId(item.id);
        if (authorizedViewLoaded && canonicalId && !authorizedViewIds.has(String(canonicalId))) {
          decisionKey = "pending";
        }
      }
      // Prefer DB severity where available
      // prefer explicit severity column over display_status (approval)
      const severityKey = normaliseColour(item.vhcCheck?.severity || item.vhcCheck?.display_status) || item.severityKey || normaliseColour(item.rawSeverity);
      const sectionKey =
        decisionKey === "authorized" || decisionKey === "completed"
          ? "authorized"
          : decisionKey === "declined"
          ? "declined"
          : severityKey;

      if (!sections[sectionKey]) return; // Skip unknown severities

      const categoryId = item.category.id;
      if (!sections[sectionKey].has(categoryId)) {
        sections[sectionKey].set(categoryId, { category: item.category, items: [] });
      }
      sections[sectionKey].get(categoryId).items.push({
        ...item,
        decisionKey,
        sectionKey,
        severityKey,
      });
    });

    // Flatten sections to lists
    ["red", "amber", "authorized", "declined"].forEach((severity) => {
      const section = sections[severity];
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

    // Sort authorized and declined lists so red items are shown first then amber
    const severityRank = (s) => (s === "red" ? 0 : s === "amber" ? 1 : s === "green" ? 2 : 3);
    lists.authorized.sort((a, b) => severityRank(a.severityKey || a.rawSeverity) - severityRank(b.severityKey || b.rawSeverity));
    lists.declined.sort((a, b) => severityRank(a.severityKey || a.rawSeverity) - severityRank(b.severityKey || b.rawSeverity));

    return lists;
  }, [summaryItems, itemEntries, resolveCanonicalVhcId, authorizedViewIds, authorizedViewLoaded]);

  const lockedSectionKeys = useMemo(() => {
    const categoryToSection = {
      wheels_tyres: "wheelsTyres",
      brakes_hubs: "brakesHubs",
      service_indicator: "serviceIndicator",
      external_inspection: "externalInspection",
      internal_electrics: "internalElectrics",
      underside: "underside",
    };
    const locked = new Set();
    (severityLists.authorized || []).forEach((item) => {
      const sectionKey = categoryToSection[item.categoryId];
      if (sectionKey) {
        locked.add(sectionKey);
      }
    });
    return locked;
  }, [severityLists]);

  const labourHoursByVhcItem = useMemo(() => {
    const map = new Map();
    const fromVhcChecks = new Set(); // Track which items are marked labour_complete in vhc_checks

    // First, get labour hours from vhc_checks (primary source of truth)
    vhcChecksData.forEach((check) => {
      if (!check?.vhc_id) return;
      if (check.labour_hours === null || check.labour_hours === undefined || check.labour_hours === "") return;
      const hours = Number(check.labour_hours);
      if (!Number.isFinite(hours) || hours < 0) return; // Allow 0 values
      const key = String(check.vhc_id);
      map.set(key, hours);
      if (Boolean(check.labour_complete)) {
        fromVhcChecks.add(key);
      }
    });

    // Then, also check parts_job_items and take the maximum value
    partsIdentified.forEach((part) => {
      if (!part?.vhc_item_id) return;
      const hours = Number(part.labour_hours);
      if (!Number.isFinite(hours) || hours <= 0) return;
      const key = String(part.vhc_item_id);
      const current = map.get(key) || 0;
      map.set(key, Math.max(current, hours));
    });

    return { map, fromVhcChecks };
  }, [partsIdentified, vhcChecksData]);

  // Combined VHC items with their parts for Parts Identified section
  const vhcItemsWithParts = useMemo(() => {
    if (!summaryItems || summaryItems.length === 0) return [];

    const items = [];
    const processedCanonicalIds = new Set();

    const partsByVhcId = new Map();
    partsIdentified.forEach((part) => {
      if (!part?.vhc_item_id) {
        return;
      }
      const key = String(part.vhc_item_id);
      if (!partsByVhcId.has(key)) {
        partsByVhcId.set(key, []);
      }
      partsByVhcId.get(key).push(part);
    });

    summaryItems.forEach((summaryItem) => {
      const displayVhcId = String(summaryItem.id);
      const canonicalVhcId = resolveCanonicalVhcId(displayVhcId);
      const linkedParts = partsByVhcId.get(canonicalVhcId) || [];

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

  const existingPartsForModal = useMemo(() => {
    if (!addPartsTarget?.vhcId) return [];
    const canonicalId = resolveCanonicalVhcId(addPartsTarget.vhcId);
    if (!canonicalId) return [];
    return partsIdentified.filter(
      (part) => String(part?.vhc_item_id || "") === String(canonicalId)
    );
  }, [addPartsTarget?.vhcId, partsIdentified, resolveCanonicalVhcId]);

  const addPartsModalTitle = useMemo(() => {
    const target = addPartsTarget || {};
    if (target.detail || target.label || target.section || (target.rows && target.rows.length > 0)) {
      return `Add Parts - ${resolveAddPartsTitleDetail(target)}`;
    }
    if (!target.vhcId) {
      return "Add Parts - VHC Item";
    }
    const summaryItem = summaryItems.find((entry) => String(entry.id) === String(target.vhcId));
    return `Add Parts - ${resolveAddPartsTitleDetail({
      label: summaryItem?.label || "VHC Item",
      detail: summaryItem?.concernText || summaryItem?.notes || "",
      section: summaryItem?.sectionName || summaryItem?.category?.label || "",
      rows: summaryItem?.rows || [],
    })}`;
  }, [addPartsTarget, summaryItems]);

  const addPartsVehicleContext = useMemo(() => {
    const vehicle = job?.vehicle || {};
    return {
      make: vehicle.make || vehicle.manufacturer || "",
      model: vehicle.model || "",
      derivative: vehicle.derivative || vehicle.trim || vehicle.variant || "",
      engine: vehicle.engine || vehicle.engine_size || vehicle.engineSize || "",
      year: vehicle.year || vehicle.model_year || vehicle.registration_year || "",
      vin: vehicle.vin || vehicle.chassis || vehicle.chassis_number || "",
      reg: vehicle.registration || vehicle.reg || vehicle.registration_number || "",
    };
  }, [job?.vehicle]);

  const addPartsContextText = useMemo(() => {
    const target = addPartsTarget || {};
    const vehicleBits = Object.values(addPartsVehicleContext)
      .filter(Boolean)
      .join(" ")
      .trim();
    const issueBits = [
      target?.label || "",
      target?.detail || target?.notes || "",
      target?.section || "",
      Array.isArray(target?.rows) ? target.rows.join(" ") : "",
    ]
      .map((part) => normalizeInlineText(part))
      .filter(Boolean)
      .join(" ");

    return [addPartsModalTitle, issueBits, vehicleBits].filter(Boolean).join(" ").trim();
  }, [addPartsTarget, addPartsModalTitle, addPartsVehicleContext]);

  const runPartsSuggestions = useCallback(async () => {
    if (!isAddPartsModalOpen) return;
    const contextText = addPartsContextText.trim();
    if (!contextText) {
      setPartsSearchSuggestions([]);
      return;
    }

    setPartsSearchSuggestionsLoading(true);
    try {
      const response = await fetch("/api/vhc/parts-search-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contextText,
          vehicleContext: addPartsVehicleContext,
          userId: isValidUuid(authUserId) ? authUserId : isValidUuid(dbUserId) ? dbUserId : null,
          jobId: job?.id || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Unable to fetch part suggestions");
      }
      const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
      setPartsSearchSuggestions(suggestions);
      if (suggestions.length > 0) {
        const firstQuery = suggestions[0].query;
        setAddPartsSearch((prev) => {
          if (String(prev || "").trim().length > 0) return prev;
          setSelectedSuggestionQuery(firstQuery);
          return firstQuery;
        });
      }
    } catch (error) {
      console.warn("Failed to run parts suggestions", error);
      setPartsSearchSuggestions([]);
    } finally {
      setPartsSearchSuggestionsLoading(false);
    }
  }, [
    isAddPartsModalOpen,
    addPartsContextText,
    addPartsVehicleContext,
    authUserId,
    dbUserId,
    job?.id,
  ]);

  useEffect(() => {
    if (!isAddPartsModalOpen) return;
    runPartsSuggestions();
  }, [isAddPartsModalOpen, addPartsContextText, addPartsTarget?.vhcId, runPartsSuggestions]);

  // Combined VHC items with their parts for Parts Authorized section
  const vhcItemsWithPartsAuthorized = useMemo(() => {
    const authorizedItems = severityLists.authorized || [];
    if (authorizedItems.length === 0) return [];

    const items = [];
    const partsByVhcId = new Map();

    partsAuthorized.forEach((part) => {
      if (!part?.vhc_item_id) return;
      const key = String(part.vhc_item_id);
      if (!partsByVhcId.has(key)) {
        partsByVhcId.set(key, []);
      }
      partsByVhcId.get(key).push(part);
    });

    authorizedItems.forEach((summaryItem) => {
      const displayVhcId = String(summaryItem.id);
      const canonicalVhcId = resolveCanonicalVhcId(displayVhcId);
      const linkedParts = partsByVhcId.get(canonicalVhcId) || [];

      items.push({
        vhcItem: summaryItem,
        linkedParts,
        vhcId: displayVhcId,
        canonicalVhcId,
      });
    });

    return items;
  }, [severityLists, partsAuthorized, resolveCanonicalVhcId]);

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
    state[itemId] || { partsCost: "", laborHours: null, totalOverride: "", status: null, labourComplete: false, partsComplete: false };

  const updateEntryValue = (itemId, field, value) => {
    setItemEntries((prev) => ({
      ...prev,
      [itemId]: { ...ensureEntryValue(prev, itemId), [field]: value },
    }));
  };

  const getEntryForItem = (itemId) => ensureEntryValue(itemEntries, itemId);

  const resolveLabourHoursValue = (itemId, entry) => {
    const localValue = entry?.laborHours;
    if (localValue === "") return "";
    if (localValue !== null && localValue !== undefined) return localValue;
    const canonicalId = resolveCanonicalVhcId(itemId);
    const hours = labourHoursByVhcItem.map.get(canonicalId);
    return Number.isFinite(hours) ? String(hours) : "";
  };

  const resolveLabourCompleteValue = (entry, labourHoursValue) => {
    return Boolean(entry?.labourComplete);
  };

  const buildSummaryItemIdentity = useCallback((summaryItem) => {
    if (!summaryItem) return null;
    const section = summaryItem.sectionName || summaryItem.category?.label || "Vehicle Health Check";
    const issueTitle = summaryItem.sourceIssueTitle || summaryItem.label || "VHC Item";
    const issueDescription = summaryItem.notes || summaryItem.concernText || "";
    const issueText = summaryItem.concernText || summaryItem.notes || issueTitle;
    const sourceBucket = summaryItem.category?.label || summaryItem.category?.id || "";
    const sourceKey = summaryItem.location || summaryItem.category?.id || issueTitle;
    const subAreaKey = summaryItem.wheelKey || issueTitle;
    const severity = summaryItem.rawSeverity || summaryItem.severityKey || "amber";
    const slotCode = getSlotCode({
      section,
      subAreaKey,
      sourceKey,
      issueTitle,
      issueDescription: issueText,
    });
    const lineType = resolveLineType({
      slotCode,
      section,
      sourceBucket,
    });
    const lineKey = makeLineKey({
      type: lineType,
      issueText,
      extra: { source: sourceBucket },
    });
    return {
      section,
      issueTitle,
      issueDescription,
      issueText,
      sourceBucket,
      sourceKey,
      subAreaKey,
      severity,
      slotCode,
      lineKey,
    };
  }, []);

  const findExistingVhcItemId = useCallback(
    (displayId, providedSummaryItem = null) => {
      const canonicalId = resolveCanonicalVhcId(displayId);
      const numericCanonicalId = Number(canonicalId);
      if (Number.isInteger(numericCanonicalId)) {
        return numericCanonicalId;
      }

      const summaryItem = providedSummaryItem || summaryItemLookup.get(String(displayId));
      if (!summaryItem) return null;
      const identity = buildSummaryItemIdentity(summaryItem);
      if (!identity) return null;

      const rows = (vhcChecksData || []).filter(
        (check) => check && check.section !== "VHC_CHECKSHEET"
      );
      if (rows.length === 0) return null;

      const pickLatest = (matches = []) => {
        if (!Array.isArray(matches) || matches.length === 0) return null;
        const sorted = [...matches].sort((a, b) => {
          const aTime = new Date(a?.updated_at || a?.created_at || 0).getTime();
          const bTime = new Date(b?.updated_at || b?.created_at || 0).getTime();
          return bTime - aTime;
        });
        return sorted[0] || null;
      };

      const slotCode = Number(identity.slotCode);
      if (Number.isFinite(slotCode) && identity.lineKey) {
        const slotMatches = rows.filter(
          (check) =>
            Number(check?.slot_code) === slotCode &&
            String(check?.line_key || "") === String(identity.lineKey)
        );
        const slotMatch = pickLatest(slotMatches);
        if (slotMatch?.vhc_id && Number.isInteger(Number(slotMatch.vhc_id))) {
          return Number(slotMatch.vhc_id);
        }
      }

      const sectionToken = normaliseLookupToken(identity.section);
      const titleToken = normaliseLookupToken(identity.issueTitle);
      const issueToken = normaliseLookupToken(identity.issueText);
      const sectionTitleMatches = rows.filter(
        (check) =>
          normaliseLookupToken(check?.section) === sectionToken &&
          normaliseLookupToken(check?.issue_title) === titleToken
      );
      const strictMatch = pickLatest(
        sectionTitleMatches.filter(
          (check) => normaliseLookupToken(check?.issue_description) === issueToken
        )
      );
      if (strictMatch?.vhc_id && Number.isInteger(Number(strictMatch.vhc_id))) {
        return Number(strictMatch.vhc_id);
      }

      const relaxedMatch = pickLatest(sectionTitleMatches);
      if (relaxedMatch?.vhc_id && Number.isInteger(Number(relaxedMatch.vhc_id))) {
        return Number(relaxedMatch.vhc_id);
      }

      return null;
    },
    [buildSummaryItemIdentity, resolveCanonicalVhcId, summaryItemLookup, vhcChecksData]
  );

  const createVhcCheckForDisplayId = useCallback(
    async (displayId, { allowCreate = true } = {}) => {
      const summaryItem = summaryItemLookup.get(String(displayId));
      const existingId = findExistingVhcItemId(displayId, summaryItem);
      if (Number.isInteger(existingId)) {
        await upsertVhcItemAlias(displayId, existingId);
        return existingId;
      }
      if (!allowCreate || !summaryItem || !job?.id) return null;
      try {
        const identity = buildSummaryItemIdentity(summaryItem);
        if (!identity) return null;
        const entry = getEntryForItem(displayId);
        const resolvedLabourHours = resolveLabourHoursValue(displayId, entry);
        const createResponse = await fetch("/api/jobcards/create-vhc-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: job.id,
            jobNumber: resolvedJobNumber,
            section: identity.section,
            subAreaKey: identity.subAreaKey,
            sourceKey: identity.sourceKey,
            sourceBucket: identity.sourceBucket,
            issueTitle: identity.issueTitle,
            issueDescription: identity.issueDescription,
            issueText: identity.issueText,
            measurement: summaryItem.measurement || null,
            severity: identity.severity,
            labourHours: resolvedLabourHours !== "" ? resolvedLabourHours : null,
          }),
        });

        if (!createResponse.ok) {
          return null;
        }

        const createResult = await createResponse.json();
        if (!createResult?.success || !createResult?.vhcId) {
          return null;
        }

        await upsertVhcItemAlias(displayId, createResult.vhcId);
        if (createResult.data) {
          setVhcChecksData((prev) => {
            const next = new Map((prev || []).map((check) => [String(check?.vhc_id), check]));
            next.set(String(createResult.data.vhc_id), createResult.data);
            return Array.from(next.values());
          });
        }
        return Number(createResult.vhcId);
      } catch (error) {
        console.error("Failed to create VHC check item for status update:", error);
        return null;
      }
    },
    [
      buildSummaryItemIdentity,
      findExistingVhcItemId,
      job?.id,
      resolvedJobNumber,
      summaryItemLookup,
      resolveLabourHoursValue,
      upsertVhcItemAlias,
    ]
  );

  const updateEntryStatus = async (itemId, status) => {
    const previousEntry = getEntryForItem(itemId);
    const previousStatus = previousEntry?.status ?? null;

    // Update local state immediately
    setItemEntries((prev) => ({
      ...prev,
      [itemId]: { ...ensureEntryValue(prev, itemId), status },
    }));

    // Persist to database (convert null to 'pending')
    const canonicalId = resolveCanonicalVhcId(itemId);
    let parsedId = Number(canonicalId);

    // Convert null to 'pending' for database
    const dbStatus = normaliseDecisionStatus(status) || "pending";
    const summaryItem = summaryItemLookup.get(String(itemId));
    const severityKey = resolveSeverityKey(summaryItem?.rawSeverity, summaryItem?.displayStatus);
    let newDisplayStatus = null;
    if (dbStatus === "authorized") newDisplayStatus = "authorized";
    if (dbStatus === "declined") newDisplayStatus = "declined";
    if (dbStatus === "completed") newDisplayStatus = "completed";
    if (dbStatus === "pending" && severityKey) newDisplayStatus = severityKey;

    if (!Number.isInteger(parsedId)) {
      if (dbStatus === "pending") {
        return;
      }
      const createdId = await createVhcCheckForDisplayId(itemId);
      if (Number.isInteger(createdId)) {
        parsedId = createdId;
      }
    }

    if (!Number.isInteger(parsedId)) {
      console.error(`❌ [VHC STATUS ERROR] Invalid ID - cannot update`);
      setItemEntries((prev) => ({
        ...prev,
        [itemId]: { ...ensureEntryValue(prev, itemId), status: previousStatus },
      }));
      return;
    }

    try {
      const entry = getEntryForItem(itemId);
      const resolvedLabourHours = resolveLabourHoursValue(itemId, entry);
      const labourCompleteValue = resolveLabourCompleteValue(entry, resolvedLabourHours);
      const requestBody = {
        vhcItemId: parsedId,
        approvalStatus: dbStatus,
        approvedBy: authUserId || dbUserId || "system",
        labourComplete: labourCompleteValue,
      };
      if (newDisplayStatus) {
        requestBody.displayStatus = newDisplayStatus;
      }
      if (resolvedLabourHours !== "" && resolvedLabourHours !== null && resolvedLabourHours !== undefined) {
        requestBody.labourHours = resolvedLabourHours;
      }
      const response = await fetch("/api/vhc/update-item-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        console.error(`❌ [VHC STATUS ERROR] API Failed:`, result?.message);
        console.error(`❌ [VHC STATUS ERROR] Full Response:`, result);
        // Revert optimistic update so UI matches persisted state.
        setItemEntries((prev) => ({
          ...prev,
          [itemId]: { ...ensureEntryValue(prev, itemId), status: previousStatus },
        }));
        return;
      }


      // Update vhcChecksData to trigger re-render of sections
      setVhcChecksData((prev) => {
        const updated = prev.map((check) => {
          if (check.vhc_id === parsedId) {
            const updatedCheck = {
              ...check,
              approval_status: dbStatus,
              display_status: newDisplayStatus || check.display_status,
              approved_by: authUserId || dbUserId || "system",
              approved_at: dbStatus === 'pending' ? null : new Date().toISOString(),
              labour_hours: resolvedLabourHours !== "" ? Number(resolvedLabourHours) : check.labour_hours,
              labour_complete: labourCompleteValue,
            };
            return updatedCheck;
          }
          return check;
        });
        return updated;
      });

      // Refresh parent job data when authorization status changes
      // This ensures Customer Requests and Parts tabs see the updated data
      if (dbStatus === "authorized" || dbStatus === "declined" || dbStatus === "pending") {
        refreshJobData();
      }

    } catch (error) {
      console.error(`❌ ━━━ [VHC STATUS ERROR] EXCEPTION ━━━`);
      console.error(`❌ [VHC STATUS ERROR]`, error);
      console.error(`❌ [VHC STATUS ERROR] Stack:`, error.stack);
    }
  };

  // Auto-update partsComplete checkbox based on parts being added or marked as not required
  useEffect(() => {
    setItemEntries((prev) => {
      const updated = { ...prev };
      let hasChanges = false;

      // Check each item in ALL severity lists (red, amber, authorized, declined)
      const allItems = [
        ...(severityLists.red || []),
        ...(severityLists.amber || []),
        ...(severityLists.authorized || []),
        ...(severityLists.declined || [])
      ];

      allItems.forEach((item) => {
        const itemId = item.id;
        const canonicalId = resolveCanonicalVhcId(itemId);
        const hasParts = partsCostByVhcItem.has(canonicalId);
        const isNotRequired = partsNotRequired.has(String(itemId));
        const shouldBeComplete = hasParts || isNotRequired;

        const entry = ensureEntryValue(prev, itemId);
        if (entry.partsComplete !== shouldBeComplete) {
          updated[itemId] = { ...entry, partsComplete: shouldBeComplete };
          hasChanges = true;

          // Also persist to database if the item has a valid VHC ID
          const parsedId = Number(canonicalId);
          if (Number.isInteger(parsedId) && shouldBeComplete !== entry.partsComplete) {
            // Update database asynchronously
            fetch("/api/vhc/update-item-status", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                vhcItemId: parsedId,
                partsComplete: shouldBeComplete,
                approvedBy: "system"
              }),
            }).catch((error) => {
              console.error("Failed to save parts complete status", error);
            });
          }
        }
      });

      return hasChanges ? updated : prev;
    });
  }, [partsCostByVhcItem, partsNotRequired, severityLists, resolveCanonicalVhcId]);

  // Load labour hours from parts_job_items (when parts with labour hours are added)
  // DO NOT auto-check labourComplete when loading from parts
  useEffect(() => {
    setItemEntries((prev) => {
      const updated = { ...prev };
      let hasChanges = false;
      const items = [
        ...(severityLists.red || []),
        ...(severityLists.amber || []),
        ...(severityLists.authorized || []),
        ...(severityLists.declined || []),
      ];

      items.forEach((item) => {
        const entry = ensureEntryValue(prev, item.id);
        // Skip if labour hours already set from database or user input
        if (entry.laborHours !== null && entry.laborHours !== undefined) {
          return;
        }
        const canonicalId = resolveCanonicalVhcId(item.id);
        const hours = labourHoursByVhcItem.map.get(canonicalId);
        const isFromVhcChecks = labourHoursByVhcItem.fromVhcChecks.has(canonicalId);
        if (Number.isFinite(hours) && hours >= 0) { // Allow 0 values
          updated[item.id] = {
            ...entry,
            laborHours: String(hours),
            labourComplete: isFromVhcChecks ? true : entry.labourComplete || false,
            // Set to false when loading from parts, preserve existing value when from vhc_checks
          };
          hasChanges = true;
        }
      });

      return hasChanges ? updated : prev;
    });
  }, [labourHoursByVhcItem, severityLists, resolveCanonicalVhcId]);

  // Initialize itemEntries from vhcApprovalLookup (database values)
  useEffect(() => {
    setItemEntries((prev) => {
      const updated = { ...prev };
      let hasChanges = false;
      const items = [...(severityLists.red || []), ...(severityLists.amber || []), ...(severityLists.authorized || []), ...(severityLists.declined || [])];

      items.forEach((item) => {
        const entry = ensureEntryValue(prev, item.id);

        // Get approval data from database
        const approvalData = vhcApprovalLookup.get(String(item.id));
        if (approvalData) {
          // Build the updated entry with database values
          const updatedEntry = {
            ...entry,
            status: approvalData.approvalStatus || entry.status || null,
          };

          // Update labour hours if present in database
          const hasLabourHours = approvalData.labourHours !== null && approvalData.labourHours !== undefined;
          if (hasLabourHours) {
            updatedEntry.laborHours = String(approvalData.labourHours);
          }
          if (approvalData.labourComplete !== null && approvalData.labourComplete !== undefined) {
            updatedEntry.labourComplete = approvalData.labourComplete;
          }

          // Update parts cost if present in database
          if (approvalData.partsCost !== null && approvalData.partsCost !== undefined) {
            updatedEntry.partsCost = String(approvalData.partsCost);
          }

          // Update parts complete status
          updatedEntry.partsComplete = approvalData.partsComplete || false;

          // Update total override if present in database
          if (approvalData.totalOverride !== null && approvalData.totalOverride !== undefined) {
            updatedEntry.totalOverride = String(approvalData.totalOverride);
          }

          // Only update if something changed
          if (JSON.stringify(entry) !== JSON.stringify(updatedEntry)) {
            updated[item.id] = updatedEntry;
            hasChanges = true;
          }
        }
      });

      return hasChanges ? updated : prev;
    });
  }, [vhcApprovalLookup, severityLists]);

  // Check if Summary actions can be enabled and notify parent with completion + lock reason.
  // IMPORTANT: Only gate on Parts/Labour checkbox columns in Summary.
  useEffect(() => {
    if (!onCheckboxesComplete && !onCheckboxesLockReason) return;

    const emitState = (complete, reason = "") => {
      if (onCheckboxesComplete) onCheckboxesComplete(complete);
      if (onCheckboxesLockReason) onCheckboxesLockReason(reason);
    };

    if (!summaryItems.length) {
      emitState(true, "");
      return;
    }

    let missingParts = 0;
    let missingLabour = 0;
    summaryItems.forEach((item) => {
      const entry = getEntryForItem(item.id);
      if (!entry.partsComplete) missingParts += 1;
      if (!entry.labourComplete) missingLabour += 1;
    });

    if (missingParts > 0 || missingLabour > 0) {
      if (missingParts > 0 && missingLabour > 0) {
        emitState(false, "Complete parts and labour tickboxes in Summary.");
      } else if (missingParts > 0) {
        emitState(false, "Complete parts tickboxes in Summary.");
      } else {
        emitState(false, "Complete labour tickboxes in Summary.");
      }
      return;
    }

    emitState(true, "");
  }, [itemEntries, summaryItems, onCheckboxesComplete, onCheckboxesLockReason]);

  const parseNumericValue = (value) => {
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : 0;
  };

  const computeLabourCost = (hours) => parseNumericValue(hours) * LABOUR_RATE;
  const parseCurrencyValue = (value) => {
    const numeric = Number.parseFloat(String(value || "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
  };

  const openLabourCostModal = (itemId, labourHoursValue) => {
    const currentCost = computeLabourCost(labourHoursValue);
    const defaultCost = currentCost > 0 ? currentCost : LABOUR_COST_DEFAULT_GBP;
    setLabourCostModal({
      open: true,
      itemId,
      costInput: defaultCost.toFixed(2),
    });
  };

  const closeLabourCostModal = () => {
    setLabourCostModal({
      open: false,
      itemId: null,
      costInput: String(LABOUR_COST_DEFAULT_GBP),
    });
  };

  const saveLabourCostModal = async () => {
    const itemId = labourCostModal.itemId;
    if (!itemId) {
      closeLabourCostModal();
      return;
    }

    const parsedCost = parseCurrencyValue(labourCostModal.costInput);
    const netCost = parsedCost === null ? LABOUR_COST_DEFAULT_GBP : parsedCost;
    const hoursValue = (netCost / LABOUR_RATE).toFixed(2);

    setItemEntries((prev) => ({
      ...prev,
      [itemId]: {
        ...ensureEntryValue(prev, itemId),
        laborHours: hoursValue,
        labourComplete: true,
      },
    }));

    await persistLabourHours(itemId, hoursValue);
    closeLabourCostModal();
  };

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

  const computeRowTotal = (entry, resolvedPartsCost, labourHoursValue) => {
    if (entry.totalOverride !== "" && entry.totalOverride !== null) {
      const override = parseNumericValue(entry.totalOverride);
      if (override > 0) {
        return override;
      }
    }
    const partsCost =
      resolvedPartsCost !== undefined ? resolvedPartsCost : parseNumericValue(entry.partsCost);
    return partsCost + computeLabourCost(labourHoursValue);
  };

  const resolveCustomerRowTotal = (itemId) => {
    const entry = getEntryForItem(itemId);
    const resolvedPartsCost = resolvePartsCost(itemId, entry);
    const canonicalId = resolveCanonicalVhcId(itemId);
    const labourHours = labourHoursByVhcItem.map.get(canonicalId) || 0;
    const labourCost = labourHours * LABOUR_RATE;
    const partsCost = resolvedPartsCost ?? 0;
    const total = partsCost + labourCost;
    return total > 0 ? total : null;
  };

  const customerTotals = useMemo(() => {
    const totals = {
      red: 0,
      amber: 0,
      authorized: 0,
      declined: 0,
      overall: 0,
    };

    // Iterate across all known lists and compute totals based on raw severity so red/amber totals include authorised/declined items
    const allLists = [severityLists.red || [], severityLists.amber || [], severityLists.authorized || [], severityLists.declined || []];

    allLists.forEach((list) => {
      list.forEach((item) => {
        const rowTotal = resolveCustomerRowTotal(item.id);
        if (!rowTotal) return;
        totals.overall += rowTotal;

        // prefer explicit severity column over display_status (approval)
        const rawSeverity = normaliseColour(item.vhcCheck?.severity || item.vhcCheck?.display_status) || item.severityKey || normaliseColour(item.rawSeverity);
        if (rawSeverity === "red") totals.red += rowTotal;
        else if (rawSeverity === "amber") totals.amber += rowTotal;

        const entry = getEntryForItem(item.id);
        const decisionKey = normaliseDecisionStatus(entry.status);
        if (decisionKey === "authorized") {
          totals.authorized += rowTotal;
        } else if (decisionKey === "declined") {
          totals.declined += rowTotal;
        }
      });
    });

    return totals;
  }, [severityLists, itemEntries, labourHoursByVhcItem, partsCostByVhcItem, resolveCanonicalVhcId]);

  // Notify parent component when financial totals change
  useEffect(() => {
    if (onFinancialTotalsChange && typeof onFinancialTotalsChange === 'function') {
      onFinancialTotalsChange({
        authorized: customerTotals.authorized,
        declined: customerTotals.declined
      });
    }
  }, [customerTotals.authorized, customerTotals.declined, onFinancialTotalsChange]);

  const formatCurrency = (value) => {
    if (!Number.isFinite(value)) return "—";
    return `£${value.toFixed(2)}`;
  };

  const resolveVhcRowDecisionKey = (item, entry) => {
    const entryDecision = normaliseDecisionStatus(entry?.status);
    if (entryDecision) return entryDecision;
    return normaliseDecisionStatus(item?.decisionKey || item?.approvalStatus) || "pending";
  };

  const resolveVhcRowStatusView = (item, entry, resolvedPartsCost, labourHoursValue) => {
    const labourCompleteValue = resolveLabourCompleteValue(entry, labourHoursValue);
    return buildVhcRowStatusView({
      decisionValue: entry?.status || item?.decisionKey || item?.approvalStatus,
      rawSeverity: item?.rawSeverity,
      displayStatus: item?.displayStatus,
      labourHoursValue,
      labourComplete: labourCompleteValue,
      partsNotRequired: partsNotRequired.has(String(item?.id)),
      resolvedPartsCost,
      partsCost: entry?.partsCost,
      totalOverride: entry?.totalOverride,
    });
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
    async (severity, status) => {

      const selectedIds = severitySelections[severity] || [];
      const dbStatus = normaliseDecisionStatus(status) || "pending";

      if (selectedIds.length === 0) {
        return;
      }

      // Get the items from the severity list to access their rawSeverity
      const items = severityLists[severity] || [];
      const itemsMap = new Map(items.map(item => [item.id, item]));

      // Update local state immediately for all selected items
      setItemEntries((prev) => {
        const next = { ...prev };
        selectedIds.forEach((id) => {
          const current = ensureEntryValue(next, id);
          next[id] = { ...current, status };
        });
        return next;
      });

      // Persist each item to database
      const updatePromises = selectedIds.map(async (itemId) => {
        const canonicalId = resolveCanonicalVhcId(itemId);
        let parsedId = Number(canonicalId);

        if (!Number.isInteger(parsedId) && dbStatus !== "pending") {
          const createdId = await createVhcCheckForDisplayId(itemId);
          if (Number.isInteger(createdId)) {
            parsedId = createdId;
          }
        }

        if (!Number.isInteger(parsedId)) {
          console.error(`❌ [VHC BULK ERROR] Invalid ID for item ${itemId}`);
          return null;
        }

        const item = itemsMap.get(itemId);

        // Determine the display_status based on the action
        let displayStatus = null;
        if (dbStatus === "authorized") {
          displayStatus = 'authorized';
        } else if (dbStatus === "declined") {
          displayStatus = 'declined';
        } else if (dbStatus === "completed") {
          displayStatus = 'completed';
        } else if (dbStatus === "pending") {
          // For Reset: restore original severity
          displayStatus = item?.severityKey || resolveSeverityKey(item?.rawSeverity, item?.displayStatus);
        }

        try {
          const entry = getEntryForItem(itemId);
          const resolvedLabourHours = resolveLabourHoursValue(itemId, entry);
          const requestBody = {
            vhcItemId: parsedId,
            approvalStatus: dbStatus,
            displayStatus: displayStatus,
            approvedBy: authUserId || dbUserId || "system"
          };
          if (resolvedLabourHours !== "" && resolvedLabourHours !== null && resolvedLabourHours !== undefined) {
            requestBody.labourHours = resolvedLabourHours;
          }
          requestBody.labourComplete = resolveLabourCompleteValue(entry, resolvedLabourHours);

          const response = await fetch("/api/vhc/update-item-status", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          });

          const result = await response.json();
          if (!response.ok || !result?.success) {
            console.error(`❌ [VHC BULK ERROR] Failed for vhc_id ${parsedId}:`, result?.message);
            return null;
          }
          return {
            parsedId,
            displayStatus,
            item,
            labourHours: resolvedLabourHours,
            labourComplete: requestBody.labourComplete,
          };
        } catch (error) {
          console.error(`❌ [VHC BULK ERROR] Exception for item ${itemId}:`, error);
          return null;
        }
      });

      // Wait for all updates to complete
      const updateResults = await Promise.all(updatePromises);
      const successfulUpdates = updateResults.filter(result => result !== null);

      // Update vhcChecksData for all successfully updated items
      if (successfulUpdates.length > 0) {
        setVhcChecksData((prev) => {
          const updated = prev.map((check) => {
            const matchingUpdate = successfulUpdates.find(u => u.parsedId === check.vhc_id);
            if (matchingUpdate) {
              return {
                ...check,
                approval_status: dbStatus,
                display_status: matchingUpdate.displayStatus || check.display_status,
                approved_by: authUserId || dbUserId || "system",
                approved_at: dbStatus === "pending" ? null : new Date().toISOString(),
                labour_hours: matchingUpdate.labourHours !== "" ? Number(matchingUpdate.labourHours) : check.labour_hours,
                labour_complete: matchingUpdate.labourComplete,
              };
            }
            return check;
          });
          return updated;
        });
      }

      if (successfulUpdates.length > 0) {
        refreshJobData();
      }

      // Clear selection
      setSeveritySelections((prev) => ({ ...prev, [severity]: [] }));
    },
    [severitySelections, severityLists, resolveCanonicalVhcId, resolveLabourHoursValue, resolveLabourCompleteValue, authUserId, dbUserId, refreshJobData, createVhcCheckForDisplayId]
  );

  const handleMoveItem = useCallback(
    async (itemId, newStatus) => {

      // Update local state immediately
      setItemEntries((prev) => {
        const current = ensureEntryValue(prev, itemId);
        return { ...prev, [itemId]: { ...current, status: newStatus } };
      });

      // Persist to database
      const canonicalId = resolveCanonicalVhcId(itemId);
      const parsedId = Number(canonicalId);

      if (!Number.isInteger(parsedId)) {
        console.error(`❌ [VHC MOVE ERROR] Invalid ID for item ${itemId}`);
        return;
      }

      const dbStatus = newStatus || 'pending';

      try {
        const entry = getEntryForItem(itemId);
        const resolvedLabourHours = resolveLabourHoursValue(itemId, entry);
        const requestBody = {
          vhcItemId: parsedId,
          approvalStatus: dbStatus,
          approvedBy: authUserId || dbUserId || "system",
          labourComplete: resolveLabourCompleteValue(entry, resolvedLabourHours),
        };
        if (resolvedLabourHours !== "" && resolvedLabourHours !== null && resolvedLabourHours !== undefined) {
          requestBody.labourHours = resolvedLabourHours;
        }

        const response = await fetch("/api/vhc/update-item-status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const result = await response.json();
        if (!response.ok || !result?.success) {
          console.error(`❌ [VHC MOVE ERROR] Failed for vhc_id ${parsedId}:`, result?.message);
          return;
        }


        // Update vhcChecksData to reflect the change
        const newDisplayStatus = newStatus === 'authorized' ? 'authorized' : newStatus === 'declined' ? 'declined' : null;
        setVhcChecksData((prev) => {
          return prev.map((check) => {
            if (check.vhc_id === parsedId) {
              return {
                ...check,
                approval_status: newStatus,
                display_status: newDisplayStatus,
                approved_by: authUserId || dbUserId || "system",
                approved_at: new Date().toISOString(),
                labour_hours: resolvedLabourHours !== "" ? Number(resolvedLabourHours) : check.labour_hours,
                labour_complete: requestBody.labourComplete,
              };
            }
            return check;
          });
        });

        if (newStatus === "authorized" || newStatus === "declined" || newStatus === "pending") {
          refreshJobData();
        }
      } catch (error) {
        console.error(`❌ [VHC MOVE ERROR] Exception:`, error);
      }
    },
    [resolveCanonicalVhcId, resolveLabourHoursValue, resolveLabourCompleteValue, authUserId, dbUserId, refreshJobData]
  );

  const labourSuggestionUserId = useMemo(() => {
    if (isValidUuid(authUserId)) return authUserId;
    if (isValidUuid(dbUserId)) return dbUserId;
    return null;
  }, [authUserId, dbUserId]);

  const saveLabourOverride = useCallback(
    async ({ itemId, description, timeHours, scope = "user", immediate = false }) => {
      const parsedTime = Number(timeHours);
      if (!description || !Number.isFinite(parsedTime) || parsedTime < 0) return;
      if (scope === "user" && !labourSuggestionUserId) return;

      const executeSave = async () => {
        try {
          const response = await fetch("/api/vhc/labour-time-overrides", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description,
              timeHours: parsedTime,
              scope,
              userId: labourSuggestionUserId,
            }),
          });

          const result = await response.json();
          if (response.ok && result?.success) {
            setSavedLabourOverrideByItem((prev) => ({ ...prev, [itemId]: Date.now() }));
          }
        } catch (error) {
          console.warn("Failed to save labour override", error);
        }
      };

      if (immediate) {
        if (labourOverrideDebounceRef.current[itemId]) {
          clearTimeout(labourOverrideDebounceRef.current[itemId]);
          delete labourOverrideDebounceRef.current[itemId];
        }
        await executeSave();
        return;
      }

      if (labourOverrideDebounceRef.current[itemId]) {
        clearTimeout(labourOverrideDebounceRef.current[itemId]);
      }

      labourOverrideDebounceRef.current[itemId] = setTimeout(() => {
        executeSave();
        delete labourOverrideDebounceRef.current[itemId];
      }, 650);
    },
    [labourSuggestionUserId]
  );

  const fetchLabourSuggestions = useCallback(
    async ({ itemId, description }) => {
      const text = String(description || "").trim();

      const requestKey = `${itemId}-${Date.now()}`;
      labourSuggestionRequestRef.current[itemId] = requestKey;
      setLabourSuggestionsLoadingByItem((prev) => ({ ...prev, [itemId]: true }));

      try {
        const response = await fetch("/api/vhc/labour-time-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: text,
            userId: labourSuggestionUserId,
            jobId: job?.id || null,
          }),
        });
        const result = await response.json();

        if (labourSuggestionRequestRef.current[itemId] !== requestKey) {
          return;
        }

        if (response.ok && result?.success) {
          if (LABOUR_SUGGEST_DEBUG) {
            console.log("[VHC labour] Suggestions loaded", { itemId, count: Array.isArray(result.suggestions) ? result.suggestions.length : 0 });
          }
          setLabourSuggestionsByItem((prev) => ({
            ...prev,
            [itemId]: Array.isArray(result.suggestions) ? result.suggestions : [],
          }));
        } else {
          setLabourSuggestionsByItem((prev) => ({ ...prev, [itemId]: [] }));
        }
      } catch (error) {
        console.warn("Failed to fetch labour suggestions", error);
        if (labourSuggestionRequestRef.current[itemId] === requestKey) {
          setLabourSuggestionsByItem((prev) => ({ ...prev, [itemId]: [] }));
        }
      } finally {
        if (labourSuggestionRequestRef.current[itemId] === requestKey) {
          setLabourSuggestionsLoadingByItem((prev) => ({ ...prev, [itemId]: false }));
        }
      }
    },
    [labourSuggestionUserId, job?.id]
  );

  useEffect(() => {
    return () => {
      Object.values(labourOverrideDebounceRef.current).forEach((timeoutHandle) => {
        clearTimeout(timeoutHandle);
      });
      labourOverrideDebounceRef.current = {};
      labourEditSessionRef.current = {};
    };
  }, []);

  const renderSeverityTable = (severity, itemsOverride = null) => {
    const items = itemsOverride || severityLists[severity] || [];
    if (items.length === 0) {
      return <EmptyStateMessage message={`No ${severity} items recorded.`} />;
    }
    // Enable selection for all items when not read-only
    const selectionEnabled = !readOnly;
    const serviceChoiceKey = vhcData?.serviceIndicator?.serviceChoice || "";
    const serviceChoiceLabel =
      SERVICE_CHOICE_LABELS[serviceChoiceKey] || serviceChoiceKey || "";
    const normaliseServiceText = (value = "") =>
      value.toString().toLowerCase().replace(/\s+/g, " ").trim();
    const isRedOrAmberTable = severity === "red" || severity === "amber";
    const isRowSelectionEligible = (item) => {
      if (!isRedOrAmberTable) return true;
      const entry = getEntryForItem(item.id);
      const resolvedLabourHours = resolveLabourHoursValue(item.id, entry);
      const labourComplete = resolveLabourCompleteValue(entry, resolvedLabourHours);
      return Boolean(entry.partsComplete && labourComplete);
    };
    const selectableIds = new Set(items.filter((item) => isRowSelectionEligible(item)).map((item) => item.id));
    const selectedIds = (severitySelections[severity] || []).filter((itemId) => selectableIds.has(itemId));
    const selectedSet = new Set(selectedIds);
    const selectableCount = selectableIds.size;
    const allChecked = selectableCount > 0 && selectedSet.size === selectableCount;
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
        <div style={{ overflow: "visible" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", tableLayout: "fixed" }}>
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
                <th style={{ textAlign: "left", padding: "12px 8px", width: "35%" }}>Item Details</th>
                <th style={{ textAlign: "left", padding: "12px 8px", width: "15%" }}>Parts</th>
                <th style={{ textAlign: "left", padding: "12px 8px", width: "18%" }}>Labour</th>
                <th style={{ textAlign: "left", padding: "12px 8px", width: "15%" }}>Total</th>
                <th style={{ textAlign: "left", padding: "12px 8px", width: "10%" }}>Status</th>
                {selectionEnabled && (
                  <th style={{ textAlign: "center", padding: "12px 8px", width: "7%" }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      disabled={selectableCount === 0}
                      onChange={(event) =>
                        handleSelectAll(
                          severity,
                          items.filter((item) => selectableIds.has(item.id)),
                          event.target.checked
                        )
                      }
                    />
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const entry = getEntryForItem(item.id);
                const quoteParts = Number.isFinite(Number(item.parts_gbp)) ? Number(item.parts_gbp) : null;
                const quoteLabourHours = Number.isFinite(Number(item.labour_hours)) ? Number(item.labour_hours) : null;
                const quoteLabourRate = Number.isFinite(Number(item.labour_rate_gbp)) ? Number(item.labour_rate_gbp) : LABOUR_RATE;
                const quoteTotal = Number.isFinite(Number(item.total_gbp)) ? Number(item.total_gbp) : null;
                const resolvedPartsCost = quoteParts !== null ? quoteParts : resolvePartsCost(item.id, entry);
                const hasLocalLabourHoursValue =
                  entry?.laborHours !== null &&
                  entry?.laborHours !== undefined;
                const resolvedLabourHours = hasLocalLabourHoursValue
                  ? String(entry.laborHours)
                  : quoteLabourHours !== null
                    ? String(quoteLabourHours)
                    : resolveLabourHoursValue(item.id, entry);
                const labourCost =
                  quoteLabourHours !== null
                    ? quoteLabourHours * quoteLabourRate
                    : computeLabourCost(resolvedLabourHours);
                const totalCost =
                  quoteTotal !== null ? quoteTotal : computeRowTotal(entry, resolvedPartsCost, resolvedLabourHours);
                const totalDisplayValue =
                  entry.totalOverride !== "" && entry.totalOverride !== null
                    ? entry.totalOverride
                    : totalCost.toFixed(2);
                const partsDisplayValue =
                  resolvedPartsCost !== undefined ? resolvedPartsCost.toFixed(2) : "";
                const effectiveEntry =
                  itemsOverride && item
                    ? {
                        ...entry,
                        status: item.approvalStatus || entry.status,
                        partsComplete:
                          typeof item.partsComplete === "boolean" ? item.partsComplete : entry.partsComplete,
                        labourComplete:
                          typeof item.labourComplete === "boolean" ? item.labourComplete : entry.labourComplete,
                      }
                    : entry;
                const statusState = resolveVhcRowStatusView(item, effectiveEntry, resolvedPartsCost, resolvedLabourHours);
                const locationLabel = item.location
                  ? LOCATION_LABELS[item.location] || item.location.replace(/_/g, " ")
                  : null;
                const isChecked = selectedSet.has(item.id);
                const isSelectionEligible = selectableIds.has(item.id);
                const isWarranty = warrantyRows.has(String(item.id));
                // prefer explicit severity column over display_status (approval)
                const rowSeverity = normaliseColour(item.vhcCheck?.severity || item.vhcCheck?.display_status) || item.severityKey || item.rawSeverity || severity;
                // For authorized/declined items, use original severity for background color
                const backgroundSeverity = (severity === "authorized" || severity === "declined")
                  ? rowSeverity
                  : rowSeverity;
                const rowTheme = SEVERITY_THEME[backgroundSeverity] || {};

                // Explicitly set background color for authorized/declined items based on original severity
                const getExplicitBackground = () => {
                  if (severity === "authorized" || severity === "declined") {
                    if (rowSeverity === "red") {
                      return "var(--danger-surface)";
                    } else if (rowSeverity === "amber") {
                      return "var(--warning-surface)";
                    }
                  }
                  return rowTheme.background || "var(--surface)";
                };

                let detailLabel = item.label || item.sectionName || "Recorded item";
                const concernDetail = item.concernText || "";
                let detailContent = concernDetail || item.notes || "";
                const rawDetailRows = Array.isArray(item.rows)
                  ? item.rows.map((row) => (row ? String(row).trim() : "")).filter(Boolean)
                  : [];
                // Wheels & Tyres already has a compact preview card (OSF Tyre + tread depths + make/size/run flat).
                // Don't repeat the extended tyre spec rows in the Summary table.
                let detailRows = item.categoryId === "wheels_tyres" ? [] : rawDetailRows;
                const supplementaryRows = [
                  ...getBrakeSupplementaryRows(item),
                  ...getTyreSupplementaryRows(item),
                ];
                const isServiceIndicatorRow = item.categoryId === "service_indicator";
                const detailLabelKey = normaliseServiceText(detailLabel);
                const detailRowsKey = normaliseServiceText(detailRows.join(" "));
                const detailContentKey = normaliseServiceText(detailContent);
                const isServiceReminderRow =
                  detailLabelKey.includes("service reminder") ||
                  detailLabelKey.includes("service reminder/oil") ||
                  detailRowsKey.includes("service reminder") ||
                  detailRowsKey.includes("service reminder/oil") ||
                  detailContentKey.includes("service reminder") ||
                  detailContentKey.includes("service reminder/oil");
                if (isServiceIndicatorRow && serviceChoiceLabel && isServiceReminderRow) {
                  detailLabel = "Service Reminder";
                  detailRows = [serviceChoiceLabel];
                  detailContent = "";
                }

                // Avoid repeating the same phrase twice (e.g. "Service reminder / oil - Service reminder/Oil...").
                // If the "notes/concern" already contains the label, render just the content under the category title.
                const normalizeCompareText = (value = "") =>
                  value
                    .toString()
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
                const labelKey = normalizeCompareText(detailLabel);
                const contentKey = normalizeCompareText(detailContent);
                const suppressDetailLabel =
                  Boolean(detailContent) &&
                  Boolean(detailLabel) &&
                  labelKey.length > 0 &&
                  contentKey.length > 0 &&
                  (contentKey.includes(labelKey) || labelKey.includes(contentKey));
                const statusKey = `${severity}-${item.id}`;
                const isStatusHovered = hoveredStatusId === statusKey;
                const labourSuggestionDescription = buildLabourSuggestionDescription({
                  detailLabel,
                  detailContent,
                  detailRows,
                  measurement: item.measurement || "",
                  locationLabel: locationLabel ? `Location ${locationLabel}` : "",
                });
                const labourSuggestions = Array.isArray(labourSuggestionsByItem[item.id]) ? labourSuggestionsByItem[item.id] : [];
                const labourSuggestionsLoading = Boolean(labourSuggestionsLoadingByItem[item.id]);
                const labourSuggestionOpen = openLabourSuggestionItemId === item.id;
                const recentSavedAt = Number(savedLabourOverrideByItem[item.id] || 0);
                const showSavedBadge = recentSavedAt > 0 && Date.now() - recentSavedAt < 2500;

                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: "1px solid var(--info-surface)",
                      background: getExplicitBackground(),
                      transition: "background 0.2s ease",
                    }}
                  >
                    <td style={{ padding: "12px 8px", color: "var(--accent-purple)", wordWrap: "break-word", overflow: "hidden" }}>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                        {item.categoryLabel || "Recorded Section"}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--accent-purple)", marginTop: "2px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        <span>{detailLabel}</span>
                        {item.rowIdLabel ? (
                          <span style={{ fontSize: "11px", color: "var(--info)", fontWeight: 600 }}>{item.rowIdLabel}</span>
                        ) : null}
                      </div>
                      {detailRows.length > 0 ? (
                        <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
                          {detailRows.map((row, rowIdx) => (
                            <div key={`${statusKey}-detail-row-${rowIdx}`} style={{ fontWeight: 600, color: "var(--info-dark)" }}>
                              - {row}
                            </div>
                          ))}
                        </div>
                      ) : suppressDetailLabel ? (
                        <div style={{ marginTop: "6px", fontWeight: 600, color: "var(--info-dark)" }}>{`- ${detailContent}`}</div>
                      ) : detailContent ? (
                        <div style={{ marginTop: "6px", fontWeight: 500, color: "var(--info-dark)" }}>- {detailContent}</div>
                      ) : null}
                      {item.measurement ? (
                        <div style={{ fontSize: "12px", color: "var(--info)", marginTop: "4px" }}>{item.measurement}</div>
                      ) : null}
                      {locationLabel ? (
                        <div style={{ fontSize: "12px", color: "var(--info)", marginTop: "4px" }}>Location: {locationLabel}</div>
                      ) : null}
                      {/* Wear indicator for tyres and brake pads */}
                      {(() => {
                        let wearPercent = null;
                        let wearLabel = "";
                        const categoryId = item.categoryId || "";
                        const labelLower = (item.label || "").toLowerCase();
                        const categoryLower = (item.categoryLabel || "").toLowerCase();
                        const allText = [item.measurement || "", detailContent, item.label || "", item.notes || ""].join(" ");

                        // Check if this is a tyre item
                        const isTyreItem = categoryId === "wheels_tyres" ||
                                          categoryLower.includes("tyre") ||
                                          categoryLower.includes("wheel") ||
                                          labelLower.includes("tyre");

                        // Check if this is a brake pad item (not disc)
                        const isPadItem = (categoryId === "brakes_hubs" || categoryLower.includes("brake")) &&
                                         (labelLower.includes("pad") || allText.toLowerCase().includes("pad thickness")) &&
                                         !labelLower.includes("disc");

                        if (isTyreItem) {
                          const treadDepth = extractTreadDepth(allText);
                          if (treadDepth !== null) {
                            wearPercent = calculateTyreWearPercent(treadDepth);
                            wearLabel = "Tyre Wear";
                          }
                        } else if (isPadItem) {
                          const padThickness = extractPadThickness(allText);
                          if (padThickness !== null) {
                            wearPercent = calculatePadWearPercent(padThickness);
                            wearLabel = "Pad Wear";
                          }
                        }

                        return wearPercent !== null ? (
                          <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{
                              width: "80px",
                              height: "8px",
                              background: "var(--info-surface)",
                              borderRadius: "4px",
                              overflow: "hidden"
                            }}>
                              <div style={{
                                width: `${wearPercent}%`,
                                height: "100%",
                                background: getWearColor(wearPercent),
                                borderRadius: "4px",
                                transition: "width 0.3s ease"
                              }} />
                            </div>
                            <span style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              color: getWearColor(wearPercent),
                              minWidth: "45px"
                            }}>
                              {wearPercent}% Worn
                            </span>
                          </div>
                        ) : null;
                      })()}
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
                            const entryStatusLabel =
                              entry.statusLabel ||
                              mapBrakeConditionFromSeverity(entry.status) ||
                              formatStatusLabel(entry.status);
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
                                {Array.isArray(entry.spec) && entry.spec.length > 0 ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", width: "100%" }}>
                                    {entry.spec.map((line) => (
                                      <span key={`${entry.id || entry.label}-spec-${line}`} style={{ color: "var(--info)", fontSize: "11px" }}>
                                        {line}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <input
                          type="checkbox"
                          checked={effectiveEntry.partsComplete || false}
                          disabled={true}
                          title={effectiveEntry.partsComplete ? "Parts added or marked as not required" : "Add parts or mark as not required"}
                        />
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent-purple)" }}>
                          {partsDisplayValue ? `£${partsDisplayValue}` : "—"}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", position: "relative" }}>
                        <input
                          type="checkbox"
                          checked={resolveLabourCompleteValue(effectiveEntry, resolvedLabourHours)}
                          onChange={(event) => event.preventDefault()}
                          onClick={(event) => {
                            event.preventDefault();
                            if (
                              readOnly ||
                              severity === "authorized" ||
                              severity === "declined"
                            ) {
                              return;
                            }
                            openLabourCostModal(item.id, resolvedLabourHours);
                          }}
                          disabled={
                            readOnly ||
                            severity === "authorized" ||
                            severity === "declined"
                          }
                          style={{ cursor: "pointer" }}
                          title="Open labour cost editor"
                        />
                        <input
                          className="labour-hours-input"
                          type="number"
                          min="0"
                          step="0.1"
                          value={resolvedLabourHours ?? ""}
                          onChange={(event) => {
                            // Don't allow changes in authorized/declined sections
                            if (
                              severity === "authorized" ||
                              severity === "declined"
                            )
                              return;

                            const value = event.target.value;
                            const isBlank = value === "";
                            const existingSession = labourEditSessionRef.current[item.id] || {};
                            setItemEntries((prev) => ({
                              ...prev,
                              [item.id]: {
                                ...ensureEntryValue(prev, item.id),
                                laborHours: value,
                                labourComplete: !isBlank,
                              },
                            }));
                            labourEditSessionRef.current[item.id] = {
                              ...existingSession,
                              initialValue: existingSession.initialValue ?? String(resolvedLabourHours ?? ""),
                              latestValue: value,
                            };
                          }}
                          onBlur={(event) => {
                            // Don't persist in authorized/declined sections
                            if (
                              severity === "authorized" ||
                              severity === "declined"
                            )
                              return;
                            const value = event.target.value;
                            const parsedValue = Number(value);
                            const editSession = labourEditSessionRef.current[item.id] || {};
                            const initialRaw = String(editSession.initialValue ?? "");
                            const initialParsedValue = Number(initialRaw);
                            const hasChangedValue =
                              value !== "" &&
                              Number.isFinite(parsedValue) &&
                              (initialRaw === "" || !Number.isFinite(initialParsedValue) || Math.abs(initialParsedValue - parsedValue) > 0.0001);
                            persistLabourHours(item.id, value);
                            if (hasChangedValue) {
                              saveLabourOverride({
                                itemId: item.id,
                                description: labourSuggestionDescription,
                                timeHours: parsedValue,
                                scope: "user",
                                immediate: true,
                              });
                              if (LABOUR_SUGGEST_DEBUG) {
                                console.log("[VHC labour] Saved user override from manual edit", { itemId: item.id, parsedValue });
                              }
                            }
                            delete labourEditSessionRef.current[item.id];
                            setOpenLabourSuggestionItemId((prev) => (prev === item.id ? null : prev));
                          }}
                          onFocus={() => {
                            setOpenLabourSuggestionItemId(item.id);
                            labourEditSessionRef.current[item.id] = {
                              initialValue: String(resolvedLabourHours ?? ""),
                              latestValue: String(resolvedLabourHours ?? ""),
                            };
                            fetchLabourSuggestions({
                              itemId: item.id,
                              description: labourSuggestionDescription,
                            });
                          }}
                          placeholder="0.0"
                          style={{
                            width: "50px",
                            padding: "4px 6px",
                            borderRadius: "8px",
                            border: "1px solid var(--accent-purple-surface)",
                            fontSize: "13px",
                          }}
                          disabled={
                            readOnly ||
                            severity === "authorized" ||
                            severity === "declined"
                          }
                        />
                        {showSavedBadge ? (
                          <span style={{ fontSize: "11px", color: "var(--success)", fontWeight: 600 }}>Saved</span>
                        ) : null}
                        <span style={{ fontSize: "12px", color: "var(--info)", whiteSpace: "nowrap" }}>£{labourCost.toFixed(2)}</span>
                        {labourSuggestionOpen ? (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: "24px",
                              marginTop: "6px",
                              width: "fit-content",
                              maxWidth: "calc(100vw - 48px)",
                              maxHeight: "240px",
                              overflowY: "auto",
                              border: "1px solid var(--accent-purple-surface)",
                              borderRadius: "10px",
                              background: "var(--surface)",
                              boxShadow: "0 12px 24px rgba(var(--text-primary-rgb), 0.14)",
                              zIndex: 12,
                            }}
                          >
                            {labourSuggestionsLoading ? (
                              <div style={{ padding: "10px 12px", fontSize: "12px", color: "var(--info)" }}>Loading suggestions…</div>
                            ) : labourSuggestions.length === 0 ? (
                              <div style={{ padding: "10px 12px", fontSize: "12px", color: "var(--info)" }}>Suggested labour time</div>
                            ) : (
                              labourSuggestions.map((suggestion) => (
                                <button
                                  key={`${item.id}-${suggestion.id}-${suggestion.timeHours}`}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => {
                                    const nextValue = Number(suggestion.timeHours).toFixed(1);
                                    setItemEntries((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...ensureEntryValue(prev, item.id),
                                        laborHours: nextValue,
                                        labourComplete: true,
                                      },
                                    }));
                                    setSelectedLabourSuggestionByItem((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        source: suggestion.source,
                                        scope: suggestion.scope,
                                        timeHours: Number(suggestion.timeHours),
                                        suggestionApplied: true,
                                      },
                                    }));
                                    labourEditSessionRef.current[item.id] = {
                                      initialValue: nextValue,
                                      latestValue: nextValue,
                                    };
                                    persistLabourHours(item.id, nextValue);
                                    setOpenLabourSuggestionItemId(null);
                                  }}
                                  style={{
                                    width: "100%",
                                    border: "none",
                                    borderBottom: "1px solid var(--surface-light)",
                                    background: "var(--surface)",
                                    textAlign: "left",
                                    padding: "9px 11px",
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
                                    <div
                                      style={{
                                        fontSize: "12px",
                                        color: suggestion.source === "fallback" ? "var(--warning)" : "var(--text-primary)",
                                        fontWeight: 600,
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {`AI suggestion: ${Number(suggestion.timeHours).toFixed(1)}h`}
                                    </div>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={totalDisplayValue}
                          onChange={(event) => updateEntryValue(item.id, "totalOverride", event.target.value)}
                          placeholder="0.00"
                          style={{
                            width: "70px",
                            padding: "4px 6px",
                            borderRadius: "8px",
                            border: "1px solid var(--accent-purple-surface)",
                            fontSize: "13px",
                          }}
                          disabled={readOnly || severity === "authorized" || severity === "declined"}
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
                    <td style={{ padding: "12px 8px" }}>
                      <div
                        onMouseEnter={() => setHoveredStatusId(statusKey)}
                        onMouseLeave={() => setHoveredStatusId(null)}
                        onFocus={() => setHoveredStatusId(statusKey)}
                        onBlur={() => setHoveredStatusId(null)}
                        style={{
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minHeight: "32px",
                          width: "100%",
                        }}
                        tabIndex={0}
                        aria-label={statusState.label}
                      >
                        <span
                          style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "999px",
                            backgroundColor: statusState.color,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 0 0 2px var(--surface)",
                            cursor: "pointer",
                          }}
                        >
                          {statusState.showTick && (
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="white"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                          {statusState.showCross && (
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="white"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <line x1="6" y1="6" x2="18" y2="18" />
                              <line x1="18" y1="6" x2="6" y2="18" />
                            </svg>
                          )}
                        </span>
                        {isStatusHovered && (
                          <div
                            style={{
                              position: "absolute",
                              left: "50%",
                              top: "-8px",
                              transform: "translate(-50%, -100%)",
                              background: "var(--surface)",
                              border: "1px solid var(--surface-light)",
                              borderRadius: "12px",
                              padding: "10px 14px",
                              boxShadow: "0 8px 16px rgba(var(--text-primary-rgb), 0.12)",
                              whiteSpace: "nowrap",
                              zIndex: 5,
                            }}
                          >
                            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--accent-purple)" }}>
                              {statusState.label}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    {selectionEnabled && (
                      <td style={{ padding: "12px 8px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!isSelectionEligible}
                          title={
                            !isSelectionEligible
                              ? "Complete both Parts and Labour before selecting this row."
                              : ""
                          }
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
            {(severity === "authorized" || severity === "declined") ? (
              <>
                <button
                  type="button"
                  onClick={() => handleBulkStatus(severity, "pending")}
                  disabled={selectedSet.size === 0}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "10px",
                    border: "1px solid var(--accent-purple)",
                    backgroundColor: selectedSet.size === 0 ? "var(--accent-purple-surface)" : "var(--surface)",
                    color: "var(--accent-purple)",
                    fontWeight: 600,
                    cursor: selectedSet.size === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  Reset
                </button>
                {severity === "authorized" && (
                  <button
                    type="button"
                    onClick={() => handleBulkStatus(severity, "completed")}
                    disabled={selectedSet.size === 0}
                    style={{
                      padding: "10px 16px",
                      borderRadius: "10px",
                      border: "1px solid var(--success)",
                      backgroundColor: selectedSet.size === 0 ? "var(--success-surface)" : "var(--success)",
                      color: selectedSet.size === 0 ? "var(--success)" : "white",
                      fontWeight: 600,
                      cursor: selectedSet.size === 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    Complete
                  </button>
                )}
              </>
            ) : (
              <>
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
                    color: selectedSet.size === 0 ? "var(--success)" : "white",
                    fontWeight: 600,
                    cursor: selectedSet.size === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  Authorise
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCustomerRow = (item, severity) => {
    const entry = getEntryForItem(item.id);
    const total = resolveCustomerRowTotal(item.id);
    const detailLabel = item.label || item.sectionName || "Recorded item";
    const detailContent = item.concernText || item.notes || "";
    const measurement = item.measurement || "";
    const categoryLabel = item.categoryLabel || item.sectionName || "Recorded Section";
    const decisionKey = resolveVhcRowDecisionKey(item, entry);
    const isAuthorized = decisionKey === "authorized" || severity === "authorized";
    const isDeclined = decisionKey === "declined" || severity === "declined";
    // Only show authorize/decline checkboxes for pending red/amber items
    const showDecision = (severity === "red" || severity === "amber") && !isAuthorized && !isDeclined;

    // Calculate wear percentage for tyres and brake pads
    const categoryId = item.category?.id || "";
    const labelLower = detailLabel.toLowerCase();
    const categoryLower = categoryLabel.toLowerCase();
    let wearPercent = null;
    let wearLabel = "";

    // Combine all text fields to search for measurements
    const allText = [measurement, detailContent, detailLabel, item.notes || ""].join(" ");

    // Check if this is a tyre item
    const isTyreItem = categoryId === "wheels_tyres" ||
                       categoryLower.includes("tyre") ||
                       categoryLower.includes("wheel") ||
                       labelLower.includes("tyre");

    // Check if this is a brake pad item (not disc)
    const isPadItem = (categoryId === "brakes_hubs" || categoryLower.includes("brake")) &&
                      (labelLower.includes("pad") || allText.toLowerCase().includes("pad thickness")) &&
                      !labelLower.includes("disc");

    if (isTyreItem) {
      const treadDepth = extractTreadDepth(allText);
      if (treadDepth !== null) {
        wearPercent = calculateTyreWearPercent(treadDepth);
        wearLabel = "Tyre Wear";
      }
    } else if (isPadItem) {
      const padThickness = extractPadThickness(allText);
      if (padThickness !== null) {
        wearPercent = calculatePadWearPercent(padThickness);
        wearLabel = "Pad Wear";
      }
    }

    // Determine background color for authorized/declined rows based on original severity
    const getRowBackground = () => {
      if (isAuthorized || isDeclined) {
        // Prefer DB severity on attached vhc_check, then item fields
        // prefer explicit severity column over display_status (approval)
        let originalSeverity = normaliseColour(item.vhcCheck?.severity || item.vhcCheck?.display_status) || item.rawSeverity || item.severityKey || normaliseColour(item.display_status || item.severity);

        if (!originalSeverity && typeof resolveCanonicalVhcId === 'function' && vhcChecksMap) {
          try {
            const canonical = resolveCanonicalVhcId(String(item.id));
            const check = vhcChecksMap.get(String(canonical)) || vhcChecksMap.get(String(item.id));
            originalSeverity = normaliseColour(check?.display_status || check?.severity);
          } catch (err) {
            // ignore
          }
        }

        if (originalSeverity === "red") {
          return "var(--danger-surface)";
        } else if (originalSeverity === "amber") {
          return "var(--warning-surface)";
        }
      }
      return "transparent";
    };

    return (
      <div
        key={`${severity}-${item.id}`}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          padding: "14px 16px",
          borderBottom: "1px solid var(--info-surface)",
          background: getRowBackground(),
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ minWidth: "240px" }}>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
              {categoryLabel}
            </div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--accent-purple)", marginTop: "4px" }}>
              {detailLabel}
            </div>
            {detailContent ? (
              <div style={{ fontSize: "13px", color: "var(--info-dark)", marginTop: "4px" }}>{detailContent}</div>
            ) : null}
            {measurement ? (
              <div style={{ fontSize: "12px", color: "var(--info)", marginTop: "4px" }}>{measurement}</div>
            ) : null}
            {wearPercent !== null && (
              <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  width: "100px",
                  height: "8px",
                  background: "var(--info-surface)",
                  borderRadius: "4px",
                  overflow: "hidden"
                }}>
                  <div style={{
                    width: `${wearPercent}%`,
                    height: "100%",
                    background: getWearColor(wearPercent),
                    borderRadius: "4px",
                    transition: "width 0.3s ease"
                  }} />
                </div>
                <span style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: getWearColor(wearPercent)
                }}>
                  {wearPercent}% Worn
                </span>
                <span style={{ fontSize: "11px", color: "var(--info)" }}>
                  ({wearLabel})
                </span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "14px", fontWeight: 600 }}>{formatCurrency(total)}</div>
            {showDecision ? (
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <label style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "13px" }}>
                  <input
                    type="checkbox"
                    checked={isAuthorized}
                    onChange={(event) => updateEntryStatus(item.id, event.target.checked ? "authorized" : null)}
                  />
                  Authorise
                </label>
                <label style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "13px" }}>
                  <input
                    type="checkbox"
                    checked={isDeclined}
                    onChange={(event) => updateEntryStatus(item.id, event.target.checked ? "declined" : null)}
                  />
                  Decline
                </label>
              </div>
            ) : null}
            {/* Final Check checkbox for authorized or declined items */}
            {(isAuthorized || isDeclined) && (
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <label style={{
                  display: "flex",
                  gap: "6px",
                  alignItems: "center",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: isAuthorized ? "var(--success)" : "var(--danger)"
                }}>
                  <input
                    type="checkbox"
                    checked={true}
                    onChange={(event) => {
                      if (!event.target.checked) {
                        // Uncheck resets status to pending
                        updateEntryStatus(item.id, null);
                      }
                    }}
                  />
                  Final Check - {isAuthorized ? "Authorised" : "Declined"}
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCustomerSection = (title, items, severity) => {
    const theme = SEVERITY_THEME[severity] || { border: "var(--info-surface)", background: "var(--surface)" };

    // Calculate authorized and declined totals for this section
    const sectionTotals = useMemo(() => {
      let authorized = 0;
      let declined = 0;

      items.forEach((item) => {
        const rowTotal = resolveCustomerRowTotal(item.id);
        if (!rowTotal) return;
        const entry = getEntryForItem(item.id);
        const decisionKey = normaliseDecisionStatus(entry.status);
        if (decisionKey === "authorized") {
          authorized += rowTotal;
        } else if (decisionKey === "declined") {
          declined += rowTotal;
        }
      });

      return { authorized, declined };
    }, [items]);

    // Ensure authorized/declined sections show red items first
    let displayItems = items;
    if (severity === "authorized" || severity === "declined") {
      const severityRank = (s) => (s === "red" ? 0 : s === "amber" ? 1 : s === "green" ? 2 : 3);
      displayItems = [...items].sort((a, b) => severityRank(a.severityKey || a.rawSeverity) - severityRank(b.severityKey || b.rawSeverity));

      if (process.env.NODE_ENV !== 'production') {

      }
    }

    return (
      <div
        style={{
          border: `1px solid ${theme.border || "var(--info-surface)"}`,
          borderRadius: "16px",
          background: theme.background || "var(--surface)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            fontWeight: 700,
            color: theme.text || "var(--accent-purple)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontSize: "12px",
            borderBottom: "1px solid var(--info-surface)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{title}</span>
            {(sectionTotals.authorized > 0 || sectionTotals.declined > 0) && (
              <div style={{ display: "flex", gap: "16px", fontSize: "11px", textTransform: "none", fontWeight: 600 }}>
                {sectionTotals.authorized > 0 && (
                  <span style={{ color: "var(--success)" }}>
                    Authorised: {formatCurrency(sectionTotals.authorized)}
                  </span>
                )}
                {sectionTotals.declined > 0 && (
                  <span style={{ color: "var(--danger)" }}>
                    Declined: {formatCurrency(sectionTotals.declined)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        {displayItems.length === 0 ? (
          <div style={{ padding: "16px", fontSize: "13px", color: "var(--info)" }}>
            No items recorded.
          </div>
        ) : (
          displayItems.map((item) => renderCustomerRow(item, severity))
        )}
      </div>
    );
  };

  const renderCustomerView = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <FinancialTotalsGrid totals={customerTotals} />

      {/* Only show Red section if there are pending red items */}
      {severityLists.red && severityLists.red.length > 0 && renderCustomerSection("Red Items", severityLists.red, "red")}

      {/* Only show Amber section if there are pending amber items */}
      {severityLists.amber && severityLists.amber.length > 0 && renderCustomerSection("Amber Items", severityLists.amber, "amber")}

      {/* Authorised section - always show if there are authorized items */}
      {severityLists.authorized && severityLists.authorized.length > 0 && renderCustomerSection("Authorised", severityLists.authorized, "authorized")}

      {/* Declined section - always show if there are declined items */}
      {severityLists.declined && severityLists.declined.length > 0 && renderCustomerSection("Declined", severityLists.declined, "declined")}

      {/* Green Items section stays at the bottom */}
      {renderCustomerSection("Green Items", greenItems || [], "green")}
    </div>
  );
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
      // Optimistically update the local state first
      setJob(prevJob => {
        if (!prevJob?.parts_job_items) return prevJob;

        const updatedParts = prevJob.parts_job_items.map(part => {
          if (part.id === partItemId) {
            const updatedPart = { ...part };

            // Apply updates
            if (updates.status !== undefined) updatedPart.status = updates.status;
            if (updates.stockStatus !== undefined) updatedPart.stock_status = updates.stockStatus;
            if (updates.prePickLocation !== undefined) updatedPart.pre_pick_location = updates.prePickLocation;
            if (updates.etaDate !== undefined) updatedPart.eta_date = updates.etaDate;
            if (updates.etaTime !== undefined) updatedPart.eta_time = updates.etaTime;
            if (updates.authorised !== undefined) updatedPart.authorised = updates.authorised;

            return updatedPart;
          }
          return part;
        });

        return {
          ...prevJob,
          parts_job_items: updatedParts
        };
      });

      const requestBody = { partItemId, ...updates };

      const response = await fetch("/api/parts/update-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });


      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[PART STATUS UPDATE] API Error:`, errorData);

        // Revert optimistic update on error by re-fetching
        if (job?.id) {
          const { data: revertJob, error: fetchError } = await supabase
            .from("jobs")
            .select(`
              *,
              customer:customer_id(*),
              vehicle:vehicle_id(*),
              technician:assigned_to(user_id, first_name, last_name, email, role, phone),
              vhc_checks(vhc_id, section, issue_description, issue_title, measurement, created_at, updated_at, approval_status, display_status, severity, approved_by, approved_at, labour_hours, parts_cost, total_override, labour_complete, parts_complete, display_id),
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

          if (!fetchError && revertJob) {
            const { vhc_checks = [], parts_job_items = [], job_files = [], ...jobFields } = revertJob;
            setJob({
              ...jobFields,
              parts_job_items: parts_job_items || [],
              job_files: job_files || [],
            });
            setVhcChecksData(vhc_checks || []);
          }
        }

        throw new Error(errorData.error || errorData.details || "Failed to update part status");
      }

      const result = await response.json();

      // Refresh parent job data so other tabs see the updated part status/pre-pick location
      refreshJobData();

      return result;
    } catch (err) {
      console.error(`[PART STATUS UPDATE] Error:`, err);
      console.error(`[PART STATUS UPDATE] Error details:`, {
        message: err.message,
        stack: err.stack,
        partItemId,
        updates
      });
      throw err;
    }
  }, [job, resolvedJobNumber, setJob, setVhcChecksData, refreshJobData]);

  const persistLabourHours = useCallback(
    async (displayVhcId, hoursValue) => {
      if (!job?.id) return;
      const canonicalId = resolveCanonicalVhcId(displayVhcId);
      const parsedId = Number(canonicalId);
      const isBlank = hoursValue === "" || hoursValue === null || hoursValue === undefined;
      const parsedHours = Number(hoursValue);
      const labourHours = !isBlank && Number.isFinite(parsedHours) ? parsedHours : null;

      try {
        let vhcItemIdToUse = parsedId;
        if (!Number.isInteger(vhcItemIdToUse)) {
          vhcItemIdToUse = await createVhcCheckForDisplayId(displayVhcId, {
            allowCreate: !isBlank,
          });
        }

        // Only proceed if we have a valid numeric ID
        if (Number.isInteger(vhcItemIdToUse)) {
          // Update the vhc_checks table - this is the primary source of truth for labour hours
          // Also set labourComplete to true when labour hours are entered
          const vhcResponse = await fetch("/api/vhc/update-item-status", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              vhcItemId: vhcItemIdToUse,
              labourHours: isBlank ? null : labourHours,
              labourComplete: !isBlank,
              approvedBy: authUserId || dbUserId || null,
            }),
          });
          const vhcResult = await vhcResponse.json();
          if (!vhcResponse.ok || !vhcResult?.success) {
            console.warn("Failed to update vhc_checks labour hours:", vhcResult?.message);
          } else {
            setVhcChecksData((prev) => prev.map((check) => {
              if (String(check.vhc_id) !== String(vhcItemIdToUse)) return check;
              return { ...check, labour_hours: labourHours, labour_complete: !isBlank };
            }));
          }

          // Update parts_job_items if there are any parts linked to this VHC item
          const partsResponse = await fetch("/api/parts/vhc-labour", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobId: job.id,
              vhcItemId: vhcItemIdToUse,
              labourHours,
              userId: authUserId || null,
              userNumericId: dbUserId || null,
            }),
          });
          const partsResult = await partsResponse.json();

          // Update parts in local state if any were updated
          if (partsResponse.ok && Array.isArray(partsResult.items) && partsResult.items.length > 0) {
            setJob((prev) => {
              if (!prev) return prev;
              const existingParts = Array.isArray(prev.parts_job_items) ? prev.parts_job_items : [];
              const updatedMap = new Map(existingParts.map((part) => [part.id, part]));
              partsResult.items.forEach((item) => {
                if (!item?.id) return;
                const current = updatedMap.get(item.id) || {};
                updatedMap.set(item.id, { ...current, ...item });
              });
              return { ...prev, parts_job_items: Array.from(updatedMap.values()) };
            });
          }

          // Refresh vhcChecksData to include the new/updated record
          if (resolvedJobNumber) {
            const { data: updatedVhcChecks } = await supabase
              .from("vhc_checks")
              .select("*")
              .eq("job_id", job.id);
            if (updatedVhcChecks) {
              setVhcChecksData(updatedVhcChecks);
            }
          }

          // Refresh parent job data so other tabs see the updated labour hours
          refreshJobData();
        }
      } catch (error) {
        console.error("Failed to persist labour hours", error);
      }
    },
    [authUserId, dbUserId, job?.id, resolveCanonicalVhcId, createVhcCheckForDisplayId, refreshJobData]
  );

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
  const handlePartsNotRequiredToggle = useCallback(
    async (vhcItemId) => {
      const key = String(vhcItemId);
      setPartsNotRequired((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        const payload = {
          ...vhcData,
          partsNotRequired: Array.from(next),
        };
        setVhcData(payload);
        persistVhcSections(payload);
        return next;
      });
    },
    [persistVhcSections, vhcData]
  );

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

  const openAddPartsModal = useCallback((vhcId, context = {}) => {
    const nextContext =
      context && typeof context === "object"
        ? context
        : { label: String(context || "VHC Item") };
    setAddPartsTarget({
      vhcId,
      label: nextContext.label || "VHC Item",
      detail: nextContext.detail || nextContext.concern || nextContext.notes || "",
      section: nextContext.section || nextContext.sectionName || "",
      rows: Array.isArray(nextContext.rows) ? nextContext.rows : [],
    });
    setAddPartsSearch("");
    setAddPartsResults([]);
    setAddPartsError("");
    setPartsSearchSuggestions([]);
    setPartsSearchSuggestionsLoading(false);
    setSelectedSuggestionQuery("");
    setPartsLearningSavedAt(null);
    setSelectedParts([]);
    setAddPartsMessage("");
    setShowNewPartForm(false);
    setNewPartError("");
    setIsAddPartsModalOpen(true);
  }, []);

  const closeAddPartsModal = useCallback(() => {
    setIsAddPartsModalOpen(false);
    setAddPartsTarget(null);
    setAddPartsSearch("");
    setAddPartsResults([]);
    setAddPartsError("");
    setPartsSearchSuggestions([]);
    setPartsSearchSuggestionsLoading(false);
    setSelectedSuggestionQuery("");
    setPartsLearningSavedAt(null);
    setSelectedParts([]);
    setAddPartsMessage("");
    setShowNewPartForm(false);
    setNewPartError("");
  }, []);

  const handleSelectSearchPart = useCallback((part) => {
    if (!part) return;
    setSelectedParts((prev) => {
      if (prev.some((entry) => entry.part?.id === part.id)) {
        return prev;
      }
      return [
        ...prev,
        {
          part,
          quantity: 1,
          warranty: false,
          backOrder: false,
          surcharge: false,
        },
      ];
    });
  }, []);

  const handleRemoveSelectedPart = useCallback((partId) => {
    setSelectedParts((prev) => prev.filter((entry) => entry.part?.id !== partId));
  }, []);

  const handleSelectedPartChange = useCallback((partId, field, value) => {
    setSelectedParts((prev) =>
      prev.map((entry) =>
        entry.part?.id === partId ? { ...entry, [field]: value } : entry
      )
    );
  }, []);

  const handleOpenNewPart = useCallback(() => {
    const trimmed = addPartsSearch.trim();
    setShowNewPartForm((prev) => !prev);
    setNewPartError("");
    setNewPartForm((prev) => ({
      ...prev,
      partNumber: trimmed || prev.partNumber,
    }));
  }, [addPartsSearch]);

  const handleNewPartFieldChange = useCallback((field, value) => {
    setNewPartForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleCreateNewPart = useCallback(async () => {
    const fieldLabels = {
      partNumber: "Part number",
      costPrice: "Cost price",
      retailPrice: "Retail price",
    };
    const requiredFields = Object.keys(fieldLabels);
    const missing = requiredFields.filter((field) => !String(newPartForm[field] || "").trim());
    if (missing.length > 0) {
      setNewPartError(`Missing: ${missing.map((field) => fieldLabels[field]).join(", ")}.`);
      return;
    }

    const unitCostValue = Number(newPartForm.costPrice);
    const unitPriceValue = Number(newPartForm.retailPrice);
    if (!Number.isFinite(unitCostValue) || !Number.isFinite(unitPriceValue)) {
      setNewPartError("Cost price and retail price must be valid numbers.");
      return;
    }

    const nameValue = String(newPartForm.description || newPartForm.partNumber).trim();
    const supplierValue = "Unspecified";
    const categoryValue = "General";
    const storageLocationValue = String(newPartForm.binLocation || "Unassigned").trim();
    const notesValue = newPartForm.discountCode
      ? `Discount code: ${String(newPartForm.discountCode).trim()}`
      : "";

    setNewPartSaving(true);
    setNewPartError("");
    try {
      const response = await fetch("/api/parts/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partNumber: newPartForm.partNumber.trim(),
          name: nameValue || newPartForm.partNumber.trim(),
          supplier: supplierValue,
          category: categoryValue,
          storageLocation: storageLocationValue,
          unitCost: unitCostValue,
          unitPrice: unitPriceValue,
          description: String(newPartForm.description || "").trim(),
          notes: notesValue,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        if (Array.isArray(payload?.missing) && payload.missing.length > 0) {
          setNewPartError(`Missing: ${payload.missing.join(", ")}.`);
          return;
        }
        throw new Error(payload?.message || "Unable to create part");
      }

      const newPart = payload.part;
      setAddPartsMessage("New part created and added to selection.");
      setAddPartsSearch(newPart?.part_number || newPartForm.partNumber.trim());
      setAddPartsResults(newPart ? [newPart] : []);
      if (newPart?.id) {
        setSelectedParts((prev) => {
          if (prev.some((entry) => entry.part?.id === newPart.id)) {
            return prev;
          }
          return [
            ...prev,
            {
              part: newPart,
              quantity: newPartForm.quantity || 1,
              warranty: false,
              backOrder: false,
              surcharge: false,
            },
          ];
        });
      }
      setShowNewPartForm(false);
      setNewPartForm(createDefaultNewPartForm());
    } catch (error) {
      console.error("Failed to create new part:", error);
      setNewPartError(error.message || "Unable to create new part.");
    } finally {
      setNewPartSaving(false);
    }
  }, [newPartForm]);

  const savePartsSearchLearning = useCallback(
    async ({ finalQuery, selectedSuggestion = "" }) => {
      const cleanQuery = String(finalQuery || "").trim();
      const cleanContext = String(addPartsContextText || "").trim();
      if (!cleanQuery || cleanQuery.length < 2 || !cleanContext) return;
      const learningUserId = isValidUuid(authUserId) ? authUserId : isValidUuid(dbUserId) ? dbUserId : null;
      if (!learningUserId) return;

      try {
        await fetch("/api/vhc/parts-search-learning", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contextText: cleanContext,
            vehicleContext: addPartsVehicleContext,
            finalQuery: cleanQuery,
            selectedSuggestion: selectedSuggestion || null,
            userId: learningUserId,
            jobId: job?.id || null,
            scope: "user",
          }),
        });
        setPartsLearningSavedAt(Date.now());
      } catch (error) {
        console.warn("Failed to save parts search learning", error);
      }
    },
    [addPartsContextText, addPartsVehicleContext, authUserId, dbUserId, job?.id]
  );

  useEffect(() => {
    if (!isAddPartsModalOpen) return;
    const trimmed = addPartsSearch.trim();
    if (!trimmed) {
      setAddPartsResults([]);
      setAddPartsError("");
      return;
    }
    if (trimmed.length < 2) {
      setAddPartsResults([]);
      setAddPartsError("Enter at least 2 characters to search parts.");
      return;
    }

    let isActive = true;
    const timer = setTimeout(async () => {
      setAddPartsLoading(true);
      setAddPartsError("");
      try {
        const normalizedSearch = trimmed.toLowerCase();
        const searchCatalog = async (term) => {
          const params = new URLSearchParams({ search: term, limit: "25" });
          const response = await fetch(`/api/parts/catalog?${params.toString()}`);
          const payload = await response.json();
          if (!response.ok || !payload?.success) {
            throw new Error(payload?.message || "Unable to search parts catalogue");
          }
          return Array.isArray(payload.parts) ? payload.parts : [];
        };

        let results = await searchCatalog(normalizedSearch);
        const searchTokens = normalizedSearch.split(/\s+/).filter((token) => token.length >= 2);
        // Fallback: when full phrase returns no rows, search by each token and merge.
        if (results.length === 0 && searchTokens.length > 1) {
          const tokenResultSets = await Promise.all(searchTokens.map((token) => searchCatalog(token)));
          const mergedById = new Map();
          tokenResultSets.flat().forEach((item) => {
            if (item?.id && !mergedById.has(item.id)) {
              mergedById.set(item.id, item);
            }
          });
          results = Array.from(mergedById.values());
        }
        if (!isActive) return;
        const rankedResults = [...results].sort((a, b) => {
          const tokenMatchScore = (item) => {
            const haystack =
              `${item?.part_number || ""} ${item?.name || ""} ${item?.description || ""} ${item?.supplier || ""}`
                .toLowerCase();
            return searchTokens.reduce((count, token) => (haystack.includes(token) ? count + 1 : count), 0);
          };
          const textFor = (item) =>
            `${item?.part_number || ""} ${item?.name || ""} ${item?.description || ""} ${item?.supplier || ""}`
              .toLowerCase();
          const score = (item) => {
            const haystack = textFor(item);
            const tokenHits = tokenMatchScore(item);
            if (haystack.startsWith(normalizedSearch)) return 0;
            if (String(item?.part_number || "").toLowerCase().startsWith(normalizedSearch)) return 1;
            if (haystack.includes(normalizedSearch)) return 2;
            if (tokenHits >= 2) return 3;
            if (tokenHits === 1) return 4;
            return 5;
          };
          return score(a) - score(b);
        });
        setAddPartsResults(rankedResults);
        setAddPartsError(rankedResults.length === 0 ? "No matching parts found." : "");

        const normalizedTypedQuery = trimmed.toLowerCase();
        const normalizedSelectedSuggestion = String(selectedSuggestionQuery || "").trim().toLowerCase();
        if (normalizedTypedQuery && normalizedTypedQuery.length >= 2 && normalizedTypedQuery !== normalizedSelectedSuggestion) {
          if (partsLearningDebounceRef.current) {
            clearTimeout(partsLearningDebounceRef.current);
          }
          partsLearningDebounceRef.current = setTimeout(() => {
            savePartsSearchLearning({
              finalQuery: trimmed,
              selectedSuggestion: "",
            });
          }, 700);
        }
      } catch (error) {
        if (!isActive) return;
        setAddPartsResults([]);
        setAddPartsError(error.message || "Unable to search parts catalogue");
      } finally {
        if (isActive) {
          setAddPartsLoading(false);
        }
      }
    }, 300);

    return () => {
      isActive = false;
      clearTimeout(timer);
      if (partsLearningDebounceRef.current) {
        clearTimeout(partsLearningDebounceRef.current);
        partsLearningDebounceRef.current = null;
      }
    };
  }, [addPartsSearch, isAddPartsModalOpen, selectedSuggestionQuery, savePartsSearchLearning]);

  const persistPartMeta = useCallback(
    async (partId, meta) => {
      if (!partId) return;
      const partRecord = job?.parts_job_items?.find((part) => part.id === partId);
      const baseNotes = partRecord?.request_notes || partRecord?.requestNotes || "";
      const requestNotes = buildRequestNotesWithMeta(baseNotes, meta);

      try {
        const response = await fetch(`/api/parts/job-items/${partId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request_notes: requestNotes }),
        });
        const payload = await response.json();
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || payload?.message || "Failed to save part details");
        }

        setJob((prev) => {
          if (!prev) return prev;
          const updatedParts = Array.isArray(prev.parts_job_items)
            ? prev.parts_job_items.map((part) =>
                part.id === partId ? { ...part, request_notes: requestNotes } : part
              )
            : prev.parts_job_items;
          return { ...prev, parts_job_items: updatedParts };
        });
      } catch (error) {
        console.error("Failed to persist part metadata:", error);
      }
    },
    [job?.parts_job_items]
  );

  // Handler for updating part detail fields
  const handlePartDetailChange = useCallback(
    (partKey, field, value, partId) => {
      setPartDetails((prev) => {
        const nextEntry = {
          ...(prev[partKey] || {}),
          [field]: value,
        };
        const next = { ...prev, [partKey]: nextEntry };

        if (partId) {
          persistPartMeta(partId, {
            warranty: Boolean(nextEntry.warranty),
            backOrder: Boolean(nextEntry.backOrder),
            surcharge: Boolean(nextEntry.surcharge),
          });
        }

        return next;
      });
    },
    [persistPartMeta]
  );

  // Handler for when a part is added
  const handlePartAdded = useCallback(async (payload) => {
    const partData = payload?.jobPart || payload;
    const sourceVhcId = payload?.sourceVhcId ? String(payload.sourceVhcId) : null;

    if (sourceVhcId && partData?.vhc_item_id) {
      await upsertVhcItemAlias(sourceVhcId, partData.vhc_item_id);
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
          vhc_checks(vhc_id, section, issue_description, issue_title, measurement, created_at, updated_at, severity),
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
        const {
          vhc_checks = [],
          parts_job_items = [],
          job_files = [],
          ...jobFields
        } = updatedJob;
        let resolvedParts = Array.isArray(parts_job_items) ? parts_job_items : [];
        if (resolvedParts.length === 0 && updatedJob?.id) {
          const fallbackParts = await fetchJobPartsViaApi(updatedJob.id);
          if (Array.isArray(fallbackParts) && fallbackParts.length > 0) {
            resolvedParts = fallbackParts;
          }
        }
        // Build alias map from display_id on vhc_checks (consolidated from vhc_item_aliases)
        const aliasMapFromDb = {};
        const sanitizedAliasRows = [];
        (vhc_checks || []).forEach((check) => {
          if (!check?.display_id || check.vhc_id === null || check.vhc_id === undefined) return;
          aliasMapFromDb[String(check.display_id)] = String(check.vhc_id);
          sanitizedAliasRows.push({ display_id: check.display_id, vhc_item_id: check.vhc_id });
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
          resolvedParts.forEach((part) => {
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

          // Calculate VAT (20%)
          const unitPrice = Number(partData.unit_price || part.unit_price || 0);
          const unitCost = Number(partData.unit_cost || part.unit_cost || 0);
          const vatAmount = unitPrice * 0.2;
          const priceWithVat = unitPrice + vatAmount;

          const newPartDetail = {
            vhcId: displayVhcId,
            partNumber: part.part_number || "",
            partName: part.name || "",
            costToCustomer: unitPrice,
            costToCompany: unitCost,
            vat: vatAmount,
            totalWithVat: priceWithVat,
            inStock: (part.qty_in_stock || 0) > 0,
            backOrder: false,
            warranty: false,
            surcharge: false,
          };

          setPartDetails((prev) => {
            const updated = {
              ...prev,
              [partKey]: newPartDetail,
            };
            return updated;
          });

          // Expand the row to show the newly added part
          setExpandedVhcItems((prev) => {
            const newSet = new Set(prev);
            newSet.add(displayVhcId);
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
  }, [fetchJobPartsViaApi, resolvedJobNumber, upsertVhcItemAlias]);

  const handleAddSelectedParts = useCallback(async () => {
    if (!job?.id || !addPartsTarget?.vhcId) return;
    if (selectedParts.length === 0) {
      setAddPartsMessage("Select at least one part to add.");
      return;
    }
    setAddingParts(true);
    setAddPartsMessage("");

    const canonicalId = resolveCanonicalVhcId(addPartsTarget.vhcId);
    const parsedId = Number(canonicalId);
    let vhcItemId = Number.isInteger(parsedId) ? parsedId : null;

    try {
      if (!Number.isInteger(vhcItemId)) {
        vhcItemId = await createVhcCheckForDisplayId(addPartsTarget.vhcId, {
          allowCreate: true,
        });
      }

      if (!Number.isInteger(vhcItemId)) {
        throw new Error("Unable to link parts to this VHC item.");
      }

      let lastJobPart = null;
      for (const entry of selectedParts) {
        const part = entry.part || {};
        const requestNotes = buildRequestNotesWithMeta(
          `Added from VHC Parts Identified - Job #${resolvedJobNumber}`,
          {
            warranty: entry.warranty,
            backOrder: entry.backOrder,
            surcharge: entry.surcharge,
          }
        );
        const response = await fetch("/api/parts/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: job.id,
            partId: part.id,
            quantityRequested: entry.quantity || 1,
            allocateFromStock: false,
            storageLocation: part.storage_location || null,
            status: "pending",
            requestNotes,
            origin: "vhc",
            vhcItemId: vhcItemId,
            userId: authUserId,
            userNumericId: dbUserId,
            unitCost: part.unit_cost || 0,
            unitPrice: part.unit_price || 0,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Failed to add part to job");
        }

        const jobPart = data?.jobPart;
        lastJobPart = jobPart || lastJobPart;
        if (jobPart?.id) {
          const partKey = `${addPartsTarget.vhcId}-${jobPart.id}`;
          setPartDetails((prev) => ({
            ...prev,
            [partKey]: {
              ...(prev[partKey] || {}),
              vhcId: addPartsTarget.vhcId,
              warranty: entry.warranty,
              backOrder: entry.backOrder,
              surcharge: entry.surcharge,
            },
          }));
        }
      }

      await handlePartAdded({ sourceVhcId: addPartsTarget.vhcId, jobPart: lastJobPart });
      setAddPartsMessage("Parts added to this VHC item.");
      setIsAddPartsModalOpen(false);
      setSelectedParts([]);
    } catch (error) {
      console.error("Failed to add parts to VHC item:", error);
      setAddPartsMessage(error.message || "Unable to add parts to VHC item.");
    } finally {
      setAddingParts(false);
    }
  }, [
    addPartsTarget,
    authUserId,
    dbUserId,
    createVhcCheckForDisplayId,
    handlePartAdded,
    job?.id,
    resolvedJobNumber,
    resolveCanonicalVhcId,
    selectedParts,
  ]);

  const handleRemovePart = useCallback(
    async (partItem, displayVhcId) => {
      if (!partItem?.id) return;
      const confirmRemove =
        typeof confirm === "function"
          ? await confirm(`Remove ${partItem.part?.name || "this part"} from the VHC item?`)
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

        refreshJobData();
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
    [confirm, job?.parts_job_items, removeVhcItemAlias, resolveCanonicalVhcId, refreshJobData]
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

  // Render VHC items panel for Parts Identified (shows all VHC items regardless of status)
  const renderVhcItemsPanel = useCallback(() => {
    const itemsById = new Map(
      (vhcItemsWithParts || []).map((item) => [String(item.vhcId), item])
    );
    const orderedSourceItems = Array.isArray(summaryItems) ? summaryItems : [];
    const filteredItems = orderedSourceItems.map((item) => {
      const key = String(item.id);
      const existing = itemsById.get(key);
      if (existing) {
        return existing;
      }
      return {
        vhcItem: item,
        linkedParts: [],
        vhcId: key,
        canonicalVhcId: resolveCanonicalVhcId(key),
      };
    });
    const filteredIds = new Set(filteredItems.map((item) => String(item.vhcId)));
    const orphanItems = (vhcItemsWithParts || []).filter((item) => !filteredIds.has(String(item.vhcId)));
    const displayItems = [...filteredItems, ...orphanItems];

    if (!displayItems || displayItems.length === 0) {
      return <EmptyStateMessage message="No VHC repairs have been recorded yet." />;
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
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr
                style={{
                  background: "var(--info-surface)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--info)",
                  fontSize: "10px",
                }}
              >
                <th style={{ textAlign: "left", padding: "10px 12px", minWidth: "200px" }}>VHC Item</th>
                <th style={{ textAlign: "left", padding: "10px 12px", minWidth: "160px" }}>Linked Parts</th>
                <th style={{ textAlign: "right", padding: "10px 12px", minWidth: "90px" }}>Parts Cost</th>
                <th style={{ textAlign: "center", padding: "10px 12px", minWidth: "70px" }}>Warranty</th>
                <th style={{ textAlign: "center", padding: "10px 12px", minWidth: "140px" }}>Parts Not Required</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item) => {
                const { vhcItem, linkedParts, vhcId, canonicalVhcId } = item;
                const isPartsNotRequired = partsNotRequired.has(vhcId);
                const isWarranty = warrantyRows.has(vhcId);
                const partsCost = partsCostByVhcItem.get(canonicalVhcId || vhcId) || 0;
                const hasParts = linkedParts.length > 0;

                // VHC item details
                const vhcLabel = vhcItem?.label || "VHC Item";
                const vhcNotes = vhcItem?.notes || vhcItem?.concernText || "";
                const vhcSeverity = vhcItem?.severityKey || vhcItem?.rawSeverity;
                const vhcCategory = vhcItem?.categoryLabel || vhcItem?.category?.label || "";
                const vhcRows = Array.isArray(vhcItem?.rows)
                  ? vhcItem.rows.map((row) => (row ? String(row).trim() : "")).filter(Boolean)
                  : [];
                const isServiceIndicatorRow = vhcItem?.category?.id === "service_indicator";
                const locationLabel = vhcItem?.location
                  ? LOCATION_LABELS[vhcItem.location] || vhcItem.location.replace(/_/g, " ")
                  : null;

                const severityBadgeStyles = vhcSeverity ? buildSeverityBadgeStyles(vhcSeverity) : null;

                const isExpanded = expandedVhcItems.has(vhcId);

                // Check if row is locked (authorized or declined)
                const entry = getEntryForItem(vhcId);
                const entryDecision = normaliseDecisionStatus(entry.status);
                const canonicalId = resolveCanonicalVhcId(vhcId);
                const isLocked =
                  entryDecision === "authorized" ||
                  entryDecision === "declined" ||
                  authorizedViewIds.has(String(canonicalId));
                const canAddPart = !isCustomerView && !readOnly && !isLocked;

                // Determine background color based on status
                let rowBackground = "var(--surface)";
                let rowHoverBackground = "var(--accent-purple-surface)";

                if (entryDecision === "authorized") {
                  rowBackground = "var(--success-surface)";
                  rowHoverBackground = "rgba(34, 197, 94, 0.15)";
                } else if (entryDecision === "declined") {
                  rowBackground = "var(--danger-surface)";
                  rowHoverBackground = "rgba(239, 68, 68, 0.15)";
                } else if (vhcSeverity) {
                  rowBackground = SEVERITY_THEME[vhcSeverity]?.background || "var(--surface)";
                  rowHoverBackground = SEVERITY_THEME[vhcSeverity]?.hover || "var(--accent-purple-surface)";
                }

                return (
                  <React.Fragment key={vhcId}>
                  <tr
                    onClick={() => handleVhcItemRowClick(vhcId)}
                    style={{
                      borderBottom: isExpanded ? "none" : "1px solid var(--info-surface)",
                      background: rowBackground,
                      cursor: "pointer",
                      transition: "background 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = rowHoverBackground;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = rowBackground;
                    }}
                  >
                    <td style={{ padding: "10px 12px", wordBreak: "break-word" }}>
                      <div>
                        <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                          {vhcCategory}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--accent-purple)", marginTop: "2px" }}>
                          {vhcLabel}
                        </div>
                        {isServiceIndicatorRow && vhcRows.length > 0 ? (
                          <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
                            {vhcRows.map((row, rowIdx) => (
                              <div key={`${vhcId}-service-indicator-row-${rowIdx}`} style={{ fontSize: "12px", fontWeight: 600, color: "var(--info-dark)" }}>
                                - {row}
                              </div>
                            ))}
                          </div>
                        ) : null}
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
                    <td style={{ padding: "10px 12px", wordBreak: "break-word" }}>
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
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
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
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
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
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
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
                        <div style={{ padding: "24px", background: rowBackground }}>
                          {!isCustomerView ? (
                            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "12px" }}>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (canAddPart) {
                                    openAddPartsModal(vhcId, {
                                      label: vhcLabel,
                                      detail: vhcNotes,
                                      section: vhcItem?.sectionName || vhcItem?.categoryLabel || "",
                                      rows: vhcItem?.rows || [],
                                    });
                                  }
                                }}
                                disabled={!canAddPart}
                                style={{
                                  padding: "8px 14px",
                                  borderRadius: "8px",
                                  border: "1px solid var(--primary)",
                                  background: canAddPart ? "var(--primary)" : "var(--surface-light)",
                                  color: canAddPart ? "var(--surface)" : "var(--info)",
                                  fontWeight: 600,
                                  cursor: canAddPart ? "pointer" : "not-allowed",
                                  fontSize: "12px",
                                  opacity: canAddPart ? 1 : 0.6,
                                }}
                                title={isLocked ? "Cannot add parts to authorized or declined items" : ""}
                              >
                                Add Part
                              </button>
                            </div>
                          ) : null}
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
                              No parts added yet.
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                              <div style={{ border: "1px solid var(--accent-purple-surface)", borderRadius: "12px", overflow: "hidden" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                                  <thead>
                                    <tr style={{ background: "var(--info-surface)", color: "var(--info)", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "10px" }}>
                                      <th style={{ textAlign: "left", padding: "10px 12px" }}>Part</th>
                                      <th style={{ textAlign: "left", padding: "10px 12px" }}>Description</th>
                                      <th style={{ textAlign: "right", padding: "10px 12px" }}>Cost</th>
                                      <th style={{ textAlign: "left", padding: "10px 12px" }}>Location</th>
                                      <th style={{ textAlign: "center", padding: "10px 12px" }}>Warranty</th>
                                      <th style={{ textAlign: "center", padding: "10px 12px" }}>Back Order</th>
                                      <th style={{ textAlign: "center", padding: "10px 12px" }}>Surcharge</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {linkedParts.map((part) => {
                                      const partKey = `${vhcId}-${part.id}`;
                                      const details = partDetails[partKey] || {};
                                      const partName = details.partName || part.part?.name || "Part";
                                      const partDescription = part.part?.description || "—";
                                      const costToCustomer = details.costToCustomer !== undefined ? details.costToCustomer : Number(part.unit_price || part.part?.unit_price || 0);
                                      const location = part.storage_location || part.part?.storage_location || "—";
                                      const warranty = details.warranty || false;
                                      const backOrder = details.backOrder || false;
                                      const surcharge = details.surcharge || false;

                                      return (
                                        <tr key={`${partKey}-summary`} style={{ borderBottom: "1px solid var(--info-surface)" }}>
                                          <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--accent-purple)" }}>
                                            {partName}
                                          </td>
                                          <td style={{ padding: "10px 12px", color: "var(--info-dark)" }}>
                                            {partDescription}
                                          </td>
                                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: "var(--accent-purple)" }}>
                                            £{Number(costToCustomer || 0).toFixed(2)}
                                          </td>
                                          <td style={{ padding: "10px 12px", color: "var(--info-dark)" }}>
                                            {location}
                                          </td>
                                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                            <input
                                              type="checkbox"
                                              checked={warranty}
                                              onChange={(event) => handlePartDetailChange(partKey, "warranty", event.target.checked, part.id)}
                                            />
                                          </td>
                                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                            <input
                                              type="checkbox"
                                              checked={backOrder}
                                              onChange={(event) => handlePartDetailChange(partKey, "backOrder", event.target.checked, part.id)}
                                            />
                                          </td>
                                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                            <input
                                              type="checkbox"
                                              checked={surcharge}
                                              onChange={(event) => handlePartDetailChange(partKey, "surcharge", event.target.checked, part.id)}
                                            />
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
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
  }, [vhcItemsWithParts, summaryItems, resolveCanonicalVhcId, partsNotRequired, warrantyRows, partsCostByVhcItem, handlePartsNotRequiredToggle, handleVhcItemRowClick, expandedVhcItems, partDetails, handlePartDetailChange, handleRemovePart, removingPartIds, isCustomerView, openAddPartsModal, readOnly]);

  // Render VHC authorized items panel (similar to Parts Identified but for authorized items)
  const renderVhcAuthorizedPanel = useCallback(() => {
    const filteredItems = vhcItemsWithPartsAuthorized || [];

    if (!filteredItems || filteredItems.length === 0) {
      return <EmptyStateMessage message="No authorized VHC items with parts yet." />;
    }

    const serviceChoiceKey = vhcData?.serviceIndicator?.serviceChoice || "";
    const serviceChoiceLabel =
      SERVICE_CHOICE_LABELS[serviceChoiceKey] || serviceChoiceKey || "";
    const normaliseServiceText = (value = "") =>
      value.toString().toLowerCase().replace(/\s+/g, " ").trim();

    return (
      <div
        style={{
          border: "1px solid var(--success-surface)",
          borderRadius: "16px",
          background: "var(--surface)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", tableLayout: "fixed" }}>
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
                <th style={{ textAlign: "left", padding: "12px 16px", width: "32%", whiteSpace: "normal" }}>VHC Item</th>
                <th style={{ textAlign: "left", padding: "12px 16px", width: "22%", whiteSpace: "normal" }}>Linked Parts</th>
                <th style={{ textAlign: "right", padding: "12px 16px", width: "10%" }}>Parts Cost</th>
                <th style={{ textAlign: "center", padding: "12px 16px", width: "8%" }}>Warranty</th>
                <th style={{ textAlign: "center", padding: "12px 16px", width: "14%" }}>Status</th>
                <th style={{ textAlign: "left", padding: "12px 16px", width: "14%", whiteSpace: "normal" }}>Pre-Pick Location</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const { vhcItem, linkedParts, vhcId, canonicalVhcId } = item;
                const isWarranty = warrantyRows.has(vhcId);

                // VHC item details
                let vhcLabel = vhcItem?.label || "VHC Item";
                let vhcNotes = vhcItem?.notes || vhcItem?.concernText || "";
                const vhcCategory = vhcItem?.categoryLabel || vhcItem?.category?.label || "";
                const locationLabel = vhcItem?.location
                  ? LOCATION_LABELS[vhcItem.location] || vhcItem.location.replace(/_/g, " ")
                  : null;
                let vhcRows = Array.isArray(vhcItem?.rows)
                  ? vhcItem.rows.map((row) => (row ? String(row).trim() : "")).filter(Boolean)
                  : [];
                const isServiceIndicatorRow = vhcItem?.category?.id === "service_indicator";
                const labelKey = normaliseServiceText(vhcLabel);
                const rowKey = normaliseServiceText(vhcRows.join(" "));
                const isServiceReminderRow =
                  labelKey.includes("service reminder") ||
                  labelKey.includes("service reminder/oil") ||
                  rowKey.includes("service reminder") ||
                  rowKey.includes("service reminder/oil");
                if (isServiceIndicatorRow && serviceChoiceLabel && isServiceReminderRow) {
                  vhcLabel = "Service Reminder";
                  vhcRows = [serviceChoiceLabel];
                  vhcNotes = "";
                }

                // Authorized items should have green background
                const rowBackground = "var(--success-surface)";
                const rowHoverBackground = "rgba(34, 197, 94, 0.15)";

                // If no parts, show single row with VHC item
                if (!linkedParts || linkedParts.length === 0) {
                  return (
                    <tr
                      key={vhcId}
                      style={{
                        borderBottom: "1px solid var(--info-surface)",
                        background: rowBackground,
                        transition: "background 0.2s ease",
                      }}
                    >
                      <td style={{ padding: "12px 16px", whiteSpace: "normal", wordBreak: "break-word" }}>
                        <div>
                          <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                            {vhcCategory}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--success)", marginTop: "2px" }}>
                            {vhcLabel}
                          </div>
                          {isServiceIndicatorRow && vhcRows.length > 0 ? (
                            <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
                              {vhcRows.map((row, rowIdx) => (
                                <div key={`${vhcId}-service-indicator-row-${rowIdx}`} style={{ fontSize: "12px", fontWeight: 600, color: "var(--info-dark)" }}>
                                  - {row}
                                </div>
                              ))}
                            </div>
                          ) : null}
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
                      <td style={{ padding: "12px 16px", whiteSpace: "normal", wordBreak: "break-word" }}>
                        <span style={{ color: "var(--info-light)", fontSize: "12px" }}>No parts linked</span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <span style={{ color: "var(--info-light)", fontSize: "12px" }}>£0.00</span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        {isWarranty ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "28px",
                              height: "28px",
                              borderRadius: "999px",
                              background: "var(--warning-surface)",
                              color: "var(--warning)",
                              fontWeight: 700,
                              fontSize: "13px",
                            }}
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
                          disabled
                          style={{
                            padding: "8px 16px",
                            borderRadius: "8px",
                            border: "1px solid var(--surface-light)",
                            background: "var(--surface-light)",
                            color: "var(--info)",
                            fontWeight: 600,
                            cursor: "not-allowed",
                            fontSize: "12px",
                            width: "100%",
                          }}
                          title="Add a part first"
                        >
                          Order
                        </button>
                      </td>
                      <td style={{ padding: "12px 16px", whiteSpace: "normal", wordBreak: "break-word" }}>
                        <span style={{ color: "var(--info-light)", fontSize: "12px" }}>—</span>
                      </td>
                    </tr>
                  );
                }

                // Show a single row per VHC item, with parts stacked inside cells.
                const partLines = linkedParts.map((part) => {
                  const partPrice = Number(part.unit_price ?? part.part?.unit_price ?? 0);
                  const partQty = Number(part.quantity_requested || 1);
                  const partTotal = partPrice * partQty;
                  const normalizedStatus = normalisePartStatus(part.status);
                  const currentStatus = normalizedStatus || "authorized";
                  const isOrdered = currentStatus === "on_order";
                  return { part, partQty, partTotal, isOrdered };
                });

                const totalPartsCost = partLines.reduce((sum, entry) => sum + (entry.partTotal || 0), 0);

                return (
                  <tr
                    key={vhcId}
                    style={{
                      borderBottom: "1px solid var(--info-surface)",
                      background: rowBackground,
                      transition: "background 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = rowHoverBackground;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = rowBackground;
                    }}
                  >
                      <td style={{ padding: "12px 16px", whiteSpace: "normal", wordBreak: "break-word" }}>
                        <div>
                          <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
                            {vhcCategory}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--success)", marginTop: "2px" }}>
                            {vhcLabel}
                          </div>
                          {isServiceIndicatorRow && vhcRows.length > 0 ? (
                            <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
                              {vhcRows.map((row, rowIdx) => (
                                <div key={`${vhcId}-service-indicator-row-${rowIdx}`} style={{ fontSize: "12px", fontWeight: 600, color: "var(--info-dark)" }}>
                                  - {row}
                                </div>
                              ))}
                            </div>
                          ) : null}
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

                    <td style={{ padding: "12px 16px", whiteSpace: "normal", wordBreak: "break-word" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {partLines.map(({ part, partQty }) => (
                          <div key={part.id} style={{ fontSize: "12px", color: "var(--info-dark)" }}>
                            <div style={{ fontWeight: 600, color: "var(--success)" }}>
                              {part.part?.name || "Unknown Part"}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--info)" }}>
                              {part.part?.part_number || "No part number"} • Qty: {partQty}
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>

                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <span style={{ fontWeight: 700, color: "var(--success)", fontSize: "14px" }}>
                        £{totalPartsCost.toFixed(2)}
                      </span>
                    </td>

                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      {isWarranty ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "28px",
                            height: "28px",
                            borderRadius: "999px",
                            background: "var(--warning-surface)",
                            color: "var(--warning)",
                            fontWeight: 700,
                            fontSize: "13px",
                          }}
                        >
                          W
                        </span>
                      ) : (
                        <span style={{ color: "var(--info-light)", fontSize: "12px" }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {partLines.map(({ part, isOrdered }) => (
                          <button
                            key={`order-${part.id}`}
                            type="button"
                            onClick={async () => {
                              if (isOrdered) return;
                              try {
                                await handlePartStatusUpdate(part.id, {
                                  status: "on_order",
                                  authorised: true,
                                  stockStatus: "no_stock",
                                });
                              } catch (error) {
                                console.error(`[VHC] Failed to mark part ${part.id} as ordered:`, error);
                                alert(`Failed to mark part as ordered: ${error.message}`);
                              }
                            }}
                            style={{
                              padding: "8px 16px",
                              borderRadius: "8px",
                              border: isOrdered ? "1px solid var(--success)" : "1px solid var(--primary)",
                              background: isOrdered ? "var(--success)" : "var(--primary)",
                              color: "var(--surface)",
                              fontWeight: 600,
                              cursor: isOrdered ? "default" : "pointer",
                              fontSize: "12px",
                              transition: "all 0.2s ease",
                              width: "100%",
                            }}
                            onMouseEnter={(e) => {
                              if (!isOrdered) {
                                e.target.style.background = "var(--primary-dark)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isOrdered) {
                                e.target.style.background = "var(--primary)";
                              } else {
                                e.target.style.background = "var(--success)";
                              }
                            }}
                          >
                            {isOrdered ? "Ordered" : "Order"}
                          </button>
                        ))}
                      </div>
                    </td>

                    <td style={{ padding: "12px 16px", whiteSpace: "normal", wordBreak: "break-word" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {partLines.map(({ part }) => (
                          <select
                            key={`prepick-${part.id}`}
                            value={part.pre_pick_location || ""}
                            onChange={async (e) => {
                              const newLocation = e.target.value;
                              try {
                                const updates = { prePickLocation: newLocation };

                                if (newLocation === "on_order") {
                                  updates.status = "on_order";
                                  updates.stockStatus = "no_stock";
                                } else if (newLocation && newLocation !== "") {
                                  updates.status = "pre_picked";
                                  updates.stockStatus = "in_stock";
                                }

                                await handlePartStatusUpdate(part.id, updates);
                              } catch (error) {
                                console.error(`[VHC] Failed to update part ${part.id}:`, error);
                                alert(`Failed to update part location: ${error.message}`);
                                e.target.value = part.pre_pick_location || "";
                              }
                            }}
                            style={{
                              padding: "8px 12px",
                              borderRadius: "8px",
                              border: "1px solid var(--accent-purple-surface)",
                              background: "var(--surface)",
                              color: "var(--accent-purple)",
                              fontWeight: 500,
                              cursor: "pointer",
                              width: "100%",
                              fontSize: "12px",
                            }}
                          >
                            <option value="">Select Location</option>
                            <option value="service_rack_1">Service Rack 1</option>
                            <option value="service_rack_2">Service Rack 2</option>
                            <option value="service_rack_3">Service Rack 3</option>
                            <option value="service_rack_4">Service Rack 4</option>
                            <option value="sales_rack_1">Sales Rack 1</option>
                            <option value="sales_rack_2">Sales Rack 2</option>
                            <option value="sales_rack_3">Sales Rack 3</option>
                            <option value="sales_rack_4">Sales Rack 4</option>
                            <option value="stairs_pre_pick">Stairs Pre-Pick</option>
                            <option value="no_pick">No Pick</option>
                            <option value="on_order">On Order</option>
                          </select>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              }).flat()}
            </tbody>
          </table>
        </div>
      </div>
    );
  }, [vhcItemsWithPartsAuthorized, warrantyRows, partsCostByVhcItem, handlePartStatusUpdate]);

  // Render parts panel with table
  const renderPartsPanel = useCallback((title, parts, emptyMessage) => {
    if (!parts || parts.length === 0) {
      return <EmptyStateMessage message={emptyMessage} />;
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
                          {(() => {
                            const partNumber =
                              part.part_number ||
                              part.partNumber ||
                              partItem.part_number ||
                              partItem.partNumber ||
                              "";
                            const isAddedToJob = partNumber
                              ? bookedPartNumbers.has(partNumber.toLowerCase())
                              : false;

                            if (isAddedToJob) {
                              return (
                                <span
                                  style={{
                                    padding: "8px 16px",
                                    borderRadius: "8px",
                                    border: "1px solid var(--success)",
                                    background: "var(--success-surface)",
                                    color: "var(--success)",
                                    fontWeight: 600,
                                    fontSize: "12px",
                                    display: "inline-block",
                                  }}
                                >
                                  Added
                                </span>
                              );
                            }

                            if (normalisePartStatus(partItem.status) === "stock") {
                              return (
                                <span
                                  style={{
                                    padding: "8px 16px",
                                    borderRadius: "8px",
                                    border: "1px solid var(--success)",
                                    background: "var(--success-surface)",
                                    color: "var(--success)",
                                    fontWeight: 600,
                                    fontSize: "12px",
                                    display: "inline-block",
                                  }}
                                >
                                  Arrived
                                </span>
                              );
                            }

                            return (
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
                            );
                          })()}
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
  }, [
    bookedPartNumbers,
    handlePrePickLocationChange,
    handleAddToJobClick,
    readOnly,
    handlePartArrived,
    normalisePartStatus,
  ]);

  // Render file gallery (photos/videos)
  const renderFileGallery = useCallback((title, files, emptyMessage, fileType) => {
    if (!files || files.length === 0) {
      return <EmptyStateMessage message={emptyMessage} />;
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

  if (isCustomerView) {
    return renderCustomerView();
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
                onClick={() => router.push("/job-cards/view")}
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

      {!activeSection && (
      <div style={PANEL_SECTION_STYLE}>
        {enableTabs ? (
          <>
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
                {/* Only show Red/Amber sections if there are pending items */}
                {["red", "amber"].map((severity) => {
                    const items = quoteSeverityLists[severity] || [];
                    if (items.length === 0) return null;
                    const meta = SEVERITY_META[severity];
                    const severityTheme = SEVERITY_THEME[severity] || { border: "var(--info-surface)", background: "var(--danger-surface)" };

                    // Calculate totals for this severity
                    const selectedIds = severitySelections[severity] || [];
                    const selectedSet = new Set(selectedIds);

                    let selectedTotal = 0;
                    let authorisedTotal = 0;
                    let declinedTotal = 0;

                    items.forEach((item) => {
                      const entry = getEntryForItem(item.id);
                      const decisionKey = resolveVhcRowDecisionKey(item, entry);
                      const finalTotal = Number(item.total_gbp ?? item.total ?? 0);

                      if (selectedSet.has(item.id)) {
                        selectedTotal += finalTotal;
                      }
                      if (decisionKey === "authorized") {
                        authorisedTotal += finalTotal;
                      } else if (decisionKey === "declined") {
                        declinedTotal += finalTotal;
                      }
                    });

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
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                            <div>
                              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: meta.accent }}>{meta.title}</h2>
                              {meta.description ? (
                                <p style={{ margin: "4px 0 0", color: "var(--info)" }}>{meta.description}</p>
                              ) : null}
                            </div>
                            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                              {selectedSet.size > 0 && (
                                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--info-dark)" }}>
                                  Selected: £{selectedTotal.toFixed(2)}
                                </span>
                              )}
                              {authorisedTotal > 0 && (
                                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--success)" }}>
                                  Authorised: £{authorisedTotal.toFixed(2)}
                                </span>
                              )}
                              {declinedTotal > 0 && (
                                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--danger)" }}>
                                  Declined: £{declinedTotal.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {renderSeverityTable(severity, items)}
                      </div>
                    );
                  })}

                  {/* Authorised section - only show if there are authorized items */}
                  {quoteSeverityLists.authorized && quoteSeverityLists.authorized.length > 0 ? (
                    <div
                      style={{
                        border: "2px solid var(--success)",
                        borderRadius: "18px",
                        padding: "18px",
                        background: "var(--surface)",
                        boxShadow: "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                      }}
                    >
                      <div style={{ borderBottom: "1px solid var(--success)", paddingBottom: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--success)" }}>Authorised</h2>
                          </div>
                          {quoteTotals.authorized > 0 && (
                            <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--success)" }}>
                              {formatCurrency(quoteTotals.authorized)}
                            </div>
                          )}
                        </div>
                      </div>
                      {renderSeverityTable("authorized", quoteSeverityLists.authorized)}
                    </div>
                  ) : null}

                  {/* Declined section - only show if there are declined items */}
                  {quoteSeverityLists.declined && quoteSeverityLists.declined.length > 0 ? (
                    <div
                      style={{
                        border: "2px solid var(--danger)",
                        borderRadius: "18px",
                        padding: "18px",
                        background: "var(--surface)",
                        boxShadow: "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                      }}
                    >
                      <div style={{ borderBottom: "1px solid var(--danger)", paddingBottom: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--danger)" }}>Declined</h2>
                          </div>
                          {quoteTotals.declined > 0 && (
                            <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--danger)" }}>
                              {formatCurrency(quoteTotals.declined)}
                            </div>
                          )}
                        </div>
                      </div>
                      {renderSeverityTable("declined", quoteSeverityLists.declined)}
                    </div>
                  ) : null}

                  {greenItems.length > 0 && (
                    <div
                      style={{
                        border: "2px solid var(--success)",
                        borderRadius: "18px",
                        padding: "20px",
                        background: "var(--success-surface)",
                        boxShadow: "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: "18px",
                      }}
                    >
                      <div>
                        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--success)" }}>Green Checks</h2>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: "12px",
                        }}
                      >
                        {greenItems.map((item) => {
                          const locationLabel = item.location
                            ? LOCATION_LABELS[item.location] || item.location.replace(/_/g, " ")
                            : null;
                          return (
                            <div
                              key={item.id}
                              style={{
                                borderRadius: "14px",
                                background: "var(--surface)",
                                border: "1px solid var(--surface-light)",
                                padding: "14px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.08em",
                                  color: "var(--info)",
                                }}
                              >
                                {item.category?.label || item.sectionName}
                              </span>
                              <div style={{ fontWeight: 700, color: "var(--accent-purple)", fontSize: "14px" }}>
                                {item.label}
                              </div>
                              {item.notes ? (
                                <div style={{ fontSize: "12px", color: "var(--info-dark)" }}>{item.notes}</div>
                              ) : null}
                              {item.measurement ? (
                                <div style={{ fontSize: "12px", color: "var(--info)" }}>{item.measurement}</div>
                              ) : null}
                              {locationLabel ? (
                                <div style={{ fontSize: "12px", color: "var(--info)" }}>Location: {locationLabel}</div>
                              ) : null}
                              {item.spec?.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px", color: "var(--info)" }}>
                                  {item.spec.map((line) => (
                                    <span key={`${item.id}-spec-${line}`}>{line}</span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
                      VHC has not been started yet.
                    </div>
                  )}
                </div>
              )}

              {activeTab === "parts-identified" && (
                <div id="parts-identified">
                  {renderVhcItemsPanel()}
                </div>
              )}

              {activeTab === "parts-authorized" && (
                <div id="parts-authorized">
                  {renderVhcAuthorizedPanel()}
                </div>
              )}


              {activeTab === "photos" &&
                renderFileGallery("Photos", photoFiles, "No customer-facing photos have been attached.", "photo")}

              {activeTab === "videos" &&
                renderFileGallery("Videos", videoFiles, "No customer-facing videos have been attached.", "video")}
            </div>
          </>
        ) : (
          <>
            {customActions && (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                {typeof customActions === "function" ? customActions("summary") : customActions}
              </div>
            )}
            <div style={TAB_CONTENT_STYLE}>
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* Only show Red/Amber sections if there are pending items */}
                {["red", "amber"].map((severity) => {
                  const items = quoteSeverityLists[severity] || [];
                  if (items.length === 0) return null;
                  const meta = SEVERITY_META[severity];
                  const severityTheme = SEVERITY_THEME[severity] || { border: "var(--info-surface)", background: "var(--danger-surface)" };

                  // Calculate totals for this severity
                  const selectedIds = severitySelections[severity] || [];
                  const selectedSet = new Set(selectedIds);

                  let selectedTotal = 0;
                  let authorisedTotal = 0;
                  let declinedTotal = 0;

                  items.forEach((item) => {
                    const entry = getEntryForItem(item.id);
                    const decisionKey = resolveVhcRowDecisionKey(item, entry);
                    const finalTotal = Number(item.total_gbp ?? item.total ?? 0);

                    if (selectedSet.has(item.id)) {
                      selectedTotal += finalTotal;
                    }
                    if (decisionKey === "authorized") {
                      authorisedTotal += finalTotal;
                    } else if (decisionKey === "declined") {
                      declinedTotal += finalTotal;
                    }
                  });

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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                          <div>
                            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: meta.accent }}>{meta.title}</h2>
                            {meta.description ? (
                              <p style={{ margin: "4px 0 0", color: "var(--info)" }}>{meta.description}</p>
                            ) : null}
                          </div>
                          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                            {selectedSet.size > 0 && (
                              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--info-dark)" }}>
                                Selected: £{selectedTotal.toFixed(2)}
                              </span>
                            )}
                            {authorisedTotal > 0 && (
                              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--success)" }}>
                                Authorised: £{authorisedTotal.toFixed(2)}
                              </span>
                            )}
                            {declinedTotal > 0 && (
                              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--danger)" }}>
                                Declined: £{declinedTotal.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {renderSeverityTable(severity, items)}
                    </div>
                  );
                })}

                {/* Authorised section - show if there are authorized items */}
                {quoteSeverityLists.authorized && quoteSeverityLists.authorized.length > 0 && (
                  <div
                    style={{
                      border: "2px solid var(--success)",
                      borderRadius: "18px",
                      padding: "18px",
                      background: "var(--surface)",
                      boxShadow: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                    }}
                  >
                    <div style={{ borderBottom: "1px solid var(--success)", paddingBottom: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--success)" }}>Authorised</h2>
                        </div>
                        {quoteTotals.authorized > 0 && (
                          <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--success)" }}>
                            {formatCurrency(quoteTotals.authorized)}
                          </div>
                        )}
                      </div>
                    </div>
                    {renderSeverityTable("authorized", quoteSeverityLists.authorized)}
                  </div>
                )}

                {/* Declined section - show if there are declined items */}
                {quoteSeverityLists.declined && quoteSeverityLists.declined.length > 0 && (
                  <div
                    style={{
                      border: "2px solid var(--danger)",
                      borderRadius: "18px",
                      padding: "18px",
                      background: "var(--surface)",
                      boxShadow: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                    }}
                  >
                    <div style={{ borderBottom: "1px solid var(--danger)", paddingBottom: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--danger)" }}>Declined</h2>
                        </div>
                        {quoteTotals.declined > 0 && (
                          <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--danger)" }}>
                            {formatCurrency(quoteTotals.declined)}
                          </div>
                        )}
                      </div>
                    </div>
                    {renderSeverityTable("declined", quoteSeverityLists.declined)}
                  </div>
                )}

                {greenItems.length > 0 && (
                  <div
                    style={{
                      border: "2px solid var(--success)",
                      borderRadius: "18px",
                      padding: "20px",
                      background: "var(--success-surface)",
                      boxShadow: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: "18px",
                    }}
                  >
                    <div>
                      <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--success)" }}>Green Checks</h2>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "12px",
                      }}
                    >
                      {greenItems.map((item) => {
                        const locationLabel = item.location
                          ? LOCATION_LABELS[item.location] || item.location.replace(/_/g, " ")
                          : null;
                        return (
                          <div
                            key={item.id}
                            style={{
                              borderRadius: "14px",
                              background: "var(--surface)",
                              border: "1px solid var(--surface-light)",
                              padding: "14px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "6px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                color: "var(--info)",
                              }}
                            >
                              {item.category?.label || item.sectionName}
                            </span>
                            <div style={{ fontWeight: 700, color: "var(--accent-purple)", fontSize: "14px" }}>
                              {item.label}
                            </div>
                            {item.notes ? (
                              <div style={{ fontSize: "12px", color: "var(--info-dark)" }}>{item.notes}</div>
                            ) : null}
                            {item.measurement ? (
                              <div style={{ fontSize: "12px", color: "var(--info)" }}>{item.measurement}</div>
                            ) : null}
                            {locationLabel ? (
                              <div style={{ fontSize: "12px", color: "var(--info)" }}>Location: {locationLabel}</div>
                            ) : null}
                            {item.spec?.length > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px", color: "var(--info)" }}>
                                {item.spec.map((line) => (
                                  <span key={`${item.id}-spec-${line}`}>{line}</span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

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

                <div id="parts-identified">
                  {renderVhcItemsPanel()}
                </div>

                <div id="parts-authorized">
                  {renderVhcAuthorizedPanel()}
                </div>


                {renderFileGallery("Photos", photoFiles, "No customer-facing photos have been attached.", "photo")}

                {renderFileGallery("Videos", videoFiles, "No customer-facing videos have been attached.", "video")}
              </div>
            </div>
          </>
        )}
      </div>
      )}

      {activeSection === "wheelsTyres" && (
        <WheelsTyresDetailsModal
          isOpen
          inlineMode
          initialData={vhcData.wheelsTyres}
          onClose={(draft) => handleSectionDismiss("wheelsTyres", draft)}
          onComplete={(data) => handleSectionComplete("wheelsTyres", data)}
          locked={lockedSectionKeys.has("wheelsTyres")}
        />
      )}
      {activeSection === "brakesHubs" && (
        <BrakesHubsDetailsModal
          isOpen
          inlineMode
          initialData={vhcData.brakesHubs}
          onClose={(draft) => handleSectionDismiss("brakesHubs", draft)}
          onComplete={(data) => handleSectionComplete("brakesHubs", data)}
          locked={lockedSectionKeys.has("brakesHubs")}
        />
      )}
      {activeSection === "serviceIndicator" && (
        <ServiceIndicatorDetailsModal
          isOpen
          inlineMode
          initialData={vhcData.serviceIndicator}
          onClose={(draft) => handleSectionDismiss("serviceIndicator", draft)}
          onComplete={(data) => handleSectionComplete("serviceIndicator", data)}
          locked={lockedSectionKeys.has("serviceIndicator")}
        />
      )}
      {activeSection === "externalInspection" && (
        <ExternalDetailsModal
          isOpen
          inlineMode
          initialData={vhcData.externalInspection}
          onClose={(draft) => handleSectionDismiss("externalInspection", draft)}
          onComplete={(data) => handleSectionComplete("externalInspection", data)}
          locked={lockedSectionKeys.has("externalInspection")}
          summaryItems={summaryItems}
        />
      )}
      {activeSection === "internalElectrics" && (
        <InternalElectricsDetailsModal
          isOpen
          inlineMode
          initialData={vhcData.internalElectrics}
          onClose={(draft) => handleSectionDismiss("internalElectrics", draft)}
          onComplete={(data) => handleSectionComplete("internalElectrics", data)}
          locked={lockedSectionKeys.has("internalElectrics")}
          summaryItems={summaryItems}
        />
      )}
      {activeSection === "underside" && (
        <UndersideDetailsModal
          isOpen
          inlineMode
          initialData={vhcData.underside}
          onClose={(draft) => handleSectionDismiss("underside", draft)}
          onComplete={(data) => handleSectionComplete("underside", data)}
          locked={lockedSectionKeys.has("underside")}
          summaryItems={summaryItems}
        />
      )}

      <VHCModalShell
        isOpen={isAddPartsModalOpen}
        title={addPartsModalTitle}
        subtitle="Search the parts catalogue and add one or more items to this VHC row."
        width="960px"
        height="720px"
        onClose={closeAddPartsModal}
        hideCloseButton
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <span style={{ fontSize: "12px", color: "var(--info)" }}>{addPartsMessage}</span>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={closeAddPartsModal}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--accent-purple-surface)",
                  background: "var(--surface)",
                  color: "var(--info-dark)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddSelectedParts}
                disabled={addingParts || selectedParts.length === 0}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "1px solid var(--primary)",
                  background: addingParts || selectedParts.length === 0 ? "var(--surface-light)" : "var(--primary)",
                  color: addingParts || selectedParts.length === 0 ? "var(--info)" : "var(--surface)",
                  fontWeight: 700,
                  cursor: addingParts || selectedParts.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                {addingParts ? "Adding…" : "Add Parts"}
              </button>
            </div>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--info)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Search parts catalogue
            </label>
            <div style={{ display: "flex", gap: "10px", marginTop: "6px", flexWrap: "wrap" }}>
              <input
                type="text"
                value={addPartsSearch}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setAddPartsSearch(nextValue);
                  if (String(selectedSuggestionQuery || "").trim().toLowerCase() !== nextValue.trim().toLowerCase()) {
                    setSelectedSuggestionQuery("");
                  }
                }}
                placeholder="Search by part number or description"
                style={{
                  flex: 1,
                  minWidth: "220px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--accent-purple-surface)",
                  background: "var(--surface)",
                  fontSize: "14px",
                  color: "var(--text-primary)",
                }}
              />
              <button
                type="button"
                onClick={handleOpenNewPart}
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--primary)",
                  background: "var(--surface)",
                  color: "var(--primary)",
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {showNewPartForm ? "Close new part" : "Add new part"}
              </button>
              <button
                type="button"
                onClick={runPartsSuggestions}
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--accent-purple-surface)",
                  background: "var(--surface)",
                  color: "var(--info-dark)",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
                title="Refresh search suggestions"
              >
                ↻
              </button>
            </div>
            {partsSearchSuggestions.length > 0 && (
              <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Search suggestions
                </span>
                {partsSearchSuggestions.map((suggestion) => (
                  <button
                    key={`parts-search-suggestion-${suggestion.id}-${suggestion.query}`}
                    type="button"
                    onClick={() => {
                      const query = String(suggestion.query || "").trim();
                      if (!query) return;
                      setAddPartsSearch(query);
                      setSelectedSuggestionQuery(query);
                      savePartsSearchLearning({
                        finalQuery: query,
                        selectedSuggestion: query,
                      });
                    }}
                    style={{
                      border: "1px solid var(--accent-purple-surface)",
                      borderRadius: "999px",
                      padding: "6px 10px",
                      background: "var(--surface)",
                      color: "var(--info-dark)",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {suggestion.query}
                  </button>
                ))}
              </div>
            )}
            {partsSearchSuggestionsLoading && (
              <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--info)" }}>
                Loading suggestions…
              </div>
            )}
            {partsLearningSavedAt && Date.now() - partsLearningSavedAt < 2500 && (
              <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--success)", fontWeight: 600 }}>
                Saved
              </div>
            )}
            {addPartsLoading && (
              <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--info)" }}>
                Searching…
              </div>
            )}
            {addPartsError && !addPartsLoading && (
              <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--danger)" }}>
                {addPartsError}
              </div>
            )}
          </div>

          {showNewPartForm && (
            <div style={{ border: "1px solid var(--accent-purple-surface)", borderRadius: "12px", padding: "16px", background: "var(--surface)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h2 style={{ margin: 0, fontSize: "16px", color: "var(--text-primary)" }}>Add part</h2>
              </div>
              {newPartError && (
                <div
                  style={{
                    border: "1px solid var(--danger)",
                    borderRadius: "12px",
                    padding: "10px 14px",
                    color: "var(--danger)",
                    background: "var(--danger-surface, rgba(239, 68, 68, 0.08))",
                    marginBottom: "12px",
                  }}
                >
                  {newPartError}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--info)", marginBottom: "6px" }}>Part number</label>
                  <input
                    type="text"
                    value={newPartForm.partNumber}
                    onChange={(event) => handleNewPartFieldChange("partNumber", event.target.value)}
                    placeholder="e.g., FPAD1"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid var(--accent-purple-surface)",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--info)", marginBottom: "6px" }}>Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={newPartForm.quantity}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      handleNewPartFieldChange("quantity", nextValue === "" ? "" : Number(nextValue));
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid var(--accent-purple-surface)",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--info)", marginBottom: "6px" }}>Bin location</label>
                  <input
                    type="text"
                    value={newPartForm.binLocation}
                    onChange={(event) => handleNewPartFieldChange("binLocation", event.target.value)}
                    placeholder="A1"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid var(--accent-purple-surface)",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--info)", marginBottom: "6px" }}>Discount code</label>
                  <input
                    type="text"
                    value={newPartForm.discountCode}
                    onChange={(event) => handleNewPartFieldChange("discountCode", event.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid var(--accent-purple-surface)",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--info)", marginBottom: "6px" }}>Description</label>
                  <textarea
                    value={newPartForm.description}
                    onChange={(event) => handleNewPartFieldChange("description", event.target.value)}
                    rows={2}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid var(--accent-purple-surface)",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      resize: "vertical",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--info)", marginBottom: "6px" }}>Retail price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newPartForm.retailPrice}
                    onChange={(event) => handleNewPartFieldChange("retailPrice", event.target.value)}
                    placeholder="0.00"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid var(--accent-purple-surface)",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--info)", marginBottom: "6px" }}>Cost price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newPartForm.costPrice}
                    onChange={(event) => handleNewPartFieldChange("costPrice", event.target.value)}
                    placeholder="0.00"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid var(--accent-purple-surface)",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setNewPartForm(createDefaultNewPartForm())}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "8px",
                    border: "1px solid var(--accent-purple-surface)",
                    background: "var(--surface)",
                    color: "var(--info-dark)",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  disabled={newPartSaving}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewPart}
                  disabled={newPartSaving}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "8px",
                    border: "1px solid var(--primary)",
                    background: newPartSaving ? "var(--surface-light)" : "var(--primary)",
                    color: newPartSaving ? "var(--info)" : "var(--surface)",
                    fontWeight: 700,
                    cursor: newPartSaving ? "not-allowed" : "pointer",
                  }}
                >
                  {newPartSaving ? "Adding…" : "Add part"}
                </button>
              </div>
            </div>
          )}

          <div style={{ border: "1px solid var(--accent-purple-surface)", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", background: "var(--info-surface)", fontSize: "12px", fontWeight: 600, color: "var(--info-dark)" }}>
              Search results
            </div>
            {addPartsResults.length === 0 ? (
              <div style={{ padding: "14px 12px", fontSize: "12px", color: "var(--info)" }}>
                {addPartsLoading ? "Loading results…" : "No parts to show yet."}
              </div>
            ) : (
              <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-light)", color: "var(--info)" }}>
                      <th style={{ textAlign: "left", padding: "8px 12px" }}>Part</th>
                      <th style={{ textAlign: "left", padding: "8px 12px" }}>Number</th>
                      <th style={{ textAlign: "left", padding: "8px 12px" }}>Location</th>
                      <th style={{ textAlign: "right", padding: "8px 12px" }}>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {addPartsResults.map((part) => (
                      <tr
                        key={part.id}
                        onClick={() => handleSelectSearchPart(part)}
                        style={{
                          cursor: "pointer",
                          borderBottom: "1px solid var(--info-surface)",
                        }}
                        onMouseEnter={(event) => {
                          event.currentTarget.style.background = "var(--accent-purple-surface)";
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.background = "transparent";
                        }}
                      >
                        <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--accent-purple)" }}>
                          {part.name || "Part"}
                        </td>
                        <td style={{ padding: "8px 12px", color: "var(--info-dark)" }}>
                          {part.part_number || "—"}
                        </td>
                        <td style={{ padding: "8px 12px", color: "var(--info-dark)" }}>
                          {part.storage_location || "—"}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--info)" }}>
                          {part.qty_in_stock ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ border: "1px solid var(--accent-purple-surface)", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", background: "var(--info-surface)", fontSize: "12px", fontWeight: 600, color: "var(--info-dark)" }}>
              Selected parts
            </div>
            {existingPartsForModal.length > 0 && (
              <div style={{ padding: "12px" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)", marginBottom: "8px" }}>
                  Already added to this VHC item
                </div>
                <div style={{ border: "1px solid var(--accent-purple-surface)", borderRadius: "10px", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "var(--surface-light)", color: "var(--info)" }}>
                        <th style={{ textAlign: "left", padding: "8px 12px" }}>Part</th>
                        <th style={{ textAlign: "left", padding: "8px 12px" }}>Description</th>
                        <th style={{ textAlign: "right", padding: "8px 12px" }}>Cost</th>
                        <th style={{ textAlign: "left", padding: "8px 12px" }}>Location</th>
                        <th style={{ textAlign: "center", padding: "8px 12px" }}>Warranty</th>
                        <th style={{ textAlign: "center", padding: "8px 12px" }}>Back Order</th>
                        <th style={{ textAlign: "center", padding: "8px 12px" }}>Surcharge</th>
                        <th style={{ textAlign: "center", padding: "8px 12px" }}>Remove</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existingPartsForModal.map((part) => {
                        const partKey = `${addPartsTarget?.vhcId}-${part.id}`;
                        const details = partDetails[partKey] || {};
                        return (
                          <tr key={`existing-${part.id}`} style={{ borderBottom: "1px solid var(--info-surface)" }}>
                            <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--accent-purple)" }}>
                              {part.part?.name || "Part"}
                            </td>
                            <td style={{ padding: "8px 12px", color: "var(--info-dark)" }}>
                              {part.part?.description || "—"}
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--info-dark)" }}>
                              £{Number(part.unit_price || part.part?.unit_price || 0).toFixed(2)}
                            </td>
                            <td style={{ padding: "8px 12px", color: "var(--info-dark)" }}>
                              {part.storage_location || part.part?.storage_location || "—"}
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={details.warranty || false}
                                onChange={(event) => handlePartDetailChange(partKey, "warranty", event.target.checked, part.id)}
                              />
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={details.backOrder || false}
                                onChange={(event) => handlePartDetailChange(partKey, "backOrder", event.target.checked, part.id)}
                              />
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={details.surcharge || false}
                                onChange={(event) => handlePartDetailChange(partKey, "surcharge", event.target.checked, part.id)}
                              />
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => handleRemovePart(part, addPartsTarget?.vhcId)}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid var(--danger)",
                                  background: "var(--danger-surface)",
                                  color: "var(--danger)",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {selectedParts.length === 0 ? (
              <div style={{ padding: "14px 12px", fontSize: "12px", color: "var(--info)" }}>
                No parts selected yet.
              </div>
            ) : (
              <div style={{ maxHeight: "240px", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-light)", color: "var(--info)" }}>
                      <th style={{ textAlign: "left", padding: "8px 12px" }}>Part</th>
                      <th style={{ textAlign: "left", padding: "8px 12px" }}>Description</th>
                      <th style={{ textAlign: "right", padding: "8px 12px" }}>Cost</th>
                      <th style={{ textAlign: "left", padding: "8px 12px" }}>Location</th>
                      <th style={{ textAlign: "center", padding: "8px 12px" }}>Warranty</th>
                      <th style={{ textAlign: "center", padding: "8px 12px" }}>Back Order</th>
                      <th style={{ textAlign: "center", padding: "8px 12px" }}>Surcharge</th>
                      <th style={{ textAlign: "center", padding: "8px 12px" }}>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedParts.map((entry) => (
                      <tr key={entry.part?.id} style={{ borderBottom: "1px solid var(--info-surface)" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--accent-purple)" }}>
                          {entry.part?.name || "Part"}
                        </td>
                        <td style={{ padding: "8px 12px", color: "var(--info-dark)" }}>
                          {entry.part?.description || "—"}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--info-dark)" }}>
                          £{Number(entry.part?.unit_price || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: "8px 12px", color: "var(--info-dark)" }}>
                          {entry.part?.storage_location || "—"}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={entry.warranty}
                            onChange={(event) => handleSelectedPartChange(entry.part?.id, "warranty", event.target.checked)}
                          />
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={entry.backOrder}
                            onChange={(event) => handleSelectedPartChange(entry.part?.id, "backOrder", event.target.checked)}
                          />
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={entry.surcharge}
                            onChange={(event) => handleSelectedPartChange(entry.part?.id, "surcharge", event.target.checked)}
                          />
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveSelectedPart(entry.part?.id)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "6px",
                              border: "1px solid var(--danger)",
                              background: "var(--danger-surface)",
                              color: "var(--danger)",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </VHCModalShell>

      {labourCostModal.open && (
        <div
          className="popup-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeLabourCostModal();
            }
          }}
        >
          <div
            className="popup-card"
            style={{
              borderRadius: "32px",
              width: "100%",
              maxWidth: "560px",
              border: "1px solid var(--surface-light)",
              maxHeight: "88vh",
              overflowY: "auto",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ padding: "32px" }}>
              <h4
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "14px",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--primary)",
                }}
              >
                Labour Cost
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#666",
                    }}
                  >
                    Labour Net Cost (GBP)
                  </label>
                  <input
                    type="text"
                    value={labourCostModal.costInput}
                    onChange={(event) => setLabourCostModal((prev) => ({ ...prev, costInput: event.target.value }))}
                    placeholder="150.00"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border: "2px solid var(--surface-light)",
                      backgroundColor: "var(--surface-light)",
                      fontSize: "15px",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={(event) => {
                      event.target.style.borderColor = "var(--primary)";
                    }}
                    onBlur={(event) => {
                      event.target.style.borderColor = "var(--surface-light)";
                    }}
                  />
                </div>

                {(() => {
                  const parsed = parseCurrencyValue(labourCostModal.costInput);
                  const net = parsed === null ? LABOUR_COST_DEFAULT_GBP : parsed;
                  const vat = net * LABOUR_VAT_RATE;
                  const gross = net + vat;
                  return (
                    <div
                      style={{
                        borderRadius: "12px",
                        border: "2px solid var(--surface-light)",
                        background: "var(--surface-light)",
                        padding: "12px 14px",
                        display: "grid",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--info-dark)" }}>
                        <span>Net</span>
                        <strong>£{net.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--info-dark)" }}>
                        <span>VAT (20%)</span>
                        <strong>£{vat.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", color: "var(--primary)", fontWeight: 700 }}>
                        <span>Total inc VAT</span>
                        <span>£{gross.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
                  <button
                    type="button"
                    onClick={closeLabourCostModal}
                    style={{
                      padding: "10px 18px",
                      borderRadius: "10px",
                      border: "1px solid var(--surface-light)",
                      background: "var(--surface)",
                      color: "var(--info-dark)",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveLabourCostModal}
                    style={{
                      padding: "10px 18px",
                      borderRadius: "10px",
                      border: "2px solid var(--primary)",
                      background: "var(--primary)",
                      color: "white",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

        .labour-hours-input {
          -moz-appearance: textfield;
          appearance: textfield;
        }

        .labour-hours-input::-webkit-outer-spin-button,
        .labour-hours-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
