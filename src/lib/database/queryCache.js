// file location: src/lib/database/queryCache.js
// Lightweight in-memory cache with TTL and in-flight deduplication.
// No external dependencies — designed to prevent duplicate simultaneous
// Supabase queries and reduce load from rapid repeated calls.

const DEFAULT_TTL_MS = 5000; // 5-second cache window

const cache = new Map();      // key → { data, expiresAt }
const inflight = new Map();   // key → Promise

/**
 * Returns cached data if still within TTL, otherwise null.
 */
function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Stores data in the cache with the given TTL.
 */
function setInCache(key, data, ttlMs = DEFAULT_TTL_MS) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/**
 * Wraps an async fetcher with caching and in-flight deduplication.
 *
 * If a cached result exists and is still fresh, it's returned immediately.
 * If the same key is already being fetched, the existing promise is reused
 * so only one request is made.
 *
 * @param {string} key   - Cache key (e.g. "jobs:all", "jobs:number:12345")
 * @param {Function} fn  - Async function that performs the actual fetch
 * @param {number} [ttlMs] - Cache TTL in milliseconds (default 5000)
 * @returns {Promise<*>}  - The fetched (or cached) result
 */
export async function cachedQuery(key, fn, ttlMs = DEFAULT_TTL_MS) {
  // 1. Return from cache if fresh
  const cached = getFromCache(key);
  if (cached !== null) return cached;

  // 2. Deduplicate in-flight requests for the same key
  if (inflight.has(key)) return inflight.get(key);

  // 3. Execute the fetch, cache the result, then clean up
  const promise = fn()
    .then((result) => {
      setInCache(key, result, ttlMs);
      inflight.delete(key);
      return result;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}

/**
 * Invalidate all cache entries whose key starts with the given prefix.
 * Call this after mutations so subsequent reads get fresh data.
 *
 * @param {string} prefix - Key prefix to invalidate (e.g. "jobs:")
 */
export function invalidateCache(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Clear the entire cache. Useful for logout or full refresh scenarios.
 */
export function clearCache() {
  cache.clear();
  inflight.clear();
}
