// file location: src/features/parts-search-suggestions/ranking.js

import { tokenizeContext } from "@/features/parts-search-suggestions/normalization";

const asSet = (value = "") => new Set(tokenizeContext(value));

export const similarityScore = (aText = "", bText = "") => {
  const a = asSet(aText);
  const b = asSet(bText);
  if (a.size === 0 || b.size === 0) return 0;

  let overlap = 0;
  a.forEach((token) => {
    if (b.has(token)) overlap += 1;
  });

  const denom = Math.max(a.size, b.size);
  return overlap / denom;
};

const sourceOrder = (item) => {
  if (item.source === "learned" && item.scope === "user") return 0;
  if (item.source === "learned" && item.scope === "global") return 1;
  if (item.source === "preset") return 2;
  return 3;
};

export const rankPartSuggestions = ({ contextText = "", candidates = [], limit = 10 } = {}) => {
  const scored = (candidates || []).map((candidate, index) => {
    const score = similarityScore(contextText, candidate.normalizedContextKey || candidate.contextText || "");
    return {
      ...candidate,
      _score: score,
      _sourceRank: sourceOrder(candidate),
      _usage: Number(candidate.usageCount || 0),
      _fallback: Number.isFinite(candidate.defaultOrder) ? candidate.defaultOrder : index,
    };
  });

  scored.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    if (a._sourceRank !== b._sourceRank) return a._sourceRank - b._sourceRank;
    if (b._usage !== a._usage) return b._usage - a._usage;
    return a._fallback - b._fallback;
  });

  return scored.slice(0, limit).map((item) => ({
    id: item.id,
    query: item.query,
    source: item.source,
    scope: item.scope || null,
    reason: item.reason || null,
  }));
};
