// file location: src/config/topbar/behaviourModel.js
//
// BEHAVIOUR MODEL (Phase 5.7) — PURE frequency model. Learns which pages / actions
// / workflows a user actually opens, so the workspace can become increasingly
// personalised — the predictive recommendations (5.1) surface "you use this
// often", and the assistant can lead with what this person reaches for.
//
// Honest scope: this is on-device, per-user learning over the same route signal
// Phase 3.2 already records — a decaying count, NOT server-side profiling. It is
// capped, it forgets (recency half-life) so a stale habit fades, and it is fully
// resettable — personalisation that stays under the user's control.
//
// No React/window/storage/Date — deterministic and unit-testable. `ts`/`now` are
// injected by the hook (src/hooks/useBehaviourModel.js), which persists the model
// via workspaceStorage and passes Date.now().
//
// Model shape:
//   { version: 1, counts: { [href]: { href, label, category, count, first, last } } }

export const BEHAVIOUR_VERSION = 1;

export function emptyModel() {
  return { version: BEHAVIOUR_VERSION, counts: {} };
}

// Coerce a stored (possibly stale/corrupt) blob into a valid model. Never throws.
export function normaliseModel(stored) {
  if (!stored || typeof stored !== "object" || typeof stored.counts !== "object" || !stored.counts) {
    return emptyModel();
  }
  const counts = {};
  for (const [href, entry] of Object.entries(stored.counts)) {
    if (!href || typeof entry !== "object") continue;
    const count = Number(entry.count);
    if (!Number.isFinite(count) || count <= 0) continue;
    counts[href] = {
      href,
      label: typeof entry.label === "string" ? entry.label : "",
      category: typeof entry.category === "string" ? entry.category : null,
      count,
      first: Number.isFinite(entry.first) ? entry.first : 0,
      last: Number.isFinite(entry.last) ? entry.last : 0,
    };
  }
  return { version: BEHAVIOUR_VERSION, counts };
}

// Recency decay: a visit's weight halves every `halfLifeMs`. Deterministic given
// `now`. Guards against a missing/future timestamp.
function decay(last, now, halfLifeMs) {
  if (!Number.isFinite(last) || !Number.isFinite(now) || !halfLifeMs) return 1;
  const age = Math.max(0, now - last);
  return Math.pow(0.5, age / halfLifeMs);
}

// A recency-weighted frequency score for one entry.
export function scoreEntry(entry, now, halfLifeMs) {
  if (!entry) return 0;
  return (entry.count || 0) * decay(entry.last, now, halfLifeMs);
}

// Record one visit, returning a NEW model (never mutates). Caps the number of
// distinct tracked hrefs, evicting the lowest-scoring entry when over `max`.
export function recordVisit(model, { href, label, category, ts } = {}, { max = 80, halfLifeMs } = {}) {
  if (!href || typeof href !== "string") return model || emptyModel();
  const base = model && model.counts ? model : emptyModel();
  const counts = { ...base.counts };
  const existing = counts[href];
  counts[href] = {
    href,
    label: label || existing?.label || "",
    category: category || existing?.category || null,
    count: (existing?.count || 0) + 1,
    first: existing?.first || ts || 0,
    last: ts || existing?.last || 0,
  };

  // Evict the weakest entry if we're over the cap (never evict the one just used).
  const keys = Object.keys(counts);
  if (keys.length > max) {
    let weakest = null;
    let weakestScore = Infinity;
    for (const key of keys) {
      if (key === href) continue;
      const s = scoreEntry(counts[key], ts || 0, halfLifeMs);
      if (s < weakestScore) {
        weakestScore = s;
        weakest = key;
      }
    }
    if (weakest) delete counts[weakest];
  }

  return { version: BEHAVIOUR_VERSION, counts };
}

// Rank the tracked actions by recency-weighted frequency, strongest first. Only
// entries with at least `minCount` visits qualify (a single visit isn't a habit).
export function rankActions(model, { now = 0, halfLifeMs, limit = 6, minCount = 2 } = {}) {
  const counts = model?.counts || {};
  return Object.values(counts)
    .filter((e) => (e.count || 0) >= minCount)
    .map((e) => ({
      href: e.href,
      label: e.label || "",
      category: e.category || null,
      count: e.count || 0,
      score: scoreEntry(e, now, halfLifeMs),
    }))
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, limit);
}

// Total distinct tracked destinations — for a "learning from N pages" note.
export function trackedCount(model) {
  return Object.keys(model?.counts || {}).length;
}

export const __test__ = { decay };
