// file location: src/lib/vhc/issueSuggestions.js

import {
  SECTION_TAXONOMY,
  expandTaxonomyToSuggestions,
  rankSuggestions,
  normalizeQuery,
  resolveTaxonomySectionKey,
} from "@/lib/vhc/faultTaxonomy";

const DEFAULT_LIMIT = 12;
const MAX_CACHE_QUERIES_PER_SECTION = 20;
const LEARNED_STORAGE_KEY = "vhc_issue_suggestions_learned_v1";
const MAX_LEARNED_PER_SECTION = 200;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "to",
  "for",
  "in",
  "on",
  "at",
  "with",
  "of",
  "is",
  "are",
  "was",
  "were",
  "has",
  "have",
  "had",
  "found",
  "showing",
  "noted",
  "requires",
  "required",
  "recommended",
  "advise",
  "advised",
  "check",
]);

const MIN_HINT_QUERY_LENGTH = 4;
const HINT_MIN_SCORE = 72;
const HINT_SCORE_MARGIN = 8;

const ISSUE_SECTION_LABEL_OVERRIDES = {
  external_wipers_washers_horn: "External - Wipers/Washers/Horn",
  external_front_lights: "External - Front Lights",
  external_rear_lights: "External - Rear Lights",
  external_wheel_trim: "External - Wheel Trim",
  external_clutch_transmission_operations: "External - Clutch/Transmission",
  external_number_plates: "External - Number Plates",
  external_doors: "External - Doors",
  external_trims: "External - Trims",
  external_miscellaneous: "External - Miscellaneous",
  internal_miscellaneous: "Internal - Miscellaneous",
  underside_miscellaneous: "Underside - Miscellaneous",
};

const SECTION_HINT_KEYWORDS = [
  {
    sectionKey: "underside_miscellaneous",
    terms: [
      "underside",
      "underbody",
      "under seal",
      "underseal",
      "subframe",
      "crossmember",
      "chassis",
      "jacking point",
      "corrosion",
      "rust",
      "floor pan",
      "undershield",
      "undertray",
    ],
  },
  {
    sectionKey: "external_miscellaneous",
    terms: [
      "door",
      "tailgate",
      "bonnet",
      "bumper",
      "mirror",
      "exterior",
      "fuel flap",
      "number plate",
      "roof rail",
      "body trim",
      "weatherstrip",
      "aerial",
      "scuttle",
    ],
  },
  {
    sectionKey: "internal_miscellaneous",
    terms: [
      "interior",
      "dashboard",
      "cabin",
      "glovebox",
      "headlining",
      "parcel shelf",
      "center console",
      "seat trim",
      "armrest",
      "cup holder",
      "door card",
      "trim rattle",
      "footwell",
    ],
  },
];

const normaliseText = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase();

const capitalize = (value = "") => value.charAt(0).toUpperCase() + value.slice(1);

const queryCacheBySection = new Map();
const learnedSuggestionsBySection = new Map();
let learnedLoaded = false;

const getSectionCache = (sectionKey) => {
  if (!queryCacheBySection.has(sectionKey)) {
    queryCacheBySection.set(sectionKey, new Map());
  }
  return queryCacheBySection.get(sectionKey);
};

const storeCachedResult = (sectionKey, queryKey, result) => {
  const cache = getSectionCache(sectionKey);
  cache.set(queryKey, result);
  while (cache.size > MAX_CACHE_QUERIES_PER_SECTION) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
};

const clearSectionCache = (sectionKey) => {
  if (sectionKey && queryCacheBySection.has(sectionKey)) {
    queryCacheBySection.delete(sectionKey);
  }
};

const loadLearnedSuggestions = () => {
  if (learnedLoaded) return;
  learnedLoaded = true;
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LEARNED_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    Object.entries(parsed).forEach(([sectionKey, items]) => {
      if (!Array.isArray(items)) return;
      const filtered = items
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
        .slice(0, MAX_LEARNED_PER_SECTION);
      if (filtered.length > 0) {
        learnedSuggestionsBySection.set(sectionKey, filtered);
      }
    });
  } catch (_error) {
    // Ignore malformed local cache.
  }
};

const persistLearnedSuggestions = () => {
  if (typeof window === "undefined") return;
  try {
    const payload = {};
    learnedSuggestionsBySection.forEach((items, sectionKey) => {
      payload[sectionKey] = items.slice(0, MAX_LEARNED_PER_SECTION);
    });
    window.localStorage.setItem(LEARNED_STORAGE_KEY, JSON.stringify(payload));
  } catch (_error) {
    // Ignore write errors (private mode / quota).
  }
};

