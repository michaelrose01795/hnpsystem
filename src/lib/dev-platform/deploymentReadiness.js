// file location: src/lib/dev-platform/deploymentReadiness.js
//
// Phase 10 — deployment-readiness scoring + release-approval gating. PURE
// analytics over the same LIGHT report rows the intelligence layer reads
// (status, severity, app_version/commit_sha/build_id, created_at + the derived
// inv_* JSON subfields) — no diagnostics blob, no new privacy surface.
//
// For each release it computes a 0–100 readiness score, a grade + recommendation,
// and the concrete blockers/warnings behind the score, so the Releases dashboard
// can show an approval gate. Approval RECORDS (who signed off) are persisted
// separately (support_release_approvals) and merged in via `approvals`.

import { isOpenStatus } from "@/lib/support/adminView";

const arr = (v) => (Array.isArray(v) ? v : []);

// Release identity — identical rule to releaseIntelligence.js so the two line up.
export const releaseKey = (r) => r?.app_version || r?.commit_sha || r?.build_id || "(unversioned)";

// Effective severity: the triaged severity wins; fall back to the investigation's
// auto-scored severity when a report has not been triaged yet.
function effectiveSeverity(r) {
  const s = r?.severity && r.severity !== "unset" ? r.severity : r?.inv_severity;
  return s || "unset";
}
const isCritical = (r) => effectiveSeverity(r) === "critical";

// Penalty weights (points removed from a perfect 100). Tuned so a single open
// critical drops a release out of "ready", and regressions matter more than
// routine open issues.
const WEIGHTS = { openCritical: 25, regression: 15, openHigh: 8, open: 4, drift: 5 };

/**
 * Score a single release's readiness from its report rows.
 * @param {object[]} reports light rows belonging to ONE release
 * @returns {{
 *   score:number, grade:'ready'|'caution'|'blocked',
 *   recommendation:'approve'|'review'|'hold',
 *   signals:object, blockers:Array<{type,detail,weight}>, warnings:string[]
 * }}
 */
export function scoreReadiness(reports = []) {
  const rows = arr(reports);
  const open = rows.filter((r) => isOpenStatus(r.status));
  const openCritical = open.filter(isCritical);
  const openHigh = open.filter((r) => effectiveSeverity(r) === "high");
  const regressions = rows.filter((r) => r.inv_regression === true);
  const drift = rows.filter((r) => r.inv_drift === true);

  const signals = {
    total: rows.length,
    open: open.length,
    openCritical: openCritical.length,
    openHigh: openHigh.length,
    regressions: regressions.length,
    drift: drift.length,
  };

  const penalty =
    openCritical.length * WEIGHTS.openCritical +
    regressions.length * WEIGHTS.regression +
    openHigh.length * WEIGHTS.openHigh +
    // routine open issues (exclude the critical/high already counted)
    Math.max(0, open.length - openCritical.length - openHigh.length) * WEIGHTS.open +
    drift.length * WEIGHTS.drift;

  const score = Math.max(0, Math.min(100, 100 - penalty));

  const blockers = [];
  if (openCritical.length) {
    blockers.push({ type: "open_critical", detail: `${openCritical.length} open critical issue(s)`, weight: openCritical.length * WEIGHTS.openCritical });
  }
  if (regressions.length) {
    blockers.push({ type: "regression", detail: `${regressions.length} regression(s) recurred on this release`, weight: regressions.length * WEIGHTS.regression });
  }

  const warnings = [];
  if (openHigh.length) warnings.push(`${openHigh.length} open high-severity issue(s).`);
  if (drift.length) warnings.push(`${drift.length} report(s) show code drift against the deployed build.`);
  if (open.length - openCritical.length - openHigh.length > 0) {
    warnings.push(`${open.length - openCritical.length - openHigh.length} other open issue(s).`);
  }

  let grade = "ready";
  if (score < 50) grade = "blocked";
  else if (score < 80) grade = "caution";
  const recommendation = grade === "ready" ? "approve" : grade === "caution" ? "review" : "hold";

  return { score, grade, recommendation, signals, blockers, warnings };
}

/**
 * Build readiness for every release present in the report set, newest release
 * first (by most-recent report), merging any persisted approval record.
 *
 * @param {object[]} reports  light rows across releases
 * @param {{ approvals?: object[] }} [opts] approval rows keyed by release_key
 * @returns {object[]} [{ releaseKey, appVersion, commitSha, readiness, approval, lastActivity }]
 */
export function buildDeploymentReadiness(reports = [], opts = {}) {
  const approvalsByKey = new Map(arr(opts.approvals).map((a) => [a.release_key, a]));
  const groups = new Map();
  for (const r of arr(reports)) {
    const key = releaseKey(r);
    if (!groups.has(key)) {
      groups.set(key, { releaseKey: key, appVersion: r.app_version || null, commitSha: r.commit_sha || null, rows: [], lastActivity: null });
    }
    const g = groups.get(key);
    g.rows.push(r);
    if (!g.appVersion && r.app_version) g.appVersion = r.app_version;
    if (!g.commitSha && r.commit_sha) g.commitSha = r.commit_sha;
    if (!g.lastActivity || String(r.created_at) > String(g.lastActivity)) g.lastActivity = r.created_at || null;
  }

  return Array.from(groups.values())
    .map((g) => {
      const readiness = scoreReadiness(g.rows);
      const approval = approvalsByKey.get(g.releaseKey) || null;
      return {
        releaseKey: g.releaseKey,
        appVersion: g.appVersion,
        commitSha: g.commitSha,
        lastActivity: g.lastActivity,
        readiness,
        approval: approval
          ? { status: approval.status, approverKey: approval.approver_key || null, score: approval.readiness_score ?? null, notes: approval.notes || null, updatedAt: approval.updated_at || null }
          : null,
      };
    })
    .sort((a, b) => String(b.lastActivity || "").localeCompare(String(a.lastActivity || "")));
}

/**
 * Decide whether a proposed approval is safe, given the live readiness. A
 * developer may still override (approve a blocked release) but the platform
 * records the override so the audit trail is honest.
 *
 * @param {object} readiness  scoreReadiness() output
 * @param {'approved'|'blocked'|'pending'} desiredStatus
 * @returns {{ ok:boolean, override:boolean, reason:string }}
 */
export function evaluateApproval(readiness = {}, desiredStatus = "approved") {
  if (desiredStatus === "blocked" || desiredStatus === "pending") {
    return { ok: true, override: false, reason: "" };
  }
  const blocked = readiness.grade === "blocked";
  return {
    ok: true,
    override: blocked,
    reason: blocked
      ? `Approving a release scored ${readiness.score}/100 with ${arr(readiness.blockers).length} blocker(s) — recorded as an override.`
      : "",
  };
}
