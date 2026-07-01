// file location: src/lib/support/savedViewValidation.js
//
// Phase 8 — PURE validation/normalisation for server-synced saved views +
// developer preferences (mirrors the triageValidation.js split so it is testable
// without the Supabase client). The API routes and the DB helper both run input
// through here before it is persisted, so a malformed or oversized payload can
// never reach the database.

export const SAVED_VIEW_SCOPES = Object.freeze(["personal", "shared"]);
export const SAVED_VIEW_SURFACES = Object.freeze(["support", "live-ops", "health"]);

// The only filter keys a saved view may carry (matches the Support Centre's
// filter model — see adminView.js / savedViews.js). Anything else is dropped.
export const SAVED_VIEW_FILTER_KEYS = Object.freeze([
  "status",
  "severity",
  "category",
  "q",
  "sort",
  "unassigned",
  "openOnly",
  "regressionsOnly",
]);

const MAX_NAME = 60;
const MAX_FILTER_STRING = 120;
const BOOLEAN_FILTER_KEYS = new Set(["unassigned", "openOnly", "regressionsOnly"]);

const clampString = (value, max) => String(value ?? "").trim().slice(0, max);

export function normaliseScope(scope) {
  return SAVED_VIEW_SCOPES.includes(scope) ? scope : "personal";
}

export function normaliseSurface(surface) {
  return SAVED_VIEW_SURFACES.includes(surface) ? surface : "support";
}

// Keep only known filter keys; coerce booleans; clamp strings; drop empties.
export function normaliseFilters(filters = {}) {
  const out = {};
  if (!filters || typeof filters !== "object") return out;
  for (const key of SAVED_VIEW_FILTER_KEYS) {
    if (!(key in filters)) continue;
    const raw = filters[key];
    if (BOOLEAN_FILTER_KEYS.has(key)) {
      if (raw === true || raw === "true" || raw === 1) out[key] = true;
      continue;
    }
    const str = clampString(raw, MAX_FILTER_STRING);
    if (str) out[key] = str;
  }
  return out;
}

/**
 * Validate + normalise a saved-view create/update payload.
 * @returns {{ ok: true, value: object } | { ok: false, error: string }}
 */
export function validateSavedViewInput(input = {}, { requireName = true } = {}) {
  const name = clampString(input.name, MAX_NAME);
  if (requireName && !name) {
    return { ok: false, error: "A view name is required." };
  }
  const value = {
    name,
    scope: normaliseScope(input.scope),
    surface: normaliseSurface(input.surface),
    filters: normaliseFilters(input.filters),
  };
  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// Developer + notification preferences. A small, closed allowlist of settings —
// unknown keys are dropped so a client can't stuff arbitrary data into the blob.
// ---------------------------------------------------------------------------
export const PREFERENCE_DEFAULTS = Object.freeze({
  density: "comfortable", // 'comfortable' | 'compact'
  defaultSurface: "home",
  defaultSort: "impact",
  liveOpsPollSeconds: 4,
  notifyOnRegression: true,
  notifyOnCritical: true,
  notifyOnAssignment: true,
});

const DENSITIES = new Set(["comfortable", "compact"]);
const MIN_POLL = 2;
const MAX_POLL = 60;

export function normalisePreferences(prefs = {}) {
  const src = prefs && typeof prefs === "object" ? prefs : {};
  const out = { ...PREFERENCE_DEFAULTS };

  if (DENSITIES.has(src.density)) out.density = src.density;
  if (typeof src.defaultSurface === "string" && src.defaultSurface.trim()) {
    out.defaultSurface = clampString(src.defaultSurface, 40);
  }
  if (typeof src.defaultSort === "string" && src.defaultSort.trim()) {
    out.defaultSort = clampString(src.defaultSort, 40);
  }
  if (src.liveOpsPollSeconds != null) {
    const n = Math.round(Number(src.liveOpsPollSeconds));
    if (Number.isFinite(n)) out.liveOpsPollSeconds = Math.min(MAX_POLL, Math.max(MIN_POLL, n));
  }
  for (const key of ["notifyOnRegression", "notifyOnCritical", "notifyOnAssignment"]) {
    if (key in src) out[key] = Boolean(src[key]);
  }
  return out;
}