const normalizeSemanticKey = (text = "") => {
  const normalized = normalizeQuery(text)
    .replace(/\bforeign object\b/g, "nail")
    .replace(/\bscrews?\b/g, "nail")
    .replace(/\bnails?\b/g, "nail")
    .replace(/\btyres?\b/g, "tyre")
    .replace(/\btires?\b/g, "tyre")
    .replace(/\bpunctured?\b/g, "puncture")
    .replace(/\bflat\b/g, "puncture")
    .replace(/\bdeflated?\b/g, "puncture")
    .replace(/\bleak(?:ing)?\b/g, "puncture")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";

  const tokens = normalized
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token));

  if (tokens.length === 0) {
    return normalized;
  }

  const unique = Array.from(new Set(tokens));
  unique.sort();
  return unique.join(" ");
};

const getLearnedSuggestionsForSection = (sectionKey) => {
  loadLearnedSuggestions();
  return learnedSuggestionsBySection.get(sectionKey) || [];
};

const rankLearnedSuggestions = (items = [], normalizedQuery = "", limit = DEFAULT_LIMIT) => {
  const q = normaliseText(normalizedQuery);
  if (!q) return [];
  return items
    .map((text) => {
      const normalizedText = normaliseText(text);
      let score = 3;
      if (normalizedText.startsWith(q)) score = 0;
      else if (normalizedText.includes(` ${q}`)) score = 1;
      else if (normalizedText.includes(q)) score = 2;
      return { text, score, length: text.length };
    })
    .filter((entry) => entry.score < 3 || normaliseText(entry.text).includes(q))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.length - b.length;
    })
    .slice(0, limit)
    .map((entry) => entry.text);
};

const resolveLegacySectionAlias = (lookup = "") => {
  const aliasMap = {
    miscellaneous: "",
    "service_under_bonnet_miscellaneous": "",
  };
  return aliasMap[lookup] !== undefined ? aliasMap[lookup] : lookup;
};

export const resolveIssueSectionKey = (sectionKey = "") => {
  const lookup = normaliseText(sectionKey);
  const normalizedLookup = resolveLegacySectionAlias(lookup);
  if (!normalizedLookup) return "";
  return resolveTaxonomySectionKey(normalizedLookup);
};

export const ISSUE_SUGGESTIONS_BY_SECTION = Object.keys(SECTION_TAXONOMY).reduce((acc, sectionKey) => {
  acc[sectionKey] = expandTaxonomyToSuggestions(sectionKey).map((entry) => entry.text);
  return acc;
}, {
  external_miscellaneous: [],
  internal_miscellaneous: [],
  underside_miscellaneous: [],
  service_under_bonnet_miscellaneous: [],
});

export const getIssueSuggestions = (sectionKey = "", query = "", limit = DEFAULT_LIMIT) => {
  const resolvedSectionKey = resolveIssueSectionKey(sectionKey);
  if (!resolvedSectionKey) return [];

  const normalizedQuery = normalizeQuery(query);
  const normalizedLimit = Number.isFinite(Number(limit)) ? Math.max(1, Number(limit)) : DEFAULT_LIMIT;

  if (!normalizedQuery) return [];

  const cacheKey = `${normalizedQuery}|${normalizedLimit}`;
  const cache = getSectionCache(resolvedSectionKey);
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const ranked = rankSuggestions(resolvedSectionKey, normalizedQuery);
  const taxonomyResult = ranked.slice(0, normalizedLimit * 2).map((entry) => entry.text);
  const learnedResult = rankLearnedSuggestions(
    getLearnedSuggestionsForSection(resolvedSectionKey),
    normalizedQuery,
    normalizedLimit
  );

  const deduped = [];
  const seen = new Set();
  [...learnedResult, ...taxonomyResult].forEach((text) => {
    const key = normaliseText(text);
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(text);
  });
  const result = deduped.slice(0, normalizedLimit);

  storeCachedResult(resolvedSectionKey, cacheKey, result);
  return result;
};

