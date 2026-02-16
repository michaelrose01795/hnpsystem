// file location: src/features/parts-search-suggestions/cache.js

const CACHE = new Map();

export const getSuggestionCache = (key, ttlMs = 30000) => {
  const item = CACHE.get(key);
  if (!item) return null;
  if (Date.now() - item.createdAt > ttlMs) {
    CACHE.delete(key);
    return null;
  }
  return item.value;
};

export const setSuggestionCache = (key, value) => {
  CACHE.set(key, {
    createdAt: Date.now(),
    value,
  });
};

export const clearSuggestionCache = (prefix = "") => {
  if (!prefix) {
    CACHE.clear();
    return;
  }
  Array.from(CACHE.keys()).forEach((key) => {
    if (String(key).startsWith(prefix)) CACHE.delete(key);
  });
};
