// file location: src/features/labourTimes/fallbackEstimator.js

const LOCATION_REWRITES = {
  "o/s": "offside",
  "n/s": "nearside",
  "off side": "offside",
  "near side": "nearside",
  lhs: "nearside",
  rhs: "offside",
  osf: "offside front",
  nsf: "nearside front",
  osr: "offside rear",
  nsr: "nearside rear",
};

const normalizeToken = (value = "") => String(value || "").toLowerCase().trim();

export const normalizeText = (text = "") => {
  const base = normalizeToken(text);
  if (!base) return "";
  const rewritten = Object.entries(LOCATION_REWRITES).reduce((carry, [from, to]) => {
    return carry.replaceAll(from, to);
  }, base);
  return rewritten
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const hasAnyKeyword = (text = "", keywords = []) => {
  return keywords.some((keyword) => text.includes(keyword));
};

const hasAllKeywords = (text = "", keywords = []) => {
  return keywords.every((keyword) => text.includes(keyword));
};

const hasTyreReplacementConcern = (text = "") => {
  const hasTyre = /\b(?:tyre|tire)\b/.test(text);
  if (!hasTyre) return false;

  return (
    /\b(?:replace|renew|worn|wear|low|below|illegal|legal limit|sidewall|bulge|crack|cord|damaged|damage)\b/.test(text) ||
    /\b\d+(?:\.\d+)?\s*mm\b/.test(text)
  );
};

export const estimateLabourHours = (description = "") => {
  const cleaned = normalizeText(description);

  if (!cleaned) {
    return { hours: 0.5, reason: "fallback default", confidence: "low" };
  }

  if (
    /\b(?:puncture|punctured|nail|screw|plug repair|plugged|flat tyre|flat tire|slow puncture)\b/.test(cleaned)
  ) {
    return { hours: 0.5, reason: "fallback rule, puncture repair keywords", confidence: "high" };
  }

  if (hasAnyKeyword(cleaned, ["wheel balance", "balance"])) {
    return { hours: 0.3, reason: "fallback rule, wheel balance keywords", confidence: "medium" };
  }

  if (hasAnyKeyword(cleaned, ["tracking", "alignment", "wheel alignment"])) {
    return { hours: 0.5, reason: "fallback rule, tracking or alignment keywords", confidence: "medium" };
  }

  if (hasTyreReplacementConcern(cleaned)) {
    return { hours: 0.5, reason: "fallback rule, single tyre replacement concern", confidence: "high" };
  }

  if (/\b(?:tyre|tire)\b/.test(cleaned)) {
    return { hours: 0.5, reason: "fallback rule, single tyre work", confidence: "medium" };
  }

  if (hasAnyKeyword(cleaned, ["wiper blade", "wiper blades", "replace wiper"])) {
    return { hours: 0.2, reason: "fallback rule, wiper blade keywords", confidence: "high" };
  }

  if (hasAnyKeyword(cleaned, ["washer jet blocked", "blocked washer jet", "washer jet"])) {
    return { hours: 0.2, reason: "fallback rule, washer jet keywords", confidence: "medium" };
  }

  if (hasAnyKeyword(cleaned, ["pads only", "pad only"])) {
    return { hours: 1, reason: "fallback rule, brake pads only keywords", confidence: "high" };
  }

  if (hasAnyKeyword(cleaned, ["discs only", "disc only", "rotors only", "rotor only"])) {
    return { hours: 1, reason: "fallback rule, brake discs only keywords", confidence: "high" };
  }

  const hasPads = /\b(?:pad|pads)\b/.test(cleaned);
  const hasDiscs = /\b(?:disc|discs|rotor|rotors)\b/.test(cleaned);
  if (hasPads && hasDiscs) {
    return { hours: 1.5, reason: "fallback rule, brake pads and discs keywords", confidence: "high" };
  }

  if (hasPads && !hasDiscs) {
    return { hours: 1, reason: "fallback rule, brake pads only keywords", confidence: "high" };
  }

  if (hasDiscs && !hasPads) {
    return { hours: 1, reason: "fallback rule, brake discs only keywords", confidence: "high" };
  }

  if (hasAnyKeyword(cleaned, ["brake fluid change", "brake fluid"])) {
    return { hours: 0.6, reason: "fallback rule, brake fluid keywords", confidence: "medium" };
  }

  if (hasAnyKeyword(cleaned, ["headlamp unit", "headlight unit"])) {
    return { hours: 0.8, reason: "fallback rule, headlamp unit keywords", confidence: "medium" };
  }

  if (hasAnyKeyword(cleaned, ["bulb replace", "replace bulb", "bulb"])) {
    return { hours: 0.2, reason: "fallback rule, bulb replacement keywords", confidence: "medium" };
  }

  if (hasAllKeywords(cleaned, ["replace", "battery"]) || hasAnyKeyword(cleaned, ["replace battery", "battery replace"])) {
    return { hours: 0.4, reason: "fallback rule, battery replacement keywords", confidence: "high" };
  }

  if (hasAnyKeyword(cleaned, ["coil spring", "spring replace", "replace spring"])) {
    return { hours: 1.8, reason: "fallback rule, coil spring keywords", confidence: "medium" };
  }

  if (hasAnyKeyword(cleaned, ["drop link", "drop-link"])) {
    return { hours: 0.6, reason: "fallback rule, drop link keywords", confidence: "medium" };
  }

  if (hasAnyKeyword(cleaned, ["wheel bearing", "hub bearing"])) {
    return { hours: 1.5, reason: "fallback rule, wheel bearing keywords", confidence: "medium" };
  }

  if (hasAnyKeyword(cleaned, ["wishbone", "lower arm", "control arm"])) {
    return { hours: 1.5, reason: "fallback rule, suspension arm keywords", confidence: "medium" };
  }

  if (hasAnyKeyword(cleaned, ["track rod end", "tie rod end"])) {
    return { hours: 0.8, reason: "fallback rule, track rod end keywords", confidence: "medium" };
  }

  if (hasAnyKeyword(cleaned, ["shock absorber", "shock", "damper"])) {
    return { hours: 1.2, reason: "fallback rule, shock absorber keywords", confidence: "medium" };
  }

  if (hasAnyKeyword(cleaned, ["oil and filter", "oil filter", "service oil"])) {
    return { hours: 0.5, reason: "fallback rule, oil and filter keywords", confidence: "medium" };
  }

  if (hasAnyKeyword(cleaned, ["cabin filter", "pollen filter"])) {
    return { hours: 0.2, reason: "fallback rule, cabin filter keywords", confidence: "medium" };
  }

  if (hasAnyKeyword(cleaned, ["air filter", "engine filter"])) {
    return { hours: 0.2, reason: "fallback rule, air filter keywords", confidence: "medium" };
  }

  if (hasAnyKeyword(cleaned, ["fault code read", "diagnostic code", "code read", "scan fault", "read fault"])) {
    return { hours: 0.3, reason: "fallback rule, diagnostics keywords", confidence: "medium" };
  }

  if (hasAnyKeyword(cleaned, ["exhaust clamp", "exhaust section", "rear silencer", "centre silencer", "center silencer"])) {
    return { hours: 0.8, reason: "fallback rule, exhaust repair keywords", confidence: "medium" };
  }

  return { hours: 0.5, reason: "fallback default", confidence: "low" };
};
