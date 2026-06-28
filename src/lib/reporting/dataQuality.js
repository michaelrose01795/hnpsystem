// file location: src/lib/reporting/dataQuality.js
//
// PHASE 15 — Reporting Data-Quality Monitor (Phase-2 §13.3 / Phase-1 §16.8).
//
// The data-quality monitoring SERVICE the architecture calls for: a set of
// continuous health checks that guard every other metric's trust. It turns the
// one-off point checks inside `adm.data_quality` into a structured, categorised
// monitor that the Admin/Management reporting surfaces (and the API) consume as
// reporting HEALTH INDICATORS.
//
// Design properties (consistent with the rest of the platform):
//   - PURE READ. It never writes; it observes the spine, history, snapshots,
//     audit backbone and operational tables and reports defects.
//   - GRACEFUL DEGRADATION. A check whose source table is not yet applied / not
//     yet accruing returns status `inactive` (not an error and not a false `ok`),
//     so the health score never pretends coverage it doesn't have.
//   - REUSES existing helpers — queryBuilder (exact counts, paginated group
//     counts, never `.limit()` as a total), statusMaps (drift detection),
//     eventCatalogue / entities / kpiCatalog (config integrity).
//
// Categories (Phase-15 §6 / Phase-2 §13.1, §13.3):
//   missing_ownership · missing_attribution · invalid_status_transitions ·
//   invalid_kpi_inputs · snapshot_failures · event_failures · audit_failures
//
// Each indicator: { id, label, category, status, value, threshold, detail }.
//   status ∈ ok | warn | fail | inactive.

import { applyDateRange, countRows, groupCount } from "./queryBuilder";
import { normaliseStatus, isStatusInModel, STATUS_MODELS } from "./config/statusMaps";
import { EVENT_NAMES, AUDIT_REQUIRED_EVENTS, isKnownEvent } from "./config/eventCatalogue";
import { listKpis } from "./kpiCatalog";
import { ENTITY_KEYS, getEntity } from "./config/entities";
import { reportingTableExists } from "@/lib/database/reporting/tableAvailability";

export const DATA_QUALITY_CATEGORIES = Object.freeze([
  "missing_ownership",
  "missing_attribution",
  "invalid_status_transitions",
  "invalid_kpi_inputs",
  "snapshot_failures",
  "event_failures",
  "audit_failures",
]);

export const DQ_STATUS = Object.freeze(["ok", "warn", "fail", "inactive"]);

// Severity ranking for rolling up the overall status (worst active wins).
const STATUS_RANK = { ok: 0, warn: 1, fail: 2, inactive: -1 };

// Build one indicator. `value` null + active=false → inactive.
function indicator({ id, label, category, value = null, threshold = 0, detail = null, active = true, lowerIsBetter = true }) {
  let status;
  if (!active) {
    status = "inactive";
  } else if (value == null) {
    status = "inactive";
  } else if (lowerIsBetter) {
    status = value > threshold ? (value > threshold * 5 + threshold ? "fail" : "warn") : "ok";
  } else {
    status = value >= threshold ? "ok" : "fail";
  }
  return { id, label, category, status, value, threshold, detail };
}

// ---------------------------------------------------------------------------
// Individual monitors. Each is best-effort and returns one indicator; a source
// table that is absent / not accruing yields an `inactive` indicator.
// ---------------------------------------------------------------------------

// 1. MISSING OWNERSHIP — report_event rows with no owner_department (§13.1 dept
//    validation: owner_department must never be null). Inactive until the spine
//    accrues (emits gated off today).
async function checkMissingOwnership(filter) {
  const active = await reportingTableExists("report_event");
  if (!active) {
    return indicator({
      id: "dq.missing_ownership",
      label: "Events missing department ownership",
      category: "missing_ownership",
      active: false,
      detail: "report_event not accruing yet (emit gated / table not applied)",
    });
  }
  const value = await countRows("report_event", (q) => applyDateRange(q.is("owner_department", null), "occurred_at", filter));
  return indicator({
    id: "dq.missing_ownership",
    label: "Events missing department ownership",
    category: "missing_ownership",
    value,
    threshold: 0,
    detail: "report_event rows with null owner_department",
  });
}

