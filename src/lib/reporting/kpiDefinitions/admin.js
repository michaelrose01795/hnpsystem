// file location: src/lib/reporting/kpiDefinitions/admin.js
//
// Admin KPI definitions (Phase-3 §13, promoted for the Phase-13 Admin report
// package — the EIGHTH report package on the shared reporting foundation after
// Workshop, Parts, Accounts, Service Advisor, MOT, Valeting and Paint).
//
// Every formula here is taken VERBATIM from the KPI catalogue
// (docs/Report System/reporting-kpi-catalogue-architecture.md §13) — no metric is
// invented, no calculation is bypassed, and nothing is computed outside the
// reporting engine. R1 metrics whose sources exist today (audit_log,
// auth_login_attempts) carry a `resolver`. R2 metrics whose *catalogue source set
// includes a table that already holds usable data* (audit_log) carry a CLEARLY
// FLAGGED proxy resolver — the same discipline the Paint package used for the R2
// `pnt.cycle_time` proxy. R2 metrics with genuinely no signal today (role changes
// are unlogged) are DECLARED (catalogue entry, no resolver) so the UI lists the
// metric with its exact blocker instead of inventing a number.
//
// SECURITY: Admin reporting exposes login, audit, security and compliance signal.
// Every KPI carries `ADMIN_REPORT_PERMISSION` so the engine's per-KPI permission
// gate (Phase-1 §14) restricts it to Admin-manager, Management and Executive
// scope — normal department users (incl. operational admin/reception staff) never
// see it. Drill-downs deliberately omit the audit_log hash chain and `diff`
// payload (which may carry sensitive before/after values); only the actor,
// action, plane and timestamp are surfaced.
//
// All counting/grouping goes through queryBuilder (exact counts, paginated group
// counts, bounded row scans — never `.limit()` as a total) so Admin numbers cannot
// regress to the D8 truncation bug the audit found.

import { defineKpi } from "../kpiCatalog";
import { applyDateRange, countRows, groupCount, fetchRows, fetchAllRows } from "../queryBuilder";
import { normaliseStatus, isStatusInModel } from "../config/statusMaps";
import { runDataQualityMonitors } from "../dataQuality";

// ---------------------------------------------------------------------------
// Permission: Admin reporting is tightly gated. Execs auto-pass the engine gate
// (scopeSatisfiesKpiPermission); these explicit Management/Admin-manager roles
// extend it WITHOUT widening to operational department managers (workshop/parts
// managers are intentionally excluded — they must not see security/audit data).
// ---------------------------------------------------------------------------
export const ADMIN_REPORT_PERMISSION = Object.freeze([
  "admin manager",
  "general manager",
  "manager",
  "owner",
]);

// ---------------------------------------------------------------------------
// Action classification (audit_log.action). Used only to BREAK DOWN the audited
// activity into the catalogue's named planes — it never invents a KPI id. The
// sets reflect the actions actually written by the live audit backbone today
// (src/lib/audit/auditLog.js writers across auth, payslips, privacy, reports).
// ---------------------------------------------------------------------------
const SECURITY_ACTIONS = new Set([
  "login_success",
  "login_fail",
  "password_change",
  "password_change_fail",
  "password_reset",
]);

// GDPR / compliance actions — the one fully-audited domain today (Phase-3 §13
// adm.compliance; readiness audit "GDPR/compliance fully audited").
const COMPLIANCE_ACTIONS = {
  consent: new Set(["cookie_consent", "consent_recorded"]),
  sar: new Set(["subject_request"]),
  data_export: new Set(["privacy_export", "data_exported"]),
  retention: new Set(["retention_run"]),
};
const ALL_COMPLIANCE_ACTIONS = new Set([
  ...COMPLIANCE_ACTIONS.consent,
  ...COMPLIANCE_ACTIONS.sar,
  ...COMPLIANCE_ACTIONS.data_export,
  ...COMPLIANCE_ACTIONS.retention,
]);

