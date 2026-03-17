// file location: src/lib/jobRequestPresets/matching.js

import { normalizePresetText, tokenizePresetText } from "@/lib/jobRequestPresets/constants";

const asTokenSet = (value = "") => new Set(tokenizePresetText(value));

const tokenOverlapScore = (query = "", candidate = "") => {
  const queryTokens = asTokenSet(query);
  const candidateTokens = asTokenSet(candidate);
  if (queryTokens.size === 0 || candidateTokens.size === 0) return 0;

  let overlap = 0;
  queryTokens.forEach((token) => {
    if (candidateTokens.has(token)) overlap += 1;
  });

  return overlap / Math.max(queryTokens.size, candidateTokens.size);
};

export const scorePresetMatch = (queryText = "", preset = {}) => {
  const query = normalizePresetText(queryText);
  const label = normalizePresetText(preset.label || "");
  const aliases = Array.isArray(preset.aliases) ? preset.aliases.map((item) => normalizePresetText(item)) : [];

  if (!query) return Number(preset.usageCount || 0) * 0.001;

  if (query === label) return 200;
  if (aliases.includes(query)) return 180;
  if (label.startsWith(query)) return 140;
  if (aliases.some((alias) => alias.startsWith(query))) return 120;

  const searchable = [label, ...aliases].join(" ");
  const overlap = tokenOverlapScore(query, searchable);
  const containsBonus = searchable.includes(query) ? 10 : 0;
  const usageBonus = Number(preset.usageCount || 0) * 0.01;

  return overlap * 100 + containsBonus + usageBonus;
};

export const rankJobRequestPresets = ({ query = "", presets = [], limit = 8 } = {}) => {
  return (Array.isArray(presets) ? presets : [])
    .map((preset, index) => ({
      ...preset,
      _score: scorePresetMatch(query, preset),
      _fallbackOrder: index,
    }))
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      const aUsage = Number(a.usageCount || 0);
      const bUsage = Number(b.usageCount || 0);
      if (bUsage !== aUsage) return bUsage - aUsage;
      return a._fallbackOrder - b._fallbackOrder;
    })
    .slice(0, limit)
    .map(({ _score, _fallbackOrder, ...preset }) => preset);
};
