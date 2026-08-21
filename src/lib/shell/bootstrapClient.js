// file location: src/lib/shell/bootstrapClient.js
//
// Client half of /api/shell/bootstrap.
//
// Several independent providers (UserContext, RosterContext, useMessagesBadge)
// each need one piece of the shell payload. Without coordination they each fire
// their own request on mount. This module makes them share ONE in-flight request
// and one short-lived result.
//
// Contract:
//   * `getShellBootstrap()` resolves to the payload, or null if it could not be
//     fetched. Callers MUST treat null as "fetch it yourself" — every provider
//     keeps its own endpoint as the refresh path, so this is only ever a
//     head start, never a dependency.
//   * The result is cached for BOOTSTRAP_TTL_MS so a provider mounting slightly
//     later reuses it instead of issuing a second request.
//   * `invalidateShellBootstrap()` drops it (call on logout / user switch).

const BOOTSTRAP_TTL_MS = 30_000;

let inflight = null;
let cached = null;
let cachedAt = 0;
let cachedForUserKey = null;

const isFresh = () => cached !== null && Date.now() - cachedAt < BOOTSTRAP_TTL_MS;

/**
 * @param {{ userKey?: string|number|null, force?: boolean }} [options]
 *   userKey — identifies who the payload belongs to. When it changes the cache
 *   is dropped, so a user switch can never read the previous user's shell data.
 * @returns {Promise<object|null>}
 */
export function getShellBootstrap({ userKey = null, force = false } = {}) {
  if (typeof window === "undefined") return Promise.resolve(null);

  const key = userKey == null ? null : String(userKey);
  if (key !== cachedForUserKey) {
    cached = null;
    inflight = null;
    cachedForUserKey = key;
  }

  if (!force && isFresh()) return Promise.resolve(cached);
  if (inflight) return inflight;

  inflight = fetch("/api/shell/bootstrap", { credentials: "include" })
    .then(async (response) => {
      if (!response.ok) return null;
      const payload = await response.json().catch(() => null);
      if (!payload?.success) return null;
      cached = payload.data || null;
      cachedAt = Date.now();
      return cached;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Read the cached payload synchronously, or null. Never triggers a request. */
export function peekShellBootstrap() {
  return isFresh() ? cached : null;
}

export function invalidateShellBootstrap() {
  cached = null;
  cachedAt = 0;
  inflight = null;
  cachedForUserKey = null;
}

export default getShellBootstrap;
