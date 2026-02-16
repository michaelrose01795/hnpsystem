// file location: src/features/labour-times/normalization.js

const TOKEN_SYNONYMS = {
  osf: ["offside", "front", "offside_front"],
  nsf: ["nearside", "front", "nearside_front"],
  osr: ["offside", "rear", "offside_rear"],
  nsr: ["nearside", "rear", "nearside_rear"],
  "o/s": ["offside"],
  "n/s": ["nearside"],
  rhs: ["offside"],
  lhs: ["nearside"],
  replace: ["replace", "replacement", "renew"],
  replaced: ["replace", "replacement", "renew"],
  replacing: ["replace", "replacement", "renew"],
  renew: ["replace", "replacement", "renew"],
  renewed: ["replace", "replacement", "renew"],
  tyre: ["tyre", "tire"],
  tire: ["tyre", "tire"],
  disc: ["disc", "rotor"],
  rotor: ["disc", "rotor"],
  pads: ["pad", "pads"],
  pad: ["pad", "pads"],
  shock: ["shock", "damper"],
  damper: ["shock", "damper"],
  spring: ["spring", "coil"],
  coil: ["spring", "coil"],
  battery: ["battery", "accumulator"],
  bulb: ["bulb", "lamp"],
  lamp: ["bulb", "lamp"],
};

const TOKEN_REWRITE = {
  "off side": "offside",
  "near side": "nearside",
  "off-side": "offside",
  "near-side": "nearside",
};

const LOCATION_TOKENS = new Set([
  "offside",
  "nearside",
  "front",
  "rear",
  "offside_front",
  "nearside_front",
  "offside_rear",
  "nearside_rear",
]);

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "to",
  "on",
  "a",
  "an",
  "of",
  "in",
  "at",
]);

export const isValidUuid = (value = "") => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
};

export const normalizeText = (value = "") => {
  const raw = String(value || "").toLowerCase().trim();
  if (!raw) return "";
  const rewritten = Object.entries(TOKEN_REWRITE).reduce((carry, [from, to]) => {
    return carry.replaceAll(from, to);
  }, raw);
  return rewritten
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const tokenize = (value = "") => {
  const cleaned = normalizeText(value);
  if (!cleaned) return [];

  const baseTokens = cleaned
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));

  const expanded = [];
  for (const token of baseTokens) {
    expanded.push(token);
    const synonyms = TOKEN_SYNONYMS[token] || [];
    for (const synonym of synonyms) {
      expanded.push(synonym);
    }
  }

  return Array.from(new Set(expanded));
};

export const buildNormalizedKey = (value = "") => {
  const tokens = tokenize(value);
  return tokens.join(" ");
};

export const countLocationTerms = (tokens = []) => {
  return tokens.reduce((count, token) => {
    return count + (LOCATION_TOKENS.has(token) ? 1 : 0);
  }, 0);
};