// High-value "sensitive action" planes (Phase-2 §11.2 audit-required set): the
// security actions above plus deletions, role/config changes and PII/financial
// document access. Surfaced as a facet of adm.audit_activity, not a new KPI.
const SENSITIVE_ACTION_HINTS = ["delete", "role", "config", "void", "payslip", "retention", "subject_request", "privacy_export", "fail"];
function isSensitiveAction(action, entityType) {
  const a = String(action || "").toLowerCase();
  if (SECURITY_ACTIONS.has(a) && a !== "login_success") return true;
  if (ALL_COMPLIANCE_ACTIONS.has(a)) return true;
  if (SENSITIVE_ACTION_HINTS.some((h) => a.includes(h))) return true;
  const e = String(entityType || "").toLowerCase();
  if (e === "payslip" || e === "user") return true;
  return false;
}

const REPORT_ACTIONS = new Set(["report.view", "report.export"]);

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);
const round1 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : null);

// ---------------------------------------------------------------------------
// Shared loaders. Login attempts and audited report-access are modest-volume,
// admin-owned tables, so a single bounded scan per resolver (fetchAllRows) yields
// every facet without re-querying — the same one-scan pattern the Paint resolver
// uses. Bulk audit-activity uses paginated groupCount (one column) so it stays
// cheap even when audit_log is large.
// ---------------------------------------------------------------------------
async function loadLoginAttempts(filter) {
  return fetchAllRows(
    "auth_login_attempts",
    "id,endpoint,email,user_id,ip_address,succeeded,failure_reason,attempted_at",
    (q) => applyDateRange(q, "attempted_at", filter),
    { orderBy: "attempted_at", ascending: false }
  );
}

async function loadReportAccess(filter) {
  return fetchAllRows(
    "audit_log",
    "id,occurred_at,actor_user_id,actor_role,action,entity_type,entity_id",
    (q) => applyDateRange(q.eq("entity_type", "report"), "occurred_at", filter),
    { orderBy: "occurred_at", ascending: false }
  );
}

async function loadComplianceRows(filter) {
  return fetchAllRows(
    "audit_log",
    "id,occurred_at,actor_user_id,actor_role,action,entity_type,entity_id",
    (q) => applyDateRange(q.in("action", Array.from(ALL_COMPLIANCE_ACTIONS)), "occurred_at", filter),
    { orderBy: "occurred_at", ascending: false }
  );
}

