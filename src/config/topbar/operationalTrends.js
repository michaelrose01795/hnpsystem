// file location: src/config/topbar/operationalTrends.js
//
// OPERATIONAL TRENDS (Phase 5.1) — PURE trend engine. Turns a short rolling
// history of the Phase 2 operational `metrics` snapshots into per-metric trend
// descriptors (current vs previous vs window-start, delta, direction, whether a
// value is rising or falling). This is the shared "is it getting better or
// worse?" signal that the predictive recommendations (5.1) and the proactive
// alerts (5.3) both read — so a metric "climbing towards a problem" is detected
// in ONE place.
//
// No React/window/storage/Date — deterministic and unit-testable. The hook
// (src/hooks/useOperationalTrends.js) holds the rolling history from the metrics
// already flowing and calls deriveTrends; nothing here polls or stores.
//
// A trend descriptor for a metric key:
//   { key, current, previous, first, delta, windowDelta, direction, rising,
//     falling, samples }
// direction ∈ "up" | "down" | "flat" (from the most recent step).

// The operational metrics worth trending. Anything numeric in the snapshot is
// tracked, but this list documents the ones the reasoning layers care about and
// guarantees a descriptor exists (as flat/zero) even before history builds.
export const TRENDED_METRICS = [
  "jobsWaiting",
  "jobsInProgress",
  "appointmentsToday",
  "overdueJobs",
  "waitingApprovals",
  "techniciansAvailable",
  "partsOutstanding",
  "pendingDeliveries",
];

function numOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function directionOf(delta) {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

// Build a single metric's trend from its ordered (oldest→newest) numeric samples.
function trendForSamples(key, samples) {
  const current = samples.length ? samples[samples.length - 1] : null;
  const previous = samples.length > 1 ? samples[samples.length - 2] : current;
  const first = samples.length ? samples[0] : null;
  const delta = current == null || previous == null ? 0 : current - previous;
  const windowDelta = current == null || first == null ? 0 : current - first;
  const direction = directionOf(delta);
  return {
    key,
    current,
    previous,
    first,
    delta,
    windowDelta,
    direction,
    rising: delta > 0,
    falling: delta < 0,
    samples: samples.length,
  };
}

// Derive the trend map from a rolling history of metric snapshots.
// `history` is oldest→newest: [{ jobsWaiting: 3, ... }, { jobsWaiting: 5, ... }].
// Returns { byKey: { [key]: descriptor }, count } where every key that appears in
// any snapshot (plus the TRENDED_METRICS) has a descriptor. Never throws.
export function deriveTrends(history = []) {
  const snapshots = Array.isArray(history) ? history.filter((s) => s && typeof s === "object") : [];

  // Which keys to build descriptors for: the documented set + anything numeric
  // that actually appeared.
  const keys = new Set(TRENDED_METRICS);
  for (const snap of snapshots) {
    for (const k of Object.keys(snap)) {
      if (numOrNull(snap[k]) != null) keys.add(k);
    }
  }

  const byKey = {};
  for (const key of keys) {
    // Collect this key's numeric samples in order, skipping snapshots where it
    // was absent/errored (so a single failed poll doesn't read as "dropped to 0").
    const samples = [];
    for (const snap of snapshots) {
      const v = numOrNull(snap[key]);
      if (v != null) samples.push(v);
    }
    byKey[key] = trendForSamples(key, samples);
  }

  return { byKey, count: snapshots.length };
}

// Safe accessor — always returns a descriptor (flat/empty when unknown) so
// consumers never guard.
export function trendFor(trends, key) {
  const entry = trends?.byKey?.[key];
  if (entry) return entry;
  return {
    key,
    current: null,
    previous: null,
    first: null,
    delta: 0,
    windowDelta: 0,
    direction: "flat",
    rising: false,
    falling: false,
    samples: 0,
  };
}

// Is `key` rising by at least `by` over the most recent step? Used by alerts /
// recommendations to spot a metric "heading towards a problem".
export function isRising(trends, key, by = 1) {
  const t = trendFor(trends, key);
  return t.current != null && t.delta >= by;
}

// Is `key` falling by at least `by` over the most recent step (e.g. free capacity
// draining)?
export function isFalling(trends, key, by = 1) {
  const t = trendFor(trends, key);
  return t.current != null && t.delta <= -by;
}

// A compact "3 → 5" style movement label for a key, or null when flat/unknown.
export function movementLabel(trends, key) {
  const t = trendFor(trends, key);
  if (t.current == null || t.previous == null || t.delta === 0) return null;
  return `${t.previous} → ${t.current}`;
}

export const __test__ = { trendForSamples };