export const learnIssueSuggestion = (sectionKey = "", issueText = "") => {
  const resolvedSectionKey = resolveIssueSectionKey(sectionKey);
  const displayText = String(issueText || "").replace(/\s+/g, " ").trim();
  if (!resolvedSectionKey || !displayText) {
    return { learned: false, reason: "invalid_input" };
  }

  const semanticKey = normalizeSemanticKey(displayText);
  if (!semanticKey) {
    return { learned: false, reason: "empty_semantic_key" };
  }

  const sectionBaseline = expandTaxonomyToSuggestions(resolvedSectionKey).map((entry) => entry.text);
  const existingLearned = getLearnedSuggestionsForSection(resolvedSectionKey);
  const semanticKeys = new Set(
    [...sectionBaseline, ...existingLearned].map((text) => normalizeSemanticKey(text)).filter(Boolean)
  );

  if (semanticKeys.has(semanticKey)) {
    return { learned: false, reason: "semantic_duplicate" };
  }

  const updated = [displayText, ...existingLearned.filter((text) => normaliseText(text) !== normaliseText(displayText))]
    .slice(0, MAX_LEARNED_PER_SECTION);
  learnedSuggestionsBySection.set(resolvedSectionKey, updated);
  persistLearnedSuggestions();
  clearSectionCache(resolvedSectionKey);

  return { learned: true, reason: "added" };
};

export const ISSUE_SECTION_LABELS = Object.keys(ISSUE_SUGGESTIONS_BY_SECTION).reduce((acc, key) => {
  acc[key] = ISSUE_SECTION_LABEL_OVERRIDES[key] || capitalize(key.replace(/_/g, " "));
  return acc;
}, {});

const scoreRankedSuggestion = (query, suggestion) => {
  if (!suggestion) return 0;

  const normalizedQuery = normalizeQuery(query);
  const tierBase = [110, 92, 74, 58][suggestion.tier] || 0;
  const containsBonus = suggestion.indexedText?.includes(normalizedQuery) ? 10 : 0;
  const distancePenalty = Number.isFinite(suggestion.distance) ? Math.min(12, suggestion.distance) : 0;

  return (
    tierBase +
    (suggestion.queryBoost || 0) +
    (suggestion.componentPriority || 0) +
    (suggestion.symptomPriority || 0) +
    containsBonus -
    distancePenalty
  );
};

const getKeywordSectionHint = (resolvedSectionKey = "", normalizedQuery = "") => {
  if (!resolvedSectionKey || !normalizedQuery) return null;

  let best = null;
  SECTION_HINT_KEYWORDS.forEach(({ sectionKey, terms = [] }) => {
    if (sectionKey === resolvedSectionKey) return;
    const score = terms.reduce((total, term) => {
      if (!term) return total;
      return normalizedQuery.includes(term) ? total + 1 : total;
    }, 0);

    if (score <= 0) return;
    if (!best || score > best.score) {
      best = { sectionKey, score };
    }
  });

  if (!best || best.score < 1) return null;
  return {
    sectionKey: best.sectionKey,
    label: ISSUE_SECTION_LABELS[best.sectionKey] || capitalize(best.sectionKey.replace(/_/g, " ")),
  };
};

export const getIssueSectionHint = (sectionKey = "", query = "") => {
  const resolvedSectionKey = resolveIssueSectionKey(sectionKey);
  const normalizedQuery = normalizeQuery(query);
  if (!resolvedSectionKey || normalizedQuery.length < MIN_HINT_QUERY_LENGTH) return null;

  const keywordHint = getKeywordSectionHint(resolvedSectionKey, normalizedQuery);
  if (keywordHint) return keywordHint;

  const currentTop = rankSuggestions(resolvedSectionKey, normalizedQuery)[0];
  const currentScore = scoreRankedSuggestion(normalizedQuery, currentTop);

  let bestAlternative = null;
  Object.keys(SECTION_TAXONOMY).forEach((candidateSectionKey) => {
    if (candidateSectionKey === resolvedSectionKey) return;
    const top = rankSuggestions(candidateSectionKey, normalizedQuery)[0];
    if (!top) return;
    const score = scoreRankedSuggestion(normalizedQuery, top);
    if (!bestAlternative || score > bestAlternative.score) {
      bestAlternative = { sectionKey: candidateSectionKey, score };
    }
  });

  if (!bestAlternative) return null;
  if (bestAlternative.score < HINT_MIN_SCORE) return null;
  if (bestAlternative.score < currentScore + HINT_SCORE_MARGIN) return null;

  return {
    sectionKey: bestAlternative.sectionKey,
    label: ISSUE_SECTION_LABELS[bestAlternative.sectionKey] || capitalize(bestAlternative.sectionKey.replace(/_/g, " ")),
  };
};
