// file location: src/lib/support/rateLimit.js
//
// Phase 7 (hardening) — abuse-resistant rate limiting for the Help & Diagnostics
// ("support") submit endpoint. A single authenticated user (or IP) can only file
// a bounded number of reports per window; sustained bursts are flagged as abuse
// so the route can audit-log them.
//
// Design:
//   - PURE core (`checkRateLimit`) that takes an explicit store + clock, so it is
//     deterministic and unit-testable in the node Vitest env with no timers.
//   - A process-local default store (`defaultSupportRateStore`) for the serverless
//     instance to share across requests. In-memory by design — this is a dev-tool
//     endpoint, not a payment gateway; see the "known limitations" note in
//     docs/Support/help-diagnostics.md (per-instance, resets on cold start).
//   - Sliding-window log: we keep the timestamps of recent hits per key and count
//     how many fall inside the window. Cheap for the small volumes this endpoint
//     sees, and it self-prunes on every check so the map cannot grow unbounded.
//
// It records NO request content — only a key (user id or hashed-ish IP) and hit
// timestamps. No privacy surface is added.

// Defaults tuned for a human filing bug reports, not a script.
export const SUPPORT_RATE_LIMIT = Object.freeze({
  windowMs: 60 * 1000, // 1 minute rolling window
  max: 5, // reports allowed per window per key
  // Abuse: more than this many hits in the window (i.e. the caller kept hammering
  // after being told to stop) marks the key as abusive so the route can audit it.
  abuseThreshold: 20,
  // How long a key's timestamps are retained before it is eligible for pruning.
  retainMs: 10 * 60 * 1000,
});

/**
 * Create a fresh in-memory store. One Map of key → number[] (hit timestamps).
 * @returns {{ hits: Map<string, number[]> }}
 */
export function createRateStore() {
  return { hits: new Map() };
}

// Process-local store shared by the API route across warm invocations.
export const defaultSupportRateStore = createRateStore();

/**
 * Derive a stable rate-limit key from a request context. Prefers the
 * authenticated user id (so a user cannot dodge the limit by rotating IPs);
 * falls back to the client IP for the rare unauthenticated path.
 * @param {{ userId?: number|string|null, ip?: string|null }} ctx
 * @returns {string}
 */
export function rateLimitKey({ userId = null, ip = null } = {}) {
  if (userId != null && userId !== "") return `user:${userId}`;
  if (ip) return `ip:${ip}`;
  return "anon";
}

/**
 * Pure sliding-window check. Does not mutate on a rejected/allowed decision beyond
 * recording the hit and pruning expired entries.
 *
 * @param {object} args
 * @param {string} args.key — caller identity (see rateLimitKey).
 * @param {{ hits: Map<string, number[]> }} args.store
 * @param {number} [args.now] — epoch ms (injected for tests; defaults to Date.now()).
 * @param {object} [args.limit] — override of SUPPORT_RATE_LIMIT.
 * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number, count: number, abuse: boolean }}
 */
export function checkRateLimit({ key, store, now, limit } = {}) {
  const cfg = { ...SUPPORT_RATE_LIMIT, ...(limit || {}) };
  const ts = typeof now === "number" ? now : Date.now();
  if (!store || !store.hits) throw new Error("checkRateLimit requires a store");
  const k = key || "anon";

  const windowStart = ts - cfg.windowMs;
  const prev = store.hits.get(k) || [];
  // Keep only hits still inside the window; this is both the count basis and the
  // prune step so the array never grows without bound.
  const recent = prev.filter((t) => t > windowStart);

  const countBefore = recent.length;
  const allowed = countBefore < cfg.max;

  // Record this attempt regardless of the decision — a rejected attempt still
  // counts towards abuse detection (that is the whole point of the threshold).
  recent.push(ts);
  store.hits.set(k, recent);

  const count = recent.length;
  const abuse = count > cfg.abuseThreshold;

  // Time until the oldest in-window hit falls out (so the caller regains a slot).
  const oldest = recent[0];
  const retryAfterMs = allowed ? 0 : Math.max(0, oldest + cfg.windowMs - ts);

  return {
    allowed,
    remaining: Math.max(0, cfg.max - count),
    retryAfterMs,
    count,
    abuse,
  };
}

/**
 * Opportunistic prune of keys whose newest hit is older than retainMs. Called
 * cheaply from the route so an idle instance sheds memory over time. Safe to call
 * on every request; O(keys) and only runs the filter on stale entries.
 * @param {{ hits: Map<string, number[]> }} store
 * @param {number} [now]
 * @param {object} [limit]
 * @returns {number} number of keys evicted
 */
export function pruneRateStore(store, now, limit) {
  const cfg = { ...SUPPORT_RATE_LIMIT, ...(limit || {}) };
  const ts = typeof now === "number" ? now : Date.now();
  if (!store || !store.hits) return 0;
  let evicted = 0;
  for (const [key, arr] of store.hits) {
    const newest = arr.length ? arr[arr.length - 1] : 0;
    if (newest < ts - cfg.retainMs) {
      store.hits.delete(key);
      evicted += 1;
    }
  }
  return evicted;
}
