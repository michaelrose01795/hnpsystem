// file location: src/lib/vhc/shared.js
// Shared utility functions used across VHC modules.
// Consolidates duplicated helpers from saveVhcItem, upsertVhcIssueRow, quoteLines, etc.

export const DEFAULT_LABOUR_RATE_GBP = 85;

export const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const collapseWhitespace = (value = "") =>
  String(value || "").trim().replace(/\s+/g, " ");

export const normalizeSeverity = (value) => {
  const text = collapseWhitespace(value).toLowerCase();
  if (!text) return "amber";
  if (text.includes("red")) return "red";
  if (text.includes("amber") || text.includes("orange") || text.includes("yellow")) return "amber";
  if (text.includes("green") || text.includes("good") || text.includes("pass")) return "green";
  return "grey";
};

export const normaliseColour = (value) => {
  if (!value) return null;
  const lower = String(value).toLowerCase().trim();
  if (lower === "red" || lower.includes("red")) return "red";
  if (lower === "amber" || lower === "yellow" || lower === "orange" || lower.includes("amber")) return "amber";
  if (lower === "green" || lower === "good" || lower === "pass" || lower.includes("green")) return "green";
  if (lower === "grey" || lower === "gray" || lower === "neutral" || lower.includes("grey")) return "grey";
  return "grey";
};

export const normalizeApprovalStatus = (value) => {
  const text = collapseWhitespace(value).toLowerCase();
  if (!text) return "pending";
  if (text === "authorised" || text === "approved") return "authorized";
  if (["authorized", "declined", "completed", "pending"].includes(text)) return text;
  return "pending";
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
