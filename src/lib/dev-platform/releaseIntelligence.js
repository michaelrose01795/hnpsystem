// file location: src/lib/dev-platform/releaseIntelligence.js
//
// Phase 9 — Developer Platform release & deployment intelligence. PURE,
// node-testable aggregation over the LIGHT report rows (build columns +
// investigation subfields — never the diagnostics blob). It reconstructs a
// deployment registry from the version/commit columns the ingest engine already
// stamps (buildInfo.js — Phase 5), scores per-release quality, tracks incidents
// across releases, and recommends AUTO-REOPEN when a resolved incident recurs on
// a newer build (a regression).
//
// No React, no I/O, no window. Deterministic — `now` is injected.

import { fingerprintKey, isOpenStatus, severityRank, SEVERITY_META } from "@/lib/support/adminView";

const arr = (v) => (Array.isArray(v) ? v : []);
const ms = (v) => {
  const t = Date.parse(String(v || ""));
  return Number.isFinite(t) ? t : null;
};

// Closed statuses eligible for auto-reopen when an incident recurs.
const REOPENABLE = new Set(["resolved", "wont_fix"]);

const releaseKey = (r) => r?.app_version || r?.commit_sha || r?.build_id || "(unversioned)";

// ---------------------------------------------------------------------------
// Deployment registry — one row per distinct release (app version / commit),
// with first/last activity + a quality roll-up. Ordered newest-first by the
// first time we saw a report on that build.
// ---------------------------------------------------------------------------
export function buildReleaseRegistry(reports = []) {
  const releases = new Map();
  for (const r of arr(reports)) {
    const key = releaseKey(r);
    if (!releases.has(key)) {
      releases.set(key, {
        key,
        version: r.app_version || null,
        commit: r.commit_sha || null,
        ref: r.commit_ref || null,
        buildId: r.build_id || null,
        reportCount: 0,
        open: 0,
        regressions: 0,
        drift: 0,
        maxSeverity: 0,
        firstSeen: null,
        lastSeen: null,
      });
    }
    const rel = releases.get(key);
    rel.reportCount += 1;
    if (isOpenStatus(r.status)) rel.open += 1;
    if (r.inv_regression === true) rel.regressions += 1;
    if (r.inv_drift === true) rel.drift += 1;
    rel.maxSeverity = Math.max(rel.maxSeverity, severityRank(r));
    const t = ms(r.created_at);
    if (t != null) {
      if (rel.firstSeen == null || t < ms(rel.firstSeen)) rel.firstSeen = r.created_at;
      if (rel.lastSeen == null || t > ms(rel.lastSeen)) rel.lastSeen = r.created_at;
    }
  }
  return Array.from(releases.values())
    .map((rel) => ({
      ...rel,
      severityLabel: SEVERITY_META[Object.keys(SEVERITY_META).find((k) => SEVERITY_META[k].rank === rel.maxSeverity)]?.label || "Unset",
      // A simple release-quality score: fewer open/regression issues → higher.
      qualityScore: Number(Math.max(0, 100 - rel.open * 8 - rel.regressions * 15 - rel.maxSeverity * 5).toFixed(1)),
    }))
    .sort((a, b) => (ms(b.firstSeen) || 0) - (ms(a.firstSeen) || 0));
}

