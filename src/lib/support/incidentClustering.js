// file location: src/lib/support/incidentClustering.js
//
// Help & Diagnostics ("support") — incident fingerprinting + clustering.
//
// Duplicate/"similar previous incident" detection that clusters across MULTIPLE
// signals (route, section, component, error signatures, request signatures,
// screenshot hashes, behaviour) instead of matching description text. Used by the
// investigation engine to surface "similar previous incidents" and "repeated
// failures on the same route/component".
//
// PURE + dependency-free (reads only sanitised snapshots + injected prior-report
// fingerprints) so it is fully node-testable and safe on client or server.

import { normaliseSignature } from "@/lib/support/diagnosticAnalysis";

const arr = (v) => (Array.isArray(v) ? v : []);
const uniq = (list) => Array.from(new Set(list.filter(Boolean)));
const reducePath = (url) => String(url || "").split("?")[0];

const topComponent = (componentStack) => {
  if (!componentStack || typeof componentStack !== "string") return null;
  const line = componentStack.split("\n").map((l) => l.trim()).find(Boolean);
  const m = line && line.match(/^(?:in|at)\s+([A-Za-z0-9_$.]+)/);
  return m ? m[1] : null;
};

// Stable, non-cryptographic string hash (djb2). Deterministic — identical input
// gives identical output, so identical screenshots/errors cluster together.
export function stableHash(input) {
  const str = String(input == null ? "" : input);
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return `h${h.toString(36)}`;
}

/**
 * Build a multi-signal fingerprint from a sanitised diagnostics snapshot.
 * Screenshot hashes come from `diagnostics.attachments[].hash` (added server-side
 * from the image bytes) so identical images cluster even with no text overlap.
 *
 * @param {object} snapshot
 * @returns {object} fingerprint
 */
export function buildFingerprint(snapshot = {}) {
  const route = reducePath(snapshot?.route?.asPath || snapshot?.route?.pathname || "");
  const sectionKey = snapshot?.code_ownership?.section_key || null;

  const errorSignatures = uniq(
    arr(snapshot?.unhandled_errors)
      .map((e) => normaliseSignature(e?.message))
      .concat(arr(snapshot?.console_errors).filter((c) => c?.level === "error").map((c) => normaliseSignature(c?.msg)))
  );

  const requestSignatures = uniq(
    arr(snapshot?.failed_requests).map((r) => {
      const cls = Number.isFinite(r?.status) ? `${Math.floor(r.status / 100)}xx` : "err";
      return normaliseSignature(`${r?.method || "GET"} ${reducePath(r?.url)} ${cls}`);
    })
  );

  const component =
    topComponent(arr(snapshot?.unhandled_errors).find((e) => e?.componentStack)?.componentStack) || sectionKey;

  const screenshotHashes = uniq(arr(snapshot?.attachments).map((a) => a?.hash).filter(Boolean));

  // Behaviour signature: the shape of the last few actions (types + section keys),
  // so two incidents reached "the same way" cluster even with different errors.
  const behaviourSignature = normaliseSignature(
    arr(snapshot?.recent_actions)
      .slice(-6)
      .map((a) => `${a?.type || ""}:${a?.sectionKey || ""}`)
      .join(">")
  );

  return { route, sectionKey, component, errorSignatures, requestSignatures, screenshotHashes, behaviourSignature };
}

