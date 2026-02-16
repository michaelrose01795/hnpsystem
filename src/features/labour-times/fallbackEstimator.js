// file location: src/features/labour-times/fallbackEstimator.js

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

export const estimateLabourHours = (description = "") => {
  const cleaned = normalizeText(description);

  if (!cleaned) {
    return { hours: 0.5, reason: "fallback default", confidence: "low" };
  }

  if (hasAnyKeyword(cleaned, ["puncture", "nail", "screw", "plug repair", "plugged", "plug"])) {
    return { hours: 0.5, reason: "fallback rule, puncture repair keywords", confidence: "high" };
  }

  if (hasAnyKeyword(cleaned, ["tyre low", "tire low", "tyre worn", "tire worn", "replace tyre", "replace tire", "tyre below limit", "tire below limit"])) {
    return { hours: 0.3, reason: "fallback rule, tyre replace keywords", confidence: "high" };
  }

  if (hasAnyKeyword(cleaned, ["wheel balance", "balance"])) {
    return { hours: 0.3, reason: "fallback rule, wheel balance keywords", confidence: "medium" };
  }

  if (hasAnyKeyword(cleaned, ["tracking", "alignment", "wheel alignment"])) {
    return { hours: 0.5, reason: "fallback rule, tracking or alignment keywords", confidence: "medium" };
  }

  if (hasAnyKeyword(cleaned, ["wiper blade", "wiper blades", "replace wiper"])) {
    return { hours: 0.2, reason: "fallback rule, wiper blade keywords", confidence: "high" };
  }

  if (hasAnyKeyword(cleaned, ["washer jet blocked", "blocked washer jet", "washer jet"])) {
    return { hours: 0.2, reason: "fallback rule, washer jet keywords", confidence: "medium" };
  }

  if (hasAnyKeyword(cleaned, ["pads only", "pad only"])) {
    return { hours: 0.8, reason: "fallback rule, brake pads only keywords", confidence: "high" };
  }

  if (hasAnyKeyword(cleaned, ["discs only", "disc only", "rotors only", "rotor only"])) {
    return { hours: 0.9, reason: "fallback rule, brake discs only keywords", confidence: "high" };
  }

  const hasPads = hasAnyKeyword(cleaned, ["pad", "pads"]);
  const hasDiscs = hasAnyKeyword(cleaned, ["disc", "discs", "rotor", "rotors"]);
  const hasBrake = cleaned.includes("brake");
  if (hasBrake && hasPads && hasDiscs) {
    return { hours: 1.2, reason: "fallback rule, brake pads and discs keywords", confidence: "high" };
  }

  if (hasBrake && hasPads && !hasDiscs) {
    return { hours: 0.8, reason: "fallback rule, brake pads only keywords", confidence: "high" };
  }

  if (hasBrake && hasDiscs && !hasPads) {
    return { hours: 0.9, reason: "fallback rule, brake discs only keywords", confidence: "high" };
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

  return { hours: 0.5, reason: "fallback default", confidence: "low" };
};
