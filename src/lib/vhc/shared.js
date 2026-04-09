// file location: src/lib/vhc/shared.js
// Shared utility functions used across VHC modules.
// Consolidates duplicated helpers from saveVhcItem, upsertVhcIssueRow, quoteLines, etc.

import {
  normalizeDecision as _normalizeDecision,
  normalizeSeverity as _normalizeSeverity,
  SEVERITY,
} from "@/lib/vhc/vhcItemState"; // Canonical state model — single source of truth.

export const DEFAULT_LABOUR_RATE_GBP = 85;

export const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const collapseWhitespace = (value = "") =>
  String(value || "").trim().replace(/\s+/g, " ");

/** @deprecated Use normalizeSeverity from vhcItemState directly. Kept for existing callers. */
export const normalizeSeverity = (value) => { // Delegates to canonical normalizer, defaults to "amber" for backward compat.
  return _normalizeSeverity(value) ?? SEVERITY.AMBER; // Legacy default was "amber" for empty input.
};

/** @deprecated Use normalizeSeverity from vhcItemState directly. Kept for existing callers. */
export const normaliseColour = (value) => { // Delegates to canonical normalizer.
  if (!value) return null; // Preserve original null behavior.
  return _normalizeSeverity(value) ?? SEVERITY.GREY; // Legacy default was "grey" for unrecognized.
};

/** @deprecated Use normalizeDecision from vhcItemState directly. Kept for existing callers. */
export const normalizeApprovalStatus = (value) => { // Delegates to canonical normalizer, defaults to "pending".
  return _normalizeDecision(value) ?? "pending"; // Legacy default was "pending" for empty input.
};

export const resolveSectionType = (sectionName) => {
  const token = collapseWhitespace(sectionName).toLowerCase();
  if (token.includes("wheel") || token.includes("tyre")) return "wheels";
  if (token.includes("brake") || token.includes("hub")) return "brakes";
  if (token.includes("service") || token.includes("bonnet") || token.includes("oil")) return "service";
  if (token.includes("external")) return "external";
  if (token.includes("internal")) return "internal";
  if (token.includes("underside")) return "underside";
  return "other";
};

export const resolveCategoryForItem = (sectionName) => {
  const lower = String(sectionName || "").toLowerCase();
  if (lower.includes("wheel") || lower.includes("tyre")) return { id: "wheels_tyres", label: "Wheels & Tyres" };
  if (lower.includes("brake") || lower.includes("hub")) return { id: "brakes_hubs", label: "Brakes & Hubs" };
  if (lower.includes("service") || lower.includes("bonnet") || lower.includes("oil")) return { id: "service_indicator", label: "Service Indicator & Under Bonnet" };
  if (lower.includes("external")) return { id: "external_inspection", label: "External" };
  if (lower.includes("internal") || lower.includes("electrics")) return { id: "internal_electrics", label: "Internal" };
  if (lower.includes("underside")) return { id: "underside", label: "Underside" };
  return { id: "other", label: sectionName || "Other" };
};
