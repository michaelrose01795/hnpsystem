// file location: src/lib/support/adminView.js
//
// Help & Diagnostics ("support") — Phase 6 developer Support Centre. PURE,
// node-testable presentation logic for the workspace: enum metadata (labels +
// theme tone tokens + order), badge derivation, intelligent impact sorting that
// surfaces the highest-impact issues first, duplicate grouping / regression
// flagging, saved-view presets, and client-side view matching.
//
// No React, no I/O, no window — everything is a pure function over the light
// LIST rows returned by listSupportReports() (which never carry the full
// diagnostics blob). "Tone" values are theme-token *names* (see theme.css); the
// UI maps them to `var(--<tone>)`. This keeps CLAUDE.md's token discipline in
// one place and out of the components.

import { stableHash } from "@/lib/support/incidentClustering";

// ---------------------------------------------------------------------------
// Enum metadata — single source of truth for labels / order / tone.
// ---------------------------------------------------------------------------
export const STATUS_META = Object.freeze({
  new: { label: "New", tone: "accentText", order: 0, open: true },
  triaged: { label: "Triaged", tone: "text-1", order: 1, open: true },
  in_progress: { label: "In progress", tone: "warning-base", order: 2, open: true },
  resolved: { label: "Resolved", tone: "success-base", order: 3, open: false },
  wont_fix: { label: "Won't fix", tone: "text-1", order: 4, open: false },
  duplicate: { label: "Duplicate", tone: "text-1", order: 5, open: false },
});

export const SEVERITY_META = Object.freeze({
  unset: { label: "Unset", tone: "text-1", rank: 0 },
  low: { label: "Low", tone: "success-base", rank: 1 },
  medium: { label: "Medium", tone: "warning-base", rank: 2 },
  high: { label: "High", tone: "danger-base", rank: 3 },
  critical: { label: "Critical", tone: "danger-base", rank: 4 },
});

export const CATEGORY_META = Object.freeze({
  bug: { label: "Bug", tone: "danger-base" },
  visual: { label: "Visual", tone: "warning-base" },
  data: { label: "Data", tone: "warning-base" },
  question: { label: "Question", tone: "text-1" },
  suggestion: { label: "Suggestion", tone: "success-base" },
  other: { label: "Other", tone: "text-1" },
});

// Investigation priority P1 (highest) → P4 (lowest).
export const PRIORITY_RANK = Object.freeze({ P1: 4, P2: 3, P3: 2, P4: 1 });

export const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }));
export const SEVERITY_OPTIONS = Object.entries(SEVERITY_META).map(([value, m]) => ({ value, label: m.label }));
export const CATEGORY_OPTIONS = Object.entries(CATEGORY_META).map(([value, m]) => ({ value, label: m.label }));

export const isOpenStatus = (status) => Boolean(STATUS_META[status]?.open);

// ---------------------------------------------------------------------------
// Duplicate grouping — cluster identical incidents by a canonical fingerprint
// key so the list can show a "recurring ×N" badge and collapse noise. Uses the
// already-stored fingerprint (never re-reads diagnostics). Exact-key grouping:
// identical incidents cluster; near-duplicates are handled by the investigation
// engine's fuzzy similarity elsewhere.
// ---------------------------------------------------------------------------
export function fingerprintKey(report) {
  const fp = report?.fingerprint;
  if (!fp || typeof fp !== "object") return null;
  const canonical = [
    fp.route || "",
    fp.component || fp.sectionKey || "",
    (Array.isArray(fp.errorSignatures) ? fp.errorSignatures : []).slice().sort().join("|"),
    (Array.isArray(fp.requestSignatures) ? fp.requestSignatures : []).slice().sort().join("|"),
  ].join("¦");
  if (!canonical.replace(/¦/g, "").trim()) return null; // no signal → don't group
  return stableHash(canonical);
}

/**
 * Annotate each report with `duplicateKey` + `duplicateCount` (how many reports
 * in the set share its fingerprint). Returns a NEW array; input is not mutated.
 * @param {object[]} reports
 * @returns {object[]}
 */