export const adminKpis = [
  // =========================================================================
  // USER & ACCESS — login security (R1, buildable now from auth_login_attempts)
  // =========================================================================
  defineKpi({
    id: "adm.login_success_rate",
    label: "Login Success Rate",
    department: "admin",
    relatedDepartments: ["management"],
    description: "Successful logins as a share of all login attempts in the period.",
    purpose: "Access-health and brute-force/credential-stuffing signal.",
    formula: "COUNT(login success) ÷ COUNT(attempts) × 100",
    numerator: "COUNT(auth_login_attempts where succeeded = true)",
    denominator: "COUNT(auth_login_attempts)",
    sourceTables: ["auth_login_attempts", "audit_log"],
    sourceEvents: ["LOGIN_SUCCEEDED", "LOGIN_FAILED"],
    tier: "operational",
    readiness: "R1",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    permission: ADMIN_REPORT_PERMISSION,
    example: "228 success ÷ 240 attempts = 95.0%",
    drilldown: async ({ filter }) => {
      const rows = await loadLoginAttempts(filter);
      return rows.map((r) => ({
        id: r.id,
        attempted_at: r.attempted_at,
        outcome: r.succeeded ? "success" : "failure",
        endpoint: r.endpoint,
        email: r.email,
        user_id: r.user_id,
        ip_address: r.ip_address,
        failure_reason: r.failure_reason,
      }));
    },
    resolver: async ({ filter }) => {
      const rows = await loadLoginAttempts(filter);
      const attempts = rows.length;
      const successes = rows.filter((r) => r.succeeded).length;
      const failures = attempts - successes;
      const distinctUsers = new Set(rows.map((r) => r.user_id).filter((v) => v != null)).size;
      const distinctIps = new Set(rows.map((r) => r.ip_address).filter(Boolean)).size;
      return {
        value: pct(successes, attempts),
        numerator: successes,
        denominator: attempts,
        count: attempts,
        breakdown: {
          attempts,
          successes,
          failures,
          success_rate: pct(successes, attempts),
          distinct_users: distinctUsers,
          distinct_ips: distinctIps,
        },
      };
    },
  }),

  defineKpi({
    id: "adm.login_failures",
    label: "Login Failures",
    department: "admin",
    relatedDepartments: ["management"],
    description: "Failed login attempts in the period, by reason / account / IP.",
    purpose: "Security drill — lockouts, throttling and credential-attack detection.",
    formula: "COUNT(login failures) by reason/user/IP",
    sourceTables: ["auth_login_attempts"],
    sourceEvents: ["LOGIN_FAILED"],
    tier: "operational",
    readiness: "R1",
    aggregation: "sum",
    unit: "count",
    format: "0,0",
    targetType: "lower_is_better",
    permission: ADMIN_REPORT_PERMISSION,
    example: "12 failures across 3 accounts / 2 IPs",
    drilldown: async ({ filter }) => {
      const rows = await loadLoginAttempts(filter);
      return rows
        .filter((r) => !r.succeeded)
        .map((r) => ({
          id: r.id,
          attempted_at: r.attempted_at,
          email: r.email,
          user_id: r.user_id,
          ip_address: r.ip_address,
          failure_reason: r.failure_reason,
          endpoint: r.endpoint,
        }));
    },
    resolver: async ({ filter }) => {
      const rows = await loadLoginAttempts(filter);
      const failures = rows.filter((r) => !r.succeeded);
      const byReason = failures.reduce((acc, r) => {
        const key = r.failure_reason || "unspecified";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      return {
        value: failures.length,
        count: failures.length,
        breakdown: {
          total_failures: failures.length,
          distinct_failed_accounts: new Set(failures.map((r) => r.email).filter(Boolean)).size,
          distinct_failed_ips: new Set(failures.map((r) => r.ip_address).filter(Boolean)).size,
          by_reason: byReason,
        },
      };
    },
  }),

  // =========================================================================
  // AUDIT & COMPLIANCE — buildable now from the hash-chained audit_log (R1)
  // =========================================================================
  defineKpi({
    id: "adm.audit_activity",
    label: "Audit Activity Volume",
    department: "admin",
    relatedDepartments: ["management"],
    description: "Audited actions logged in the period, by action and plane (entity type).",
    purpose: "Coverage of the 'who did what when' audit backbone; security/sensitive activity visibility.",
    formula: "COUNT(audit_log rows) by plane/action",
    sourceTables: ["audit_log", "job_activity_events"],
    sourceEvents: ["RECORD_DELETED", "CONFIG_CHANGED", "LOGIN_SUCCEEDED", "LOGIN_FAILED"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "sum",
    unit: "count",
    format: "0,0",
    targetType: "informational",
    permission: ADMIN_REPORT_PERMISSION,
    futureNotes:
      "Counts audit_log rows by action and entity_type (plane). job_activity_events is a second, granular per-job audit stream that folds in once its actor columns are reconciled (audit debt D-actor). Sensitive/security plane counts are facets of this KPI, not separate metrics.",
    drilldown: async ({ filter }) =>
      fetchRows(
        "audit_log",
        "id,occurred_at,actor_user_id,actor_role,action,entity_type,entity_id",
        (q) => applyDateRange(q, "occurred_at", filter),
        { orderBy: "occurred_at" }
      ),
    resolver: async ({ filter }) => {
      const [total, byAction, byEntity] = await Promise.all([
        countRows("audit_log", (q) => applyDateRange(q, "occurred_at", filter)),
        groupCount("audit_log", "action", (q) => applyDateRange(q, "occurred_at", filter)),
        groupCount("audit_log", "entity_type", (q) => applyDateRange(q, "occurred_at", filter)),
      ]);
      let securityActions = 0;
      let complianceActions = 0;
      let sensitiveActions = 0;
      let reportActions = 0;
      for (const [action, n] of Object.entries(byAction)) {
        const a = action === "(null)" ? "" : action;
        if (SECURITY_ACTIONS.has(a)) securityActions += n;
        if (ALL_COMPLIANCE_ACTIONS.has(a)) complianceActions += n;
        if (REPORT_ACTIONS.has(a)) reportActions += n;
        if (isSensitiveAction(a, null)) sensitiveActions += n;
      }
      return {
        value: total,
        count: total,
        breakdown: {
          audit_events: total,
          security_actions: securityActions,
          sensitive_actions: sensitiveActions,
          compliance_actions: complianceActions,
          report_actions: reportActions,
          distinct_actions: Object.keys(byAction).filter((k) => k !== "(null)").length,
          by_action: byAction,
          by_plane: byEntity,
        },
      };
    },
  }),

  defineKpi({
    id: "adm.compliance",
    label: "Compliance Metrics",
    department: "admin",
    relatedDepartments: ["management", "hr"],
    description: "GDPR/compliance activity: consent, subject-access requests, data exports and retention runs.",
    purpose: "Evidence of GDPR adherence — the one fully-audited domain today.",
    formula: "consent coverage, SAR turnaround, retention adherence",
    sourceTables: ["audit_log"],
    sourceEvents: ["CONSENT_RECORDED", "DATA_EXPORTED"],
    tier: "strategic",
    readiness: "R1",
    aggregation: "sum",
    unit: "count",
    format: "0,0",
    targetType: "informational",
    permission: ADMIN_REPORT_PERMISSION,
    futureNotes:
      "Surfaces the catalogue's named compliance sub-signals (consent / SAR / data-export / retention) as audited event counts — the trustworthy R1 view. The rate forms (consent coverage % vs total population, SAR turnaround in days, retention adherence %) need a request→fulfilment pairing and a population denominator; those denominators are declared, not invented here.",
    drilldown: async ({ filter }) => {
      const rows = await loadComplianceRows(filter);
      return rows.map((r) => ({
        id: r.id,
        occurred_at: r.occurred_at,
        action: r.action,
        category: COMPLIANCE_ACTIONS.consent.has(r.action)
          ? "consent"
          : COMPLIANCE_ACTIONS.sar.has(r.action)
          ? "subject_access_request"
          : COMPLIANCE_ACTIONS.data_export.has(r.action)
          ? "data_export"
          : "retention",
        actor_user_id: r.actor_user_id,
        actor_role: r.actor_role,
        entity_type: r.entity_type,
        entity_id: r.entity_id,
      }));
    },
    resolver: async ({ filter }) => {
      const rows = await loadComplianceRows(filter);
      const tally = (set) => rows.filter((r) => set.has(r.action)).length;
      const consent = tally(COMPLIANCE_ACTIONS.consent);
      const sar = tally(COMPLIANCE_ACTIONS.sar);
      const dataExport = tally(COMPLIANCE_ACTIONS.data_export);
      const retention = tally(COMPLIANCE_ACTIONS.retention);
      return {
        value: rows.length,
        count: rows.length,
        breakdown: {
          compliance_events: rows.length,
          consent_events: consent,
          sar_requests: sar,
          data_exports: dataExport,
          retention_runs: retention,
          retention_run_in_period: retention > 0 ? 1 : 0,
        },
      };
    },
  }),

  // =========================================================================
  // REPORTING USAGE — R2 catalogue id, served NOW from audit_log report.* rows.
  // The reporting platform already writes a hash-chained report.view/report.export
  // audit row on every /api/reports/* access (src/lib/reporting/audit.js), so the
  // usage signal is live today; the REPORT_VIEWED/EXPORTED event spine adds richer
  // per-report breakdown later (flagged, not invented).
  // =========================================================================
  defineKpi({
    id: "adm.report_usage",
    label: "Report Usage",
    department: "admin",
    relatedDepartments: ["management"],
    description: "Report views and exports in the period, by user and report.",
    purpose: "Reporting-platform adoption and access analysis.",
    formula: "COUNT(REPORT_VIEWED/EXPORTED) by report/user",
    sourceTables: ["audit_log"],
    sourceEvents: ["REPORT_VIEWED", "REPORT_EXPORTED"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "sum",
    unit: "count",
    format: "0,0",
    targetType: "informational",
    permission: ADMIN_REPORT_PERMISSION,
    futureNotes:
      "R2 proxy served live from audit_log rows where entity_type='report' (action report.view/report.export), written by the shared reporting audit backbone today. Per-report and per-department usage breakdown sharpens once the REPORT_VIEWED/REPORT_EXPORTED report_event spine is switched on.",
    drilldown: async ({ filter }) => {
      const rows = await loadReportAccess(filter);
      return rows.map((r) => ({
        id: r.id,
        occurred_at: r.occurred_at,
        access: r.action === "report.export" ? "export" : "view",
        report: r.entity_id,
        actor_user_id: r.actor_user_id,
        actor_role: r.actor_role,
      }));
    },
    resolver: async ({ filter }) => {
      const rows = await loadReportAccess(filter);
      const views = rows.filter((r) => r.action !== "report.export").length;
      const exports = rows.filter((r) => r.action === "report.export").length;
      return {
        value: rows.length,
        count: rows.length,
        breakdown: {
          report_accesses: rows.length,
          report_views: views,
          report_exports: exports,
          distinct_users: new Set(rows.map((r) => r.actor_user_id).filter((v) => v != null)).size,
          distinct_reports: new Set(rows.map((r) => r.entity_id).filter(Boolean)).size,
        },
      };
    },
  }),

  // =========================================================================
  // USER ACTIVITY — R2 catalogue id, served NOW as an audited-activity proxy.
  // The catalogue source set is `report_event`(distinct actor) + audit_log. The
  // event spine is not accruing yet, so active users are proxied from distinct
  // audited actors + distinct logged-in users — clearly flagged.
  // =========================================================================
  defineKpi({
    id: "adm.user_activity",
    label: "User Activity",
    department: "admin",
    relatedDepartments: ["management"],
    description: "Distinct active users in the period (audited actors + authenticated logins).",
    purpose: "Adoption / active-user trend across the platform.",
    formula: "active users per period (distinct actors emitting events)",
    sourceTables: ["report_event", "audit_log", "auth_login_attempts"],
    sourceEvents: ["LOGIN_SUCCEEDED"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "distinct",
    unit: "count",
    format: "0,0",
    targetType: "informational",
    permission: ADMIN_REPORT_PERMISSION,
    futureNotes:
      "R2 proxy — true 'active users emitting events' needs the report_event spine (distinct actor_user_id). Until it accrues, active users are proxied from distinct audit_log actors + distinct authenticated logins in the period (both admin-owned sources from the catalogue's source set).",
    drilldown: async ({ filter }) => {
      const audit = await fetchAllRows(
        "audit_log",
        "actor_user_id,actor_role,action,occurred_at",
        (q) => applyDateRange(q.not("actor_user_id", "is", null), "occurred_at", filter),
        { orderBy: "occurred_at", ascending: false }
      );
      const byUser = new Map();
      for (const r of audit) {
        const u = r.actor_user_id;
        if (u == null) continue;
        const cur = byUser.get(u) || { actor_user_id: u, actor_role: r.actor_role, audited_actions: 0, last_seen: r.occurred_at };
        cur.audited_actions += 1;
        byUser.set(u, cur);
      }
      return Array.from(byUser.values()).sort((a, b) => b.audited_actions - a.audited_actions);
    },
    resolver: async ({ filter }) => {
      const [auditActors, logins] = await Promise.all([
        groupCount("audit_log", "actor_user_id", (q) => applyDateRange(q, "occurred_at", filter)),
        loadLoginAttempts(filter),
      ]);
      const auditUserIds = Object.keys(auditActors).filter((k) => k !== "(null)");
      const loginUserIds = logins.filter((r) => r.succeeded && r.user_id != null).map((r) => String(r.user_id));
      const active = new Set([...auditUserIds, ...loginUserIds]);
      return {
        value: active.size,
        count: active.size,
        breakdown: {
          active_users: active.size,
          audited_actors: auditUserIds.length,
          authenticated_users: new Set(loginUserIds).size,
          audit_events: Object.values(auditActors).reduce((s, n) => s + n, 0),
        },
      };
    },
  }),

  // =========================================================================
  // DATA-QUALITY HEALTH — R2 meta-KPI, served NOW for the achievable defect
  // facets (missing attribution, unresolved actor, status drift). Snapshot drift
  // and department-ownership coverage stay declared until their monitors land.
  // =========================================================================
  defineKpi({
    id: "adm.data_quality",
    label: "Data-Quality Health",
    department: "admin",
    relatedDepartments: ["management"],
    description: "Reporting data-quality defects: missing attribution, unresolved actors, out-of-model status drift.",
    purpose: "Meta-KPI guarding every other metric's trust (Phase-2 §13.3).",
    formula: "counts of records missing department / unresolved actor / out-of-model status / snapshot drift",
    sourceTables: ["audit_log", "auth_login_attempts", "jobs", "report_event"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "sum",
    unit: "count",
    format: "0,0",
    targetType: "lower_is_better",
    permission: ADMIN_REPORT_PERMISSION,
    futureNotes:
      "R2 — the achievable defect monitors run today (audit rows with no actor, login attempts with no resolved user, job statuses outside the canonical model). Department-ownership coverage and snapshot drift read the report_event/snapshot spine and stay at 0/declared until that capture accrues; the data-quality monitor service (Phase-2 §13.3) replaces these point checks with continuous monitors.",
    drilldown: async ({ filter }) => {
      const orphanAudit = await fetchRows(
        "audit_log",
        "id,occurred_at,action,entity_type,entity_id,actor_role",
        (q) => applyDateRange(q.is("actor_user_id", null), "occurred_at", filter),
        { orderBy: "occurred_at" }
      );
      return orphanAudit.map((r) => ({ ...r, defect: "missing_attribution" }));
    },
    resolver: async ({ filter }) => {
      const [missingAttribution, unresolvedActorLogins, jobStatusDist, missingDeptOwnership] = await Promise.all([
        countRows("audit_log", (q) => applyDateRange(q.is("actor_user_id", null), "occurred_at", filter)),
        countRows("auth_login_attempts", (q) => applyDateRange(q.is("user_id", null), "attempted_at", filter)),
        groupCount("jobs", "status"),
        countRows("report_event", (q) => applyDateRange(q.is("owner_department", null), "occurred_at", filter)),
      ]);
      let statusDrift = 0;
      const driftStatuses = {};
      for (const [status, n] of Object.entries(jobStatusDist)) {
        if (status === "(null)") {
          statusDrift += n;
          driftStatuses.unstatused = (driftStatuses.unstatused || 0) + n;
          continue;
        }
        const canonical = normaliseStatus("job", status);
        if (canonical && !isStatusInModel("job", canonical)) {
          statusDrift += n;
          driftStatuses[canonical] = (driftStatuses[canonical] || 0) + n;
        }
      }
      const achievableDefects = missingAttribution + unresolvedActorLogins + statusDrift;
      return {
        value: achievableDefects,
        count: achievableDefects,
        breakdown: {
          total_defects: achievableDefects,
          missing_attribution: missingAttribution,
          unresolved_actor_logins: unresolvedActorLogins,
          status_drift: statusDrift,
          missing_department_ownership: missingDeptOwnership,
          status_drift_detail: driftStatuses,
        },
      };
    },
  }),

  // =========================================================================
  // DECLARED — not yet implemented (audit-logging gap). No resolver: the engine
  // reports it as "declared, readiness R2" so the UI lists the metric and its
  // exact blocker honestly, lighting up once role changes are logged.
  // =========================================================================
  defineKpi({
    id: "adm.role_changes",
    label: "Role Changes",
    department: "admin",
    relatedDepartments: ["management", "hr"],
    description: "Role/permission changes applied to user accounts.",
    formula: "COUNT(ROLE_CHANGED)",
    sourceTables: ["audit_log"],
    sourceEvents: ["ROLE_CHANGED"],
    tier: "tactical",
    readiness: "R2",
    aggregation: "sum",
    unit: "count",
    format: "0,0",
    targetType: "informational",
    permission: ADMIN_REPORT_PERMISSION,
    futureNotes:
      "R2 — DECLARED. Role changes are currently UNLOGGED (readiness audit finding 15: 'role changes / clocking edits / deletes unlogged'). It lights up once user-role writes emit ROLE_CHANGED (and fan out a role-change audit_log action). No reliable proxy exists today, so no number is invented. The Phase-15 emitRoleChanged adapter implements the capture; it accrues once reporting_emit_enabled is switched on.",
  }),

  // =========================================================================
  // REPORTING HEALTH — Phase-15 data-quality monitor surfaced as a KPI. The
  // meta-metric guarding every other figure's trust (Phase-2 §13.3). Value = the
  // share of ACTIVE data-quality monitors passing (health score 0–100); inactive
  // monitors (capture not accruing yet) are excluded so the score never claims
  // coverage it doesn't have. Composes the dataQuality monitor service — it does
  // not re-implement any check.
  // =========================================================================
  defineKpi({
    id: "adm.reporting_health",
    label: "Reporting Health Score",
    department: "admin",
    relatedDepartments: ["management"],
    description: "Share of active reporting data-quality monitors passing (ownership, attribution, status drift, KPI inputs, snapshot/event/audit integrity).",
    purpose: "Single trust signal for the reporting platform — the data-quality monitor's headline.",
    formula: "COUNT(monitors status=ok) ÷ COUNT(active monitors) × 100",
    numerator: "active monitors passing",
    denominator: "active monitors",
    sourceTables: ["report_event", "audit_log", "auth_login_attempts", "jobs", "report_aggregation_run"],
    tier: "strategic",
    readiness: "R2",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    permission: ADMIN_REPORT_PERMISSION,
    futureNotes:
      "R2 — the achievable monitors (status drift, missing attribution, invalid KPI inputs, malformed audit rows) run live today; ownership / event / snapshot monitors are inactive (excluded from the score, not failed) until the event spine + aggregation pipeline accrue. The score sharpens to full coverage automatically as capture goes live — no KPI change needed.",
    drilldown: async ({ filter }) => {
      const { indicators } = await runDataQualityMonitors({ filter });
      return indicators.map((d) => ({
        monitor: d.id,
        category: d.category,
        status: d.status,
        defects: d.value,
        detail: typeof d.detail === "object" ? JSON.stringify(d.detail) : d.detail,
      }));
    },
    resolver: async ({ filter }) => {
      const { summary, indicators } = await runDataQualityMonitors({ filter });
      return {
        value: summary.health_score,
        numerator: summary.ok,
        denominator: summary.active,
        count: summary.total_monitors,
        breakdown: {
          health_score: summary.health_score,
          overall_status: summary.status,
          total_monitors: summary.total_monitors,
          active_monitors: summary.active,
          inactive_monitors: summary.inactive,
          passing: summary.ok,
          warning: summary.warn,
          failing: summary.fail,
          by_monitor: indicators.map((d) => ({ id: d.id, category: d.category, status: d.status, value: d.value })),
        },
      };
    },
  }),
];

export default adminKpis;
