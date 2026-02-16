// file location: src/features/labour-times/cache.js

const CACHE = new Map();

export const getCachedValue = (key, ttlMs = 30000) => {
  const existing = CACHE.get(key);
  if (!existing) return null;
  if (Date.now() - existing.createdAt > ttlMs) {
    CACHE.delete(key);
    return null;
  }
  return existing.value;
};

export const setCachedValue = (key, value) => {
  CACHE.set(key, {
    createdAt: Date.now(),
    value,
  });
};

export const clearCacheByPrefix = (prefix = "") => {
  if (!prefix) {
    CACHE.clear();
    return;
  }
  const keys = Array.from(CACHE.keys());
  keys.forEach((key) => {
    if (String(key).startsWith(prefix)) {
      CACHE.delete(key);
    }
  });
};