// Jaccard overlap of two string arrays (0..1). Empty vs empty → 0 (no evidence).
function jaccard(a, b) {
  const sa = new Set(a || []);
  const sb = new Set(b || []);
  if (sa.size === 0 && sb.size === 0) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

// Weighted multi-signal similarity between two fingerprints, plus the reasons
// that contributed (for explainability in the investigation).
const WEIGHTS = {
  errorSignatures: 0.34,
  requestSignatures: 0.24,
  screenshotHashes: 0.16,
  component: 0.12,
  route: 0.08,
  behaviourSignature: 0.06,
};

/**
 * @returns {{ score: number, reasons: string[] }}
 */
export function similarity(a = {}, b = {}) {
  const reasons = [];
  let score = 0;

  const errJ = jaccard(a.errorSignatures, b.errorSignatures);
  if (errJ > 0) {
    score += WEIGHTS.errorSignatures * errJ;
    reasons.push("same error signature");
  }
  const reqJ = jaccard(a.requestSignatures, b.requestSignatures);
  if (reqJ > 0) {
    score += WEIGHTS.requestSignatures * reqJ;
    reasons.push("same failing request");
  }
  const shotJ = jaccard(a.screenshotHashes, b.screenshotHashes);
  if (shotJ > 0) {
    score += WEIGHTS.screenshotHashes * shotJ;
    reasons.push("identical screenshot");
  }
  if (a.component && a.component === b.component) {
    score += WEIGHTS.component;
    reasons.push("same component");
  }
  if (a.route && a.route === b.route) {
    score += WEIGHTS.route;
    reasons.push("same route");
  }
  if (a.behaviourSignature && a.behaviourSignature === b.behaviourSignature) {
    score += WEIGHTS.behaviourSignature;
    reasons.push("same steps");
  }

  return { score: Number(Math.min(1, score).toFixed(3)), reasons };
}

/**
 * Rank prior reports by similarity to the current fingerprint.
 * @param {object} fingerprint current incident fingerprint
 * @param {Array<{ id: string, fingerprint: object, route?: string, createdAt?: string }>} priorReports
 * @param {{ threshold?: number, limit?: number }} [opts]
 * @returns {Array<{ reportId: string, score: number, reasons: string[], route?: string, createdAt?: string }>}
 */
export function findSimilarReports(fingerprint, priorReports = [], { threshold = 0.25, limit = 5 } = {}) {
  return arr(priorReports)
    .map((r) => {
      const { score, reasons } = similarity(fingerprint, r?.fingerprint || {});
      return { reportId: r?.id, score, reasons, route: r?.route, createdAt: r?.createdAt };
    })
    .filter((m) => m.reportId && m.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

const toMs = (v) => {
  const t = Date.parse(String(v || ""));
  return Number.isFinite(t) ? t : null;
};

/**
 * Determine the FIRST app version an incident appeared in and the LATEST version
 * it was reproduced on, by matching prior reports to the current fingerprint and
 * ordering the matched occurrences (prior + current) by capture time. This is the
 * foundation for cross-release regression tracking (Help & Diagnostics §8): once
 * a fix ships, a later matching report in a newer version flags a regression.
 *
 * Prior reports must carry { fingerprint, appVersion?, commitSha?, createdAt? }.
 *
 * @param {object} fingerprint current incident fingerprint
 * @param {Array} priorReports
 * @param {{ version?: string, commitSha?: string, at?: string }} [current] the report being ingested
 * @param {{ threshold?: number }} [opts]
 * @returns {{
 *   occurrences: number,
 *   firstSeenVersion: string|null, firstSeenCommit: string|null, firstSeenAt: string|null,
 *   lastSeenVersion: string|null, lastSeenCommit: string|null, lastSeenAt: string|null,
 *   versions: string[], spansMultipleVersions: boolean, isRegression: boolean
 * }}
 */
export function versionRange(fingerprint = {}, priorReports = [], current = {}, { threshold = 0.5 } = {}) {
  const occurrences = [];
  // The current report always counts as an occurrence.
  occurrences.push({
    version: current?.version || null,
    commit: current?.commitSha || null,
    at: current?.at || null,
    isCurrent: true,
  });
  for (const r of arr(priorReports)) {
    const { score } = similarity(fingerprint, r?.fingerprint || {});
    if (score < threshold) continue;
    occurrences.push({
      version: r?.appVersion || null,
      commit: r?.commitSha || null,
      at: r?.createdAt || null,
      isCurrent: false,
    });
  }

  // Order by capture time; occurrences with no timestamp sink to the end so a
  // dated occurrence always wins first/last.
  const ordered = occurrences
    .map((o, i) => ({ ...o, _ms: toMs(o.at), _i: i }))
    .sort((a, b) => {
      if (a._ms == null && b._ms == null) return a._i - b._i;
      if (a._ms == null) return 1;
      if (b._ms == null) return -1;
      return a._ms - b._ms;
    });

  const first = ordered[0] || {};
  const last = ordered[ordered.length - 1] || {};
  const versions = uniq(occurrences.map((o) => o.version));
  const commits = uniq(occurrences.map((o) => o.commit));

  return {
    occurrences: occurrences.length,
    firstSeenVersion: first.version || null,
    firstSeenCommit: first.commit || null,
    firstSeenAt: first.at || null,
    lastSeenVersion: last.version || null,
    lastSeenCommit: last.commit || null,
    lastSeenAt: last.at || null,
    versions,
    spansMultipleVersions: versions.length > 1,
    // Recurring across more than one build/commit → a candidate regression: the
    // same incident reappeared after the code moved on.
    isRegression: occurrences.length > 1 && (versions.length > 1 || commits.length > 1),
  };
}

/**
 * Count prior reports that failed on the same route and/or component — the
 * "repeated failures" signal (independent of the fuzzy similarity score).
 * @returns {{ route: string|null, routeCount: number, component: string|null, componentCount: number }}
 */
export function repeatedFailures(fingerprint = {}, priorReports = []) {
  let routeCount = 0;
  let componentCount = 0;
  for (const r of arr(priorReports)) {
    const fp = r?.fingerprint || {};
    if (fingerprint.route && fp.route === fingerprint.route) routeCount += 1;
    if (fingerprint.component && fp.component === fingerprint.component) componentCount += 1;
  }
  return {
    route: fingerprint.route || null,
    routeCount,
    component: fingerprint.component || null,
    componentCount,
  };
}