// ---------------------------------------------------------------------------
// Deployment timeline — the registry as a time-ordered list (oldest → newest)
// for a timeline chart. Each entry carries the delta from the previous release.
// ---------------------------------------------------------------------------
export function deploymentTimeline(reports = []) {
  const registry = buildReleaseRegistry(reports)
    .filter((rel) => rel.firstSeen != null)
    .sort((a, b) => (ms(a.firstSeen) || 0) - (ms(b.firstSeen) || 0));
  return registry.map((rel, i) => {
    const prev = registry[i - 1];
    return {
      key: rel.key,
      version: rel.version,
      commit: rel.commit,
      firstSeen: rel.firstSeen,
      reportCount: rel.reportCount,
      open: rel.open,
      regressions: rel.regressions,
      qualityScore: rel.qualityScore,
      // Did quality improve or regress vs the previous deployment?
      qualityDelta: prev ? Number((rel.qualityScore - prev.qualityScore).toFixed(1)) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Per-incident version timeline — for each recurring fingerprint, the span of
// releases it has appeared on (first → last), whether it crosses releases, and
// whether it is a regression.
// ---------------------------------------------------------------------------
export function incidentVersionTimeline(reports = [], { limit = 20 } = {}) {
  const groups = new Map();
  for (const r of arr(reports)) {
    const key = fingerprintKey(r);
    if (!key) continue;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        occurrences: 0,
        versions: new Set(),
        regression: false,
        open: 0,
        firstSeen: null,
        lastSeen: null,
        firstVersion: r.inv_first_version || null,
        lastVersion: r.inv_last_version || null,
        sample: null,
      });
    }
    const g = groups.get(key);
    g.occurrences += 1;
    if (r.app_version) g.versions.add(r.app_version);
    if (r.inv_regression === true) g.regression = true;
    if (isOpenStatus(r.status)) g.open += 1;
    if (r.inv_first_version) g.firstVersion = r.inv_first_version;
    if (r.inv_last_version) g.lastVersion = r.inv_last_version;
    const t = ms(r.created_at);
    if (t != null) {
      if (g.firstSeen == null || t < ms(g.firstSeen)) g.firstSeen = r.created_at;
      if (g.lastSeen == null || t > ms(g.lastSeen)) {
        g.lastSeen = r.created_at;
        g.sample = { id: r.id, title: r.title || r.description || "", route: r.route || null };
      }
    }
  }
  return Array.from(groups.values())
    .filter((g) => g.occurrences > 1)
    .map((g) => ({
      key: g.key,
      occurrences: g.occurrences,
      versions: Array.from(g.versions),
      spansReleases: g.versions.size > 1,
      regression: g.regression,
      open: g.open,
      firstVersion: g.firstVersion,
      lastVersion: g.lastVersion,
      firstSeen: g.firstSeen,
      lastSeen: g.lastSeen,
      sample: g.sample,
    }))
    .sort((a, b) => Number(b.regression) - Number(a.regression) || b.occurrences - a.occurrences)
    .slice(0, Math.max(1, limit));
}

// ---------------------------------------------------------------------------
// Auto-reopen candidates — a resolved / won't-fix report flagged as a regression
// (the same incident recurred on a newer build after it was closed). These are
// the reports the platform recommends automatically reopening. Returns the patch
// the caller applies (status → triaged) plus an explanation.
// ---------------------------------------------------------------------------
export function autoReopenCandidates(reports = []) {
  return arr(reports)
    .filter((r) => r && r.inv_regression === true && REOPENABLE.has(r.status))
    .map((r) => ({
      id: r.id,
      fromStatus: r.status,
      route: r.route || null,
      firstVersion: r.inv_first_version || null,
      lastVersion: r.inv_last_version || null,
      reason:
        `Regression: this incident was ${r.status === "resolved" ? "resolved" : "closed as won't-fix"}` +
        (r.inv_first_version && r.inv_last_version && r.inv_first_version !== r.inv_last_version
          ? ` in ${r.inv_first_version} but recurred on ${r.inv_last_version}.`
          : " but has recurred on a newer build."),
      patch: { status: "triaged" },
    }));
}

// ---------------------------------------------------------------------------
// build — the whole release-intelligence payload.
// ---------------------------------------------------------------------------
export function buildReleaseIntelligence(reports = [], { now = Date.now() } = {}) {
  const registry = buildReleaseRegistry(reports);
  const reopen = autoReopenCandidates(reports);
  return {
    generatedAt: new Date(now).toISOString(),
    releaseCount: registry.length,
    releases: registry,
    timeline: deploymentTimeline(reports),
    incidents: incidentVersionTimeline(reports),
    autoReopen: reopen,
    autoReopenCount: reopen.length,
  };
}
