// file location: src/lib/reporting/cache.js
//
// CACHING framework (Phase-1 §9.10, tier 1 — the short-TTL read cache).
//
// Absorbs dashboard refresh storms by caching engine results keyed by
// (kind, kpiId, filterHash, scopeHash) for ~30–60s. Reuses the existing
// in-process queryCache (src/lib/database/queryCache.js) so reporting shares the
// established cache + in-flight dedupe behaviour rather than inventing a new one.
//
// Tier 2 (snapshot/rollup tables) and tier 3 (client SWR) live elsewhere (the
// data layer and the future UI respectively).

import { cachedQuery, invalidateCache } from "@/lib/database/queryCache";
import { filterHash } from "./filters";
import { scopeHash } from "./permissionScope";

const PREFIX = "reporting:";
// 45s sits in the middle of the §9.10 30–60s window.
export const DEFAULT_REPORTING_TTL_MS = 45000;

// Build a stable cache key for a reporting read.
export function reportingCacheKey(kind, { kpiId = "", filter = null, scope = null, extra = "" } = {}) {
  const fh = filter ? filterHash(filter) : "nofilter";
  const sh = scope ? scopeHash(scope) : "noscope";
  return `${PREFIX}${kind}:${kpiId}:${fh}:${sh}${extra ? `:${extra}` : ""}`;
}

// Wrap a result-producing async fn in the reporting read cache.
export function withReportingCache(kind, parts, fn, ttlMs = DEFAULT_REPORTING_TTL_MS) {
  const key = reportingCacheKey(kind, parts);
  return cachedQuery(key, fn, ttlMs);
}

// Invalidate all reporting cache entries (e.g. after a manual recompute).
export function invalidateReportingCache() {
  invalidateCache(PREFIX);
}

export default withReportingCache;
