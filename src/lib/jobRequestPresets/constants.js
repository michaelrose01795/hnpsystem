// file location: src/lib/jobRequestPresets/constants.js

export const DIAGNOSTIC_KEYWORDS = [
  "diagnostic",
  "diagnostics",
  "diagnose",
  "diagnosis",
  "fault finding",
  "investigate",
  "investigation",
  "check fault",
  "warning light check",
  "engine light check",
  "engine management light check",
  "eml",
];

export const normalizePresetText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const tokenizePresetText = (value = "") =>
  normalizePresetText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

export const isDiagnosticRequestText = (value = "") => {
  const normalized = normalizePresetText(value);
  if (!normalized) return false;

  return DIAGNOSTIC_KEYWORDS.some((keyword) => normalized.includes(normalizePresetText(keyword)));
};

export const toHoursNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Number(parsed.toFixed(2));
};

export const clampSuggestionLimit = (value, fallback = 8) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 20);
};