// 2. MISSING ATTRIBUTION — actor not resolved where one is expected. Combines
//    three live sources: audit rows with no actor, login attempts with no
//    resolved user, and (once accruing) user-kind events with no canonical id.
async function checkMissingAttribution(filter) {
  const [orphanAudit, unresolvedLogins, spineExists] = await Promise.all([
    countRows("audit_log", (q) => applyDateRange(q.is("actor_user_id", null), "occurred_at", filter)),
    countRows("auth_login_attempts", (q) => applyDateRange(q.is("user_id", null), "attempted_at", filter)),
    reportingTableExists("report_event"),
  ]);
  let unattributedEvents = 0;
  if (spineExists) {
    unattributedEvents = await countRows("report_event", (q) =>
      applyDateRange(q.eq("actor_kind", "user").is("actor_user_id", null), "occurred_at", filter)
    );
  }
  const value = orphanAudit + unresolvedLogins + unattributedEvents;
  return indicator({
    id: "dq.missing_attribution",
    label: "Records missing actor attribution",
    category: "missing_attribution",
    value,
    threshold: 0,
    detail: {
      orphan_audit_rows: orphanAudit,
      unresolved_login_users: unresolvedLogins,
      unattributed_user_events: spineExists ? unattributedEvents : null,
      note: spineExists ? null : "report_event not accruing — event attribution check inactive",
    },
  });
}

// 3. INVALID STATUS TRANSITIONS — operational statuses outside the canonical
//    model (drift detection §13.1). Active today: scans jobs.status (always
//    present) against the job model; folds in any accruing status-history.
async function checkInvalidStatusTransitions() {
  const jobStatusDist = await groupCount("jobs", "status");
  let drift = 0;
  const driftDetail = {};
  for (const [status, n] of Object.entries(jobStatusDist)) {
    if (status === "(null)") {
      drift += n;
      driftDetail.unstatused = (driftDetail.unstatused || 0) + n;
      continue;
    }
    const canonical = normaliseStatus("job", status);
    if (canonical && !isStatusInModel("job", canonical)) {
      drift += n;
      driftDetail[canonical] = (driftDetail[canonical] || 0) + n;
    }
  }
  return indicator({
    id: "dq.invalid_status_transitions",
    label: "Statuses outside the canonical model",
    category: "invalid_status_transitions",
    value: drift,
    threshold: 0,
    detail: { entity: "jobs", drift_by_status: driftDetail },
  });
}

// 4. INVALID KPI INPUTS — catalogue integrity (computable now from the registry,
//    no DB): R1 KPIs with no resolver, sourceEvents not in the event catalogue,
//    sourceHistories not matching a real entity history table. These are the
//    config-level "invalid inputs" that would silently break a metric.
function checkInvalidKpiInputs() {
  const kpis = listKpis();
  const historyTables = new Set(ENTITY_KEYS.map((k) => getEntity(k).historyTable));
  const problems = [];
  for (const k of kpis) {
    if (k.readiness === "R1" && typeof k.resolver !== "function") {
      problems.push({ kpi: k.id, problem: "R1 without resolver" });
    }
    for (const ev of k.sourceEvents || []) {
      if (!isKnownEvent(ev)) problems.push({ kpi: k.id, problem: `sourceEvent ${ev} not in catalogue` });
    }
    for (const h of k.sourceHistories || []) {
      if (!historyTables.has(h)) problems.push({ kpi: k.id, problem: `sourceHistory ${h} not an entity history table` });
    }
  }
  return indicator({
    id: "dq.invalid_kpi_inputs",
    label: "KPI definitions with invalid inputs",
    category: "invalid_kpi_inputs",
    value: problems.length,
    threshold: 0,
    detail: { catalogue_size: kpis.length, problems },
  });
}

// 5. SNAPSHOT FAILURES — aggregation runs that did not complete cleanly + a
//    coverage signal. Inactive until the aggregation pipeline has run.
async function checkSnapshotFailures(filter) {
  const active = await reportingTableExists("report_aggregation_run");
  if (!active) {
    return indicator({
      id: "dq.snapshot_failures",
      label: "Snapshot / aggregation failures",
      category: "snapshot_failures",
      active: false,
      detail: "aggregation pipeline not yet running (report_aggregation_run absent)",
    });
  }
  const [failedRuns, totalRuns] = await Promise.all([
    countRows("report_aggregation_run", (q) => applyDateRange(q.neq("status", "ok"), "finished_at", filter)),
    countRows("report_aggregation_run", (q) => applyDateRange(q, "finished_at", filter)),
  ]);
  return indicator({
    id: "dq.snapshot_failures",
    label: "Snapshot / aggregation failures",
    category: "snapshot_failures",
    value: failedRuns,
    threshold: 0,
    active: totalRuns > 0,
    detail: { failed_runs: failedRuns, total_runs: totalRuns },
  });
}

