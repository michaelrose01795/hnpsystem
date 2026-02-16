// file location: src/features/labour-times/ranking.js

import { tokenize, countLocationTerms } from "@/features/labour-times/normalization";

const toTokenSet = (value = "") => {
  return new Set(tokenize(value));
};

export const scoreMatch = ({ queryText = "", candidateText = "", candidateTags = [] } = {}) => {
  const queryTokens = toTokenSet(queryText);
  if (queryTokens.size === 0) return 0;

  const candidateTokens = toTokenSet([candidateText, ...(candidateTags || [])].join(" "));
  if (candidateTokens.size === 0) return 0;

  let overlap = 0;
  queryTokens.forEach((token) => {
    if (candidateTokens.has(token)) overlap += 1;
  });

  const precision = overlap / queryTokens.size;
  const recall = overlap / candidateTokens.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  const queryLocationTerms = countLocationTerms(Array.from(queryTokens));
  const candidateLocationTerms = countLocationTerms(Array.from(candidateTokens));
  const locationBonus = queryLocationTerms > 0 && candidateLocationTerms > 0 ? 0.08 : 0;

  return f1 + locationBonus;
};

export const rankSuggestions = ({
  queryText = "",
  suggestions = [],
  limit = 8,
} = {}) => {
  const scored = (suggestions || []).map((item, index) => {
    const textualScore = scoreMatch({
      queryText,
      candidateText: item.displayDescription,
      candidateTags: item.tags,
    });

    return {
      ...item,
      _textualScore: textualScore,
      _fallbackOrder: Number.isFinite(item.defaultOrder) ? item.defaultOrder : index,
      _usageCount: Number(item.usageCount || 0),
    };
  });

  scored.sort((a, b) => {
    if (b._textualScore !== a._textualScore) return b._textualScore - a._textualScore;
    if (b._usageCount !== a._usageCount) return b._usageCount - a._usageCount;
    return a._fallbackOrder - b._fallbackOrder;
  });

  return scored.slice(0, limit).map((item) => ({
    id: item.id,
    source: item.source,
    scope: item.scope || null,
    displayDescription: item.displayDescription,
    normalizedKey: item.normalizedKey,
    timeHours: Number(item.timeHours),
    usageCount: Number(item._usageCount || 0),
  }));
};
