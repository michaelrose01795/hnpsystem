// file location: src/features/parts-search-suggestions/normalization.js

const CONTEXT_SYNONYMS = {
  eml: ["engine_management_light", "check_engine"],
  hose: ["pipe", "boost_hose", "charge_pipe"],
  pipe: ["hose", "boost_hose", "charge_pipe"],
  boost: ["underboost", "overboost", "turbo"],
  turbo: ["boost", "charger"],
  dpf: ["diesel_particulate_filter"],
  egr: ["exhaust_gas_recirculation"],
  maf: ["mass_air_flow"],
  map: ["manifold_pressure"],
  sensor: ["sender", "switch"],
  pads: ["pad", "brake_pads"],
  pad: ["pads", "brake_pads"],
  battery: ["12v_battery", "starter_battery"],
  misfire: ["rough_running", "combustion_fault"],
  knock: ["noise", "clunk"],
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "onto",
  "due",
  "that",
  "this",
  "is",
  "are",
  "be",
  "required",
  "requires",
  "replacement",
  "replace",
  "add",
  "parts",
]);

export const normalizeText = (value = "") => {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const tokenizeContext = (value = "") => {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  const base = normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

  const expanded = [];
  base.forEach((token) => {
    expanded.push(token);
    (CONTEXT_SYNONYMS[token] || []).forEach((synonym) => expanded.push(synonym));
  });

  return Array.from(new Set(expanded));
};

export const buildNormalizedContextKey = (contextText = "") => {
  return tokenizeContext(contextText).join(" ");
};

export const buildVehicleContextText = (vehicle = {}) => {
  const make = vehicle?.make || vehicle?.manufacturer || "";
  const model = vehicle?.model || "";
  const derivative = vehicle?.derivative || vehicle?.trim || vehicle?.variant || "";
  const engine = vehicle?.engine || vehicle?.engine_size || vehicle?.engineSize || "";
  const year = vehicle?.year || vehicle?.model_year || vehicle?.registration_year || "";
  const vin = vehicle?.vin || vehicle?.chassis || vehicle?.chassis_number || "";
  const reg = vehicle?.registration || vehicle?.reg || vehicle?.registration_number || "";

  return [make, model, derivative, engine, year, reg, vin]
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join(" ")
    .trim();
};
