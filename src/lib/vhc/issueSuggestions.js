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

const normaliseText = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase();

const capitalize = (value = "") => value.charAt(0).toUpperCase() + value.slice(1);

const queryCacheBySection = new Map();

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

const resolveLegacySectionAlias = (lookup = "") => {
  const aliasMap = {
    miscellaneous: "",
    "external_miscellaneous": "",
    "internal_miscellaneous": "",
    "underside_miscellaneous": "",
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
  const result = ranked.slice(0, normalizedLimit).map((entry) => entry.text);

  storeCachedResult(resolvedSectionKey, cacheKey, result);
  return result;
};

export const ISSUE_SECTION_LABELS = Object.keys(ISSUE_SUGGESTIONS_BY_SECTION).reduce((acc, key) => {
  acc[key] = capitalize(key.replace(/_/g, " "));
  return acc;
}, {});
