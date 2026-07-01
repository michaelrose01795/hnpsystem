// file location: src/lib/support/investigationCache.js
//
// Help & Diagnostics ("support") — investigation result cache. The investigation
// engine is deterministic for a given snapshot (+ prior-report set), so we cache
// results by a stable key to avoid re-analysing the same incident (e.g. a dev
// viewer re-opening a report, or the same snapshot analysed twice in one request).
//
// PURE + store-injected (an in-memory Map by default, but any Map-like store
// works) so it is node-testable and has no ambient global state leaking between
// callers unless they share a store.

import { stableHash } from "@/lib/support/incidentClustering";
import { buildInvestigation } from "@/lib/support/investigation";

// A process-wide default store (bounded) for server callers that don't bring
// their own. Kept small so it can't grow unbounded.
const DEFAULT_MAX = 200;
const defaultStore = new Map();

function setBounded(store, key, value, max = DEFAULT_MAX) {
  if (store.size >= max) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, value);
}

/**
 * Stable cache key for a snapshot + the identity of the prior-report set. The
 * key changes when the diagnostics OR the set of prior reports change, so a
 * newly-arrived similar incident invalidates a stale cached result.
 * @param {object} snapshot
 * @param {Array} [priorReports]
 * @returns {string}
 */
export function investigationKey(snapshot = {}, priorReports = []) {
  const core = {
    route: snapshot?.route?.asPath || snapshot?.route?.pathname || "",
    errors: (snapshot?.unhandled_errors || []).map((e) => e?.message),
    requests: (snapshot?.failed_requests || []).map((r) => `${r?.method} ${r?.url} ${r?.status}`),
    console: (snapshot?.console_errors || []).map((c) => c?.msg),
    actions: (snapshot?.recent_actions || []).length,
    priors: (priorReports || []).map((r) => r?.id).sort(),
  };
  return stableHash(JSON.stringify(core));
}

/**
 * Build the investigation, reusing a cached result when the same key was seen.
 * @param {object} snapshot
 * @param {{ priorReports?: Array, now?: string, analysis?: object, store?: Map, maxEntries?: number }} [options]
 * @returns {{ investigation: object, cached: boolean, key: string }}
 */
export function getOrBuildInvestigation(snapshot = {}, options = {}) {
  const store = options.store || defaultStore;
  const key = investigationKey(snapshot, options.priorReports);
  if (store.has(key)) {
    return { investigation: store.get(key), cached: true, key };
  }
  const investigation = buildInvestigation(snapshot, options);
  setBounded(store, key, investigation, options.maxEntries);
  return { investigation, cached: false, key };
}

/** Clear the default process cache (tests / manual invalidation). */
export function clearInvestigationCache() {
  defaultStore.clear();
}
