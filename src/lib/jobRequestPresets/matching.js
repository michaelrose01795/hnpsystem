// file location: src/lib/jobRequestPresets/matching.js

import { normalizePresetText, tokenizePresetText } from "@/lib/jobRequestPresets/constants";

const TOKEN_EQUIVALENTS = new Map([
  ["tires", "tyre"], ["tire", "tyre"], ["tyres", "tyre"],
  ["brakes", "brake"], ["services", "service"], ["servicing", "service"],
  ["diagnostics", "diagnostic"], ["diagnosis", "diagnostic"], ["diag", "diagnostic"],
  ["ac", "aircon"], ["airconditioning", "aircon"], ["aircon", "aircon"],
  ["mot", "mot"], ["mots", "mot"],
]);

const canonicalToken = (token = "") => {
  const ordinal = String(token).match(/^(\d+)(?:st|nd|rd|th)$/);
  if (ordinal) return ordinal[1];
  return TOKEN_EQUIVALENTS.get(token) || token;
};

const canonicalTokens = (value = "") => tokenizePresetText(value).map(canonicalToken);
const asTokenSet = (value = "") => new Set(canonicalTokens(value));

const tokensMatch = (queryToken, candidateToken) => {
  if (queryToken === candidateToken) return true;
  if (queryToken.length < 2) return false;
  return candidateToken.startsWith(queryToken);
};

const tokenOverlapScore = (query = "", candidate = "") => {
  const queryTokens = asTokenSet(query);
  const candidateTokens = asTokenSet(candidate);
  if (queryTokens.size === 0 || candidateTokens.size === 0) return 0;

  let overlap = 0;
  queryTokens.forEach((token) => {
    if ([...candidateTokens].some((candidateToken) => tokensMatch(token, candidateToken))) overlap += 1;
  });

  return overlap / Math.max(queryTokens.size, candidateTokens.size);
};

export const scorePresetMatch = (queryText = "", preset = {}) => {
  const query = normalizePresetText(queryText);
  const label = normalizePresetText(preset.label || "");
  const aliases = Array.isArray(preset.aliases) ? preset.aliases.map((item) => normalizePresetText(item)) : [];

  if (!query) return Number(preset.usageCount || 0) * 0.001;

  const canonicalQuery = canonicalTokens(query).join(" ");
  const canonicalLabel = canonicalTokens(label).join(" ");
  const canonicalAliases = aliases.map((alias) => canonicalTokens(alias).join(" "));
  const queryNumbers = canonicalTokens(query).filter((token) => /^\d+$/.test(token));
  const candidateNumbers = canonicalTokens([label, ...aliases].join(" ")).filter((token) => /^\d+$/.test(token));
  const hasWrongNumber = queryNumbers.length > 0
    && candidateNumbers.length > 0
    && !queryNumbers.some((number) => candidateNumbers.includes(number));
  if (hasWrongNumber) return 0;

  if (canonicalQuery === canonicalLabel) return 1000;
  if (canonicalAliases.includes(canonicalQuery)) return 960;

  const fields = [canonicalLabel, ...canonicalAliases];
  const prefixFields = fields.filter((field) => field.startsWith(canonicalQuery));
  if (prefixFields.length) {
    const shortestCompletion = Math.min(...prefixFields.map((field) => field.length - canonicalQuery.length));
    return 850 + Math.max(0, 60 - shortestCompletion);
  }

  const queryTokens = canonicalTokens(query);
  const bestFieldCoverage = Math.max(...fields.map((field) => {
    const fieldTokens = canonicalTokens(field);
    const matched = queryTokens.filter((queryToken) =>
      fieldTokens.some((candidateToken) => tokensMatch(queryToken, candidateToken))
    ).length;
    return queryTokens.length ? matched / queryTokens.length : 0;
  }));
  const searchable = fields.join(" ");
  const overlap = tokenOverlapScore(canonicalQuery, searchable);
  const allTermsMatchBonus = bestFieldCoverage === 1 ? 280 : 0;
  const containsBonus = searchable.includes(canonicalQuery) ? 80 : 0;
  const numberBonus = queryNumbers.length > 0 && queryNumbers.some((number) => candidateNumbers.includes(number)) ? 160 : 0;
  const usageBonus = Math.min(Number(preset.usageCount || 0), 1000) * 0.01;

  return bestFieldCoverage * 300 + overlap * 160 + allTermsMatchBonus + containsBonus + numberBonus + usageBonus;
};

const similarity = (left = "", right = "") => {
  const leftTokens = asTokenSet(left);
  const rightTokens = asTokenSet(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return intersection / new Set([...leftTokens, ...rightTokens]).size;
};

export const rankJobRequestPresets = ({ query = "", presets = [], limit = 8 } = {}) => {
  const normalizedQuery = normalizePresetText(query);
  const ranked = (Array.isArray(presets) ? presets : [])
    .map((preset, index) => ({
      ...preset,
      _score: scorePresetMatch(normalizedQuery, preset),
      _fallbackOrder: index,
    }))
    .filter((preset) => !normalizedQuery || preset._score >= 180)
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      const aUsage = Number(a.usageCount || 0);
      const bUsage = Number(b.usageCount || 0);
      if (bUsage !== aUsage) return bUsage - aUsage;
      return a._fallbackOrder - b._fallbackOrder;
    });

  const unique = [];
  for (const preset of ranked) {
    const isDuplicate = unique.some((existing) =>
      normalizePresetText(existing.label) === normalizePresetText(preset.label)
      || (
        existing.category === preset.category
        && similarity(existing.label, preset.label) >= 0.94
      )
    );
    if (!isDuplicate) unique.push(preset);
    if (unique.length >= limit) break;
  }

  return unique.map(({ _score, _fallbackOrder, ...preset }) => {
    void _score;
    void _fallbackOrder;
    return preset;
  });
};
