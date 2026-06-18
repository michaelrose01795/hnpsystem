// file location: src/components/VHC/VhcDetailsPanel.js
"use client";

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/database/supabaseClient";
import { summariseTechnicianVhc } from "@/lib/vhc/summary";
import { buildVhcQuoteLinesModel } from "@/lib/vhc/quoteLines";
import { saveChecksheet } from "@/lib/database/jobs";
import { logJobActivityClient } from "@/lib/jobs/logActivityClient";
// Phase 4 of the VHC refactor: VHC-table reads inside the fallback loader are
// owned by the DB helper module per CLAUDE.md §5.
import { loadVhcFallbackBundle } from "@/lib/database/vhc";
import { classifyVhcMedia, groupVhcMedia } from "@/lib/vhc/buildVhcMediaLibrary";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
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
import VhcCustomerDescriptionModal from "@/components/VHC/VhcCustomerDescriptionModal";
import PopupModal from "@/components/popups/popupStyleApi";
import { getVehicleRegistration, pickMileageValue } from "@/lib/canonical/fields";
// VHC status helpers are owned by the canonical engine. summaryStatus.js was
// deleted in Phase 6 — these helpers now live inline inside the engine.
import {
  buildVhcRowStatusView,
  normaliseDecisionStatus,
  resolveSeverityKey,
  // Single source of truth for the Parts Authorised button label — keeps the
  // VHC tab aligned with the Parts Added / Parts On Order panel datasets.
  getPartAuthorisedDisplayStatus,
  AUTHORISED_PART_STATUS,
} from "@/features/vhc/vhcStatusEngine";
import { getSlotCode, makeLineKey, resolveLineType } from "@/lib/vhc/slotIdentity";
import { uploadVhcMediaFile, setMainVhcVideo, updateVhcMediaRecord } from "@/lib/vhc/uploadMediaClient";
import { collectSectionConcerns } from "@/components/VHC/mediaCapture/collectSectionConcerns";
import {
  EmptyStateMessage,
  SeverityBadge,
  VhcItemCell,
  extractVhcItemData,
  FinancialTotalsGrid,
  StockStatusBadge,
  PartRowCells,
} from "@/components/VHC/VhcSharedComponents";
import { isValidUuid } from "@/features/labourTimes/normalization";
import { buildStableDisplayId, formatMeasurement, resolveLocationKey, normalizeText, hashString, LOCATION_TOKENS } from "@/lib/vhc/displayId";
import { collectLinkedPartRows, resolveLinkedPrePickLocation } from "@/lib/prePickLocations";

const LABOUR_SUGGEST_DEBUG = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEBUG_LABOUR_SUGGESTIONS === "1";

const STATUS_BADGES = {
  red: "var(--danger)",
  amber: "var(--warning)",
  green: "var(--info)",
  grey: "var(--info)",
};

const PART_META_PREFIX = "VHC_META:";
const JOB_ADDED_PART_STATUSES = new Set(["booked", "fitted"]);

const normalisePartStatus = (value = "") =>
  value.toString().toLowerCase();

const normalisePartNumber = (value = "") =>
  String(value || "").trim().toLowerCase();

const getPartNumber = (part = {}) =>
  part?.part?.part_number ||
  part?.part?.partNumber ||
  part?.part_number ||
  part?.partNumber ||
  part?.part_number_snapshot ||
  "";

const isPartAddedToJob = (part = {}) => {
  if (part?.added_to_job === true || part?.addedToJob === true) return true;
  return JOB_ADDED_PART_STATUSES.has(normalisePartStatus(part.status));
};

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
  { id: "parts", label: "Parts" },
  { id: "media", label: "Media" },
];

const PRE_PICK_LOCATION_OPTIONS_FULL = [
  { value: "", label: "Not assigned" },
  { value: "service_rack_1", label: "Service Rack 1" },
  { value: "service_rack_2", label: "Service Rack 2" },
  { value: "service_rack_3", label: "Service Rack 3" },
  { value: "service_rack_4", label: "Service Rack 4" },
  { value: "sales_rack_1", label: "Sales Rack 1" },
  { value: "sales_rack_2", label: "Sales Rack 2" },
  { value: "sales_rack_3", label: "Sales Rack 3" },
  { value: "sales_rack_4", label: "Sales Rack 4" },
  { value: "tyre_shed", label: "Tyre Shed" },
  { value: "stairs_pre_pick", label: "Stairs Pre-Pick" },
  { value: "no_pick", label: "No Pick" },
  { value: "on_order", label: "On Order" },
];

const formatPrePickLocationLabel = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "Not assigned";
  return PRE_PICK_LOCATION_OPTIONS_FULL.find((option) => option.value === normalized)?.label || normalized;
};

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
  const contextText = [label, detail, section, ...rows].join(" ").toLowerCase();
  const isTyreContext =
    /\b(tyre|tire|wheel)\b/.test(contextText) ||
    rows.some((row) => /^make\s*[-:]/i.test(row) || /^size\s*[-:]/i.test(row));

  const extractRowValue = (sourceRows, prefix) => {
    const row = sourceRows.find((entry) =>
      new RegExp(`^${prefix}\\s*[-:]\\s*`, "i").test(entry)
    );
    if (!row) return "";
    return row.replace(new RegExp(`^${prefix}\\s*[-:]\\s*`, "i"), "").trim();
  };

  const resolveTyreMakeSizeDetail = (sourceRows = [], sourceDetail = "") => {
    const makeFromRows = extractRowValue(sourceRows, "make");
    const sizeFromRows = extractRowValue(sourceRows, "size");
    const makeFromDetailMatch = sourceDetail.match(/(?:^|\b)make\s*[-:]\s*([^-|]+(?:\s+[^-|]+)*)/i);
    const sizeFromDetailMatch = sourceDetail.match(/(?:^|\b)size\s*[-:]\s*([^-|]+(?:\s+[^-|]+)*)/i);
    const makeValue = makeFromRows || (makeFromDetailMatch?.[1] || "").trim();
    const sizeValue = sizeFromRows || (sizeFromDetailMatch?.[1] || "").trim();
    return [makeValue, sizeValue].filter(Boolean).join(" ").trim();
  };

  if (isTyreContext) {
    const tyreTitle = resolveTyreMakeSizeDetail(rows, detail);
    if (tyreTitle) {
      return trimDisplayText(tyreTitle);
    }
  }

  const candidates = [detail, ...rows, label, section].filter(Boolean);
  const picked = candidates.find((candidate) => {
    if (!label) return true;
    const candidateLower = candidate.toLowerCase();
    const labelLower = label.toLowerCase();
    return !candidateLower.includes(labelLower) || candidate.length > label.length + 8;
  });

  return trimDisplayText(picked || label || section || "VHC Item");
};