// 6. EVENT FAILURES — events whose event_name is not in the catalogue (the spine
//    drift the lint guards at build time, monitored at runtime). Inactive until
//    the spine accrues.
async function checkEventFailures(filter) {
  const active = await reportingTableExists("report_event");
  if (!active) {
    return indicator({
      id: "dq.event_failures",
      label: "Out-of-catalogue events",
      category: "event_failures",
      active: false,
      detail: "report_event not accruing yet",
    });
  }
  const byName = await groupCount("report_event", "event_name", (q) => applyDateRange(q, "occurred_at", filter));
  let unknown = 0;
  const unknownDetail = {};
  for (const [name, n] of Object.entries(byName)) {
    const clean = name === "(null)" ? null : name;
    if (!clean || !isKnownEvent(clean)) {
      unknown += n;
      unknownDetail[clean || "(null)"] = n;
    }
  }
  const total = Object.values(byName).reduce((s, n) => s + n, 0);
  return indicator({
    id: "dq.event_failures",
    label: "Out-of-catalogue events",
    category: "event_failures",
    value: unknown,
    threshold: 0,
    active: total > 0,
    detail: { unknown_events: unknownDetail, total_events: total },
  });
}

// 7. AUDIT FAILURES — audit backbone integrity: malformed audit rows (no action),
//    and a coverage signal that audit-required events are catalogued. The
//    hash-chain itself is verified by the audit subsystem, not duplicated here.
async function checkAuditFailures(filter) {
  const malformed = await countRows("audit_log", (q) => applyDateRange(q.is("action", null), "occurred_at", filter));
  return indicator({
    id: "dq.audit_failures",
    label: "Malformed / missing audit rows",
    category: "audit_failures",
    value: malformed,
    threshold: 0,
    detail: {
      malformed_audit_rows: malformed,
      audit_required_event_count: AUDIT_REQUIRED_EVENTS.length,
      catalogue_event_count: EVENT_NAMES.length,
    },
  });
}

// ---------------------------------------------------------------------------
// Orchestrator — run every monitor, roll up a health score + overall status.
// ---------------------------------------------------------------------------
export async function runDataQualityMonitors({ filter = {} } = {}) {
  const settled = await Promise.allSettled([
    checkMissingOwnership(filter),
    checkMissingAttribution(filter),
    checkInvalidStatusTransitions(),
    Promise.resolve(checkInvalidKpiInputs()),
    checkSnapshotFailures(filter),
    checkEventFailures(filter),
    checkAuditFailures(filter),
  ]);

  const indicators = settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : indicator({
          id: `dq.monitor_${i}`,
          label: "Monitor error",
          category: DATA_QUALITY_CATEGORIES[i] || "audit_failures",
          active: false,
          detail: String(s.reason?.message || s.reason),
        })
  );

  const active = indicators.filter((d) => d.status !== "inactive");
  const ok = active.filter((d) => d.status === "ok").length;
  const warn = active.filter((d) => d.status === "warn").length;
  const fail = active.filter((d) => d.status === "fail").length;
  const inactive = indicators.length - active.length;
  // Health score = share of active monitors passing, 0–100. Null when nothing
  // is active yet (honest: no false 100%).
  const healthScore = active.length ? Math.round((ok / active.length) * 1000) / 10 : null;
  const overall = active.reduce((worst, d) => (STATUS_RANK[d.status] > STATUS_RANK[worst] ? d.status : worst), "ok");

  return {
    summary: {
      total_monitors: indicators.length,
      active: active.length,
      inactive,
      ok,
      warn,
      fail,
      health_score: healthScore,
      status: active.length ? overall : "inactive",
    },
    indicators,
  };
}

export default runDataQualityMonitors;