export function groupDuplicates(reports = []) {
  const counts = new Map();
  for (const r of reports) {
    const key = fingerprintKey(r);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return reports.map((r) => {
    const key = fingerprintKey(r);
    return { ...r, duplicateKey: key, duplicateCount: key ? counts.get(key) : 1 };
  });
}

// ---------------------------------------------------------------------------
// Badges — small descriptors the row/detail render as pills.
// ---------------------------------------------------------------------------
const RECENT_NEW_MS = 24 * 60 * 60 * 1000;

export function deriveBadges(report = {}, { now = Date.now() } = {}) {
  const badges = [];
  const created = Date.parse(report.created_at || "");
  if (report.status === "new" && Number.isFinite(created) && now - created <= RECENT_NEW_MS) {
    badges.push({ key: "new", label: "New", tone: "accentText" });
  }
  if (report.inv_regression === true) {
    badges.push({ key: "regression", label: "Regression", tone: "danger-base" });
  }
  if ((report.duplicateCount || 0) > 1) {
    badges.push({ key: "recurring", label: `Recurring ×${report.duplicateCount}`, tone: "warning-base" });
  }
  if (report.duplicate_of) {
    badges.push({ key: "duplicate", label: "Duplicate", tone: "text-1" });
  }
  if (report.inv_drift === true) {
    badges.push({ key: "drift", label: "Code drift", tone: "warning-base" });
  }
  return badges;
}

// ---------------------------------------------------------------------------
// Impact scoring + sorting — surface the highest-impact issues first.
// ---------------------------------------------------------------------------
export function severityRank(report = {}) {
  const triage = SEVERITY_META[report.severity]?.rank ?? 0;
  const inv = SEVERITY_META[report.inv_severity]?.rank ?? 0;
  return Math.max(triage, inv);
}

export function impactScore(report = {}) {
  let score = 0;
  score += severityRank(report) * 3; // 0..12 — dominant signal
  score += PRIORITY_RANK[report.inv_priority] || 0; // 0..4
  if (report.inv_regression === true) score += 4;
  if (report.inv_drift === true) score += 1;
  if (isOpenStatus(report.status)) score += 3;
  else score -= 3; // resolved / won't-fix / duplicate sink
  score += Math.min(report.duplicateCount || 1, 5); // recurring weight
  const conf = Number(report.inv_confidence);
  if (Number.isFinite(conf)) score += conf; // 0..~0.95 tiebreak nudge
  return Number(score.toFixed(3));
}

export const SORT_OPTIONS = Object.freeze([
  { value: "impact", label: "Highest impact" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "updated", label: "Recently updated" },
  { value: "severity", label: "Severity" },
]);

const ts = (v) => {
  const t = Date.parse(v || "");
  return Number.isFinite(t) ? t : 0;
};

/**
 * Sort reports (returns a new array). Default "impact". All sorts fall back to
 * newest-first as a stable tiebreak.
 * @param {object[]} reports
 * @param {string} [key]
 * @returns {object[]}
 */
export function sortReports(reports = [], key = "impact") {
  const list = reports.slice();
  const byNewest = (a, b) => ts(b.created_at) - ts(a.created_at);
  switch (key) {
    case "newest":
      return list.sort(byNewest);
    case "oldest":
      return list.sort((a, b) => ts(a.created_at) - ts(b.created_at));
    case "updated":
      return list.sort((a, b) => ts(b.updated_at) - ts(a.updated_at) || byNewest(a, b));
    case "severity":
      return list.sort((a, b) => severityRank(b) - severityRank(a) || byNewest(a, b));
    case "impact":
    default:
      return list.sort((a, b) => impactScore(b) - impactScore(a) || byNewest(a, b));
  }
}

// ---------------------------------------------------------------------------
// Saved views — presets + client-side matching. A "view" is a filter object
// ({ status, severity, category, unassigned, regressionsOnly, q, sort }). The
// server applies the DB-backed filters; `matchesView` refines client-side flags
// (regressionsOnly) over an already-fetched page.
// ---------------------------------------------------------------------------
export const SAVED_VIEW_PRESETS = Object.freeze([
  { id: "triage-queue", name: "Triage queue", filters: { status: "new", sort: "impact" } },
  { id: "open", name: "All open", filters: { openOnly: true, sort: "impact" } },
  { id: "unassigned", name: "Unassigned", filters: { unassigned: true, openOnly: true, sort: "impact" } },
  { id: "critical", name: "Critical", filters: { severity: "critical", sort: "impact" } },
  { id: "regressions", name: "Regressions", filters: { regressionsOnly: true, sort: "impact" } },
  { id: "recent", name: "Recently updated", filters: { sort: "updated" } },
]);

/**
 * Client-side refinement of a fetched page against a view's non-DB flags.
 * (DB-backed filters — status/severity/category/unassigned/q — are applied by
 * the API; this only enforces the derived flags openOnly / regressionsOnly.)
 * @param {object} report
 * @param {object} [view]
 * @returns {boolean}
 */
export function matchesView(report = {}, view = {}) {
  if (view.openOnly && !isOpenStatus(report.status)) return false;
  if (view.regressionsOnly && report.inv_regression !== true) return false;
  return true;
}

/**
 * Quick client-side summary of a fetched page (complements the server stats).
 * @param {object[]} reports
 * @returns {{ shown: number, open: number, regressions: number, unassigned: number }}
 */
export function summarisePage(reports = []) {
  return {
    shown: reports.length,
    open: reports.filter((r) => isOpenStatus(r.status)).length,
    regressions: reports.filter((r) => r.inv_regression === true).length,
    unassigned: reports.filter((r) => isOpenStatus(r.status) && r.assigned_to == null).length,
  };
}