const resolveTyreMakeSizeDetail = (rows = [], detail = "") => {
  const normalizedRows = Array.isArray(rows)
    ? rows.map((row) => normalizeInlineText(row)).filter(Boolean)
    : [];
  const extractRowValue = (prefix) => {
    const row = normalizedRows.find((entry) =>
      new RegExp(`^${prefix}\\s*[-:]\\s*`, "i").test(entry)
    );
    if (!row) return "";
    return row.replace(new RegExp(`^${prefix}\\s*[-:]\\s*`, "i"), "").trim();
  };
  const normalizedDetail = normalizeInlineText(detail);
  const makeFromRows = extractRowValue("make");
  const sizeFromRows = extractRowValue("size");
  const makeFromDetailMatch = normalizedDetail.match(/(?:^|\b)make\s*[-:]\s*([^-|]+(?:\s+[^-|]+)*)/i);
  const sizeFromDetailMatch = normalizedDetail.match(/(?:^|\b)size\s*[-:]\s*([^-|]+(?:\s+[^-|]+)*)/i);
  const makeValue = makeFromRows || (makeFromDetailMatch?.[1] || "").trim();
  const sizeValue = sizeFromRows || (sizeFromDetailMatch?.[1] || "").trim();
  return [makeValue, sizeValue].filter(Boolean).join(" ").trim();
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
const LABOUR_VAT_RATE = 0.2;
const LABOUR_RATE_GROSS_DEFAULT_GBP = 150;
const LABOUR_RATE = LABOUR_RATE_GROSS_DEFAULT_GBP / (1 + LABOUR_VAT_RATE);
const QUOTE_LABOUR_RATE = 85;
const LABOUR_COST_DEFAULT_GBP = LABOUR_RATE;
const SEVERITY_META = {
  red: { title: "Red Repairs", description: "", accent: "var(--danger-dark)" },
  amber: { title: "Amber Repairs", description: "", accent: "var(--warning-dark)" },
};

const COLOUR_CLASS = {
  red: "var(--danger-surface)",
  amber: "var(--warning-surface)",
  green: "var(--success-surface)",
  grey: "var(--theme)",
};

const SEVERITY_THEME = {
  red: { background: "var(--danger-surface)", border: "none", text: "var(--danger-dark)", hover: "var(--danger-surface-hover)" },
  amber: { background: "var(--warning-surface)", border: "none", text: "var(--warning-dark)", hover: "var(--warning-surface-hover)" },
  green: { background: "var(--success-surface)", border: "none", text: "var(--info-dark)", hover: "var(--success-surface-hover)" },
  grey: { background: "var(--theme)", border: "none", text: "var(--info-dark)", hover: "var(--theme)" },
  authorized: { background: "var(--authorised-surface)", border: "none", text: "var(--authorised)", hover: "var(--authorised-surface-hover)" },
  completed: { background: "var(--complete-surface)", border: "none", text: "var(--complete)", hover: "var(--complete-surface-hover)" },
  declined: { background: "var(--danger-surface)", border: "none", text: "var(--danger-dark)", hover: "var(--danger-surface-hover)" },
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
  borderRadius: "var(--radius-lg)",
  border: "none",

  padding: "24px",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
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
  const loadPart = tyre.load ? ` ${tyre.load}` : "";
  const speedPart = tyre.speed ? ` ${tyre.speed}` : "";
  const fullSize = tyre.size ? `${tyre.size}${loadPart}${speedPart}`.trim() : "";
  const makeAndSize = [tyre.manufacturer, fullSize].filter(Boolean).join(" ").trim();
  if (makeAndSize) specs.push(`Make: ${makeAndSize}`);
  else if (tyre.manufacturer) specs.push(`Make: ${tyre.manufacturer}`);
  else if (fullSize) specs.push(`Size: ${fullSize}`);
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
    background: (colour && SEVERITY_THEME[colour]?.background) || COLOUR_CLASS[colour] || "var(--theme)",
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

const HealthSectionCard = ({ config, section, rawData, onOpen, collapsed: collapsedProp, onToggle }) => {
  // Sections render minimised (header only, ~60px) by default. The header acts
  // as a dropdown toggle that expands the full detail in place — this is
  // separate from the "Open" button, which launches the section modal.
  // When `onToggle` is supplied the collapse state is controlled by the parent
  // (used to link paired sections so opening one opens both); otherwise the
  // card manages its own state.
  const isControlled = typeof onToggle === "function";
  const [internalCollapsed, setInternalCollapsed] = useState(true);
  const collapsed = isControlled ? collapsedProp : internalCollapsed;
  const toggleCollapsed = () => {
    if (isControlled) onToggle();
    else setInternalCollapsed((prev) => !prev);
  };
  const rawItems = Array.isArray(section?.items) ? section.items : [];
  const items = config.key === "brakesHubs" ? buildBrakeHealthCardItems(rawItems, rawData) : rawItems;
  const hasItems = items.length > 0;
  const isBrakesHubsSection = config.key === "brakesHubs";

  return (
    <div
      data-dev-section="1"
      data-dev-section-key={`vhc-healthcheck-card-${config.key}`}
      data-dev-section-type="content-card"
      data-dev-section-parent="vhc-healthcheck-stack"
      style={{
        border: "none",
        borderRadius: "var(--radius-md)",
        background: "var(--theme)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div
        data-dev-section="1"
        data-dev-section-key={`vhc-healthcheck-card-${config.key}-header`}
        data-dev-section-type="toolbar"
        data-dev-section-parent={`vhc-healthcheck-card-${config.key}`}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={toggleCollapsed}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleCollapsed();
          }
        }}
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              flexShrink: 0,
              lineHeight: 1,
              fontSize: "13px",
              color: "var(--text-accent)",
              transition: "transform 0.15s ease",
              transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            }}
          >
            ▼
          </span>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-accent)" }}>
            {config.label}
          </h3>
        </div>
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (onOpen) onOpen(config.key);
            }}
            style={{
              padding: "8px 14px",
              borderRadius: "var(--input-radius)",
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

      {!collapsed && (hasItems ? (
        <div
          style={{
            display: isBrakesHubsSection ? "grid" : "flex",
            flexDirection: isBrakesHubsSection ? undefined : "column",
            gridTemplateColumns: isBrakesHubsSection ? "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" : undefined,
            gap: "14px",
          }}
        >
          {items.map((item, idx) => {
            const rows = mapRows(item.rows);
            const displayRows = config.key === "wheelsTyres" ? groupWheelSpecRows(rows) : rows;
            const concerns = Array.isArray(item.concerns) ? item.concerns.filter(Boolean) : [];
            const itemSeverity = determineItemSeverity(item);
            const theme = itemSeverity ? SEVERITY_THEME[itemSeverity] : null;
            const isBrakeSummaryItem =
              isBrakesHubsSection && /(brake|drum|hub)/i.test(String(item.heading || item.label || ""));
            const wheelRowsSeverity =
              config.key === "wheelsTyres"
                ? (normaliseColour(item.status) || itemSeverity || "green")
                : null;
            const wheelRowsTint =
              wheelRowsSeverity === "red"
                ? {
                    blockBg: "var(--danger-surface)",
                    blockBorder: "none",
                    tileBorder: "none",
                  }
                : wheelRowsSeverity === "amber"
                  ? {
                      blockBg: "var(--warning-surface)",
                      blockBorder: "none",
                      tileBorder: "none",
                    }
                  : {
                      blockBg: "var(--success-surface)",
                      blockBorder: "none",
                      tileBorder: "none",
                    };
            const brakeRowsSeverity = isBrakeSummaryItem
              ? (normaliseColour(item.status) || itemSeverity || "green")
              : null;
            const brakeRowsTint =
              brakeRowsSeverity === "red"
                ? {
                    blockBg: "var(--danger-surface)",
                    blockBorder: "none",
                    tileBorder: "none",
                  }
                : brakeRowsSeverity === "amber"
                  ? {
                      blockBg: "var(--warning-surface)",
                      blockBorder: "none",
                      tileBorder: "none",
                    }
                  : {
                      blockBg: "var(--success-surface)",
                      blockBorder: "none",
                      tileBorder: "none",
                    };
            const itemSectionKey = `vhc-healthcheck-card-${config.key}-item-${idx}`;
            return (
              <div
                key={`${config.key}-${idx}-${item.heading || item.label || "item"}`}
                data-dev-section="1"
                data-dev-section-key={itemSectionKey}
                data-dev-section-type="content-card"
                data-dev-section-parent={`vhc-healthcheck-card-${config.key}`}
                style={{
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  background: theme?.background || "var(--theme)",
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
                    <strong style={{ color: "var(--text-accent)", fontSize: "15px" }}>
                      {item.heading || item.label || `Item ${idx + 1}`}
                    </strong>
                    {item.notes ? (
                      <p style={{ margin: "6px 0 0", color: "var(--text-1)", fontSize: "13px" }}>{item.notes}</p>
                    ) : null}
                  </div>
                  {item.status ? (
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "var(--radius-pill)",
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
                      borderRadius: "var(--radius-sm)",
                      background:
                        config.key === "wheelsTyres"
                          ? wheelRowsTint.blockBg
                          : isBrakeSummaryItem
                            ? brakeRowsTint.blockBg
                            : "var(--surface)",
                      padding: "12px",
                      display: "grid",
                      gridTemplateColumns:
                        isBrakesHubsSection
                          ? "1fr"
                          : "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: "10px",
                    }}
                  >
                    {displayRows.map((row, rowIdx) => {
                      if (row && typeof row === "object" && row.type === "wheel_spec_group") {
                        return (
                          <div
                            key={`${config.key}-${idx}-row-group-${rowIdx}`}
                            data-dev-section="1"
                            data-dev-section-key={`${itemSectionKey}-tile-${rowIdx}`}
                            data-dev-section-type="stat-card"
                            data-dev-section-parent={itemSectionKey}
                            style={{
                              borderRadius: "var(--input-radius)",
                              background: "var(--surface)",
                              border: "none",
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
                                <span key={`${config.key}-${idx}-row-group-${rowIdx}-line-${lineIdx}`} style={{ fontSize: "13px", color: "var(--text-1)", fontWeight: 600, lineHeight: 1.45 }}>
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
                          data-dev-section="1"
                          data-dev-section-key={`${itemSectionKey}-tile-${rowIdx}`}
                          data-dev-section-type="stat-card"
                          data-dev-section-parent={itemSectionKey}
                          style={{
                            borderRadius: "var(--input-radius)",
                            background: "var(--surface)",
                            border: "none",
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
                          <span style={{ fontSize: "13px", color: "var(--text-1)", fontWeight: 600, lineHeight: 1.45 }}>
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
                      borderRadius: "var(--radius-sm)",
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
                          color: "var(--text-1)",
                          background: SEVERITY_THEME[normaliseColour(concern.status)]?.background || "var(--surface)",
                          borderRadius: "var(--input-radius)",
                          padding: "8px 10px",
                        }}
                      >
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "var(--radius-xs)",
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
            borderRadius: "var(--radius-sm)",
            padding: "16px",
            background: "var(--theme)",
            color: "var(--text-1)",
            fontSize: "13px",
          }}
        >
          No technician entries have been captured for this section yet.
        </div>
      ))}
    </div>
  );
};

// Renders a pair of health sections that share a single collapse state, so
// opening (or closing) one section also opens (or closes) its partner. The two
// sit in a 50/50 row that drops to one column on mobile. There is no wrapping
// card — the sections live directly in the health-check stack.
const HealthSectionPair = ({ sections, onOpen }) => {
  const [collapsed, setCollapsed] = useState(true);
  const toggleCollapsed = () => setCollapsed((prev) => !prev);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: "18px",
        alignItems: "start",
      }}
    >
      {sections.map(({ config, data, rawData }) => (
        <HealthSectionCard
          key={config.key}
          config={config}
          section={data}
          rawData={rawData}
          onOpen={onOpen}
          collapsed={collapsed}
          onToggle={toggleCollapsed}
        />
      ))}
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
  onUpdateRequestPrePickLocation = async () => {},
  viewMode = "full",
  enableTabs = false,
  devOverlayAutoOutline = false,
  devOverlayPageContext = "",
  devOverlayTabContext = "",
  devOverlayCardContext = "",
}) {
  const isCustomerView = viewMode === "customer";
  const router = useRouter();
  const { authUserId, dbUserId, user: currentUser } = useUser() || {};
  const { confirm } = useConfirmation();
  const resolvedJobNumber = jobNumber || router.query?.jobNumber;

  const [job, setJob] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [vhcData, setVhcData] = useState(baseVhcPayload());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Bumped after a Photos-tab upload so the panel re-fetches job_files
  // (the main loader keys off this token alongside the job number).
  const [photosReloadToken, setPhotosReloadToken] = useState(0);
  // Top-level Photos-tab upload state (hidden file input lives in the tab).
  const photoUploadInputRef = useRef(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState("");
  // file_id currently being promoted/demoted as the main customer video.
  const [mainVideoSavingId, setMainVideoSavingId] = useState(null);
  const [photoPreviewFile, setPhotoPreviewFile] = useState(null);
  const [photoPreviewMessage, setPhotoPreviewMessage] = useState("");
  // Photo Preview popup controls: visibility-toggle + linked-item relink state.
  const [mediaVisibilitySaving, setMediaVisibilitySaving] = useState(false);
  const [mediaLinkSaving, setMediaLinkSaving] = useState(false);
  const [creatingMediaLocation, setCreatingMediaLocation] = useState(false);
  const [newMediaLocationName, setNewMediaLocationName] = useState("");
  const [activeTab, setActiveTab] = useState("summary");
  const activeTabLabel = TAB_OPTIONS.find((tab) => tab.id === activeTab)?.label || "";
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
  // Customer description override modal — opened when user clicks the
  // description text on a Summary tab row to edit what the customer sees.
  const [customerDescriptionEditTarget, setCustomerDescriptionEditTarget] = useState(null);
  // Track the item currently being edited in the Total column and its raw edit value,
  // so the input shows whatever the user is typing (including empty string) without
  // immediately snapping back to the computed Parts+Labour total mid-edit.
  const [totalEditItemId, setTotalEditItemId] = useState(null);
  const [totalEditValue, setTotalEditValue] = useState("");
  const [vhcChecksData, setVhcChecksData] = useState([]);
  const [authorizedViewRows, setAuthorizedViewRows] = useState([]);
  const [authorizedViewLoaded, setAuthorizedViewLoaded] = useState(false);
  const [isAddPartsModalOpen, setIsAddPartsModalOpen] = useState(false);

  // Parts tab — search box.
  const [partsIdentifiedSearch, setPartsIdentifiedSearch] = useState("");


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
    hoursInput: "",
  });
  const labourOverrideDebounceRef = useRef({});
  const labourHoursPersistDebounceRef = useRef({});
  const labourSuggestionRequestRef = useRef({});
  const labourEditSessionRef = useRef({});
  const partsLearningDebounceRef = useRef(null);
  const vhcPartsStatusSyncRef = useRef(new Set());
  const vhcPartsCostSyncRef = useRef(new Set());
  // Track item IDs where totalOverride has been touched by the user so the
  // DB-init effect never overwrites an in-progress edit or an explicit clear.
  const totalOverrideTouchedRef = useRef(new Set());
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

  const handleSectionMediaUploaded = useCallback(
    (uploadedFile, concern = null) => {
      if (uploadedFile) {
        const concernLink =
          uploadedFile.vhc_concern_link ||
          (concern
            ? {
                section: concern.section,
                category: concern.category || null,
                categoryLabel: concern.categoryLabel || null,
                concernId: concern.concernId,
                index: concern.index,
                label: concern.label,
                status: concern.status,
              }
            : null);
        const enrichedFile = {
          ...uploadedFile,
          ...(concernLink ? { vhc_concern_link: concernLink } : {}),
        };

        setJob((prev) => {
          if (!prev) return prev;
          const currentFiles = Array.isArray(prev.job_files) ? prev.job_files : [];
          const nextFiles = currentFiles.some((file) => String(file?.file_id) === String(enrichedFile.file_id))
            ? currentFiles.map((file) => (String(file?.file_id) === String(enrichedFile.file_id) ? { ...file, ...enrichedFile } : file))
            : [enrichedFile, ...currentFiles];
          return { ...prev, job_files: nextFiles };
        });
      }

      setPhotosReloadToken((token) => token + 1);
      refreshJobData(uploadedFile, concern);
    },
    [refreshJobData]
  );

  const applyLinkedPrePickLocation = useCallback(
    ({ requestId = null, vhcItemId = null }, nextPrePickLocation) => {
      const normalizedRequestId =
        requestId === null || requestId === undefined || requestId === ""
          ? null
          : String(requestId);
      const normalizedVhcItemId =
        vhcItemId === null || vhcItemId === undefined || vhcItemId === ""
          ? null
          : String(vhcItemId);

      const matchesLinkedRow = (row = {}) => {
        const rowRequestId = row?.request_id ?? row?.requestId ?? null;
        const rowVhcId = row?.vhc_id ?? row?.vhcItemId ?? row?.vhc_item_id ?? null;
        if (normalizedRequestId && String(rowRequestId) === normalizedRequestId) return true;
        if (normalizedVhcItemId && String(rowVhcId) === normalizedVhcItemId) return true;
        return false;
      };

      setAuthorizedViewRows((prev) =>
        (Array.isArray(prev) ? prev : []).map((row) => {
          if (!matchesLinkedRow(row)) return row;
          return {
            ...row,
            request_id: row?.request_id ?? row?.requestId ?? requestId ?? null,
            requestId: row?.requestId ?? row?.request_id ?? requestId ?? null,
            vhc_id: row?.vhc_id ?? row?.vhcItemId ?? row?.vhc_item_id ?? vhcItemId ?? null,
            vhcItemId: row?.vhcItemId ?? row?.vhc_id ?? row?.vhc_item_id ?? vhcItemId ?? null,
            pre_pick_location: nextPrePickLocation,
            prePickLocation: nextPrePickLocation,
          };
        })
      );

      setVhcChecksData((prev) =>
        (Array.isArray(prev) ? prev : []).map((row) => {
          if (!matchesLinkedRow(row)) return row;
          return {
            ...row,
            request_id: row?.request_id ?? row?.requestId ?? requestId ?? null,
            requestId: row?.requestId ?? row?.request_id ?? requestId ?? null,
            pre_pick_location: nextPrePickLocation,
            prePickLocation: nextPrePickLocation,
          };
        })
      );

      setJob((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          vhc_checks: Array.isArray(prev.vhc_checks)
            ? prev.vhc_checks.map((row) => {
                if (!matchesLinkedRow(row)) return row;
                return {
                  ...row,
                  request_id: row?.request_id ?? row?.requestId ?? requestId ?? null,
                  requestId: row?.requestId ?? row?.request_id ?? requestId ?? null,
                  pre_pick_location: nextPrePickLocation,
                  prePickLocation: nextPrePickLocation,
                };
              })
            : prev.vhc_checks,
          parts_job_items: Array.isArray(prev.parts_job_items)
            ? prev.parts_job_items.map((row) => {
                const rowVhcId = row?.vhc_item_id ?? row?.vhcItemId ?? null;
                if (!normalizedVhcItemId || String(rowVhcId) !== normalizedVhcItemId) return row;
                return {
                  ...row,
                  pre_pick_location: nextPrePickLocation,
                  prePickLocation: nextPrePickLocation,
                };
              })
            : prev.parts_job_items,
        };
      });
    },
    []
  );

  useEffect(() => {
    const rawTab = router.query?.vhcTab;
    if (!rawTab || typeof rawTab !== "string") return;
    // Back-compat: the old "Parts Identified" / "Parts Authorised" tabs were
    // merged into a single "Parts" tab, and the separate "Photos" / "Videos"
    // tabs were merged into a single "Video / Photo" media tab. Alias their
    // saved deep links across.
    const requestedTab =
      rawTab === "parts-identified" || rawTab === "parts-authorized"
        ? "parts"
        : rawTab === "photos" || rawTab === "videos"
          ? "media"
          : rawTab;
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
        // Job tracker logging — record every health-check save. Whether the
        // editor is the assigned tech or another role is captured in payload
        // so the tracker can highlight non-tech edits.
        try {
          const userRoles = (currentUser?.roles || []).map((r) => String(r).toUpperCase());
          const isTechRole = userRoles.some((r) => r.includes("TECH") || r.includes("MOT"));
          const isAssignedTech =
            job?.assigned_to && currentUser?.user_id && Number(job.assigned_to) === Number(currentUser.user_id);
          const editorIsTech = isAssignedTech || isTechRole;
          await logJobActivityClient({
            jobNumber: resolvedJobNumber,
            category: "health_check",
            action: editorIsTech ? "tech_saved_checksheet" : "non_tech_edited_checksheet",
            summary: editorIsTech
              ? "Technician saved health check changes"
              : `Health check edited by ${currentUser?.first_name || currentUser?.name || "non-tech user"}`,
            targetType: "vhc_checksheet",
            payload: {
              roles: userRoles,
              editorIsTech,
              assignedTo: job?.assigned_to || null,
            },
          });
        } catch {}
        return true;
      } catch (err) {
        console.error("Failed to save VHC sections", err);
        setSectionSaveStatus("error");
        setSectionSaveError(err.message || "Failed to save VHC data.");
        return false;
      }
    },
    [resolvedJobNumber, currentUser, job?.assigned_to]
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
            vhc_checks(vhc_id, section, issue_description, customer_description, issue_title, measurement, created_at, updated_at, approval_status, authorization_state, display_status, severity, approved_by, approved_at, labour_hours, parts_cost, total_override, labour_complete, parts_complete, display_id, Complete),
            parts_job_items(
              id,
              part_id,
              allocated_to_request_id,
              quantity_requested,
              quantity_allocated,
              quantity_fitted,
              status,
              origin,
              vhc_item_id,
              row_description,
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
              uploaded_by,
              visible_to_customer,
              vhc_concern_link,
              is_main_vhc_video
            )`
          )
          .eq("job_number", resolvedJobNumber)
          .maybeSingle();

        const [{ data: primaryJobRow, error: jobError }] = await Promise.all([
          jobPromise,
        ]);

        let jobRow = primaryJobRow;
        if (jobError) {
          console.warn("[VHC] Primary job query failed, retrying with fallback loader", jobError);
          const { data: fallbackBaseJob, error: fallbackBaseError } = await supabase
            .from("jobs")
            .select("*")
            .eq("job_number", resolvedJobNumber)
            .maybeSingle();

          if (fallbackBaseError) {
            throw fallbackBaseError;
          }

          if (fallbackBaseJob?.id) {
            // Phase 4 of the VHC refactor: parallel fetch is owned by the DB
            // helper. The shape returned matches the original inline code.
            const bundle = await loadVhcFallbackBundle(fallbackBaseJob.id);

            jobRow = {
              ...fallbackBaseJob,
              vhc_checks: bundle.vhcChecks,
              parts_job_items: bundle.partsJobItems,
              job_files: bundle.jobFiles,
            };
          }
        }
        if (!jobRow) {
          setError("Job not found for the supplied job number.");
          setJob(null);
          setBuilderData(null);
          setWorkflow(null);
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
        setWorkflow(null);

        // Store all VHC checks data for approval status lookup
        setVhcChecksData(vhc_checks || []);

        // Derive authorised view rows from vhc_checks (consolidated — no separate table needed)
        const authorizedRows = (vhc_checks || []).filter((check) => {
          const section = String(check?.section || "").trim();
          if (section === "VHC_CHECKSHEET" || section === "VHC Checksheet") return false;
          const decision =
            normaliseDecisionStatus(check?.authorization_state) ||
            normaliseDecisionStatus(check?.approval_status);
          return (
            decision === "authorized" ||
            decision === "completed" ||
            check?.Complete === true ||
            check?.complete === true
          );
        });
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
  }, [fetchJobPartsViaApi, resolvedJobNumber, photosReloadToken]);

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
              .order("approved_at", { ascending: false });
            const nextAuthorized = (Array.isArray(data) ? data : []).filter((check) => {
              const section = String(check?.section || "").trim();
              if (section === "VHC_CHECKSHEET" || section === "VHC Checksheet") return false;
              const decision =
                normaliseDecisionStatus(check?.authorization_state) ||
                normaliseDecisionStatus(check?.approval_status);
              return (
                decision === "authorized" ||
                decision === "completed" ||
                check?.Complete === true ||
                check?.complete === true
              );
            });
            setAuthorizedViewRows(nextAuthorized);
          } catch (e) {
            console.warn("[VHC] failed to refresh authorized items via realtime", e);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "parts_job_items",
          filter: `job_id=eq.${job.id}`,
        },
        async () => {
          try {
            const latestParts = await fetchJobPartsViaApi(job.id);
            if (!Array.isArray(latestParts)) return;
            setJob((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                parts_job_items: latestParts,
              };
            });
          } catch (e) {
            console.warn("[VHC] failed to refresh parts_job_items via realtime", e);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(checksChannel);
    };
  }, [job?.id, fetchJobPartsViaApi]);

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
  const partsIdentified = useMemo(
    () =>
      jobParts.filter((part) => {
        const linkedVhcId = part?.vhc_item_id ?? part?.vhcItemId ?? null;
        if (linkedVhcId !== null && linkedVhcId !== undefined && String(linkedVhcId).trim() !== "") {
          return true;
        }
        return normalisePartStatus(part.origin).includes("vhc");
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
          authorizationState: normaliseDecisionStatus(check.authorization_state) || null,
          displayStatus: check.display_status || null,
          approvedBy: check.approved_by,
          approvedAt: check.approved_at,
          labourHours: check.labour_hours,
          partsCost: check.parts_cost,
          totalOverride: check.total_override,
          labourComplete: check.labour_complete,
          partsComplete: check.parts_complete,
          complete: Boolean(check?.Complete ?? check?.complete),
        });
      }
    });
    return map;
  }, [vhcChecksData]);

  const partsAuthorized = useMemo(
    () => {
      return jobParts.filter((part) => {
        if (normalisePartStatus(part.status) === "removed") {
          return false;
        }
        // Any part linked to an authorised/completed VHC item should appear here,
        // even if it was added from the job card rather than the VHC modal.
        if (part.vhc_item_id) {
          const canonicalId = String(part.vhc_item_id);
          const approvalData = vhcApprovalLookup.get(canonicalId);
          if (approvalData) {
            const decision =
              normaliseDecisionStatus(approvalData.authorizationState) ||
              normaliseDecisionStatus(approvalData.approvalStatus);
            return decision === "authorized" || decision === "completed";
          }
        }

        // Legacy fallback for old data without vhc_item_id.
        const isVhc = normalisePartStatus(part.origin).includes("vhc");
        if (!isVhc) return false;
        return part.authorised === true;
      });
    },
    [jobParts, vhcApprovalLookup]
  );

  const partsOnOrder = useMemo(
    () => {
      return jobParts.filter((part) => {
        // Parts linked to an authorised/completed VHC row should remain visible
        // in on-order tracking regardless of whether they were added via VHC or job card.
        const partStatus = normalisePartStatus(part.status);
        const isOnOrderOrStock = partStatus === "on_order" || partStatus === "stock";

        if (!isOnOrderOrStock) return false;

        if (part.vhc_item_id) {
          const canonicalId = String(part.vhc_item_id);
          const approvalData = vhcApprovalLookup.get(canonicalId);
          const decision =
            normaliseDecisionStatus(approvalData?.authorizationState) ||
            normaliseDecisionStatus(approvalData?.approvalStatus);
          if (decision === "authorized" || decision === "completed") {
            return true;
          }
        }

        const isVhc = normalisePartStatus(part.origin).includes("vhc");
        if (!isVhc) return false;
        return part.authorised === true;
      });
    },
    [jobParts, vhcApprovalLookup]
  );

  const bookedPartNumbers = useMemo(() => {
    const numbers = new Set();
    jobParts.forEach((part) => {
      const partNumber = getPartNumber(part);
      if (!partNumber) return;
      if (isPartAddedToJob(part)) {
        numbers.add(normalisePartNumber(partNumber));
      }
    });
    return numbers;
  }, [jobParts]);

  const requiredPartNumbersByVhcItem = useMemo(() => {
    const map = new Map();
    jobParts.forEach((part) => {
      if (normalisePartStatus(part?.status) === "removed") return;
      const rawVhcId = part?.vhc_item_id ?? part?.vhcItemId ?? null;
      if (rawVhcId === null || rawVhcId === undefined || String(rawVhcId).trim() === "") return;
      const canonicalId = String(resolveCanonicalVhcId(rawVhcId));
      if (!canonicalId) return;
      const partNumber = normalisePartNumber(getPartNumber(part));
      if (!partNumber) return;
      if (!map.has(canonicalId)) map.set(canonicalId, new Set());
      map.get(canonicalId).add(partNumber);
    });
    return map;
  }, [jobParts, resolveCanonicalVhcId]);

  const getCompletionPartBlockReason = useCallback(
    (itemId) => {
      const canonicalId = String(resolveCanonicalVhcId(itemId) || "");
      const requiredNumbers = requiredPartNumbersByVhcItem.get(canonicalId);
      if (!requiredNumbers || requiredNumbers.size === 0) return "";
      const missingNumbers = Array.from(requiredNumbers).filter(
        (partNumber) => !bookedPartNumbers.has(partNumber)
      );
      if (missingNumbers.length === 0) return "";
      return `Add matching part number ${missingNumbers.join(", ")} to the Job section before completing this row.`;
    },
    [bookedPartNumbers, requiredPartNumbersByVhcItem, resolveCanonicalVhcId]
  );

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

  const resolveOriginalSeverityDisplay = useCallback(
    (itemId, fallbackItem = null) => {
      const canonicalId = String(resolveCanonicalVhcId(itemId) || "");
      const fallbackId = String(itemId || "");
      const check =
        vhcChecksData.find((row) => String(row?.vhc_id) === canonicalId) ||
        vhcChecksData.find((row) => String(row?.vhc_id) === fallbackId) ||
        null;

      const fromDb = normaliseColour(check?.severity || check?.display_status);
      if (fromDb) return fromDb;

      return (
        normaliseColour(fallbackItem?.rawSeverity) ||
        normaliseColour(fallbackItem?.severityKey) ||
        resolveSeverityKey(fallbackItem?.rawSeverity, fallbackItem?.displayStatus) ||
        null
      );
    },
    [resolveCanonicalVhcId, vhcChecksData]
  );

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
        // Avoid duplicating tread depth in Green Checks when it's already embedded in the label.
        item.measurement = wheelKey && treadLabel ? null : `Tread depths: ${treadSummary}`;
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

    // Tally tyre makes across every wheel position so we can flag any wheel
    // whose make is the odd one out — a make fitted to fewer wheels than the
    // most common make on the vehicle (e.g. 3 Michelin + 1 Pirelli → Pirelli).
    const normaliseTyreMake = (value) => String(value || "").trim().toLowerCase();
    const makeCounts = new Map();
    WHEEL_POSITION_KEYS.forEach((key) => {
      const make = normaliseTyreMake(tyres[key]?.manufacturer);
      if (!make) return;
      makeCounts.set(make, (makeCounts.get(make) || 0) + 1);
    });
    const maxMakeCount = makeCounts.size > 0 ? Math.max(...makeCounts.values()) : 0;

    WHEEL_POSITION_KEYS.forEach((key) => {
      const entry = tyres[key];
      if (!entry || typeof entry !== "object") return;
      const depthSummary = formatTreadDepthSummary(entry.tread);
      const status = normaliseColour(entry.status) || normaliseColour(entry.treadStatus);
      const spec = buildTyreSpecLines(entry);
      const tyreMake = entry.manufacturer ? String(entry.manufacturer).trim() : "";
      const normalisedMake = normaliseTyreMake(entry.manufacturer);
      // Odd make = at least two distinct makes exist and this wheel's make is
      // fitted to strictly fewer wheels than the most common make. A 2/2 split
      // or all-different set has no clear odd one, so nothing is flagged.
      const isOddMake =
        Boolean(normalisedMake) &&
        makeCounts.size > 1 &&
        (makeCounts.get(normalisedMake) || 0) < maxMakeCount;
      if (!depthSummary && spec.length === 0 && !status && !isOddMake) return;
      map.set(key.toUpperCase(), {
        id: `tyre-${key}`,
        label: `${key} Tyre`,
        measurement: depthSummary ? `Tread depths: ${depthSummary}` : null,
        status,
        hideLabel: true,
        spec,
        isOddMake,
        tyreMake,
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
    const lists = { red: [], amber: [], authorized: [], completed: [], declined: [] };
    const sections = { red: new Map(), amber: new Map(), authorized: new Map(), completed: new Map(), declined: new Map() };

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
        decisionKey === "completed"
          ? "completed"
          : decisionKey === "authorized"
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
    ["red", "amber", "authorized", "completed", "declined"].forEach((severity) => {
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

    // Sort authorized, completed and declined lists so red items are shown first then amber
    const severityRank = (s) => (s === "red" ? 0 : s === "amber" ? 1 : s === "green" ? 2 : 3);
    lists.authorized.sort((a, b) => severityRank(a.severityKey || a.rawSeverity) - severityRank(b.severityKey || b.rawSeverity));
    lists.completed.sort((a, b) => severityRank(a.severityKey || a.rawSeverity) - severityRank(b.severityKey || b.rawSeverity));
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
    // Decided items lock their owning Health-Check section so the underlying
    // measurement can no longer be edited. "Decided" means the customer has
    // made a final call — authorised, completed, OR declined. Declined was
    // previously omitted from this set, which let users keep editing the
    // section even after the row had been turned down on the Summary tab.
    [
      ...(severityLists.authorized || []),
      ...(severityLists.completed || []),
      ...(severityLists.declined || []),
    ].forEach((item) => {
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
      const isLabourComplete = Boolean(check.labour_complete);
      if (hours > 0 || isLabourComplete) {
        map.set(key, hours);
      }
      if (isLabourComplete) {
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
      reg: getVehicleRegistration(vehicle),
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

  const partsCostByVhcItem = useMemo(() => {
    const map = new Map();
    const canonicalNotRequired = new Set();

    partsNotRequired.forEach((rawId) => {
      const key = String(rawId);
      const alias = vhcIdAliases[key];
      canonicalNotRequired.add(alias ? String(alias) : key);
    });

    const summaryLines = summaryQuoteModel?.items || [];
    summaryLines.forEach((line) => {
      const canonicalId = String(line?.canonicalId || line?.id || "");
      if (!canonicalId) return;
      const partsValue = Number(line?.parts_gbp);
      if (!Number.isFinite(partsValue)) return;
      map.set(canonicalId, (map.get(canonicalId) || 0) + partsValue);
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
  }, [partsNotRequired, summaryItems, summaryQuoteModel, vhcIdAliases]);

  const partsAuthorizedByVhcItemId = useMemo(() => {
    const map = new Map();
    partsAuthorized.forEach((part) => {
      if (!part?.vhc_item_id) return;
      const key = String(part.vhc_item_id);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [partsAuthorized]);

  const ensureEntryValue = (state, itemId) =>
    state[itemId] || { partsCost: "", laborHours: null, totalOverride: "", status: null, labourComplete: false, partsComplete: false, completed: false };

  const updateEntryValue = (itemId, field, value) => {
    setItemEntries((prev) => ({
      ...prev,
      [itemId]: { ...ensureEntryValue(prev, itemId), [field]: value },
    }));
  };

  const getEntryForItem = (itemId) => ensureEntryValue(itemEntries, itemId);

  const hasValidLabourHoursInput = useCallback((value) => {
    if (value === null || value === undefined) return false;
    const text = String(value).trim();
    if (!text) return false;
    const numeric = Number(text);
    return Number.isFinite(numeric) && numeric >= 0;
  }, []);

  const resolveLabourHoursValue = (itemId, entry) => {
    const localValue = entry?.laborHours;
    if (localValue === "") return "";
    if (localValue !== null && localValue !== undefined) {
      return localValue;
    }
    const canonicalId = resolveCanonicalVhcId(itemId);
    const hours = labourHoursByVhcItem.map.get(canonicalId);
    if (!Number.isFinite(hours)) return "";
    return String(hours);
  };

  const resolveLabourCompleteValue = (entry, labourHoursValue) => {
    if (typeof entry?.labourComplete === "boolean" && entry.labourComplete) {
      return true;
    }
    return hasValidLabourHoursInput(labourHoursValue);
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
      [itemId]: { ...ensureEntryValue(prev, itemId), status, completed: normaliseDecisionStatus(status) === "completed" },
    }));

    // Persist to database (convert null to 'pending')
    const canonicalId = resolveCanonicalVhcId(itemId);
    let parsedId = Number(canonicalId);

    // Convert null to 'pending' for database
    const dbStatus = normaliseDecisionStatus(status) || "pending";
    const completeFlag = dbStatus === "completed";
    const summaryItem = summaryItemLookup.get(String(itemId));
    const severityKey = resolveOriginalSeverityDisplay(itemId, summaryItem);
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
        [itemId]: {
          ...ensureEntryValue(prev, itemId),
          status: previousStatus,
          completed: previousEntry?.completed ?? false,
        },
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
        complete: completeFlag,
      };
      if (newDisplayStatus && dbStatus !== "pending") {
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
          [itemId]: {
            ...ensureEntryValue(prev, itemId),
            status: previousStatus,
            completed: previousEntry?.completed ?? false,
          },
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
              authorization_state: dbStatus === "pending" ? "pending" : dbStatus,
              display_status: newDisplayStatus || check.display_status,
              approved_by: authUserId || dbUserId || "system",
              approved_at: dbStatus === 'pending' ? null : new Date().toISOString(),
              labour_hours: resolvedLabourHours !== "" ? Number(resolvedLabourHours) : check.labour_hours,
              labour_complete: labourCompleteValue,
              Complete: completeFlag,
            };
            return updatedCheck;
          }
          return check;
        });
        return updated;
      });

      // Refresh parent job data when authorization status changes
      // This ensures Customer Requests and Parts tabs see the updated data
      if (dbStatus === "authorized" || dbStatus === "declined" || dbStatus === "pending" || dbStatus === "completed") {
        refreshJobData();
      }

    } catch (error) {
      console.error(`❌ ━━━ [VHC STATUS ERROR] EXCEPTION ━━━`);
      console.error(`❌ [VHC STATUS ERROR]`, error);
      console.error(`❌ [VHC STATUS ERROR] Stack:`, error.stack);
    }
  };

  // Auto-update partsComplete checkbox and parts_cost based on parts being added or marked as not required
  useEffect(() => {
    const pendingSyncs = [];

    setItemEntries((prev) => {
      const updated = { ...prev };
      let hasChanges = false;

      // Check each item in ALL severity lists (red, amber, authorized, declined)
      const allItems = [
        ...(severityLists.red || []),
        ...(severityLists.amber || []),
        ...(severityLists.authorized || []),
        ...(severityLists.completed || []),
        ...(severityLists.declined || [])
      ];

      allItems.forEach((item) => {
        const itemId = item.id;
        const canonicalId = resolveCanonicalVhcId(itemId);
        const existingVhcId = findExistingVhcItemId(itemId, item);
        const candidateIds = new Set([
          String(itemId),
          String(canonicalId),
        ]);
        if (Number.isInteger(existingVhcId)) {
          candidateIds.add(String(existingVhcId));
        }

        const hasParts = Array.from(candidateIds).some((id) => {
          if (!id) return false;
          return partsCostByVhcItem.has(id) || partsAuthorizedByVhcItemId.has(id);
        });
        const isNotRequired = Array.from(candidateIds).some((id) => partsNotRequired.has(String(id)));
        const entry = ensureEntryValue(prev, itemId);

        const shouldBeComplete = hasParts || isNotRequired;

        // null  → item not in map (no parts, not "not required") — don't overwrite DB
        // 0     → item is "not required" — write 0 to DB
        // N > 0 → item has parts — write total cost to DB
        const calculatedPartsCost = Array.from(candidateIds).reduce((value, id) => {
          if (value !== null) return value;
          return partsCostByVhcItem.has(id) ? partsCostByVhcItem.get(id) : null;
        }, null);

        const currentStoredPartsCost =
          entry.partsCost !== "" && entry.partsCost !== null && entry.partsCost !== undefined
            ? parseFloat(entry.partsCost)
            : null;

        const partsCompleteChanged = entry.partsComplete !== shouldBeComplete;
        const clearPartsCost = !hasParts && !isNotRequired && currentStoredPartsCost !== null;
        const partsCostNeedsUpdate =
          calculatedPartsCost !== null
            ? calculatedPartsCost !== currentStoredPartsCost
            : clearPartsCost;

        if (partsCompleteChanged || partsCostNeedsUpdate) {
          const newEntry = { ...entry, partsComplete: shouldBeComplete };
          if (calculatedPartsCost !== null) {
            newEntry.partsCost = String(calculatedPartsCost);
          } else if (clearPartsCost) {
            newEntry.partsCost = "";
          }
          updated[itemId] = newEntry;
          hasChanges = true;

          // Also persist to database if the item has a valid VHC ID
          const parsedId = Array.from(candidateIds).reduce((resolved, id) => {
            if (Number.isInteger(resolved)) return resolved;
            const numeric = Number(id);
            return Number.isInteger(numeric) ? numeric : resolved;
          }, null);
          if (Number.isInteger(parsedId)) {
            const dbPayload = {
              vhcItemId: parsedId,
              partsComplete: shouldBeComplete,
              approvedBy: "system",
            };
            if (calculatedPartsCost !== null) {
              dbPayload.partsCost = calculatedPartsCost;
            } else if (clearPartsCost) {
              dbPayload.partsCost = 0;
            }
            pendingSyncs.push(dbPayload);
          }
        }
      });

      return hasChanges ? updated : prev;
    });

    pendingSyncs.forEach((dbPayload) => {
      const syncKey = JSON.stringify(dbPayload);
      if (vhcPartsStatusSyncRef.current.has(syncKey)) return;
      vhcPartsStatusSyncRef.current.add(syncKey);

      fetch("/api/vhc/update-item-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dbPayload),
      })
        .catch((error) => {
          console.error("Failed to save parts complete/cost status", error);
        })
        .finally(() => {
          vhcPartsStatusSyncRef.current.delete(syncKey);
        });
    });
  }, [
    partsCostByVhcItem,
    partsAuthorizedByVhcItemId,
    partsNotRequired,
    severityLists,
    resolveCanonicalVhcId,
    findExistingVhcItemId,
  ]);

  // Direct sync of parts_cost from parts_job_items → vhc_checks.
  // Uses ALL jobParts (no VHC-origin filter) to match the quote model that already displays
  // the correct price. Fires whenever jobParts or vhcChecksData change, sends a PATCH only
  // when the stored DB value differs from the computed total.
  useEffect(() => {
    if (!jobParts.length || !vhcChecksData.length) return;

    // Build cost map: vhc_item_id → sum(qty * unit_price)  — same logic as buildVhcQuoteLinesModel
    const costMap = new Map();
    jobParts.forEach((part) => {
      if (!part?.vhc_item_id) return;
      const key = String(part.vhc_item_id);
      const qty = Number(part.quantity_requested) || 1;
      const unitPrice = Number(part.unit_price ?? part?.part?.unit_price ?? 0);
      if (!Number.isFinite(unitPrice)) return;
      costMap.set(key, (costMap.get(key) || 0) + qty * unitPrice);
    });

    if (!costMap.size) return;

    vhcChecksData.forEach((check) => {
      if (!check?.vhc_id || check.section === "VHC_CHECKSHEET") return;
      const key = String(check.vhc_id);
      if (!costMap.has(key)) return;

      const computedCost = costMap.get(key);
      const storedCost =
        check.parts_cost !== null && check.parts_cost !== undefined
          ? parseFloat(check.parts_cost)
          : null;

      if (storedCost === computedCost) return; // Already in sync

      const nextPartsComplete = computedCost > 0 || Boolean(check.parts_complete);
      const syncKey = `${check.vhc_id}:${computedCost}:${nextPartsComplete}`;
      if (vhcPartsCostSyncRef.current.has(syncKey)) return;
      vhcPartsCostSyncRef.current.add(syncKey);

      fetch("/api/vhc/update-item-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vhcItemId: check.vhc_id,
          partsCost: computedCost,
          partsComplete: nextPartsComplete,
          approvedBy: "system",
        }),
      })
        .then((res) => {
          if (!res.ok) return;
          // Update local vhcChecksData so the effect doesn't re-fire and
          // so the DB-init effect picks up the correct value for itemEntries.
          setVhcChecksData((prev) =>
            prev.map((c) =>
              c.vhc_id === check.vhc_id
                ? {
                    ...c,
                    parts_cost: String(computedCost),
                    parts_complete: nextPartsComplete,
                  }
                : c
            )
          );
        })
        .catch((error) =>
          console.error("Failed to sync parts cost to vhc_checks", error)
        )
        .finally(() => {
          vhcPartsCostSyncRef.current.delete(syncKey);
        });
    });
  }, [jobParts, vhcChecksData]);

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
        ...(severityLists.completed || []),
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
        if (Number.isFinite(hours) && (hours > 0 || isFromVhcChecks)) {
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
  // Important: do not overwrite a decided local row status with a stale "pending" value.
  useEffect(() => {
    setItemEntries((prev) => {
      const updated = { ...prev };
      let hasChanges = false;
      const items = [...(severityLists.red || []), ...(severityLists.amber || []), ...(severityLists.authorized || []), ...(severityLists.completed || []), ...(severityLists.declined || [])];

      items.forEach((item) => {
        const hasLocalEntry = Object.prototype.hasOwnProperty.call(prev, item.id);
        const entry = ensureEntryValue(prev, item.id);

        // Resolve by canonical VHC id first, then display id fallback.
        const canonicalId = resolveCanonicalVhcId(item.id);
        const approvalData =
          vhcApprovalLookup.get(String(canonicalId)) ||
          vhcApprovalLookup.get(String(item.id));
        if (approvalData) {
          const candidateIds = new Set([String(item.id), String(canonicalId)]);
          const derivedPartsComplete = Array.from(candidateIds).some(
            (id) =>
              partsCostByVhcItem.has(id) ||
              partsAuthorizedByVhcItemId.has(id) ||
              partsNotRequired.has(id)
          );
          const dbDecision = normaliseDecisionStatus(approvalData.approvalStatus);
          const nextStatus =
            dbDecision && (dbDecision !== "pending" || !entry.status)
              ? dbDecision
              : entry.status || null;
          // Build the updated entry with database values
          const updatedEntry = {
            ...entry,
            status: nextStatus,
            completed: approvalData.complete ?? entry.completed ?? false,
          };

          // Update labour hours if present in database
          const hasLabourHours = approvalData.labourHours !== null && approvalData.labourHours !== undefined;
          const approvalLabourHours = Number(approvalData.labourHours);
          const hasExplicitLabourHours =
            hasLabourHours &&
            Number.isFinite(approvalLabourHours) &&
            (approvalLabourHours > 0 || approvalData.labourComplete === true);
          if (hasLabourHours) {
            if (hasExplicitLabourHours) {
              updatedEntry.laborHours = String(approvalData.labourHours);
            } else if (!hasLocalEntry) {
              updatedEntry.laborHours = null;
            }
          }
          if (approvalData.labourComplete !== null && approvalData.labourComplete !== undefined) {
            updatedEntry.labourComplete = approvalData.labourComplete;
          }

          // Update parts cost if present in database
          if (approvalData.partsCost !== null && approvalData.partsCost !== undefined) {
            updatedEntry.partsCost = String(approvalData.partsCost);
          }

          // Update parts complete status
          updatedEntry.partsComplete = derivedPartsComplete
            ? true
            : hasLocalEntry
            ? Boolean(entry.partsComplete)
            : Boolean(approvalData.partsComplete);

          // Update total override if present in database — but skip if the user
          // has already touched this field (typed or cleared) to prevent the
          // effect from overwriting in-progress edits or explicit clears.
          if (
            !totalOverrideTouchedRef.current.has(String(item.id)) &&
            approvalData.totalOverride !== null &&
            approvalData.totalOverride !== undefined
          ) {
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
  }, [
    vhcApprovalLookup,
    severityLists,
    resolveCanonicalVhcId,
    partsCostByVhcItem,
    partsAuthorizedByVhcItemId,
    partsNotRequired,
  ]);

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

  const computeLabourCost = (hours) => parseNumericValue(hours) * LABOUR_RATE_GROSS_DEFAULT_GBP;
  const parseCurrencyValue = (value) => {
    const numeric = Number.parseFloat(String(value || "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
  };

  const openLabourCostModal = (itemId, labourHoursValue) => {
    const parsedHours = Number(labourHoursValue);
    const resolvedHours = Number.isFinite(parsedHours) && parsedHours >= 0 ? parsedHours : 0;
    setLabourCostModal({
      open: true,
      itemId,
      costInput: LABOUR_COST_DEFAULT_GBP.toFixed(2),
      hoursInput: resolvedHours.toFixed(2),
    });
  };

  const closeLabourCostModal = () => {
    setLabourCostModal({
      open: false,
      itemId: null,
      costInput: LABOUR_COST_DEFAULT_GBP.toFixed(2),
      hoursInput: "",
    });
  };

  const saveLabourCostModal = async () => {
    const itemId = labourCostModal.itemId;
    if (!itemId) {
      closeLabourCostModal();
      return;
    }

    const parsedHours = Number(labourCostModal.hoursInput);
    const resolvedHours = Number.isFinite(parsedHours) && parsedHours >= 0 ? parsedHours : 0;
    const hoursValue = resolvedHours.toFixed(2);

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
    const labourCost = labourHours * LABOUR_RATE_GROSS_DEFAULT_GBP;
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
    const allLists = [severityLists.red || [], severityLists.amber || [], severityLists.authorized || [], severityLists.completed || [], severityLists.declined || []];

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
    if (loading) return;
    if (onFinancialTotalsChange && typeof onFinancialTotalsChange === 'function') {
      // Authorised + Complete both count toward the job-card summary's
      // "Authorised" total — completed work is still authorised work.
      const authorisedSum = Number.isFinite(Number(quoteTotals.authorized))
        ? Number(quoteTotals.authorized)
        : null;
      const completedSum = Number.isFinite(Number(quoteTotals.completed))
        ? Number(quoteTotals.completed)
        : 0;
      onFinancialTotalsChange({
        authorized: authorisedSum !== null
          ? authorisedSum + completedSum
          : customerTotals.authorized,
        declined: Number.isFinite(Number(quoteTotals.declined))
          ? Number(quoteTotals.declined)
          : customerTotals.declined
      });
    }
  }, [
    quoteTotals.authorized,
    quoteTotals.completed,
    quoteTotals.declined,
    customerTotals.authorized,
    customerTotals.declined,
    onFinancialTotalsChange,
    loading,
  ]);

  const formatCurrency = useCallback((value) => {
    if (!Number.isFinite(value)) return "—";
    return `£${value.toFixed(2)}`;
  }, []);

  const formatLabourHoursDisplay = (value) => {
    if (value === null || value === undefined || value === "") return "—";
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value);
    return Number.isInteger(numeric) ? String(numeric) : String(parseFloat(numeric.toFixed(2)));
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

  const vhcPartsToolbarMoneyTiles = (() => {
    const resolveRowSeverity = (value) =>
      normaliseColour(
        value?.vhcCheck?.severity ||
          value?.vhcCheck?.display_status ||
          value?.severityKey ||
          value?.rawSeverity ||
          value?.severity
      );
    const quoteItems = [
      ...(quoteSeverityLists.red || []),
      ...(quoteSeverityLists.amber || []),
      ...(quoteSeverityLists.authorized || []),
      ...(quoteSeverityLists.completed || []),
      ...(quoteSeverityLists.declined || []),
    ].filter((value) => {
      const severity = resolveRowSeverity(value);
      return severity === "red" || severity === "amber";
    });

    if (quoteItems.length === 0) return [];

    const partsByVhcId = new Map();
    partsIdentified.forEach((part) => {
      const rawVhcId = part?.vhc_item_id ?? part?.vhcItemId ?? null;
      if (rawVhcId === null || rawVhcId === undefined || String(rawVhcId).trim() === "") return;
      const canonicalId = String(resolveCanonicalVhcId(rawVhcId));
      if (!partsByVhcId.has(canonicalId)) partsByVhcId.set(canonicalId, []);
      partsByVhcId.get(canonicalId).push(part);
    });

    const sumCost = (predicate) =>
      quoteItems.reduce((sum, item) => {
        const vhcId = String(item.id);
        const canonicalId = String(resolveCanonicalVhcId(item.canonicalId || item.id));
        const entry = getEntryForItem(vhcId);
        const entryDecision = normaliseDecisionStatus(entry?.status);
        const declined = entryDecision === "declined";
        const authorised =
          !declined &&
          (entryDecision === "authorized" ||
            entryDecision === "completed" ||
            authorizedViewIds.has(canonicalId));

        if (!predicate({ declined, authorised })) return sum;

        const linkedParts = partsByVhcId.get(canonicalId) || [];
        const linkedPartsCost = linkedParts.reduce((total, part) => {
          const qtyValue = Number(part?.quantity_requested);
          const qty = Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 1;
          const unitPrice = Number(part?.unit_price ?? part?.part?.unit_price ?? 0);
          return Number.isFinite(unitPrice) ? total + qty * unitPrice : total;
        }, 0);
        const mappedPartsCost = Number(partsCostByVhcItem.get(canonicalId) || 0);
        const partsCost = partsNotRequired.has(vhcId)
          ? 0
          : mappedPartsCost > 0
            ? mappedPartsCost
            : linkedPartsCost;
        return sum + (partsCost || 0);
      }, 0);

    const approvedTotal = sumCost((item) => item.authorised);
    const inProgressTotal = sumCost((item) => !item.authorised && !item.declined);
    const declinedTotal = sumCost((item) => item.declined);
    const potentialTotal = approvedTotal + inProgressTotal + declinedTotal;

    return [
      { key: "approved", label: "Approved Parts", value: formatCurrency(approvedTotal), tone: "var(--success)" },
      { key: "inprogress", label: "In Progress", value: formatCurrency(inProgressTotal), tone: "var(--warning)" },
      { key: "declined", label: "Declined Parts", value: formatCurrency(declinedTotal), tone: "var(--danger)" },
      { key: "potential", label: "Total Potential", value: formatCurrency(potentialTotal), tone: "var(--text-accent)" },
    ];
  })();

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
      const isUncompleteAction = status === "uncomplete";
      const dbStatus = isUncompleteAction ? "authorized" : (normaliseDecisionStatus(status) || "pending");
      const completeFlag = dbStatus === "completed";

      if (selectedIds.length === 0) {
        return;
      }

      // Get the items from the severity list to access their rawSeverity
      const items = severityLists[severity] || [];
      const itemsMap = new Map(items.map(item => [item.id, item]));

      if (completeFlag) {
        const blockedItems = selectedIds
          .map((itemId) => ({
            itemId,
            item: itemsMap.get(itemId),
            reason: getCompletionPartBlockReason(itemId),
          }))
          .filter((entry) => entry.reason);

        if (blockedItems.length > 0) {
          const firstBlocked = blockedItems[0];
          const label = firstBlocked.item?.label || firstBlocked.item?.sectionName || `row ${firstBlocked.itemId}`;
          alert(`${label} cannot be completed yet. ${firstBlocked.reason}`);
          return;
        }
      }

      // Update local state immediately for all selected items
      setItemEntries((prev) => {
        const next = { ...prev };
        selectedIds.forEach((id) => {
          const current = ensureEntryValue(next, id);
          next[id] = { ...current, status: dbStatus, completed: completeFlag };
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
            // For Reset: restore original severity from DB where available.
            displayStatus = resolveOriginalSeverityDisplay(itemId, item);
          }

        try {
          const entry = getEntryForItem(itemId);
          const resolvedLabourHours = resolveLabourHoursValue(itemId, entry);
          const requestBody = {
            vhcItemId: parsedId,
            approvalStatus: dbStatus,
            approvedBy: authUserId || dbUserId || "system",
            complete: completeFlag,
          };
          if (displayStatus && dbStatus !== "pending") {
            requestBody.displayStatus = displayStatus;
          }
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
            complete: completeFlag,
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
                authorization_state: dbStatus === "pending" ? "pending" : dbStatus,
                display_status: matchingUpdate.displayStatus || check.display_status,
                approved_by: authUserId || dbUserId || "system",
                approved_at: dbStatus === "pending" ? null : new Date().toISOString(),
                labour_hours: matchingUpdate.labourHours !== "" ? Number(matchingUpdate.labourHours) : check.labour_hours,
                labour_complete: matchingUpdate.labourComplete,
                Complete: matchingUpdate.complete,
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
    [severitySelections, severityLists, getCompletionPartBlockReason, resolveCanonicalVhcId, resolveLabourHoursValue, resolveLabourCompleteValue, authUserId, dbUserId, refreshJobData, createVhcCheckForDisplayId, resolveOriginalSeverityDisplay]
  );

  const handleMoveItem = useCallback(
    async (itemId, newStatus) => {

      // Update local state immediately
      setItemEntries((prev) => {
        const current = ensureEntryValue(prev, itemId);
        return { ...prev, [itemId]: { ...current, status: newStatus, completed: false } };
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
          complete: false,
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
        const sourceItem = [
          ...(severityLists.red || []),
          ...(severityLists.amber || []),
          ...(severityLists.authorized || []),
          ...(severityLists.completed || []),
          ...(severityLists.declined || []),
        ].find((row) => String(row?.id) === String(itemId));
        const restoredPendingSeverity = resolveOriginalSeverityDisplay(itemId, sourceItem);
        const newDisplayStatus =
          newStatus === 'authorized'
            ? 'authorized'
            : newStatus === 'declined'
            ? 'declined'
            : newStatus === 'pending'
            ? restoredPendingSeverity || null
            : null;
        setVhcChecksData((prev) => {
          return prev.map((check) => {
            if (check.vhc_id === parsedId) {
              return {
                ...check,
                approval_status: newStatus,
                authorization_state: newStatus === "pending" ? "pending" : newStatus,
                display_status: newDisplayStatus,
                approved_by: authUserId || dbUserId || "system",
                approved_at: newStatus === "pending" ? null : new Date().toISOString(),
                labour_hours: resolvedLabourHours !== "" ? Number(resolvedLabourHours) : check.labour_hours,
                labour_complete: requestBody.labourComplete,
                Complete: false,
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
    [resolveCanonicalVhcId, resolveLabourHoursValue, resolveLabourCompleteValue, authUserId, dbUserId, refreshJobData, resolveOriginalSeverityDisplay]
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
      Object.values(labourHoursPersistDebounceRef.current).forEach((timeoutHandle) => {
        clearTimeout(timeoutHandle);
      });
      labourHoursPersistDebounceRef.current = {};
      Object.values(labourOverrideDebounceRef.current).forEach((timeoutHandle) => {
        clearTimeout(timeoutHandle);
      });
      labourOverrideDebounceRef.current = {};
      labourEditSessionRef.current = {};
    };
  }, []);

  const renderSectionBulkActions = (severity, itemsOverride = null) => {
    if (readOnly) return null;
    const itemsRaw = itemsOverride || severityLists[severity] || [];
    if (!itemsRaw || itemsRaw.length === 0) return null;
    const isRedOrAmberTable = severity === "red" || severity === "amber";
    const isRowSelectionEligible = (item) => {
      if (!isRedOrAmberTable) return true;
      const entry = getEntryForItem(item.id);
      const effectiveEntry = {
        ...entry,
        partsComplete:
          typeof item?.partsComplete === "boolean" ? item.partsComplete : entry.partsComplete,
        labourComplete:
          typeof item?.labourComplete === "boolean" ? item.labourComplete : entry.labourComplete,
      };
      const quoteParts = Number.isFinite(Number(item.parts_gbp)) ? Number(item.parts_gbp) : null;
      const resolvedPartsCost = quoteParts !== null ? quoteParts : resolvePartsCost(item.id, entry);
      const quoteLabourHours = Number.isFinite(Number(item.labour_hours)) ? Number(item.labour_hours) : null;
      const hasLocalLabourHoursValue = entry?.laborHours !== null && entry?.laborHours !== undefined;
      const resolvedLabourHours = hasLocalLabourHoursValue
        ? String(entry.laborHours)
        : quoteLabourHours !== null
          ? String(quoteLabourHours)
          : resolveLabourHoursValue(item.id, entry);
      const rowStatus = resolveVhcRowStatusView(item, effectiveEntry, resolvedPartsCost, resolvedLabourHours);
      return rowStatus.dotStateKey === "awaiting";
    };
    // Completion blockers must not affect row selection: selected rows still need Reset/Uncomplete actions.
    const selectableIds = new Set(itemsRaw.filter((item) => isRowSelectionEligible(item)).map((item) => item.id));
    const selectedIds = (severitySelections[severity] || []).filter((itemId) => selectableIds.has(itemId));
    const selectedSet = new Set(selectedIds);
    const selectedItems = itemsRaw.filter((item) => selectedSet.has(item.id));
    const selectedCompletedCount = selectedItems.filter((item) => {
      const entry = getEntryForItem(item.id);
      return Boolean(entry?.completed || vhcApprovalLookup.get(String(resolveCanonicalVhcId(item.id)))?.complete);
    }).length;
    const selectedAllCompleted = selectedItems.length > 0 && selectedCompletedCount === selectedItems.length;
    const selectedCompletionBlockedReason =
      severity === "authorized" && !selectedAllCompleted
        ? selectedItems.map((item) => getCompletionPartBlockReason(item.id)).find(Boolean) || ""
        : "";
    const buttonBaseStyle = {
      padding: "8px 14px",
      borderRadius: "var(--input-radius)",
      fontWeight: 600,
      fontSize: "13px",
    };
    return (
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {severity === "completed" ? (
          <button
            type="button"
            onClick={() => handleBulkStatus(severity, "uncomplete")}
            disabled={selectedSet.size === 0}
            style={{
              ...buttonBaseStyle,
              border: "1px solid var(--ghostbutton-ring)",
              backgroundColor: selectedSet.size === 0 ? "var(--theme)" : "var(--surface)",
              color: "var(--text-accent)",
              cursor: selectedSet.size === 0 ? "not-allowed" : "pointer",
            }}
          >
            Reset
          </button>
        ) : (severity === "authorized" || severity === "declined") ? (
          <>
            {!(severity === "authorized" && selectedAllCompleted) && (
              <button
                type="button"
                onClick={() => handleBulkStatus(severity, "pending")}
                disabled={selectedSet.size === 0}
                style={{
                  ...buttonBaseStyle,
                  border: "1px solid var(--ghostbutton-ring)",
                  backgroundColor: selectedSet.size === 0 ? "var(--theme)" : "var(--surface)",
                  color: "var(--text-accent)",
                  cursor: selectedSet.size === 0 ? "not-allowed" : "pointer",
                }}
              >
                Reset
              </button>
            )}
            {severity === "authorized" && (
              <button
                type="button"
                onClick={() => handleBulkStatus(severity, selectedAllCompleted ? "uncomplete" : "completed")}
                disabled={selectedSet.size === 0 || Boolean(selectedCompletionBlockedReason)}
                title={selectedCompletionBlockedReason}
                style={{
                  ...buttonBaseStyle,
                  border: "none",
                  backgroundColor: selectedSet.size === 0 || selectedCompletionBlockedReason ? "var(--complete-surface)" : "var(--complete)",
                  color: selectedSet.size === 0 || selectedCompletionBlockedReason ? "var(--complete)" : "white",
                  cursor: selectedSet.size === 0 || selectedCompletionBlockedReason ? "not-allowed" : "pointer",
                }}
              >
                {selectedAllCompleted ? "Uncomplete" : "Complete"}
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
                ...buttonBaseStyle,
                border: "none",
                backgroundColor: selectedSet.size === 0 ? "var(--danger-surface)" : "var(--surface)",
                color: "var(--danger)",
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
                ...buttonBaseStyle,
                border: "none",
                backgroundColor: selectedSet.size === 0 ? "var(--authorised-surface)" : "var(--authorised)",
                color: selectedSet.size === 0 ? "var(--authorised)" : "white",
                cursor: selectedSet.size === 0 ? "not-allowed" : "pointer",
              }}
            >
              Authorise
            </button>
          </>
        )}
      </div>
    );
  };

  const renderSeverityTable = (severity, itemsOverride = null) => {
    const itemsRaw = itemsOverride || severityLists[severity] || [];
    let items =
      severity === "authorized" || severity === "completed" || severity === "declined"
        ? [...itemsRaw].sort((a, b) => {
            const severityRank = (item) => {
              const value = normaliseColour(
                item?.vhcCheck?.severity ||
                  item?.vhcCheck?.display_status ||
                  item?.severityKey ||
                  item?.rawSeverity
              );
              if (value === "red") return 0;
              if (value === "amber") return 1;
              if (value === "green") return 2;
              return 3;
            };
            return severityRank(a) - severityRank(b);
          })
        : itemsRaw;

    // Keep rows grouped by reported category inside each summary section
    // (Red / Amber / Authorised / Declined) without adding visible separators.
    if (items.length > 1) {
      const indexedItems = items.map((item, index) => ({ item, index }));
      const categoryOrder = new Map();
      indexedItems.forEach(({ item }) => {
        const key = String(item?.categoryLabel || item?.sectionName || "Recorded Section");
        if (!categoryOrder.has(key)) {
          categoryOrder.set(key, categoryOrder.size);
        }
      });
      indexedItems.sort((a, b) => {
        const aCategory = String(a.item?.categoryLabel || a.item?.sectionName || "Recorded Section");
        const bCategory = String(b.item?.categoryLabel || b.item?.sectionName || "Recorded Section");
        const categoryDiff = (categoryOrder.get(aCategory) ?? 999) - (categoryOrder.get(bCategory) ?? 999);
        if (categoryDiff !== 0) return categoryDiff;
        return a.index - b.index;
      });
      items = indexedItems.map((entry) => entry.item);
    }

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
      const effectiveEntry = {
        ...entry,
        partsComplete:
          typeof item?.partsComplete === "boolean" ? item.partsComplete : entry.partsComplete,
        labourComplete:
          typeof item?.labourComplete === "boolean" ? item.labourComplete : entry.labourComplete,
      };
      const quoteParts = Number.isFinite(Number(item.parts_gbp)) ? Number(item.parts_gbp) : null;
      const resolvedPartsCost = quoteParts !== null ? quoteParts : resolvePartsCost(item.id, entry);
      const quoteLabourHours = Number.isFinite(Number(item.labour_hours)) ? Number(item.labour_hours) : null;
      const hasLocalLabourHoursValue = entry?.laborHours !== null && entry?.laborHours !== undefined;
      const resolvedLabourHours = hasLocalLabourHoursValue
        ? String(entry.laborHours)
        : quoteLabourHours !== null
          ? String(quoteLabourHours)
          : resolveLabourHoursValue(item.id, entry);
      const rowStatus = resolveVhcRowStatusView(item, effectiveEntry, resolvedPartsCost, resolvedLabourHours);
      return rowStatus.dotStateKey === "awaiting";
    };
    const selectableIds = new Set(items.filter((item) => isRowSelectionEligible(item)).map((item) => item.id));
    const selectedIds = (severitySelections[severity] || []).filter((itemId) => selectableIds.has(itemId));
    const selectedSet = new Set(selectedIds);
    const selectedItems = items.filter((item) => selectedSet.has(item.id));
    const selectedCompletedCount = selectedItems.filter((item) => {
      const entry = getEntryForItem(item.id);
      return Boolean(entry?.completed || vhcApprovalLookup.get(String(resolveCanonicalVhcId(item.id)))?.complete);
    }).length;
    const selectedAllCompleted = selectedItems.length > 0 && selectedCompletedCount === selectedItems.length;
    const selectableCount = selectableIds.size;
    const allChecked = selectableCount > 0 && selectedSet.size === selectableCount;
    const theme = SEVERITY_THEME[severity] || { border: "none" };

    return (
      <div
        style={{
          border: "none",
          borderRadius: "var(--radius-md)",
          background: "var(--surface)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflow: "visible" }}>
          {/* Opt out of GlobalTableShells: .app-table-shell--with-headings forces tbody tr backgrounds with !important and would beat the per-row severity background set on each <tr> below. */}
          <table data-app-table-shell="off" style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", tableLayout: "fixed" }}>
            <thead>
              <tr
                style={{
                  background: "var(--theme)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--text-1)",
                  fontSize: "11px",
                }}
              >
                <th style={{ textAlign: "left", padding: "12px 8px", width: "35%" }}>Item Details</th>
                <th style={{ textAlign: "left", padding: "12px 8px", width: "15%" }}>Parts</th>
                <th style={{ textAlign: "left", padding: "12px 8px", width: "18%" }}>Labour</th>
                <th style={{ textAlign: "left", padding: "12px 8px", width: "15%" }}>Total</th>
                <th style={{ textAlign: "center", padding: "12px 8px", width: "10%" }}>Status</th>
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
                // Display value: only show the field populated when the user has
                // actively entered something locally, OR there's a persisted
                // non-zero value. A stored 0 (from default/seed data) renders blank.
                const hasExplicitPersistedZero =
                  Number(resolvedLabourHours) === 0 &&
                  (entry.labourComplete === true || item.labourComplete === true);
                const labourInputDisplayValue = hasLocalLabourHoursValue
                  ? String(entry.laborHours)
                  : (() => {
                      const num = Number(resolvedLabourHours);
                      return Number.isFinite(num) && (num > 0 || hasExplicitPersistedZero)
                        ? String(resolvedLabourHours)
                        : "";
                    })();
                const labourCost =
                  quoteLabourHours !== null
                    ? quoteLabourHours * quoteLabourRate
                    : computeLabourCost(resolvedLabourHours);
                const totalCost =
                  quoteTotal !== null ? quoteTotal : computeRowTotal(entry, resolvedPartsCost, resolvedLabourHours);
                const totalDisplayValue = (() => {
                  if (entry.totalOverride !== "" && entry.totalOverride !== null)
                    return entry.totalOverride;
                  const rounded = parseFloat(totalCost.toFixed(2));
                  // Show no decimals for whole numbers, 2 decimals otherwise (e.g. 400 not 400.00, but 400.50 not 400.5)
                  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
                })();
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
                          severity === "authorized" || severity === "completed" || severity === "declined"
                            ? entry.labourComplete ?? item.labourComplete
                            : typeof item.labourComplete === "boolean"
                              ? item.labourComplete
                              : entry.labourComplete,
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
                // For authorised/completed/declined items, use original severity
                // for background colour so red/amber rows stay visually flagged
                // even after they've been actioned.
                const backgroundSeverity = rowSeverity;
                const rowTheme = SEVERITY_THEME[backgroundSeverity] || {};

                const getExplicitBackground = () => {
                  // Red / Amber working tables: rows sit on the plain surface colour
                  // (overrides any staffglobal table-shell tinting for these tables).
                  if (severity === "red" || severity === "amber") {
                    return "var(--surface)";
                  }
                  if (
                    severity === "authorized" ||
                    severity === "completed" ||
                    severity === "declined"
                  ) {
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
                const technicianDescription = concernDetail || item.notes || "";
                const customerOverride = (item.vhcCheck?.customer_description || "").trim();
                let detailContent = customerOverride || technicianDescription;
                const isCustomerOverride = Boolean(customerOverride);
                const summaryCategoryId = item.categoryId || item.category?.id || "";
                const canEditDescriptionFromTitle = [
                  "wheels_tyres",
                  "brakes_hubs",
                  "service_indicator",
                  "underside",
                ].includes(summaryCategoryId);
                const handleDescriptionClick = () => {
                  setCustomerDescriptionEditTarget({
                    vhcId: item.vhcCheck?.vhc_id || item.id,
                    itemLabel: item.label || item.sectionName || "Recorded item",
                    categoryLabel: item.categoryLabel || item.sectionName || "",
                    technicianDescription,
                    currentCustomerDescription: customerOverride,
                  });
                };
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
                if (item.categoryId === "wheels_tyres" && /\bwheel\b/i.test(detailLabel)) {
                  detailLabel = detailLabel.replace(/\bwheel\b/i, "Tyre");
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
                      // --separating-line is a full border shorthand (staffglobal row-divider setting)
                      borderBottom: "var(--separating-line)",
                      background: getExplicitBackground(),
                      transition: "background 0.2s ease",
                    }}
                  >
                    <td style={{ padding: "12px 8px", color: "var(--text-accent)", wordWrap: "break-word", overflow: "hidden" }}>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-1)" }}>
                        {item.categoryLabel || "Recorded Section"}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-accent)", marginTop: "2px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {canEditDescriptionFromTitle ? (
                          <button
                            type="button"
                            onClick={handleDescriptionClick}
                            title="Click to edit the customer description"
                            style={{
                              background: "transparent",
                              border: "none",
                              padding: 0,
                              margin: 0,
                              color: "var(--text-accent)",
                              font: "inherit",
                              fontWeight: 700,
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            {detailLabel}
                          </button>
                        ) : (
                          <span>{detailLabel}</span>
                        )}
                      </div>
                      {detailRows.length > 0 ? (
                        <button
                          type="button"
                          onClick={handleDescriptionClick}
                          title="Click to edit the customer description"
                          style={{
                            marginTop: "6px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            textAlign: "left",
                            cursor: "pointer",
                            color: "var(--text-1)",
                            font: "inherit",
                            width: "100%",
                          }}
                        >
                          {detailRows.map((row, rowIdx) => (
                            <div key={`${statusKey}-detail-row-${rowIdx}`} style={{ fontWeight: 600, color: "var(--text-1)" }}>
                              - {row}
                            </div>
                          ))}
                          {isCustomerOverride ? (
                            <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-accent)", fontWeight: 700 }}>
                              Customer description ✎
                            </div>
                          ) : null}
                        </button>
                      ) : suppressDetailLabel ? (
                        <button
                          type="button"
                          onClick={handleDescriptionClick}
                          title="Click to edit the customer description"
                          style={{
                            marginTop: "6px",
                            fontWeight: 600,
                            color: "var(--text-1)",
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            textAlign: "left",
                            cursor: "pointer",
                            font: "inherit",
                            width: "100%",
                          }}
                        >
                          {`- ${detailContent}`}
                          {isCustomerOverride ? (
                            <span style={{ marginLeft: 6, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-accent)", fontWeight: 700 }}>
                              ✎ customer
                            </span>
                          ) : null}
                        </button>
                      ) : detailContent ? (
                        <button
                          type="button"
                          onClick={handleDescriptionClick}
                          title="Click to edit the customer description"
                          style={{
                            marginTop: "6px",
                            fontWeight: 500,
                            color: "var(--text-1)",
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            textAlign: "left",
                            cursor: "pointer",
                            font: "inherit",
                            width: "100%",
                          }}
                        >
                          - {detailContent}
                          {isCustomerOverride ? (
                            <span style={{ marginLeft: 6, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-accent)", fontWeight: 700 }}>
                              ✎ customer
                            </span>
                          ) : null}
                        </button>
                      ) : canEditDescriptionFromTitle ? null : (
                        <button
                          type="button"
                          onClick={handleDescriptionClick}
                          title="Click to add a customer description"
                          style={{
                            marginTop: "6px",
                            fontStyle: "italic",
                            color: "var(--text-1)",
                            background: "transparent",
                            border: "1px dashed var(--ghostbutton-ring)",
                            borderRadius: "var(--radius-xs)",
                            padding: "4px 8px",
                            textAlign: "left",
                            cursor: "pointer",
                            font: "inherit",
                            fontSize: "12px",
                          }}
                        >
                          + Add customer description
                        </button>
                      )}
                      {item.measurement ? (
                        <div style={{ fontSize: "12px", color: "var(--text-1)", marginTop: "4px" }}>{item.measurement}</div>
                      ) : null}
                      {locationLabel ? (
                        <div style={{ fontSize: "12px", color: "var(--text-1)", marginTop: "4px" }}>Location: {locationLabel}</div>
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
                              background: "var(--theme)",
                              borderRadius: "var(--radius-xs)",
                              overflow: "hidden"
                            }}>
                              <div style={{
                                width: `${wearPercent}%`,
                                height: "100%",
                                background: getWearColor(wearPercent),
                                borderRadius: "var(--radius-xs)",
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
                            borderRadius: "var(--radius-sm)",
                            background: "var(--surface)",
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
                                  color: "var(--text-1)",
                                }}
                              >
                                {!entry.hideLabel ? (
                                  <span style={{ fontWeight: 600, color: "var(--text-accent)" }}>{entry.label}</span>
                                ) : null}
                                {entry.measurement ? <span>{entry.measurement}</span> : null}
                                {entryStatusLabel && badgeStyles ? (
                                  <span
                                    style={{
                                      padding: "2px 10px",
                                      borderRadius: "var(--radius-pill)",
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
                                {entry.note ? <span style={{ color: "var(--text-1)" }}>{entry.note}</span> : null}
                                {entry.isOddMake ? (
                                  <span
                                    title={
                                      entry.tyreMake
                                        ? `${entry.tyreMake} differs from the make fitted to the other tyres on this vehicle`
                                        : "Tyre make differs from the other tyres on this vehicle"
                                    }
                                    style={{
                                      padding: "2px 10px",
                                      borderRadius: "var(--radius-pill)",
                                      fontSize: "11px",
                                      fontWeight: 600,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.08em",
                                      background: "var(--warning-surface)",
                                      color: "var(--warning)",
                                    }}
                                  >
                                    ⚠ Odd tyre make
                                  </span>
                                ) : null}
                                {Array.isArray(entry.spec) && entry.spec.length > 0 ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", width: "100%" }}>
                                    {entry.spec.map((line) => (
                                      <span key={`${entry.id || entry.label}-spec-${line}`} style={{ color: "var(--text-1)", fontSize: "11px" }}>
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
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-accent)" }}>
                          {partsDisplayValue ? `£${partsDisplayValue}` : "—"}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", position: "relative" }}>
                        <input
                          className="labour-hours-input"
                          type="number"
                          min="0"
                          step="0.1"
                          value={labourInputDisplayValue}
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
                                  labourComplete: hasValidLabourHoursInput(value),
                                },
                              }));
                            labourEditSessionRef.current[item.id] = {
                              ...existingSession,
                              initialValue: existingSession.initialValue ?? String(resolvedLabourHours ?? ""),
                              latestValue: value,
                            };
                            queuePersistLabourHours(item.id, value);
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
                            flushQueuedLabourPersist(item.id);
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
                          placeholder="h"
                          style={{
                            width: "50px",
                            padding: "4px 6px",
                            borderRadius: "var(--radius-xs)",
                            border: "1px solid var(--input-ring)",
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
                        <span style={{ fontSize: "12px", color: "var(--text-1)", whiteSpace: "nowrap" }}>£{labourCost.toFixed(2)}</span>
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
                              borderRadius: "var(--input-radius)",
                              background: "var(--surface)",
                              boxShadow: "0 12px 24px rgba(var(--text-1-rgb), 0.14)",
                              zIndex: 12,
                            }}
                          >
                            {labourSuggestionsLoading ? (
                              <div style={{ padding: "10px 12px", fontSize: "12px", color: "var(--text-1)" }}>Loading suggestions…</div>
                            ) : labourSuggestions.length === 0 ? (
                              <div style={{ padding: "10px 12px", fontSize: "12px", color: "var(--text-1)" }}>Suggested labour time</div>
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
                                    borderBottom: "1px solid var(--separating-line)",
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
                                        color: suggestion.source === "fallback" ? "var(--warning)" : "var(--text-1)",
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
                          value={totalEditItemId === item.id ? totalEditValue : totalDisplayValue}
                          onFocus={() => {
                            // When the user clicks in, seed the edit buffer with the current
                            // displayed value so they see the same number they were looking at.
                            setTotalEditItemId(item.id);
                            setTotalEditValue(
                              entry.totalOverride !== "" && entry.totalOverride !== null && entry.totalOverride !== undefined
                                ? String(entry.totalOverride)
                                : (() => { const r = parseFloat(totalCost.toFixed(2)); return Number.isInteger(r) ? String(r) : r.toFixed(2); })()
                            );
                          }}
                          onChange={(event) => {
                            // Keep the edit buffer in sync so the input shows exactly what
                            // the user is typing (including empty string — no snap-back).
                            totalOverrideTouchedRef.current.add(String(item.id));
                            setTotalEditValue(event.target.value);
                            updateEntryValue(item.id, "totalOverride", event.target.value);
                          }}
                          onBlur={() => {
                            // Stop showing the edit buffer — revert to totalDisplayValue.
                            setTotalEditItemId(null);
                            setTotalEditValue("");
                            if (readOnly || severity === "authorized" || severity === "declined") return;
                            totalOverrideTouchedRef.current.add(String(item.id));
                            const rawValue = entry.totalOverride;
                            const isEmpty = rawValue === "" || rawValue === null || rawValue === undefined;
                            const parsedValue = isEmpty ? null : parseFloat(rawValue);
                            if (!isEmpty && (!Number.isFinite(parsedValue) || parsedValue < 0)) return;
                            const canonicalId = resolveCanonicalVhcId(item.id);
                            const parsedId = Number(canonicalId);
                            if (!Number.isInteger(parsedId)) return;
                            updateEntryValue(item.id, "totalOverride", isEmpty ? "" : String(parsedValue));
                            fetch("/api/vhc/update-item-status", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                vhcItemId: parsedId,
                                totalOverride: isEmpty ? null : parsedValue,
                                approvedBy: authUserId || dbUserId || null,
                              }),
                            })
                              .then((res) => {
                                if (!res.ok) return;
                                setVhcChecksData((prev) =>
                                  prev.map((c) =>
                                    c.vhc_id === parsedId
                                      ? { ...c, total_override: isEmpty ? null : parsedValue }
                                      : c
                                  )
                                );
                              })
                              .catch((error) => console.error("Failed to save total override", error));
                          }}
                          placeholder="0.00"
                          className="vhc-total-input"
                          style={{
                            width: "70px",
                            padding: "4px 6px",
                            borderRadius: "var(--radius-xs)",
                            border: "1px solid var(--input-ring)",
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
                              borderRadius: "var(--radius-xs)",
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
                    <td style={{ padding: "12px 8px", textAlign: "center" }}>
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
                            borderRadius: "var(--radius-pill)",
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
                              border: "none",
                              borderRadius: "var(--radius-sm)",
                              padding: "10px 14px",
                              boxShadow: "0 8px 16px rgba(var(--text-1-rgb), 0.12)",
                              whiteSpace: "nowrap",
                              zIndex: 5,
                            }}
                          >
                            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-accent)" }}>
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
                              ? "Row must be awaiting customer decision before it can be selected."
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
      </div>
    );
  };

  const renderCustomerRow = (item, severity) => {
    const entry = getEntryForItem(item.id);
    const total = resolveCustomerRowTotal(item.id);
    const detailLabel = item.label || item.sectionName || "Recorded item";
    const customerOverride = (item.vhcCheck?.customer_description || "").trim();
    const detailContent = customerOverride || item.concernText || item.notes || "";
    const measurement = item.measurement || "";
    const categoryLabel = item.categoryLabel || item.sectionName || "Recorded Section";
    const decisionKey = resolveVhcRowDecisionKey(item, entry);
    const isCompleted = decisionKey === "completed";
    const isAuthorized = decisionKey === "authorized" || severity === "authorized" || isCompleted;
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
          borderBottom: "1px solid var(--separating-line)",
          background: getRowBackground(),
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ minWidth: "240px" }}>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-1)" }}>
              {categoryLabel}
            </div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-accent)", marginTop: "4px" }}>
              {detailLabel}
            </div>
            {detailContent ? (
              <div style={{ fontSize: "13px", color: "var(--text-1)", marginTop: "4px" }}>{detailContent}</div>
            ) : null}
            {measurement ? (
              <div style={{ fontSize: "12px", color: "var(--text-1)", marginTop: "4px" }}>{measurement}</div>
            ) : null}
            {wearPercent !== null && (
              <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  width: "100px",
                  height: "8px",
                  background: "var(--theme)",
                  borderRadius: "var(--radius-xs)",
                  overflow: "hidden"
                }}>
                  <div style={{
                    width: `${wearPercent}%`,
                    height: "100%",
                    background: getWearColor(wearPercent),
                    borderRadius: "var(--radius-xs)",
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
                <span style={{ fontSize: "11px", color: "var(--text-1)" }}>
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
                  Final Check - {isCompleted ? "Completed" : isAuthorized ? "Authorised" : "Declined"}
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCustomerSection = (title, items, severity) => {
    const theme = SEVERITY_THEME[severity] || { border: "none", background: "var(--surface)" };

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
    const sectionTotals = { authorized, declined };

    // Ensure authorized/declined sections show red items first
    let displayItems = items;
    if (severity === "authorized" || severity === "declined") {
      const severityRank = (s) => (s === "red" ? 0 : s === "amber" ? 1 : s === "green" ? 2 : 3);
      displayItems = [...items].sort((a, b) => severityRank(a.severityKey || a.rawSeverity) - severityRank(b.severityKey || b.rawSeverity));

      if (process.env.NODE_ENV !== 'production') {

      }
    }

    // Group rows by reported category (contiguous ordering) without rendering
    // extra category section headers.
    if (displayItems.length > 1) {
      const indexedItems = displayItems.map((item, index) => ({ item, index }));
      const categoryOrder = new Map();

      indexedItems.forEach(({ item }) => {
        const key = String(item.categoryLabel || item.sectionName || "Recorded Section");
        if (!categoryOrder.has(key)) {
          categoryOrder.set(key, categoryOrder.size);
        }
      });

      const severityRank = (s) => (s === "red" ? 0 : s === "amber" ? 1 : s === "green" ? 2 : 3);
      indexedItems.sort((a, b) => {
        const aCategoryKey = String(a.item.categoryLabel || a.item.sectionName || "Recorded Section");
        const bCategoryKey = String(b.item.categoryLabel || b.item.sectionName || "Recorded Section");
        const categoryDiff =
          (categoryOrder.get(aCategoryKey) ?? 999) - (categoryOrder.get(bCategoryKey) ?? 999);
        if (categoryDiff !== 0) return categoryDiff;

        if (severity === "authorized" || severity === "declined") {
          const rankDiff =
            severityRank(a.item.severityKey || a.item.rawSeverity) -
            severityRank(b.item.severityKey || b.item.rawSeverity);
          if (rankDiff !== 0) return rankDiff;
        }

        return a.index - b.index;
      });

      displayItems = indexedItems.map((entry) => entry.item);
    }

    return (
      <div
        style={{
          border: "none",
          borderRadius: "var(--radius-md)",
          background: theme.background || "var(--surface)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            fontWeight: 700,
            color: theme.text || "var(--text-accent)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontSize: "12px",
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
          <div style={{ padding: "16px", fontSize: "13px", color: "var(--text-1)" }}>
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
  // VHC photo / video classification is shared with the technician-facing
  // VhcMediaGallery via the buildVhcMediaLibrary helper so both surfaces agree
  // on what counts as VHC media.
  const { photoFiles, videoFiles } = useMemo(
    () => classifyVhcMedia(jobFiles),
    [jobFiles],
  );

  // Group VHC media (photos + videos) by the request/concern they were
  // captured against (job_files.vhc_concern_link). Each linked concern becomes
  // one request row in the merged Video / Photo tab, carrying both its photos
  // and its videos so the row can show a photo count + a video count. Media
  // with no concern link falls into the "unlinked" bucket. Any video flagged
  // job_files.is_main_vhc_video is the customer-facing "main" walkaround taken
  // at the end of the health check; it is pulled out and pinned in a row at the
  // very top of the tab regardless of whether it is also linked to a concern.
  const mediaLibrary = useMemo(
    () => groupVhcMedia({ photoFiles, videoFiles }),
    [photoFiles, videoFiles],
  );

  const vhcMediaToolbarStatTiles = (() => {
    const stats = mediaLibrary?.stats || {};
    return [
      { label: "Photos", value: stats.photos || 0 },
      { label: "Videos", value: stats.videos || 0 },
      { label: "Customer-visible", value: stats.customerVisible || 0 },
    ];
  })();

  // Top-level Photos-tab upload: drops an (unlinked) VHC photo onto the job,
  // then bumps the reload token so the panel re-fetches its job_files.
  const handlePhotoTabUpload = useCallback(
    async (event) => {
      const file = event?.target?.files?.[0];
      if (event?.target) event.target.value = "";
      if (!file) return;
      try {
        setPhotoUploading(true);
        setPhotoUploadError("");
        await uploadVhcMediaFile({
          file,
          jobId: job?.id || null,
          jobNumber: resolvedJobNumber,
          userId: dbUserId || authUserId || "system",
          visibleToCustomer: true,
        });
        setPhotosReloadToken((token) => token + 1);
      } catch (err) {
        console.error("Photo upload failed:", err);
        setPhotoUploadError(err?.message || "Upload failed");
      } finally {
        setPhotoUploading(false);
      }
    },
    [job?.id, resolvedJobNumber, dbUserId, authUserId],
  );

  // Promote/demote a video as the job's main customer-facing VHC video, then
  // bump the reload token so the panel re-fetches and the pinned top row
  // reflects the change.
  const handleToggleMainVideo = useCallback(
    async (fileId, makeMain) => {
      if (fileId === undefined || fileId === null) return;
      try {
        setMainVideoSavingId(fileId);
        setPhotoUploadError("");
        await setMainVhcVideo({ fileId, isMain: makeMain });
        setPhotosReloadToken((token) => token + 1);
      } catch (err) {
        console.error("Set main video failed:", err);
        setPhotoUploadError(err?.message || "Could not update the main video.");
      } finally {
        setMainVideoSavingId(null);
      }
    },
    [],
  );

  const handleOpenPhotoPreview = useCallback((file) => {
    setPhotoPreviewFile(file || null);
    setPhotoPreviewMessage("");
    setCreatingMediaLocation(false);
    setNewMediaLocationName("");
  }, []);

  const handleCopyPhotoLink = useCallback(async () => {
    const url = photoPreviewFile?.file_url;
    if (!url) return;
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setPhotoPreviewMessage("Copy is not available in this browser.");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setPhotoPreviewMessage("Link copied.");
    } catch {
      setPhotoPreviewMessage("Could not copy the link.");
    }
  }, [photoPreviewFile]);

  // Flat list of every red/amber reported concern across all VHC sections —
  // the relink dropdown's "reported item" options. Built from the live vhcData
  // via the same collector the per-section camera button uses.
  const reportedConcerns = useMemo(() => {
    const sectionKeys = ["wheels", "brakes", "service", "external", "internal", "underside"];
    return sectionKeys.flatMap((key) => collectSectionConcerns(key, vhcData || {}));
  }, [vhcData]);

  // Custom "media locations" already created on THIS job (custom concern links
  // saved on its job_files). Job-scoped by construction — they live on this
  // job's files only and never leak into other job numbers.
  const customMediaLocations = useMemo(() => {
    const byId = new Map();
    jobFiles.forEach((file) => {
      const link = file?.vhc_concern_link;
      if (link && typeof link === "object" && link.custom && link.concernId != null) {
        const id = String(link.concernId);
        if (!byId.has(id)) byId.set(id, { concernId: id, label: link.label || "Custom location", section: link.section || "", custom: true });
      }
    });
    return Array.from(byId.values());
  }, [jobFiles]);

  // Persist a new concern link (or null to unlink) onto the previewed media
  // file, then optimistically patch the popup + bump the reload token.
  const handleSetMediaLink = useCallback(async (file, link) => {
    if (!file?.file_id) return;
    try {
      setMediaLinkSaving(true);
      setPhotoPreviewMessage("");
      await updateVhcMediaRecord({ fileId: file.file_id, concernLink: link });
      setPhotoPreviewFile((prev) => (prev && prev.file_id === file.file_id ? { ...prev, vhc_concern_link: link } : prev));
      setCreatingMediaLocation(false);
      setNewMediaLocationName("");
      setPhotosReloadToken((token) => token + 1);
    } catch (err) {
      console.error("Update media link failed:", err);
      setPhotoPreviewMessage(err?.message || "Could not update the linked item.");
    } finally {
      setMediaLinkSaving(false);
    }
  }, []);

  // Resolve a dropdown selection to a concern link and save it. "" → unlink,
  // "__create__" → reveal the new-location input, otherwise match a reported
  // concern or an existing custom location by id.
  const handleSelectMediaLink = useCallback((file, value) => {
    if (value === "__create__") {
      setCreatingMediaLocation(true);
      return;
    }
    setCreatingMediaLocation(false);
    if (!value) {
      handleSetMediaLink(file, null);
      return;
    }
    const match =
      reportedConcerns.find((concern) => String(concern.concernId) === value) ||
      customMediaLocations.find((loc) => String(loc.concernId) === value);
    if (match) handleSetMediaLink(file, match);
  }, [reportedConcerns, customMediaLocations, handleSetMediaLink]);

  // Create a brand-new, job-scoped media location from the typed name and link
  // the current media to it. The custom flag keeps it out of other jobs.
  const handleCreateMediaLocation = useCallback((file) => {
    const name = newMediaLocationName.trim();
    if (!name) return;
    const concernId = `custom-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    handleSetMediaLink(file, { concernId, label: name, section: "", status: "", custom: true });
  }, [newMediaLocationName, handleSetMediaLink]);

  // Flip a media file's customer visibility, then optimistically patch + reload.
  const handleToggleMediaVisibility = useCallback(async (file) => {
    if (!file?.file_id) return;
    const next = !file.visible_to_customer;
    try {
      setMediaVisibilitySaving(true);
      setPhotoPreviewMessage("");
      await updateVhcMediaRecord({ fileId: file.file_id, visibleToCustomer: next });
      setPhotoPreviewFile((prev) => (prev && prev.file_id === file.file_id ? { ...prev, visible_to_customer: next } : prev));
      setPhotosReloadToken((token) => token + 1);
    } catch (err) {
      console.error("Update media visibility failed:", err);
      setPhotoPreviewMessage(err?.message || "Could not update visibility.");
    } finally {
      setMediaVisibilitySaving(false);
    }
  }, []);

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
              vhc_checks(vhc_id, section, issue_description, customer_description, issue_title, measurement, created_at, updated_at, approval_status, authorization_state, display_status, severity, approved_by, approved_at, labour_hours, parts_cost, total_override, labour_complete, parts_complete, display_id, Complete),
              parts_job_items(
                id,
                part_id,
                allocated_to_request_id,
                quantity_requested,
                quantity_allocated,
                quantity_fitted,
                status,
                origin,
                vhc_item_id,
                row_description,
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
                uploaded_by,
                visible_to_customer,
                vhc_concern_link,
                is_main_vhc_video
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
    async (displayVhcId, hoursValue, options = {}) => {
      const { suppressRefresh = false } = options;
      if (!job?.id) return;
      const canonicalId = resolveCanonicalVhcId(displayVhcId);
      const parsedId = Number(canonicalId);
      const isBlank = hoursValue === "" || hoursValue === null || hoursValue === undefined;
      const parsedHours = Number(hoursValue);
      const labourHours = !isBlank && Number.isFinite(parsedHours) ? parsedHours : null;
      const hasValidHours = hasValidLabourHoursInput(hoursValue);

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
                labourHours: hasValidHours ? labourHours : null,
                labourComplete: hasValidHours,
                approvedBy: authUserId || dbUserId || null,
              }),
            });
          const vhcResult = await vhcResponse.json();
          if (!vhcResponse.ok || !vhcResult?.success) {
            console.warn("Failed to update vhc_checks labour hours:", vhcResult?.message);
          } else {
            setVhcChecksData((prev) => prev.map((check) => {
              if (String(check.vhc_id) !== String(vhcItemIdToUse)) return check;
              return { ...check, labour_hours: hasValidHours ? labourHours : null, labour_complete: hasValidHours };
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
          if (resolvedJobNumber && !suppressRefresh) {
            const { data: updatedVhcChecks } = await supabase
              .from("vhc_checks")
              .select("*")
              .eq("job_id", job.id);
            if (updatedVhcChecks) {
              setVhcChecksData(updatedVhcChecks);
            }
          }

          // Refresh parent job data so other tabs see the updated labour hours
          if (!suppressRefresh) {
            refreshJobData();
          }
        }
      } catch (error) {
        console.error("Failed to persist labour hours", error);
      }
    },
    [authUserId, dbUserId, job?.id, resolveCanonicalVhcId, createVhcCheckForDisplayId, refreshJobData, hasValidLabourHoursInput]
  );

  const queuePersistLabourHours = useCallback(
    (displayVhcId, hoursValue) => {
      const key = String(displayVhcId);
      if (labourHoursPersistDebounceRef.current[key]) {
        clearTimeout(labourHoursPersistDebounceRef.current[key]);
      }
      labourHoursPersistDebounceRef.current[key] = setTimeout(() => {
        persistLabourHours(displayVhcId, hoursValue, { suppressRefresh: true });
        delete labourHoursPersistDebounceRef.current[key];
      }, 300);
    },
    [persistLabourHours]
  );

  const flushQueuedLabourPersist = useCallback(
    (displayVhcId) => {
      const key = String(displayVhcId);
      if (labourHoursPersistDebounceRef.current[key]) {
        clearTimeout(labourHoursPersistDebounceRef.current[key]);
        delete labourHoursPersistDebounceRef.current[key];
      }
    },
    []
  );

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
          vhc_checks(vhc_id, section, issue_description, customer_description, issue_title, measurement, created_at, updated_at, severity),
          parts_job_items(
            id,
            part_id,
            allocated_to_request_id,
            quantity_requested,
            quantity_allocated,
            quantity_fitted,
            status,
            origin,
            vhc_item_id,
            row_description,
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
            uploaded_by,
            visible_to_customer,
            vhc_concern_link,
            is_main_vhc_video
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
          requestNotes: `Added from VHC Parts Authorised - Job #${resolvedJobNumber}`,
          origin: "vhc",
          vhcItemId: selectedPartForJob.vhc_item_id || null,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to add part to job");
      }

      // Job tracker logging — non-blocking.
      try {
        const qty = selectedPartForJob.quantity_requested || 1;
        await logJobActivityClient({
          jobId: job.id,
          jobNumber: resolvedJobNumber,
          category: "parts",
          action: "added_to_vhc_item",
          summary: `Part added: ${part.name || part.part_number || "(unnamed)"} × ${qty}`,
          targetType: "parts_job_item",
          targetId: selectedPartForJob.vhc_item_id ? String(selectedPartForJob.vhc_item_id) : null,
          payload: {
            partId: part.id,
            partName: part.name,
            partNumber: part.part_number,
            quantity: qty,
            vhcItemId: selectedPartForJob.vhc_item_id || null,
          },
        });
      } catch {}

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

  // Render VHC items panel for Parts Identified — only red and amber rows are shown here.
  // We source from every bucket (red/amber/authorised/completed/declined) and filter by
  // the row's underlying severity instead of bucket name. This is necessary because the
  // bucketing in quoteLines.js promotes any item with approvalStatus in
  // {authorized, completed, declined} into its decision bucket BEFORE checking severity,
  // so a red item the customer has authorised would otherwise vanish from Parts Identified.
  const renderVhcPartsPanel = useCallback(() => {
    const resolveRowSeverity = (value) =>
      normaliseColour(
        value?.vhcCheck?.severity ||
          value?.vhcCheck?.display_status ||
          value?.severityKey ||
          value?.rawSeverity ||
          value?.severity
      );
    const quoteItems = [
      ...(quoteSeverityLists.red || []),
      ...(quoteSeverityLists.amber || []),
      ...(quoteSeverityLists.authorized || []),
      ...(quoteSeverityLists.completed || []),
      ...(quoteSeverityLists.declined || []),
    ]
      .filter((value) => {
        // Underlying severity is what gates Parts Identified visibility, not the
        // current decision. A row is red or amber if any of its severity sources
        // resolves to one of those colours.
        const severity = resolveRowSeverity(value);
        return severity === "red" || severity === "amber";
      })
      .sort((a, b) => {
        const rank = (value) => {
          const severity = resolveRowSeverity(value);
          if (severity === "red") return 0;
          if (severity === "amber") return 1;
          return 2;
        };
        return rank(a) - rank(b);
      });

    const normaliseMatchText = (value = "") =>
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const extractWheelPositionToken = (value = "") => {
      const text = normaliseMatchText(value);
      if (!text) return "";
      if (/\bnsf\b/.test(text) || text.includes("near side front")) return "nsf";
      if (/\bosf\b/.test(text) || text.includes("off side front")) return "osf";
      if (/\bnsr\b/.test(text) || text.includes("near side rear")) return "nsr";
      if (/\bosr\b/.test(text) || text.includes("off side rear")) return "osr";
      return "";
    };

    const extractTyreSizeKey = (value = "") => {
      const raw = String(value || "").toUpperCase();
      const match = raw.match(/(\d{3}\s*\/\s*\d{2}\s*R\s*\d{2})/);
      if (!match?.[1]) return "";
      return match[1].replace(/\s+/g, "");
    };

    const stripMetaSuffix = (value = "") => {
      const text = String(value || "");
      const markerIndex = text.indexOf(PART_META_PREFIX);
      if (markerIndex === -1) return text.trim();
      return text.slice(0, markerIndex).trim();
    };

    const searchableRows = quoteItems.map((item) => {
      const canonicalId = String(resolveCanonicalVhcId(item.canonicalId || item.id));
      const haystack = normaliseMatchText(
        [
          item?.measurement,
          item?.label,
          item?.notes,
          item?.concernText,
          item?.sectionName,
          item?.categoryLabel,
          ...(Array.isArray(item?.rows) ? item.rows : []),
        ]
          .filter(Boolean)
          .join(" ")
      );
      return { canonicalId, haystack };
    });
    const legacyTieAllocationCount = new Map();
    const wheelTokenRank = { nsf: 0, osf: 1, nsr: 2, osr: 3 };

    const resolveLegacyPartVhcId = (part) => {
      const partPositionToken = extractWheelPositionToken(
        [
          part?.part?.name,
          part?.part_name_snapshot,
          part?.row_description,
          part?.request_notes,
          part?.requestNotes,
        ]
          .filter(Boolean)
          .join(" ")
      );
      const partTyreSizeKey = extractTyreSizeKey(
        [
          part?.part?.name,
          part?.part_name_snapshot,
          part?.part?.description,
          part?.row_description,
          part?.request_notes,
          part?.requestNotes,
        ]
          .filter(Boolean)
          .join(" ")
      );

      const hints = [
        part?.row_description,
        part?.part?.name,
        part?.part_name_snapshot,
        part?.part?.description,
        part?.part?.part_number,
        part?.part_number_snapshot,
        stripMetaSuffix(part?.request_notes || part?.requestNotes || ""),
      ]
        .map((value) => normaliseMatchText(value))
        .filter((value) => value && value.length >= 4);

      if (hints.length === 0) return null;

      const ranked = searchableRows
        .map((row) => {
          let score = 0;
          const rowPositionToken = extractWheelPositionToken(row.haystack);
          const rowTyreSizeKey = extractTyreSizeKey(row.haystack);

          if (partPositionToken && rowPositionToken) {
            score += partPositionToken === rowPositionToken ? 60 : -35;
          }
          if (partTyreSizeKey && rowTyreSizeKey) {
            score += partTyreSizeKey === rowTyreSizeKey ? 24 : -12;
          }

          hints.forEach((hint) => {
            if (row.haystack.includes(hint)) {
              score += Math.min(50, hint.length * 3);
              return;
            }
            const tokens = hint.split(" ").filter((token) => token.length >= 4);
            const tokenHits = tokens.filter((token) => row.haystack.includes(token)).length;
            score += tokenHits * 4;
          });
          return { row, score };
        })
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score);

      if (ranked.length === 0) return null;
      if (ranked.length === 1) return ranked[0].row.canonicalId;
      if (ranked[0].score > ranked[1].score) return ranked[0].row.canonicalId;

      // Ambiguous tie fallback for legacy tyre parts (vhc_item_id missing):
      // distribute repeated matching parts across tied wheel rows deterministically.
      const topScore = ranked[0].score;
      const tied = ranked.filter((entry) => entry.score === topScore);
      if (tied.length === 0) return null;

      const tyreContextText = normaliseMatchText(
        [
          part?.part?.name,
          part?.part_name_snapshot,
          part?.part?.description,
          part?.part?.part_number,
          part?.part_number_snapshot,
          part?.row_description,
          stripMetaSuffix(part?.request_notes || part?.requestNotes || ""),
        ]
          .filter(Boolean)
          .join(" ")
      );
      const isTyreContext = Boolean(partTyreSizeKey) || /\b(tyre|tire|wheel)\b/.test(tyreContextText);
      if (!isTyreContext) return null;

      const sizeMatchedPool = tied.filter((entry) => {
        if (!partTyreSizeKey) return true;
        const rowTyreSizeKey = extractTyreSizeKey(entry.row.haystack);
        return Boolean(rowTyreSizeKey) && rowTyreSizeKey === partTyreSizeKey;
      });
      const pool = (sizeMatchedPool.length > 0 ? sizeMatchedPool : tied).sort((a, b) => {
        const aToken = extractWheelPositionToken(a.row.haystack);
        const bToken = extractWheelPositionToken(b.row.haystack);
        const aRank = Object.prototype.hasOwnProperty.call(wheelTokenRank, aToken)
          ? wheelTokenRank[aToken]
          : 99;
        const bRank = Object.prototype.hasOwnProperty.call(wheelTokenRank, bToken)
          ? wheelTokenRank[bToken]
          : 99;
        if (aRank !== bRank) return aRank - bRank;
        return a.row.canonicalId.localeCompare(b.row.canonicalId);
      });
      if (pool.length === 0) return null;

      const allocationSignature = normaliseMatchText(
        [
          partTyreSizeKey,
          part?.part?.part_number,
          part?.part_number_snapshot,
          part?.part?.name,
          part?.part_name_snapshot,
        ]
          .filter(Boolean)
          .join(" ")
      );
      const signatureKey = allocationSignature || "legacy-tyre";
      const currentIndex = legacyTieAllocationCount.get(signatureKey) || 0;
      legacyTieAllocationCount.set(signatureKey, currentIndex + 1);
      return pool[currentIndex % pool.length].row.canonicalId;
    };

    // Build parts lookup by canonical vhc id for linking.
    const partsByVhcId = new Map();
    const addPartToLookup = (canonicalId, part) => {
      if (!canonicalId) return;
      if (!partsByVhcId.has(canonicalId)) partsByVhcId.set(canonicalId, []);
      partsByVhcId.get(canonicalId).push(part);
    };

    partsIdentified.forEach((part) => {
      const rawVhcId = part?.vhc_item_id ?? part?.vhcItemId ?? null;
      if (rawVhcId !== null && rawVhcId !== undefined && String(rawVhcId).trim() !== "") {
        addPartToLookup(String(resolveCanonicalVhcId(rawVhcId)), part);
        return;
      }

      // Legacy fallback: some historical VHC-origin parts were created without vhc_item_id.
      // Infer the row using part text signals so they still surface in Parts Identified.
      const origin = normalisePartStatus(part?.origin);
      if (!origin.includes("vhc")) return;
      const inferredCanonicalId = resolveLegacyPartVhcId(part);
      if (!inferredCanonicalId) return;
      addPartToLookup(String(inferredCanonicalId), part);
    });

    const displayItems = quoteItems.map((item) => {
      const canonicalId = String(resolveCanonicalVhcId(item.canonicalId || item.id));
      const linkedParts = partsByVhcId.get(canonicalId) || [];
      return {
        vhcItem: item,
        linkedParts,
        vhcId: String(item.id),
        canonicalVhcId: canonicalId,
      };
    });

    if (!displayItems || displayItems.length === 0) {
      return <EmptyStateMessage message="No VHC repairs have been recorded yet." />;
    }

    // ── Per-item decision-state classification (one status per VHC item) ──
    // add-part   → no part linked yet (and not flagged "not required")
    // awaiting   → part(s) added, item not yet authorised by the customer
    // authorised → authorised, but no part ordered or received yet
    // ordered    → at least one linked part is on order
    // here       → at least one linked part has arrived / been added to the job
    const isItemAuthorised = (vhcId, canonicalVhcId) => {
      const entry = getEntryForItem(vhcId);
      const decision = normaliseDecisionStatus(entry?.status);
      return (
        decision === "authorized" ||
        decision === "completed" ||
        authorizedViewIds.has(String(canonicalVhcId))
      );
    };
    const resolveItemPipelineStatus = (vhcId, canonicalVhcId, linkedParts, isNotRequired) => {
      const hasParts = Array.isArray(linkedParts) && linkedParts.length > 0;
      if (!hasParts && !isNotRequired) return "add-part";
      if (!isItemAuthorised(vhcId, canonicalVhcId)) return "awaiting";
      const partStatuses = (linkedParts || []).map((part) => getPartAuthorisedDisplayStatus(part));
      if (partStatuses.some((status) => status === AUTHORISED_PART_STATUS.ADDED_TO_JOB)) return "here";
      if (partStatuses.some((status) => status === AUTHORISED_PART_STATUS.ON_ORDER)) return "ordered";
      return "authorised";
    };

    // Enrich each display item with the fields the header + filters need.
    const enrichedItems = displayItems.map((item) => {
      const { vhcItem, linkedParts, vhcId, canonicalVhcId } = item;
      const severity = resolveRowSeverity(vhcItem);
      const isNotRequired = partsNotRequired.has(vhcId);
      const mappedPartsCost = Number(partsCostByVhcItem.get(canonicalVhcId || vhcId) || 0);
      const linkedPartsCost = (linkedParts || []).reduce((total, part) => {
        const qtyValue = Number(part?.quantity_requested);
        const qty = Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 1;
        const unitPrice = Number(part?.unit_price ?? part?.part?.unit_price ?? 0);
        if (!Number.isFinite(unitPrice)) return total;
        return total + qty * unitPrice;
      }, 0);
      const partsCost = isNotRequired ? 0 : mappedPartsCost > 0 ? mappedPartsCost : linkedPartsCost;
      const entry = getEntryForItem(vhcId);
      const labourCost = computeLabourCost(entry?.laborHours);
      const pipelineStatus = resolveItemPipelineStatus(vhcId, canonicalVhcId, linkedParts, isNotRequired);
      const searchText = normaliseMatchText(
        [
          vhcItem?.label,
          vhcItem?.notes,
          vhcItem?.concernText,
          vhcItem?.categoryLabel,
          vhcItem?.category?.label,
          ...(Array.isArray(vhcItem?.rows) ? vhcItem.rows : []),
          ...(linkedParts || []).map((part) => part?.part?.name),
          ...(linkedParts || []).map((part) => part?.part?.part_number),
        ]
          .filter(Boolean)
          .join(" ")
      );
      return { ...item, severity, partsCost, labourCost, pipelineStatus, searchText };
    });

    // ── Per-item decision grouping (drives sort + bottom-stacking) ──
    // Each row is classified by the customer's decision on the VHC item:
    //   authorised  → keep at the TOP
    //   in-progress → awaiting / not yet decided (middle)
    //   declined    → keep at the BOTTOM
    const classifiedItems = enrichedItems.map((it) => {
      const entry = getEntryForItem(it.vhcId);
      const entryDecision = normaliseDecisionStatus(entry?.status);
      const canonicalId = String(resolveCanonicalVhcId(it.vhcId));
      const declined = entryDecision === "declined";
      const authorised =
        !declined &&
        (entryDecision === "authorized" ||
          entryDecision === "completed" ||
          authorizedViewIds.has(canonicalId));
      const group = declined ? "declined" : authorised ? "authorised" : "in-progress";
      const groupRank = group === "authorised" ? 0 : group === "in-progress" ? 1 : 2;
      return { ...it, entryDecision, declined, authorised, group, groupRank };
    });

    // ── Live search (VHC item / part name / part number), then sort so
    // authorised rows sit at the top and declined fall to the bottom. ──
    const searchQuery = normaliseMatchText(partsIdentifiedSearch);
    const filteredItems = classifiedItems
      .filter((it) => !searchQuery || it.searchText.includes(searchQuery))
      .sort((a, b) => {
        if (a.groupRank !== b.groupRank) return a.groupRank - b.groupRank;
        const sevRank = (sev) => (sev === "red" ? 0 : sev === "amber" ? 1 : 2);
        if (sevRank(a.severity) !== sevRank(b.severity)) return sevRank(a.severity) - sevRank(b.severity);
        return String(a.vhcItem?.label || "").localeCompare(String(b.vhcItem?.label || ""));
      });

    const GROUP_HEADINGS = {
      authorised: "Authorised",
      "in-progress": "In Progress",
      declined: "Declined",
    };

    const controlStyle = {
      minHeight: "var(--control-height)",
      padding: "var(--control-padding)",
      borderRadius: "var(--control-radius)",
      background: "var(--control-bg)",
      color: "var(--text-1)",
      fontSize: "var(--control-font-size)",
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Parts search (staffglobal tokens) */}
        <div
          data-dev-section="1"
          data-dev-section-key="vhc-parts-header"
          data-dev-section-type="toolbar"
          data-dev-section-parent="vhc-parts-shell"
          style={{
            // Borderless, backgroundless layout container so the search controls
            // sit directly on the parent panel surface card
            // rather than inside a nested sub-card.
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Search box */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", alignItems: "end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <input
                type="search"
                className="app-input"
                value={partsIdentifiedSearch}
                onChange={(event) => setPartsIdentifiedSearch(event.target.value)}
                placeholder="Search VHC items, parts, part numbers…"
                style={controlStyle}
              />
            </label>
          </div>
        </div>

        {/* ── Items table ── */}
        <div
          data-dev-section="1"
          data-dev-section-key="vhc-parts-identified-card"
          data-dev-section-type="content-card"
          data-dev-section-parent="vhc-parts-identified-shell"
          style={{
            border: "none",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            overflow: "hidden",
          }}
        >
          {filteredItems.length === 0 ? (
            <EmptyStateMessage message="No VHC items match the current filters." />
          ) : (
          <div style={{ overflowX: "auto" }} data-dev-section="1" data-dev-section-key="vhc-parts-identified-scroll" data-dev-section-type="section-shell" data-dev-section-parent="vhc-parts-identified-card">
          {/* data-app-table-shell="off" opts this table out of the global
              GlobalTableShells classifier (src/components/App/GlobalTableShells.js).
              Without this, the auto-applied .app-table-shell--with-headings
              class sets `background: var(--surface) !important` on every <tr>,
              which beats the inline severity-tint set on the row. The scoped
              .vhc-parts-identified-table rules already supply the design we
              want. */}
          <table className="vhc-parts-identified-table" data-app-table-shell="off" data-dev-section="1" data-dev-section-key="vhc-parts-identified-table" data-dev-section-type="data-table" data-dev-section-parent="vhc-parts-identified-scroll">
            <thead data-dev-section="1" data-dev-section-key="vhc-parts-identified-table-headings" data-dev-section-type="table-headings" data-dev-section-parent="vhc-parts-identified-table">
              <tr>
                <th style={{ textAlign: "left", padding: "10px 12px", minWidth: "200px" }}>VHC Item</th>
                <th style={{ textAlign: "left", padding: "10px 12px", minWidth: "160px" }}>Part Details</th>
                <th style={{ textAlign: "center", padding: "10px 12px", minWidth: "120px" }}>Decision</th>
                <th style={{ textAlign: "center", padding: "10px 12px", minWidth: "100px" }}>Part Status</th>
                <th style={{ textAlign: "right", padding: "10px 12px", minWidth: "90px" }}>Parts Cost</th>
                <th style={{ textAlign: "center", padding: "10px 12px", minWidth: "150px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, idx) => {
                const { vhcItem, linkedParts, vhcId, canonicalVhcId, group, authorised, declined } = item;
                const isGroupStart = idx === 0 || filteredItems[idx - 1]?.group !== group;
                const isPartsNotRequired = partsNotRequired.has(vhcId);
                const hasParts = linkedParts.length > 0;
                const mappedPartsCost = Number(partsCostByVhcItem.get(canonicalVhcId || vhcId) || 0);
                const linkedPartsCost = linkedParts.reduce((total, part) => {
                  const qtyValue = Number(part?.quantity_requested);
                  const qty = Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 1;
                  const unitPrice = Number(part?.unit_price ?? part?.part?.unit_price ?? 0);
                  if (!Number.isFinite(unitPrice)) return total;
                  return total + qty * unitPrice;
                }, 0);
                const partsCost = isPartsNotRequired
                  ? 0
                  : mappedPartsCost > 0
                  ? mappedPartsCost
                  : linkedPartsCost;

                // VHC item details
                const vhcLabel = vhcItem?.label || "VHC Item";
                const vhcNotes = vhcItem?.notes || vhcItem?.concernText || "";
                // Use the same severity resolver as the row filter at the top of
                // this function so the two stay in lockstep. quoteLines.js puts
                // the colour on `line.severity` and on the raw DB row at
                // `vhcCheck.severity`/`display_status`; older code only looked at
                // `severityKey`/`rawSeverity`, so authorised/declined items in the
                // table came through as undefined and never picked up a tint.
                const vhcSeverity = resolveRowSeverity(vhcItem);
                const vhcCategory = vhcItem?.categoryLabel || vhcItem?.category?.label || "";
                const vhcRows = Array.isArray(vhcItem?.rows)
                  ? vhcItem.rows.map((row) => (row ? String(row).trim() : "")).filter(Boolean)
                  : [];
                const tyreMakeSizeDetail = resolveTyreMakeSizeDetail(vhcRows, vhcNotes);
                const vhcDetailText = tyreMakeSizeDetail || vhcNotes;
                const isServiceIndicatorRow = vhcItem?.category?.id === "service_indicator";
                const locationLabel = vhcItem?.location
                  ? LOCATION_LABELS[vhcItem.location] || vhcItem.location.replace(/_/g, " ")
                  : null;

                const isExpanded = expandedVhcItems.has(vhcId);

                // Check if row is locked (authorised, declined, or completed)
                const entry = getEntryForItem(vhcId);
                const entryDecision = normaliseDecisionStatus(entry.status);
                const canonicalId = resolveCanonicalVhcId(vhcId);
                const isLocked =
                  entryDecision === "authorized" ||
                  entryDecision === "declined" ||
                  entryDecision === "completed" ||
                  authorizedViewIds.has(String(canonicalId));
                const canAddPart = !isCustomerView && !readOnly && !isLocked;

                // Background tint by severity, then decision (keeps red/amber
                // visible across pending/authorised/declined in both themes).
                let rowBackground = "var(--surface)";
                let rowHoverBackground = "var(--theme)";

                if (vhcSeverity === "red" || vhcSeverity === "amber") {
                  rowBackground = SEVERITY_THEME[vhcSeverity]?.background || "var(--surface)";
                  rowHoverBackground = SEVERITY_THEME[vhcSeverity]?.hover || "var(--theme)";
                } else if (declined) {
                  rowBackground = "var(--danger-surface)";
                  rowHoverBackground = "var(--danger-surface-hover)";
                } else if (entryDecision === "completed") {
                  rowBackground = "var(--success-surface)";
                  rowHoverBackground = "var(--success-surface-hover)";
                }

                // Decision badge — the customer's decision on this VHC item.
                let decisionLabel;
                let decisionClass;
                if (declined) {
                  decisionLabel = "Declined";
                  decisionClass = "app-badge--danger";
                } else if (authorised) {
                  decisionLabel = "Authorised";
                  decisionClass = "app-badge--success";
                } else if (hasParts) {
                  decisionLabel = "Awaiting Response";
                  decisionClass = "app-badge--warning";
                } else {
                  decisionLabel = "Pending";
                  decisionClass = "app-badge--neutral";
                }

                // Physical part status (in stock / on order / here), derived from
                // the same engine the old Parts Authorised panel used.
                const partStatusKeys = linkedParts.map((part) => getPartAuthorisedDisplayStatus(part));
                let partStatusLabel = "—";
                let partStatusClass = "app-badge--neutral";
                if (hasParts) {
                  if (partStatusKeys.some((s) => s === AUTHORISED_PART_STATUS.ADDED_TO_JOB)) {
                    partStatusLabel = "Here";
                    partStatusClass = "app-badge--success";
                  } else if (partStatusKeys.some((s) => s === AUTHORISED_PART_STATUS.ON_ORDER)) {
                    partStatusLabel = "On Order";
                    partStatusClass = "app-badge--accent-soft";
                  } else if (linkedParts.some((part) => Number(part?.part?.qty_in_stock ?? part?.qty_in_stock ?? 0) > 0)) {
                    partStatusLabel = "In Stock";
                    partStatusClass = "app-badge--accent-soft";
                  } else {
                    partStatusLabel = "Awaiting";
                    partStatusClass = "app-badge--warning";
                  }
                }

                const addPartContext = {
                  label: vhcLabel,
                  detail: vhcNotes,
                  section: vhcItem?.sectionName || vhcItem?.categoryLabel || "",
                  rows: vhcItem?.rows || [],
                };

                return (
                  <React.Fragment key={vhcId}>
                  {isGroupStart && (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          padding: "8px 12px",
                          background: "var(--theme)",
                          color: "var(--text-1)",
                          fontWeight: 700,
                          fontSize: "11px",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        {GROUP_HEADINGS[group]}
                      </td>
                    </tr>
                  )}
                  <tr
                    onClick={() => handleVhcItemRowClick(vhcId)}
                    style={{
                      borderBottom: isExpanded ? "none" : "1px solid var(--separating-line)",
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
                    {/* VHC Item */}
                    <td style={{ padding: "10px 12px", wordBreak: "break-word" }}>
                      <div>
                        <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-1)" }}>
                          {vhcCategory}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-accent)", marginTop: "2px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          <span>{vhcLabel}</span>
                        </div>
                        {isServiceIndicatorRow && vhcRows.length > 0 ? (
                          <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
                            {vhcRows.map((row, rowIdx) => (
                              <div key={`${vhcId}-service-indicator-row-${rowIdx}`} style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-1)" }}>
                                - {row}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {vhcDetailText && (
                          <div style={{ fontSize: "12px", color: "var(--text-1)", marginTop: "4px" }}>
                            {vhcDetailText}
                          </div>
                        )}
                        {locationLabel && (
                          <div style={{ fontSize: "11px", color: "var(--text-1)", marginTop: "4px" }}>
                            Location: {locationLabel}
                          </div>
                        )}
                      </div>
                    </td>
                    {/* Part Details */}
                    <td style={{ padding: "10px 12px", wordBreak: "break-word" }}>
                      {hasParts ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {linkedParts.map((part) => (
                            <div key={part.id} style={{ fontSize: "12px", color: "var(--text-1)" }}>
                              <div style={{ fontWeight: 600, color: "var(--text-accent)" }}>
                                {part.part?.name || "Part"}
                              </div>
                              <div style={{ fontSize: "11px", color: "var(--text-1)" }}>
                                {part.part?.part_number || "—"} × {part.quantity_requested || 1}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: "12px", color: "var(--text-1)", fontStyle: "italic" }}>
                          No parts added yet
                        </div>
                      )}
                    </td>
                    {/* Decision */}
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <span className={`app-badge ${decisionClass}`}>{decisionLabel}</span>
                    </td>
                    {/* Part Status */}
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <span className={`app-badge ${partStatusClass}`}>{partStatusLabel}</span>
                    </td>
                    {/* Parts Cost */}
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: 700,
                          color: isPartsNotRequired ? "var(--info)" : "var(--primary)",
                          textDecoration: isPartsNotRequired ? "line-through" : "none",
                        }}
                      >
                        £{partsCost.toFixed(2)}
                      </div>
                    </td>
                    {/* Action */}
                    <td style={{ padding: "10px 12px", textAlign: "center" }} onClick={(event) => event.stopPropagation()}>
                      {isCustomerView || readOnly ? (
                        <span style={{ color: "var(--text-1)", fontSize: "12px" }}>—</span>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "stretch" }}>
                          {/* Authorised items: per-part order → here progression. */}
                          {authorised && hasParts && linkedParts.map((part) => {
                            const st = getPartAuthorisedDisplayStatus(part);
                            if (st === AUTHORISED_PART_STATUS.REMOVED) {
                              return (
                                <button key={`act-${part.id}`} type="button" disabled className="app-table-action-btn app-table-action-btn--danger" style={{ width: "100%" }}>
                                  Removed
                                </button>
                              );
                            }
                            if (st === AUTHORISED_PART_STATUS.ADDED_TO_JOB) {
                              return (
                                <button key={`act-${part.id}`} type="button" disabled className="app-table-action-btn" style={{ width: "100%" }}>
                                  Here ✓
                                </button>
                              );
                            }
                            if (st === AUTHORISED_PART_STATUS.ON_ORDER) {
                              return (
                                <button
                                  key={`act-${part.id}`}
                                  type="button"
                                  className="app-table-action-btn app-table-action-btn--primary"
                                  style={{ width: "100%" }}
                                  onClick={async () => {
                                    try {
                                      await handlePartStatusUpdate(part.id, { status: "booked", stockStatus: "in_stock" });
                                    } catch (error) {
                                      console.error(`[VHC] Failed to mark part ${part.id} as here:`, error);
                                      alert(`Failed to update part: ${error.message}`);
                                    }
                                  }}
                                >
                                  Mark Here
                                </button>
                              );
                            }
                            return (
                              <button
                                key={`act-${part.id}`}
                                type="button"
                                className="app-table-action-btn app-table-action-btn--primary"
                                style={{ width: "100%" }}
                                onClick={async () => {
                                  try {
                                    await handlePartStatusUpdate(part.id, { status: "on_order", authorised: true, stockStatus: "no_stock" });
                                  } catch (error) {
                                    console.error(`[VHC] Failed to order part ${part.id}:`, error);
                                    alert(`Failed to mark part as ordered: ${error.message}`);
                                  }
                                }}
                              >
                                Order
                              </button>
                            );
                          })}
                          {/* Add a part to this VHC item (disabled once locked). */}
                          {!declined && (
                            <button
                              type="button"
                              className="app-table-action-btn app-table-action-btn--primary"
                              style={{ width: "100%" }}
                              disabled={!canAddPart}
                              onClick={() => {
                                if (canAddPart) openAddPartsModal(vhcId, addPartContext);
                              }}
                              title={isLocked ? "Cannot add parts to authorised, declined or completed items" : "Add a part to this VHC item"}
                            >
                              Add Part
                            </button>
                          )}
                          {/* Mark "not required" when nothing has been linked yet. */}
                          {!hasParts && !isLocked && (
                            <button
                              type="button"
                              className="app-table-action-btn"
                              style={{ width: "100%" }}
                              onClick={() => handlePartsNotRequiredToggle(vhcId)}
                            >
                              {isPartsNotRequired ? "✓ Not Required" : "Not required?"}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Expandable Details Row */}
                  {isExpanded && (
                    <tr>
                      <td colSpan="6" style={{ padding: "0", borderBottom: "1px solid var(--separating-line)" }}>
                        <div
                          className="vhc-parts-identified-expanded"
                          data-dev-section="1"
                          data-dev-section-key={`vhc-parts-identified-expanded-${vhcId}`}
                          data-dev-section-type="content-card"
                          data-dev-section-parent="vhc-parts-identified-table"
                          style={{ background: rowHoverBackground }}
                        >
                          {/* Part Details Sections */}
                          {linkedParts.length === 0 ? (
                            <div style={{
                              padding: "24px",
                              borderRadius: "var(--radius-sm)",
                              background: "var(--theme)",
                              textAlign: "center",
                              color: "var(--text-1)",
                              fontSize: "13px",
                            }}>
                              No parts added yet.
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                              <div style={{ border: "none", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                                  <thead>
                                    <tr style={{ background: "var(--theme)", color: "var(--text-1)", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "10px" }}>
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
                                        <tr key={`${partKey}-summary`} style={{ borderBottom: "1px solid var(--separating-line)" }}>
                                          <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--text-accent)" }}>
                                            {partName}
                                          </td>
                                          <td style={{ padding: "10px 12px", color: "var(--text-1)" }}>
                                            {partDescription}
                                          </td>
                                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: "var(--text-accent)" }}>
                                            £{Number(costToCustomer || 0).toFixed(2)}
                                          </td>
                                          <td style={{ padding: "10px 12px", color: "var(--text-1)" }}>
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
          )}
        </div>
      </div>
    );
  }, [quoteSeverityLists, partsIdentified, partsNotRequired, partsCostByVhcItem, getEntryForItem, computeLabourCost, handlePartsNotRequiredToggle, handlePartStatusUpdate, handleVhcItemRowClick, expandedVhcItems, partDetails, handlePartDetailChange, isCustomerView, openAddPartsModal, readOnly, resolveCanonicalVhcId, authorizedViewIds, partsIdentifiedSearch]);

  // Render parts panel with table
  const renderPartsPanel = useCallback((title, parts, emptyMessage) => {
    if (!parts || parts.length === 0) {
      return <EmptyStateMessage message={emptyMessage} />;
    }

    const isAuthorisedSection = title === "Parts Authorised";
    const isOnOrderSection = title === "Parts On Order";

    return (
      <div
        style={{
          borderRadius: "var(--radius-md)",
          background: "var(--surface)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr
                style={{
                  background: "var(--theme)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--text-1)",
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
                    <th style={{ textAlign: "left", padding: "12px 16px", minWidth: "180px" }}>Picked Location</th>
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
                const prePickLabel = formatPrePickLocationLabel(prePickLocation);

                return (
                  <tr
                    key={partItem.id}
                    style={{
                      borderBottom: "1px solid var(--separating-line)",
                      background: "var(--surface)",
                    }}
                  >
                    <td style={{ padding: "12px 16px", color: "var(--text-accent)", fontWeight: 600 }}>
                      {part.name || "—"}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-1)" }}>
                      {part.part_number || "—"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", color: "var(--text-1)" }}>
                      {partItem.quantity_requested || 1}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--text-1)", fontWeight: 600 }}>
                      £{Number(price).toFixed(2)}
                    </td>
                    {isAuthorisedSection && (
                      <>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "var(--radius-pill)",
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
                        <td style={{ padding: "12px 16px", color: "var(--text-1)" }}>
                          {partItem.storage_location || "—"}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center", color: "var(--text-1)" }}>
                          {formatLabourHoursDisplay(partItem.labour_hours)}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div
                            className="app-input"
                            aria-label={`Picked location: ${prePickLabel}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              minHeight: "34px",
                              padding: "6px 10px",
                              fontSize: "var(--text-caption)",
                              lineHeight: 1.2,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              opacity: prePickLocation ? 1 : 0.72,
                            }}
                          >
                            {prePickLabel}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleAddToJobClick(partItem)}
                            disabled={readOnly}
                            style={{
                              padding: "8px 16px",
                              borderRadius: "var(--radius-xs)",
                              background: readOnly ? "var(--surface)" : "var(--primary)",
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
                        <td style={{ padding: "12px 16px", color: "var(--text-1)" }}>
                          {partItem.eta_date || "—"}
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-1)" }}>
                          {partItem.eta_time || "—"}
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-1)" }}>
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
                                    borderRadius: "var(--radius-xs)",
                                    border: "none",
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
                                    borderRadius: "var(--radius-xs)",
                                    border: "none",
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
                                  borderRadius: "var(--radius-xs)",
                                  border: "none",
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
    handleAddToJobClick,
    readOnly,
    handlePartArrived,
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
            role={fileType === "photo" ? "button" : undefined}
            tabIndex={fileType === "photo" ? 0 : undefined}
            onClick={fileType === "photo" ? () => handleOpenPhotoPreview(file) : undefined}
            onKeyDown={
              fileType === "photo"
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") handleOpenPhotoPreview(file);
                  }
                : undefined
            }
            style={{
              padding: "10px",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              background: "var(--surface)",
              cursor: fileType === "photo" ? "pointer" : "default",
            }}
          >
            {fileType === "photo" ? (
              <img
                src={file.file_url}
                alt="VHC photo"
                style={{
                  width: "100%",
                  height: "156px",
                  objectFit: "cover",
                  display: "block",
                  borderRadius: "var(--radius-sm)",
                }}
              />
            ) : (
              <video
                src={file.file_url}
                controls
                style={{
                  width: "100%",
                  height: "156px",
                  objectFit: "cover",
                  display: "block",
                  borderRadius: "var(--radius-sm)",
                }}
              />
            )}
            <div style={{ padding: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "8px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-accent)", fontWeight: 600, flex: 1 }}>
                  {""}
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
            </div>
          </div>
        ))}
      </div>
    );
  }, [handleOpenPhotoPreview]);

  // Video / Photo tab — request-grouped layout. A pinned "customer video" row
  // (the main end-of-check walkaround) always sits at the very top, followed by
  // a summary card (photo + video stat tiles + a top-level upload button), then
  // one row per request that has media. Each request row shows the concern
  // label, a status dot and a "X photos · Y videos" count on the left, with the
  // linked photo thumbnails and video previews on the right.
  const renderMediaTab = useCallback(() => {
    const MEDIA_TILE_HEIGHT = 156;
    const { groups, unlinkedPhotos, unlinkedVideos, mainVideos } = mediaLibrary;

    const statusColour = (status) =>
      status === "red"
        ? "var(--danger)"
        : status === "amber"
          ? "var(--warning)"
          : "var(--text-1)";

    // Severity → badge text + tone, mirroring the attachment's "Safety Critical /
    // Advisory / Monitor" chips. Driven purely by the status we already have.
    const severityBadge = (status) => {
      if (status === "red") return { label: "Safety Critical", color: "var(--danger)", bg: "var(--danger-surface)" };
      if (status === "amber") return { label: "Advisory", color: "var(--warning)", bg: "var(--warning-surface)" };
      if (status === "green") return { label: "Monitor", color: "var(--success)", bg: "var(--success-surface)" };
      return null;
    };

    // Small numbered chip overlaid on each thumbnail (top-left in the attachment).
    const renderThumbIndex = (index) => (
      <span
        style={{
          position: "absolute",
          top: "6px",
          left: "6px",
          minWidth: "18px",
          height: "18px",
          padding: "0 5px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "var(--radius-sm)",
          background: "var(--overlay)",
          color: "var(--text-2)",
          fontSize: "11px",
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {index + 1}
      </span>
    );

    const renderPhotoThumb = (file, index) => (
      <button
        type="button"
        key={file.file_id}
        onClick={() => handleOpenPhotoPreview(file)}
        title="Open photo preview"
        style={{
          position: "relative",
          height: `${MEDIA_TILE_HEIGHT}px`,
          width: `${MEDIA_TILE_HEIGHT}px`, // square — picture width matches its height
          flex: "0 0 auto", // fixed size so the strip overflows sideways instead of shrinking
          padding: 0,
          border: "none",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          background: "var(--surface)",
          cursor: "pointer",
        }}
      >
          <img
            src={file.file_url}
            alt="VHC photo"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          {renderThumbIndex(index)}
      </button>
    );

    const renderVideoThumb = (file, index) => {
      const saving = mainVideoSavingId === file.file_id;
      return (
        <figure
          key={file.file_id}
          style={{ margin: 0, width: `${Math.round(MEDIA_TILE_HEIGHT * 1.6)}px`, flex: "0 0 auto", display: "flex", flexDirection: "column", gap: "8px" }}
        >
          <div
            title="Video preview"
            style={{
              position: "relative",
              width: "100%",
              height: `${MEDIA_TILE_HEIGHT}px`,
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              background: "var(--surface)",
            }}
          >
            <video
              src={file.file_url}
              controls
              preload="metadata"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            {renderThumbIndex(index)}
          </div>
          {!readOnly ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => handleToggleMainVideo(file.file_id, true)}
                disabled={saving}
                style={{
                  padding: "4px 8px",
                  borderRadius: "var(--input-radius)",
                  border: "none",
                  background: "rgba(var(--primary-rgb), 0.10)",
                  color: "var(--primary-selected)",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: saving ? "wait" : "pointer",
                  opacity: saving ? 0.65 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {saving ? "Saving…" : "Set as main video"}
              </button>
            </div>
          ) : null}
        </figure>
      );
    };

    const renderRequestRow = (key, label, section, status, photos, videos) => {
      const badge = severityBadge(status);
      // Videos lead, then photos — numbered continuously across the strip.
      let mediaIndex = -1;
      return (
        <div
          key={key}
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            gap: "10px",
            background: "var(--theme)",
            borderRadius: "var(--radius-md)",
            padding: "10px",
            minHeight: `${MEDIA_TILE_HEIGHT + 20}px`,
          }}
        >
          {/* Left — the report/concern this set of media belongs to */}
          <div style={{ flex: "0 0 210px", minWidth: "180px", display: "flex", flexDirection: "column", gap: "10px", padding: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  aria-hidden="true"
                  style={{ width: "10px", height: "10px", borderRadius: "var(--radius-pill)", background: statusColour(status), flexShrink: 0 }}
                />
                <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-1)" }}>{label}</span>
              </div>
              {section ? (
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-1)", opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {section}
                </span>
              ) : null}
            </div>

            {badge ? (
              <span
                style={{
                  alignSelf: "flex-start",
                  padding: "3px 10px",
                  borderRadius: "var(--radius-pill)",
                  background: badge.bg,
                  color: badge.color,
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {badge.label}
              </span>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-1)", opacity: 0.7 }}>
                {photos.length} {photos.length === 1 ? "Photo" : "Photos"}
              </span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-1)", opacity: 0.7 }}>
                {videos.length} {videos.length === 1 ? "Video" : "Videos"}
              </span>
            </div>
          </div>

          {/* Vertical rule separating the concern info from its media strip */}
          <div aria-hidden="true" style={{ alignSelf: "stretch", borderLeft: "var(--separating-line)", flexShrink: 0 }} />

          {/* Right — the photos + videos taken for that request, in a horizontally
              scrolling thumbnail strip (overflows sideways instead of wrapping). */}
          <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", alignItems: "stretch", flexWrap: "nowrap", gap: "10px", overflowX: "auto", overflowY: "hidden", paddingBottom: "4px" }}>
            {videos.map((file) => { mediaIndex += 1; return renderVideoThumb(file, mediaIndex); })}
            {photos.map((file) => { mediaIndex += 1; return renderPhotoThumb(file, mediaIndex); })}
          </div>
        </div>
      );
    };

    const hasRequestMedia = groups.length > 0 || unlinkedPhotos.length > 0 || unlinkedVideos.length > 0;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Customer-facing main video — the end-of-check walkaround. Carries the
            same --theme surface chrome as the request media rows (radius-md,
            10px padding) so it follows their style. Left blank when no video. */}
        <div style={{ order: 2, display: "flex", flexDirection: "column", gap: "10px", background: "var(--theme)", borderRadius: "var(--radius-md)", padding: "10px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-1)" }}>Customer Video</h3>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-1)", opacity: 0.7 }}>
              Main walkaround taken at the end of the health check
            </span>
          </div>
          {mainVideos.length === 0 ? null : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "16px",
              }}
            >
              {mainVideos.map((file) => (
                <div
                  key={file.file_id}
                  style={{ borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--surface)" }}
                >
                  <video
                    src={file.file_url}
                    controls
                    preload="metadata"
                    style={{ width: "100%", height: "200px", objectFit: "cover", display: "block", background: "var(--surface)" }}
                  />
                  <div style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-1)", opacity: 0.7 }}>
                      {formatDateTime(file.uploaded_at)}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {file.visible_to_customer !== undefined && (
                        <span title={file.visible_to_customer ? "Visible to customer" : "Internal only"}>
                          {file.visible_to_customer ? "👁️" : "🔒"}
                        </span>
                      )}
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleToggleMainVideo(file.file_id, false)}
                          disabled={mainVideoSavingId === file.file_id}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "var(--input-radius)",
                            border: "none",
                            background: "rgba(var(--primary-rgb), 0.06)",
                            color: "var(--text-1)",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: mainVideoSavingId === file.file_id ? "wait" : "pointer",
                            opacity: mainVideoSavingId === file.file_id ? 0.65 : 1,
                          }}
                        >
                          {mainVideoSavingId === file.file_id ? "Saving…" : "Remove from main"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats + upload — no longer wrapped in its own surface card. The
            content now sits directly in the main media tab area (per request).
            Single row: equal-width stat tiles kept to the left, Upload Media
            button pushed to the far right. order: 1 keeps it above the
            Customer Video card (order: 2). */}
        {/* One row per request that has media, plus any unlinked photos.
            order: 3 keeps this below the summary (1) and customer video (2). */}
        <div style={{ order: 3, display: "flex", flexDirection: "column", gap: "12px" }}>
          {!hasRequestMedia ? (
            <EmptyStateMessage message="No photos or videos have been linked to a request." />
          ) : (
            <>
              {groups.map((group) =>
                renderRequestRow(group.key, group.label, group.section, group.status, group.photos, group.videos),
              )}
              {(unlinkedPhotos.length > 0 || unlinkedVideos.length > 0) &&
                renderRequestRow("__unlinked__", "Unlinked media", "", "", unlinkedPhotos, unlinkedVideos)}
            </>
          )}
        </div>
      </div>
    );
  }, [mediaLibrary, readOnly, handleToggleMainVideo, handleOpenPhotoPreview, mainVideoSavingId]);

  if (!resolvedJobNumber) {
    return renderStatusMessage("Provide a job number to view VHC details.");
  }

  if (loading) {
    // Shell-first skeleton: render a structured placeholder that matches the
    // VHC details panel shape (header summary + section blocks) so the panel
    // never collapses to empty while data fetches.
    return (
      <div style={{ padding: containerPadding, display: "flex", flexDirection: "column", gap: 14 }}>
        <SkeletonKeyframes />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                background: "var(--surface)",
                borderRadius: "var(--radius-md)",
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <SkeletonBlock width="60%" height="10px" />
              <SkeletonBlock width="80%" height="20px" />
              <SkeletonBlock width="50%" height="10px" />
            </div>
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-md)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <SkeletonBlock width="35%" height="14px" />
            <SkeletonBlock width="100%" height="12px" />
            <SkeletonBlock width="90%" height="12px" />
            <SkeletonBlock width="65%" height="12px" />
          </div>
        ))}
      </div>
    );
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
        <div style={{ fontSize: "12px", color: "var(--text-1)", textTransform: "uppercase", letterSpacing: "0.16em" }}>Job</div>
        <div style={{ fontSize: "20px", fontWeight: 700 }}>{job?.job_number || "—"}</div>
      </div>
      <div>
        <div style={{ fontSize: "12px", color: "var(--text-1)", textTransform: "uppercase", letterSpacing: "0.16em" }}>Reg</div>
        <div style={{ fontSize: "20px", fontWeight: 700 }}>{getVehicleRegistration(job?.vehicle) || job?.vehicle_reg || "—"}</div>
      </div>
      <div>
        <div style={{ fontSize: "12px", color: "var(--text-1)", textTransform: "uppercase", letterSpacing: "0.16em" }}>Customer</div>
        <div style={{ fontSize: "15px", fontWeight: 600 }}>{customerName}</div>
      </div>
      <div>
        <div style={{ fontSize: "12px", color: "var(--text-1)", textTransform: "uppercase", letterSpacing: "0.16em" }}>Mileage</div>
        <div style={{ fontSize: "15px", fontWeight: 600 }}>{pickMileageValue(job?.vehicle?.mileage, job?.mileage, job?.milage) ? `${pickMileageValue(job?.vehicle?.mileage, job?.mileage, job?.milage)} mi` : "—"}</div>
      </div>
      <div>
        <div style={{ fontSize: "12px", color: "var(--text-1)", textTransform: "uppercase", letterSpacing: "0.16em" }}>Submitted</div>
        <div style={{ fontSize: "15px", fontWeight: 600 }}>{formatDateTime(workflow?.vhc_sent_at || workflow?.last_sent_at || job?.created_at)}</div>
      </div>
      <div style={{ justifySelf: "end" }}>
        <span
          style={{
            padding: "6px 12px",
            borderRadius: "var(--radius-pill)",
            background: "var(--primary)",
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
    <div
      style={pageWrapperStyle}
      data-dev-auto-outline={devOverlayAutoOutline ? "cards" : undefined}
      data-dev-page={devOverlayPageContext || undefined}
      data-dev-tab={devOverlayTabContext || undefined}
      data-dev-card-section={devOverlayCardContext || undefined}
      data-dev-active-tab={activeTab}
      data-dev-active-tab-label={activeTabLabel || undefined}
    >
      {showNavigation && (
        <div style={PANEL_SECTION_STYLE}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => router.push("/jobs")}
                style={{
                borderRadius: "var(--input-radius)",
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
                    reg: getVehicleRegistration(job?.vehicle),
                    customer: job?.customer?.name || `${job?.customer?.firstname || ""} ${job?.customer?.lastname || ""}`.trim() || "",
                    makeModel: job?.vehicle?.make_model || `${job?.vehicle?.make || ""} ${job?.vehicle?.model || ""}`.trim() || "",
                    colour: job?.vehicle?.colour || "",
                    openPopup: "true"
                  });
                  router.push(`/tracking?${params.toString()}`);
                }}
                style={{
                  borderRadius: "var(--input-radius)",
                  padding: "8px 18px",
                  background: "var(--primary)",
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
                  borderRadius: "var(--input-radius)",
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }} data-dev-section="1" data-dev-section-key="vhc-tabs-row" data-dev-section-type="toolbar">
              <nav
                className="tab-api"
                aria-label="VHC tabs"
                data-dev-section="1"
                data-dev-section-key="vhc-tabs-nav"
                data-dev-section-type="toolbar"
                data-dev-section-parent="vhc-tabs-row"
              >
                {TAB_OPTIONS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`tab-api__item${isActive ? " is-active" : ""}`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
              {activeTab === "parts" && vhcPartsToolbarMoneyTiles.length > 0 ? (
                <div
                  data-dev-section="1"
                  data-dev-section-key="vhc-parts-toolbar-money"
                  data-dev-section-type="toolbar"
                  data-dev-section-parent="vhc-tabs-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(112px, 1fr))",
                    gap: "8px",
                    flex: "1 1 560px",
                    minWidth: 0,
                    maxWidth: "720px",
                    overflowX: "auto",
                  }}
                >
                  {vhcPartsToolbarMoneyTiles.map((tile) => (
                    <div
                      key={tile.key}
                      className="app-layout-stat-card"
                      style={{
                        alignItems: "flex-start",
                        gap: "2px",
                        minHeight: "auto",
                        padding: "6px 10px",
                      }}
                    >
                      <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-1)" }}>
                        {tile.label}
                      </span>
                      <span style={{ fontSize: "14px", fontWeight: 800, color: tile.tone, lineHeight: 1.1 }}>
                        {tile.value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {activeTab === "media" ? (
                <div
                  data-dev-section="1"
                  data-dev-section-key="vhc-media-toolbar-stats"
                  data-dev-section-type="toolbar"
                  data-dev-section-parent="vhc-tabs-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(112px, 128px))",
                    justifyContent: "center",
                    gap: "8px",
                    flex: "1 1 420px",
                    minWidth: 0,
                  }}
                >
                  {vhcMediaToolbarStatTiles.map((tile) => (
                    <div
                      key={tile.label}
                      className="app-layout-stat-card"
                      style={{
                        alignItems: "flex-start",
                        gap: "2px",
                        minHeight: "auto",
                        padding: "6px 10px",
                      }}
                    >
                      <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-1)", lineHeight: 1.1 }}>
                        {tile.value}
                      </span>
                      <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-1)", opacity: 0.7, whiteSpace: "nowrap" }}>
                        {tile.label}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {activeTab === "media" && !readOnly ? (
                <div
                  data-dev-section="1"
                  data-dev-section-key="vhc-media-toolbar-upload"
                  data-dev-section-type="toolbar"
                  data-dev-section-parent="vhc-tabs-row"
                  style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginLeft: "auto" }}
                >
                  {photoUploadError ? (
                    <span role="alert" style={{ fontSize: "12px", fontWeight: 600, color: "var(--danger)" }}>
                      {photoUploadError}
                    </span>
                  ) : null}
                  <input
                    ref={photoUploadInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoTabUpload}
                    style={{ display: "none" }}
                  />
                  <button
                    type="button"
                    onClick={() => photoUploadInputRef.current?.click()}
                    disabled={photoUploading}
                    style={{
                      padding: "8px 18px",
                      borderRadius: "var(--input-radius)",
                      border: "none",
                      background: "var(--primary)",
                      color: "var(--text-2)",
                      fontWeight: 600,
                      fontSize: "var(--control-font-size)",
                      minHeight: "var(--control-height)",
                      cursor: photoUploading ? "wait" : "pointer",
                      opacity: photoUploading ? 0.65 : 1,
                    }}
                  >
                    {photoUploading ? "Uploading..." : "Upload Media"}
                  </button>
                </div>
              ) : null}
              {customActions && (
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {typeof customActions === "function" ? customActions(activeTab) : customActions}
                </div>
              )}
            </div>
            <div
              style={TAB_CONTENT_STYLE}
              data-dev-section="1"
              data-dev-section-key="vhc-tab-content"
              data-dev-section-type="section-shell"
              data-dev-active-tab={activeTab}
              data-dev-active-tab-label={activeTabLabel || undefined}
            >
              {activeTab === "summary" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} data-dev-section="1" data-dev-section-key="vhc-summary-stack" data-dev-section-type="section-shell" data-dev-section-parent="vhc-tab-content">
                {/* Top summary bar: item counts (+ £) and parts pipeline counts */}
                {(() => {
                  const redItems = quoteSeverityLists.red || [];
                  const amberItems = quoteSeverityLists.amber || [];
                  const sumTotal = (list) =>
                    list.reduce((sum, it) => sum + Number(it.total_gbp ?? it.total ?? 0), 0);
                  const partsRequired = (() => {
                    const numbers = new Set();
                    requiredPartNumbersByVhcItem.forEach((set) => set.forEach((n) => numbers.add(n)));
                    return numbers.size;
                  })();
                  const tiles = [
                    { key: "red", label: "Red Items", count: redItems.length, value: sumTotal(redItems), color: "var(--danger)", bg: "var(--danger-surface)" },
                    { key: "amber", label: "Amber Items", count: amberItems.length, value: sumTotal(amberItems), color: "var(--warning)", bg: "var(--warning-surface)" },
                    { key: "green", label: "Green Items", count: (greenItems || []).length, value: null, color: "var(--success)", bg: "var(--success-surface)" },
                    { key: "req", label: "Parts Required", count: partsRequired, value: null, color: "var(--text-accent)", bg: "var(--theme)" },
                    { key: "ord", label: "Parts Ordered", count: (partsOnOrder || []).length, value: null, color: "var(--text-accent)", bg: "var(--theme)" },
                    { key: "booked", label: "Parts Booked", count: bookedPartNumbers ? bookedPartNumbers.size : 0, value: null, color: "var(--text-accent)", bg: "var(--theme)" },
                    // Media counts mirror the Video / Photo tab stats so the top
                    // summary bar surfaces how much media exists at a glance.
                    { key: "photos", label: "Photos", count: photoFiles.length, value: null, color: "var(--text-accent)", bg: "var(--theme)" },
                    { key: "videos", label: "Videos", count: videoFiles.length, value: null, color: "var(--text-accent)", bg: "var(--theme)" },
                  ];
                  return (
                    <div
                      data-dev-section="1"
                      data-dev-section-key="vhc-summary-tiles"
                      data-dev-section-type="toolbar"
                      data-dev-section-parent="vhc-summary-stack"
                      style={{
                        display: "grid",
                        gridAutoFlow: "column",
                        gridAutoColumns: "minmax(96px, 1fr)",
                        gap: "8px",
                        overflowX: "auto",
                        paddingBottom: "2px",
                      }}
                    >
                      {tiles.map((tile) => (
                        <div
                          key={tile.key}
                          style={{
                            background: tile.bg,
                            borderRadius: "var(--radius-md)",
                            padding: "10px 12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            minWidth: 0,
                          }}
                        >
                          <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: tile.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {tile.label}
                          </span>
                          <span style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-accent)", lineHeight: 1 }}>
                            {tile.count}
                          </span>
                          {tile.value !== null && tile.value > 0 ? (
                            <span style={{ fontSize: "12px", fontWeight: 600, color: tile.color, whiteSpace: "nowrap" }}>
                              {formatCurrency(tile.value)}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Body split 70 / 30: working tables (left) and outcomes (right) */}
                <div
                  data-dev-section="1"
                  data-dev-section-key="vhc-summary-split"
                  data-dev-section-type="section-shell"
                  data-dev-section-parent="vhc-summary-stack"
                  style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "var(--page-stack-gap)" }}
                >
                <div
                  data-dev-section="1"
                  data-dev-section-key="vhc-summary-working"
                  data-dev-section-type="section-shell"
                  data-dev-section-parent="vhc-summary-split"
                  style={{ flex: "7 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: "24px" }}
                >
                {/* Only show Red/Amber sections if there are pending items */}
                {["red", "amber"].map((severity) => {
                    const items = quoteSeverityLists[severity] || [];
                    if (items.length === 0) return null;
                    const meta = SEVERITY_META[severity];
                    const severityTheme = SEVERITY_THEME[severity] || { border: "none", background: "var(--danger-surface)" };

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
                      if (decisionKey === "authorized" || decisionKey === "completed") {
                        authorisedTotal += finalTotal;
                      } else if (decisionKey === "declined") {
                        declinedTotal += finalTotal;
                      }
                    });

                    return (
                      <div
                        key={severity}
                        data-dev-section="1"
                        data-dev-section-key={`vhc-summary-${severity}-section`}
                        data-dev-section-type="content-card"
                        data-dev-section-parent="vhc-summary-stack"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "18px",
                          border: "none",
                          borderRadius: "var(--radius-lg)",
                          padding: "20px",
                          background: severityTheme.background,
                        }}
                      >
                        <div
                          style={{
                            paddingBottom: "10px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
                              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: meta.accent }}>{meta.title}</h2>
                              {selectedSet.size > 0 && (
                                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-1)" }}>
                                  Selected: £{selectedTotal.toFixed(2)}
                                </span>
                              )}
                              {authorisedTotal > 0 && (
                                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--authorised)" }}>
                                  Authorised: £{authorisedTotal.toFixed(2)}
                                </span>
                              )}
                              {declinedTotal > 0 && (
                                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--danger)" }}>
                                  Declined: £{declinedTotal.toFixed(2)}
                                </span>
                              )}
                              {meta.description ? (
                                <p style={{ margin: 0, color: "var(--text-1)", flexBasis: "100%" }}>{meta.description}</p>
                              ) : null}
                            </div>
                            {renderSectionBulkActions(severity, items)}
                          </div>
                        </div>
                        {renderSeverityTable(severity, items)}
                      </div>
                    );
                  })}

                  {greenItems.length > 0 && (
                    <div
                      data-dev-section="1"
                      data-dev-section-key="vhc-summary-greenchecks-section"
                      data-dev-section-type="content-card"
                      data-dev-section-parent="vhc-summary-stack"
                      style={{
                        border: "none",
                        borderRadius: "var(--radius-lg)",
                        padding: "20px",
                        background: "var(--success-surface)",

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
                                borderRadius: "var(--radius-md)",
                                background: "var(--surface)",
                                border: "none",
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
                                  color: "var(--text-1)",
                                }}
                              >
                                {item.category?.label || item.sectionName}
                              </span>
                              <div style={{ fontWeight: 700, color: "var(--text-accent)", fontSize: "14px" }}>
                                {item.label}
                              </div>
                              {item.notes ? (
                                <div style={{ fontSize: "12px", color: "var(--text-1)" }}>{item.notes}</div>
                              ) : null}
                              {item.measurement ? (
                                <div style={{ fontSize: "12px", color: "var(--text-1)" }}>{item.measurement}</div>
                              ) : null}
                              {locationLabel ? (
                                <div style={{ fontSize: "12px", color: "var(--text-1)" }}>Location: {locationLabel}</div>
                              ) : null}
                              {item.spec?.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px", color: "var(--text-1)" }}>
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
                {/* Right 30%: compact outcomes panel (Approved + Declined) */}
                {(() => {
                  const approvedItems = quoteSeverityLists.authorized || [];
                  const completedItems = quoteSeverityLists.completed || [];
                  const declinedItems = quoteSeverityLists.declined || [];
                  const computeItemCosts = (item) => {
                    const entry = getEntryForItem(item.id);
                    const quoteParts = Number.isFinite(Number(item.parts_gbp)) ? Number(item.parts_gbp) : null;
                    const quoteLabourHours = Number.isFinite(Number(item.labour_hours)) ? Number(item.labour_hours) : null;
                    const quoteLabourRate = Number.isFinite(Number(item.labour_rate_gbp)) ? Number(item.labour_rate_gbp) : LABOUR_RATE;
                    const quoteTotal = Number.isFinite(Number(item.total_gbp)) ? Number(item.total_gbp) : null;
                    const partsCost = quoteParts !== null ? quoteParts : resolvePartsCost(item.id, entry);
                    const hasLocal = entry?.laborHours !== null && entry?.laborHours !== undefined;
                    const resolvedLabourHours = hasLocal
                      ? String(entry.laborHours)
                      : quoteLabourHours !== null
                        ? String(quoteLabourHours)
                        : resolveLabourHoursValue(item.id, entry);
                    const labourCost = quoteLabourHours !== null
                      ? quoteLabourHours * quoteLabourRate
                      : computeLabourCost(resolvedLabourHours);
                    const totalCost = quoteTotal !== null
                      ? quoteTotal
                      : computeRowTotal(entry, partsCost, resolvedLabourHours);
                    return {
                      partsCost: Number(partsCost) || 0,
                      labourCost: Number(labourCost) || 0,
                      totalCost: Number(totalCost) || 0,
                    };
                  };
                  const sumBlock = (list) =>
                    list.reduce(
                      (acc, item) => {
                        const c = computeItemCosts(item);
                        acc.parts += c.partsCost;
                        acc.labour += c.labourCost;
                        return acc;
                      },
                      { parts: 0, labour: 0 }
                    );
                  const btnBase = {
                    padding: "6px 10px",
                    borderRadius: "var(--input-radius)",
                    fontWeight: 600,
                    fontSize: "12px",
                    minHeight: "32px",
                  };
                  const renderOutcomeRow = (item, kind) => {
                    const { partsCost, labourCost, totalCost } = computeItemCosts(item);
                    const label = item.label || item.sectionName || "Recorded item";
                    const completeBlock =
                      kind === "approved" ? getCompletionPartBlockReason(item.id) : "";
                    // Reset target: completed rows step back to Approved; approved/declined
                    // rows step back to their original Red/Amber state (pending).
                    const resetStatus = kind === "completed" ? "authorized" : null;
                    return (
                      <div
                        key={item.id}
                        style={{
                          // Approved / Complete / Declined rows always sit on the plain surface colour
                          background: "var(--surface)",
                          borderRadius: "var(--radius-sm)",
                          padding: "10px 12px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "baseline" }}>
                          <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-accent)" }}>{label}</span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", fontSize: "12px", color: "var(--text-1)" }}>
                          <span>Parts {formatCurrency(partsCost)}</span>
                          <span>Labour {formatCurrency(labourCost)}</span>
                          <span style={{ fontWeight: 700, color: "var(--text-accent)" }}>Total {formatCurrency(totalCost)}</span>
                        </div>
                        {!readOnly ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => updateEntryStatus(item.id, resetStatus)}
                              style={{
                                ...btnBase,
                                border: "1px solid var(--ghostbutton-ring)",
                                background: "var(--surface)",
                                color: "var(--text-accent)",
                                cursor: "pointer",
                              }}
                            >
                              Reset
                            </button>
                            {kind === "approved" ? (
                              <button
                                type="button"
                                onClick={() => updateEntryStatus(item.id, "completed")}
                                disabled={Boolean(completeBlock)}
                                title={completeBlock || undefined}
                                style={{
                                  ...btnBase,
                                  border: "none",
                                  background: completeBlock ? "var(--complete-surface)" : "var(--complete)",
                                  color: completeBlock ? "var(--complete)" : "white",
                                  cursor: completeBlock ? "not-allowed" : "pointer",
                                }}
                              >
                                Complete
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  };
                  const approvedTotals = sumBlock(approvedItems);
                  const completedTotals = sumBlock(completedItems);
                  const declinedTotals = sumBlock(declinedItems);
                  return (
                    <div
                      data-dev-section="1"
                      data-dev-section-key="vhc-summary-outcomes"
                      data-dev-section-type="section-shell"
                      data-dev-section-parent="vhc-summary-split"
                      style={{ flex: "3 1 280px", minWidth: "260px", display: "flex", flexDirection: "column", gap: "18px" }}
                    >
                      <div
                        data-dev-section="1"
                        data-dev-section-key="vhc-summary-approved-section"
                        data-dev-section-type="content-card"
                        data-dev-section-parent="vhc-summary-outcomes"
                        style={{
                          background: "var(--authorised-surface)",
                          borderRadius: "var(--radius-lg)",
                          padding: "16px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--authorised)" }}>Approved</h2>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-1)" }}>
                            Parts {formatCurrency(approvedTotals.parts)} · Labour {formatCurrency(approvedTotals.labour)}
                          </span>
                        </div>
                        {approvedItems.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {approvedItems.map((item) => renderOutcomeRow(item, "approved"))}
                          </div>
                        ) : (
                          <span style={{ fontSize: "12px", color: "var(--text-1)" }}>No approved items yet.</span>
                        )}
                      </div>
                      <div
                        data-dev-section="1"
                        data-dev-section-key="vhc-summary-complete-section"
                        data-dev-section-type="content-card"
                        data-dev-section-parent="vhc-summary-outcomes"
                        style={{
                          background: "var(--complete-surface)",
                          borderRadius: "var(--radius-lg)",
                          padding: "16px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--complete)" }}>Complete</h2>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-1)" }}>
                            Parts {formatCurrency(completedTotals.parts)} · Labour {formatCurrency(completedTotals.labour)}
                          </span>
                        </div>
                        {completedItems.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {completedItems.map((item) => renderOutcomeRow(item, "completed"))}
                          </div>
                        ) : (
                          <span style={{ fontSize: "12px", color: "var(--text-1)" }}>No completed items yet.</span>
                        )}
                      </div>
                      <div
                        data-dev-section="1"
                        data-dev-section-key="vhc-summary-declined-section"
                        data-dev-section-type="content-card"
                        data-dev-section-parent="vhc-summary-outcomes"
                        style={{
                          background: "var(--declined-section-bg)",
                          borderRadius: "var(--radius-lg)",
                          padding: "16px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--danger)" }}>Declined</h2>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-1)" }}>
                            Parts {formatCurrency(declinedTotals.parts)} · Labour {formatCurrency(declinedTotals.labour)}
                          </span>
                        </div>
                        {declinedItems.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {declinedItems.map((item) => renderOutcomeRow(item, "declined"))}
                          </div>
                        ) : (
                          <span style={{ fontSize: "12px", color: "var(--text-1)" }}>No declined items yet.</span>
                        )}
                      </div>
                    </div>
                  );
                })()}
                </div>
                </div>
              )}

              {activeTab === "health-check" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }} data-dev-section="1" data-dev-section-key="vhc-healthcheck-stack" data-dev-section-type="section-shell" data-dev-section-parent="vhc-tab-content">
                  <div
                    data-dev-section="1"
                    data-dev-section-key="vhc-healthcheck-status-row"
                    data-dev-section-type="toolbar"
                    data-dev-section-parent="vhc-healthcheck-stack"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "16px",
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: "240px" }}>
                      {!hasHealthData ? (
                        <div
                          style={{
                            borderRadius: "var(--radius-md)",
                            padding: "20px",
                            background: "var(--theme)",
                            color: "var(--text-accent)",
                            fontSize: "13px",
                            textAlign: "center",
                          }}
                        >
                          VHC has not been started yet.
                        </div>
                      ) : null}
                    </div>
                    {sectionSaveMessage ? (
                      <span style={{ fontSize: "12px", fontWeight: 600, color: sectionSaveColor }}>
                        {sectionSaveMessage}
                      </span>
                    ) : null}
                  </div>

                  {(() => {
                    // Wheels & Tyres and Brakes & Hubs each take a full-width row at
                    // the top. The remaining sections are paired into grouping cards:
                    // Service Indicator & Under Bonnet + External share one card (50/50),
                    // Internal + Underside share another (50/50). Each pair collapses to
                    // a single column on mobile.
                    const leadKeys = ["wheelsTyres", "brakesHubs"];
                    const groupedPairs = [
                      ["serviceIndicator", "externalInspection"],
                      ["internalElectrics", "underside"],
                    ];
                    const findSection = (key) =>
                      orderedHealthSections.find(({ config }) => config.key === key);
                    const leadSections = orderedHealthSections.filter(({ config }) => leadKeys.includes(config.key));
                    return (
                      <>
                        {leadSections.map(({ config, data, rawData }) => (
                          <HealthSectionCard
                            key={config.key}
                            config={config}
                            section={data}
                            rawData={rawData}
                            onOpen={handleOpenSection}
                          />
                        ))}
                        {groupedPairs.map((pairKeys, groupIdx) => {
                          const pairSections = pairKeys.map(findSection).filter(Boolean);
                          if (pairSections.length === 0) return null;
                          return (
                            <HealthSectionPair
                              key={`vhc-healthcheck-pair-${groupIdx}`}
                              sections={pairSections}
                              onOpen={handleOpenSection}
                            />
                          );
                        })}
                      </>
                    );
                  })()}

                </div>
              )}

              {activeTab === "parts" && (
                <div id="parts" data-dev-section="1" data-dev-section-key="vhc-parts-shell" data-dev-section-type="section-shell" data-dev-section-parent="vhc-tab-content">
                  {renderVhcPartsPanel()}
                </div>
              )}


              {activeTab === "media" && (
                <div data-dev-section="1" data-dev-section-key="vhc-media-shell" data-dev-section-type="section-shell" data-dev-section-parent="vhc-tab-content">
                  {renderMediaTab()}
                </div>
              )}
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
                  const severityTheme = SEVERITY_THEME[severity] || { border: "none", background: "var(--danger-surface)" };

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
                        gap: "18px",
                        border: "none",
                        borderRadius: "var(--radius-lg)",
                        padding: "20px",
                        background: severityTheme.background,
                      }}
                    >
                      <div
                        style={{
                          paddingBottom: "10px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
                            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: meta.accent }}>{meta.title}</h2>
                            {selectedSet.size > 0 && (
                              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-1)" }}>
                                Selected: £{selectedTotal.toFixed(2)}
                              </span>
                            )}
                            {authorisedTotal > 0 && (
                              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--authorised)" }}>
                                Authorised: £{authorisedTotal.toFixed(2)}
                              </span>
                            )}
                            {declinedTotal > 0 && (
                              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--danger)" }}>
                                Declined: £{declinedTotal.toFixed(2)}
                              </span>
                            )}
                            {meta.description ? (
                              <p style={{ margin: 0, color: "var(--text-1)", flexBasis: "100%" }}>{meta.description}</p>
                            ) : null}
                          </div>
                          {renderSectionBulkActions(severity, items)}
                        </div>
                      </div>
                      {renderSeverityTable(severity, items)}
                    </div>
                  );
                })}

                {/* Authorised section - show if there are authorized items (in-progress) */}
                {quoteSeverityLists.authorized && quoteSeverityLists.authorized.length > 0 && (
                  <div
                    style={{
                      border: "none",
                      borderRadius: "var(--radius-lg)",
                      padding: "20px",
                      background: "var(--authorised-surface)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "18px",
                    }}
                  >
                    <div style={{ paddingBottom: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
                          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--authorised)" }}>Authorised</h2>
                          {(() => {
                            const authorisedOnlyTotal = (quoteSeverityLists.authorized || []).reduce(
                              (sum, item) => sum + Number(item.total_gbp ?? item.total ?? 0),
                              0
                            );
                            return authorisedOnlyTotal > 0 ? (
                              <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--authorised)" }}>
                                {formatCurrency(authorisedOnlyTotal)}
                              </span>
                            ) : null;
                          })()}
                        </div>
                        {renderSectionBulkActions("authorized", quoteSeverityLists.authorized)}
                      </div>
                    </div>
                    {renderSeverityTable("authorized", quoteSeverityLists.authorized)}
                  </div>
                )}

                {/* Complete section - rows from Authorised that are now completed */}
                {quoteSeverityLists.completed && quoteSeverityLists.completed.length > 0 && (
                  <div
                    style={{
                      border: "none",
                      borderRadius: "var(--radius-lg)",
                      padding: "20px",
                      background: "var(--complete-surface)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "18px",
                    }}
                  >
                    <div style={{ paddingBottom: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
                          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--complete)" }}>Complete</h2>
                          {(() => {
                            const completedTotal = (quoteSeverityLists.completed || []).reduce(
                              (sum, item) => sum + Number(item.total_gbp ?? item.total ?? 0),
                              0
                            );
                            return completedTotal > 0 ? (
                              <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--complete)" }}>
                                {formatCurrency(completedTotal)}
                              </span>
                            ) : null;
                          })()}
                        </div>
                        {renderSectionBulkActions("completed", quoteSeverityLists.completed)}
                      </div>
                    </div>
                    {renderSeverityTable("completed", quoteSeverityLists.completed)}
                  </div>
                )}

                {/* Declined section - show if there are declined items */}
                {quoteSeverityLists.declined && quoteSeverityLists.declined.length > 0 && (
                  <div
                    style={{
                      border: "none",
                      borderRadius: "var(--radius-lg)",
                      padding: "20px",
                      background: "var(--declined-section-bg)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "18px",
                    }}
                  >
                    <div style={{ paddingBottom: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
                          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--danger)" }}>Declined</h2>
                          {quoteTotals.declined > 0 && (
                            <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--danger)" }}>
                              {formatCurrency(quoteTotals.declined)}
                            </span>
                          )}
                        </div>
                        {renderSectionBulkActions("declined", quoteSeverityLists.declined)}
                      </div>
                    </div>
                    {renderSeverityTable("declined", quoteSeverityLists.declined)}
                  </div>
                )}

                {greenItems.length > 0 && (
                  <div
                    style={{
                      border: "none",
                      borderRadius: "var(--radius-lg)",
                      padding: "20px",
                      background: "var(--success-surface)",
                    
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
                              borderRadius: "var(--radius-md)",
                              background: "var(--surface)",
                              border: "none",
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
                                color: "var(--text-1)",
                              }}
                            >
                              {item.category?.label || item.sectionName}
                            </span>
                            <div style={{ fontWeight: 700, color: "var(--text-accent)", fontSize: "14px" }}>
                              {item.label}
                            </div>
                            {item.notes ? (
                              <div style={{ fontSize: "12px", color: "var(--text-1)" }}>{item.notes}</div>
                            ) : null}
                            {item.measurement ? (
                              <div style={{ fontSize: "12px", color: "var(--text-1)" }}>{item.measurement}</div>
                            ) : null}
                            {locationLabel ? (
                              <div style={{ fontSize: "12px", color: "var(--text-1)" }}>Location: {locationLabel}</div>
                            ) : null}
                            {item.spec?.length > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px", color: "var(--text-1)" }}>
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
                      {!hasHealthData ? (
                        <div
                          style={{
                            borderRadius: "var(--radius-md)",
                            padding: "20px",
                            background: "var(--theme)",
                            color: "var(--text-accent)",
                            fontSize: "13px",
                            textAlign: "center",
                          }}
                        >
                          Technicians have not recorded any VHC data yet. Use the section buttons above to open the full builder
                          forms and start a health check for this job.
                        </div>
                      ) : null}
                    </div>
                    {sectionSaveMessage ? (
                      <span style={{ fontSize: "12px", fontWeight: 600, color: sectionSaveColor }}>
                        {sectionSaveMessage}
                      </span>
                    ) : null}
                  </div>

                  {(() => {
                    // Wheels & Tyres and Brakes & Hubs each take a full-width row at
                    // the top. The remaining sections are paired into grouping cards:
                    // Service Indicator & Under Bonnet + External share one card (50/50),
                    // Internal + Underside share another (50/50). Each pair collapses to
                    // a single column on mobile.
                    const leadKeys = ["wheelsTyres", "brakesHubs"];
                    const groupedPairs = [
                      ["serviceIndicator", "externalInspection"],
                      ["internalElectrics", "underside"],
                    ];
                    const findSection = (key) =>
                      orderedHealthSections.find(({ config }) => config.key === key);
                    const leadSections = orderedHealthSections.filter(({ config }) => leadKeys.includes(config.key));
                    return (
                      <>
                        {leadSections.map(({ config, data, rawData }) => (
                          <HealthSectionCard
                            key={config.key}
                            config={config}
                            section={data}
                            rawData={rawData}
                            onOpen={handleOpenSection}
                          />
                        ))}
                        {groupedPairs.map((pairKeys, groupIdx) => {
                          const pairSections = pairKeys.map(findSection).filter(Boolean);
                          if (pairSections.length === 0) return null;
                          return (
                            <HealthSectionPair
                              key={`vhc-healthcheck-pair-${groupIdx}`}
                              sections={pairSections}
                              onOpen={handleOpenSection}
                            />
                          );
                        })}
                      </>
                    );
                  })()}

                </div>

                <div id="parts">
                  {renderVhcPartsPanel()}
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
          jobId={job?.id || null}
          jobNumber={resolvedJobNumber}
          userId={dbUserId || authUserId || null}
          onSectionMediaUploaded={handleSectionMediaUploaded}
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
          jobId={job?.id || null}
          jobNumber={resolvedJobNumber}
          userId={dbUserId || authUserId || null}
          onSectionMediaUploaded={handleSectionMediaUploaded}
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
          jobId={job?.id || null}
          jobNumber={resolvedJobNumber}
          userId={dbUserId || authUserId || null}
          onSectionMediaUploaded={handleSectionMediaUploaded}
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
          jobId={job?.id || null}
          jobNumber={resolvedJobNumber}
          userId={dbUserId || authUserId || null}
          onSectionMediaUploaded={handleSectionMediaUploaded}
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
          jobId={job?.id || null}
          jobNumber={resolvedJobNumber}
          userId={dbUserId || authUserId || null}
          onSectionMediaUploaded={handleSectionMediaUploaded}
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
          jobId={job?.id || null}
          jobNumber={resolvedJobNumber}
          userId={dbUserId || authUserId || null}
          onSectionMediaUploaded={handleSectionMediaUploaded}
        />
      )}

      <VHCModalShell
        isOpen={Boolean(photoPreviewFile)}
        title="Photo Preview"
        subtitle={photoPreviewFile?.vhc_concern_link?.label || undefined}
        width="980px"
        height="auto"
        adaptiveHeight
        onClose={() => {
          setPhotoPreviewFile(null);
          setPhotoPreviewMessage("");
          setCreatingMediaLocation(false);
          setNewMediaLocationName("");
        }}
        sectionKey="vhc-photo-preview"
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", width: "100%", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", color: "var(--text-1)", opacity: 0.7 }}>
              {photoPreviewMessage || (photoPreviewFile?.visible_to_customer ? "Visible to customer" : "Internal only")}
            </span>
            {/* Action buttons use the shared .app-btn family (staffglobal.css)
                so they share one height and sit centred in the footer. */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <button type="button" className="app-btn app-btn--secondary" onClick={handleCopyPhotoLink}>
                Copy link
              </button>
              {photoPreviewFile?.file_url ? (
                <a className="app-btn app-btn--ghost" href={photoPreviewFile.file_url} target="_blank" rel="noreferrer">
                  Open original
                </a>
              ) : null}
              {photoPreviewFile?.file_url ? (
                <a className="app-btn app-btn--primary" href={photoPreviewFile.file_url} download>
                  Download
                </a>
              ) : null}
            </div>
          </div>
        }
      >
        {photoPreviewFile ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "start" }}>
            <div style={{ flex: "1 1 520px", minWidth: "min(100%, 280px)", borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--theme)", padding: "10px" }}>
              <img
                src={photoPreviewFile.file_url}
                alt="VHC photo preview"
                style={{ width: "100%", maxHeight: "68vh", objectFit: "contain", display: "block", borderRadius: "var(--radius-sm)" }}
              />
            </div>
            <div style={{ flex: "1 1 220px", minWidth: "min(100%, 220px)", display: "flex", flexDirection: "column", gap: "12px", padding: "10px", borderRadius: "var(--radius-md)", background: "var(--theme)" }}>
              <div style={{ display: "grid", gap: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-1)", opacity: 0.65 }}>
                  Linked item
                </span>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-accent)" }}>
                  {photoPreviewFile.vhc_concern_link?.label || "Unlinked media"}
                </span>
                {photoPreviewFile.vhc_concern_link?.section ? (
                  <span style={{ fontSize: "12px", color: "var(--text-1)", opacity: 0.75 }}>
                    {photoPreviewFile.vhc_concern_link.section}
                  </span>
                ) : null}

                {/* Relink controls — connect this media to a reported item or a
                    job-scoped custom location. Editing is hidden in readOnly. */}
                {!readOnly && (
                  <>
                    <select
                      className="app-input"
                      style={{ width: "100%" }}
                      disabled={mediaLinkSaving}
                      value={photoPreviewFile.vhc_concern_link?.concernId != null ? String(photoPreviewFile.vhc_concern_link.concernId) : ""}
                      onChange={(event) => handleSelectMediaLink(photoPreviewFile, event.target.value)}
                    >
                      <option value="">Unlinked media</option>
                      {reportedConcerns.length > 0 ? (
                        <optgroup label="Reported items">
                          {reportedConcerns.map((concern) => (
                            <option key={concern.concernId} value={String(concern.concernId)}>
                              {concern.categoryLabel ? `${concern.categoryLabel} — ${concern.label}` : concern.label}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      {customMediaLocations.length > 0 ? (
                        <optgroup label="Custom locations">
                          {customMediaLocations.map((loc) => (
                            <option key={loc.concernId} value={String(loc.concernId)}>
                              {loc.label}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      <option value="__create__">+ Create new location…</option>
                    </select>

                    {creatingMediaLocation ? (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <input
                          className="app-input"
                          type="text"
                          style={{ flex: "1 1 140px", minWidth: 0 }}
                          placeholder="New location name"
                          value={newMediaLocationName}
                          disabled={mediaLinkSaving}
                          onChange={(event) => setNewMediaLocationName(event.target.value)}
                          onKeyDown={(event) => { if (event.key === "Enter") handleCreateMediaLocation(photoPreviewFile); }}
                        />
                        <button
                          type="button"
                          className="app-btn app-btn--primary app-btn--sm"
                          disabled={mediaLinkSaving || !newMediaLocationName.trim()}
                          onClick={() => handleCreateMediaLocation(photoPreviewFile)}
                        >
                          {mediaLinkSaving ? "Saving…" : "Create"}
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              {/* Customer visibility toggle */}
              {!readOnly ? (
                <div style={{ display: "grid", gap: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-1)", opacity: 0.65 }}>
                    Customer visibility
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(photoPreviewFile.visible_to_customer)}
                      aria-label="Toggle customer visibility"
                      className={`app-toggle--switch${photoPreviewFile.visible_to_customer ? " is-checked" : ""}`}
                      disabled={mediaVisibilitySaving}
                      onClick={() => handleToggleMediaVisibility(photoPreviewFile)}
                    />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-1)" }}>
                      {photoPreviewFile.visible_to_customer ? "Visible to customer" : "Internal only"}
                    </span>
                  </div>
                </div>
              ) : null}

              <div style={{ display: "grid", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-1)", opacity: 0.65 }}>
                  Captured
                </span>
                <span style={{ fontSize: "13px", color: "var(--text-1)" }}>
                  {formatDateTime(photoPreviewFile.uploaded_at)}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </VHCModalShell>

      <VHCModalShell
        isOpen={isAddPartsModalOpen}
        title={addPartsModalTitle}
        width="960px"
        height="720px"
        overlayStyle={{
          background: "rgba(0, 0, 0, 0.6)",
          zIndex: 9999,
          padding: "20px",
        }}
        onClose={closeAddPartsModal}
        hideCloseButton
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <span style={{ fontSize: "12px", color: "var(--text-1)" }}>{addPartsMessage}</span>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={closeAddPartsModal}
                style={{
                  padding: "10px 16px",
                  borderRadius: "var(--radius-xs)",
                  background: "var(--surface)",
                  color: "var(--text-1)",
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
                  borderRadius: "var(--radius-xs)",
                  background: addingParts || selectedParts.length === 0 ? "var(--surface)" : "var(--primary)",
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
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-1)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
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
                  borderRadius: "var(--radius-xs)",
                  border: "1px solid var(--input-ring)",
                  background: "var(--surface)",
                  fontSize: "14px",
                  color: "var(--text-1)",
                }}
              />
              <button
                type="button"
                onClick={handleOpenNewPart}
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-xs)",
                  border: "1px solid var(--ghostbutton-ring)",
                  background: "var(--surface)",
                  color: "var(--text-accent)",
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
                  borderRadius: "var(--radius-xs)",
                  background: "var(--surface)",
                  color: "var(--text-1)",
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
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-accent)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
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
                      borderRadius: "var(--radius-pill)",
                      padding: "6px 10px",
                      background: "var(--surface)",
                      color: "var(--text-1)",
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
              <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-1)" }}>
                Loading suggestions…
              </div>
            )}
            {partsLearningSavedAt && Date.now() - partsLearningSavedAt < 2500 && (
              <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--success)", fontWeight: 600 }}>
                Saved
              </div>
            )}
            {addPartsLoading && (
              <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-1)" }}>
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
            <div style={{ border: "none", borderRadius: "var(--radius-sm)", padding: "16px", background: "var(--surface)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h2 style={{ margin: 0, fontSize: "16px", color: "var(--text-1)" }}>Add part</h2>
              </div>
              {newPartError && (
                <div
                  style={{
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 14px",
                    color: "var(--danger)",
                    background: "var(--danger-surface)",
                    marginBottom: "12px",
                  }}
                >
                  {newPartError}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-1)", marginBottom: "6px" }}>Part number</label>
                  <input
                    type="text"
                    value={newPartForm.partNumber}
                    onChange={(event) => handleNewPartFieldChange("partNumber", event.target.value)}
                    placeholder="e.g., FPAD1"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "var(--input-radius)",
                      border: "1px solid var(--input-ring)",
                      background: "var(--surface)",
                      color: "var(--text-1)",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-1)", marginBottom: "6px" }}>Quantity</label>
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
                      borderRadius: "var(--input-radius)",
                      border: "1px solid var(--input-ring)",
                      background: "var(--surface)",
                      color: "var(--text-1)",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-1)", marginBottom: "6px" }}>Bin location</label>
                  <input
                    type="text"
                    value={newPartForm.binLocation}
                    onChange={(event) => handleNewPartFieldChange("binLocation", event.target.value)}
                    placeholder="A1"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "var(--input-radius)",
                      border: "1px solid var(--input-ring)",
                      background: "var(--surface)",
                      color: "var(--text-1)",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-1)", marginBottom: "6px" }}>Discount code</label>
                  <input
                    type="text"
                    value={newPartForm.discountCode}
                    onChange={(event) => handleNewPartFieldChange("discountCode", event.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "var(--input-radius)",
                      border: "1px solid var(--input-ring)",
                      background: "var(--surface)",
                      color: "var(--text-1)",
                    }}
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-1)", marginBottom: "6px" }}>Description</label>
                  <textarea
                    value={newPartForm.description}
                    onChange={(event) => handleNewPartFieldChange("description", event.target.value)}
                    rows={2}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "var(--input-radius)",
                      border: "1px solid var(--input-ring)",
                      background: "var(--surface)",
                      color: "var(--text-1)",
                      resize: "vertical",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-1)", marginBottom: "6px" }}>Retail price</label>
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
                      borderRadius: "var(--input-radius)",
                      border: "1px solid var(--input-ring)",
                      background: "var(--surface)",
                      color: "var(--text-1)",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-1)", marginBottom: "6px" }}>Cost price</label>
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
                      borderRadius: "var(--input-radius)",
                      border: "1px solid var(--input-ring)",
                      background: "var(--surface)",
                      color: "var(--text-1)",
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
                    borderRadius: "var(--radius-xs)",
                    background: "var(--surface)",
                    color: "var(--text-1)",
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
                    borderRadius: "var(--radius-xs)",
                    background: newPartSaving ? "var(--surface)" : "var(--primary)",
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

          <div style={{ border: "none", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", background: "var(--theme)", fontSize: "12px", fontWeight: 600, color: "var(--text-1)" }}>
              Search results
            </div>
            {addPartsResults.length === 0 ? (
              <div style={{ padding: "14px 12px", fontSize: "12px", color: "var(--text-1)" }}>
                {addPartsLoading ? "Loading results…" : "No parts to show yet."}
              </div>
            ) : (
              <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "var(--surface)", color: "var(--text-1)" }}>
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
                          borderBottom: "1px solid var(--separating-line)",
                        }}
                        onMouseEnter={(event) => {
                          event.currentTarget.style.background = "var(--theme)";
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.background = "transparent";
                        }}
                      >
                        <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--text-accent)" }}>
                          {part.name || "Part"}
                        </td>
                        <td style={{ padding: "8px 12px", color: "var(--text-1)" }}>
                          {part.part_number || "—"}
                        </td>
                        <td style={{ padding: "8px 12px", color: "var(--text-1)" }}>
                          {part.storage_location || "—"}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-1)" }}>
                          {part.qty_in_stock ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ border: "none", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", background: "var(--theme)", fontSize: "12px", fontWeight: 600, color: "var(--text-1)" }}>
              Selected parts
            </div>
            {existingPartsForModal.length > 0 && (
              <div style={{ padding: "12px" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-1)", marginBottom: "8px" }}>
                  Already added to this VHC item
                </div>
                <div style={{ border: "none", borderRadius: "var(--input-radius)", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "var(--surface)", color: "var(--text-1)" }}>
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
                          <tr key={`existing-${part.id}`} style={{ borderBottom: "1px solid var(--separating-line)" }}>
                            <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--text-accent)" }}>
                              {part.part?.name || "Part"}
                            </td>
                            <td style={{ padding: "8px 12px", color: "var(--text-1)" }}>
                              {part.part?.description || "—"}
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-1)" }}>
                              £{Number(part.unit_price || part.part?.unit_price || 0).toFixed(2)}
                            </td>
                            <td style={{ padding: "8px 12px", color: "var(--text-1)" }}>
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
                                  borderRadius: "var(--radius-xs)",
                                  border: "none",
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
              <div style={{ padding: "14px 12px", fontSize: "12px", color: "var(--text-1)" }}>
                No parts selected yet.
              </div>
            ) : (
              <div style={{ maxHeight: "240px", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "var(--surface)", color: "var(--text-1)" }}>
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
                      <tr key={entry.part?.id} style={{ borderBottom: "1px solid var(--separating-line)" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--text-accent)" }}>
                          {entry.part?.name || "Part"}
                        </td>
                        <td style={{ padding: "8px 12px", color: "var(--text-1)" }}>
                          {entry.part?.description || "—"}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-1)" }}>
                          £{Number(entry.part?.unit_price || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: "8px 12px", color: "var(--text-1)" }}>
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
                              borderRadius: "var(--radius-xs)",
                              border: "none",
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
        <PopupModal
          isOpen={labourCostModal.open}
          onClose={closeLabourCostModal}
          ariaLabel="Labour cost editor"
          cardStyle={{
            maxWidth: "560px",
            maxHeight: "88vh",
          }}
        >
            <div style={{ padding: "32px" }}>
              <h4
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "14px",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-accent)",
                }}
              >
                Labour Cost
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* auto-fit keeps the two labour-cost fields in a row on desktop, stacks on narrow screens (CLAUDE.md §3.6) */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: "10px" }}>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "var(--text-1)",
                      }}
                    >
                      Labour Time (Hours)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={labourCostModal.hoursInput}
                      onChange={(event) => setLabourCostModal((prev) => ({ ...prev, hoursInput: event.target.value }))}
                      placeholder="0.00"
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        borderRadius: "var(--radius-sm)",
                        border: "2px solid var(--input-ring)",
                        backgroundColor: "var(--surface)",
                        fontSize: "15px",
                        transition: "border-color 0.2s",
                      }}
                      onFocus={(event) => {
                        event.target.style.borderColor = "var(--focus-ring)";
                      }}
                      onBlur={(event) => {
                        event.target.style.borderColor = "var(--input-ring)";
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "var(--text-1)",
                      }}
                    >
                      Labour Net Cost / Hour (GBP)
                    </label>
                    <input
                      type="text"
                      value={labourCostModal.costInput}
                      onChange={(event) => setLabourCostModal((prev) => ({ ...prev, costInput: event.target.value }))}
                      placeholder={LABOUR_COST_DEFAULT_GBP.toFixed(2)}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        borderRadius: "var(--radius-sm)",
                        border: "2px solid var(--input-ring)",
                        backgroundColor: "var(--surface)",
                        fontSize: "15px",
                        transition: "border-color 0.2s",
                      }}
                      onFocus={(event) => {
                        event.target.style.borderColor = "var(--focus-ring)";
                      }}
                      onBlur={(event) => {
                        event.target.style.borderColor = "var(--input-ring)";
                      }}
                    />
                  </div>
                </div>

                {(() => {
                  const parsed = parseCurrencyValue(labourCostModal.costInput);
                  const net = parsed === null ? LABOUR_COST_DEFAULT_GBP : parsed;
                  const parsedHours = Number(labourCostModal.hoursInput);
                  const hours = Number.isFinite(parsedHours) && parsedHours >= 0 ? parsedHours : 0;
                  const labourTotalNet = hours * net;
                  const vat = labourTotalNet * LABOUR_VAT_RATE;
                  const gross = labourTotalNet + vat;
                  return (
                    <div
                      style={{
                        borderRadius: "var(--radius-sm)",
                        background: "var(--surface)",
                        padding: "12px 14px",
                        display: "grid",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--text-1)" }}>
                        <span>Labour Total (Net)</span>
                        <strong>£{labourTotalNet.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--text-1)" }}>
                        <span>Default Price (Inc VAT)</span>
                        <strong>£{LABOUR_RATE_GROSS_DEFAULT_GBP.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--text-1)" }}>
                        <span>Labour Rate (Net / Hour)</span>
                        <strong>£{net.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--text-1)" }}>
                        <span>VAT (20%)</span>
                        <strong>£{vat.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", color: "var(--text-accent)", fontWeight: 700 }}>
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
                      borderRadius: "var(--input-radius)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-1)",
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
                      borderRadius: "var(--input-radius)",
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
        </PopupModal>
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

      {/* Customer description override modal — Summary tab edit popup */}
      <VhcCustomerDescriptionModal
        open={Boolean(customerDescriptionEditTarget)}
        onClose={() => setCustomerDescriptionEditTarget(null)}
        itemLabel={customerDescriptionEditTarget?.itemLabel || ""}
        categoryLabel={customerDescriptionEditTarget?.categoryLabel || ""}
        technicianDescription={customerDescriptionEditTarget?.technicianDescription || ""}
        initialCustomerDescription={customerDescriptionEditTarget?.currentCustomerDescription || ""}
        onSave={async (nextValue) => {
          const target = customerDescriptionEditTarget;
          if (!target?.vhcId) return;
          const response = await fetch("/api/vhc/update-customer-description", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              vhcItemId: target.vhcId,
              customerDescription: nextValue,
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.success) {
            throw new Error(payload?.message || "Could not save the customer description.");
          }
          // Optimistically reflect the change in local state so the row updates
          // before the realtime channel re-syncs vhcChecksData.
          const savedValue = payload?.data?.customer_description ?? null;
          setVhcChecksData((prev) =>
            (prev || []).map((row) =>
              String(row?.vhc_id) === String(target.vhcId)
                ? { ...row, customer_description: savedValue }
                : row
            )
          );
        }}
      />

      <style jsx global>{`
        .labour-hours-input {
          -moz-appearance: textfield;
          appearance: textfield;
        }

        .labour-hours-input::-webkit-outer-spin-button,
        .labour-hours-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .labour-hours-input::placeholder {
          color: var(--text-1);
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
