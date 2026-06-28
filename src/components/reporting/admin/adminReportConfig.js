// file location: src/components/reporting/admin/adminReportConfig.js
//
// Presentation grouping for the Admin report package (Phase 13 — the eighth
// reporting package on the shared platform). This file is layout metadata only;
// every value, drill-down, export and saved view is served by the shared
// reporting platform (/api/reports/*). No KPI maths lives here.

export const ADMIN_DEPARTMENT = { code: "admin", label: "Admin" };
export const ADMIN_VIEW_TARGET = "reports:admin";

const K = (id, label, unit, format, readiness, hasDrilldown, description, futureNotes = "") => ({
  id,
  label,
  unit,
  format,
  readiness,
  hasDrilldown,
  description,
  futureNotes,
});

// ---- 1. Admin Overview — department scorecard ----------------------------
export const OVERVIEW_SCORECARD = [
  K("adm.login_success_rate", "Login Success Rate", "percent", "0.0%", "R1", true, "Successful logins / attempts."),
  K("adm.login_failures", "Login Failures", "count", "0,0", "R1", true, "Failed login attempts."),
  K("adm.audit_activity", "Audit Activity", "count", "0,0", "R1", true, "Audited actions logged."),
  K("adm.compliance", "Compliance Events", "count", "0,0", "R1", true, "GDPR/consent/SAR/retention activity."),
  K("adm.report_usage", "Report Usage", "count", "0,0", "R2", true, "Report views + exports (audit-backed proxy)."),
  K("adm.user_activity", "Active Users", "count", "0,0", "R2", true, "Distinct active users (audited proxy)."),
];

// ---- 2. User & Access Activity ------------------------------------------
export const ACCESS_KPIS = [
  K("adm.login_success_rate", "Login Success Rate", "percent", "0.0%", "R1", true, "Successful logins / attempts."),
  K("adm.login_failures", "Login Failures", "count", "0,0", "R1", true, "Failed login attempts by reason / account / IP."),
  K("adm.user_activity", "Active Users", "count", "0,0", "R2", true, "Distinct active users (audited proxy).", "Full active-user set needs the report_event spine."),
];

export const LOGIN_BREAKDOWN_CARDS = [
  { key: "attempts", label: "Login Attempts", unit: "count", format: "0,0" },
  { key: "successes", label: "Successful Logins", unit: "count", format: "0,0" },
  { key: "failures", label: "Failed Logins", unit: "count", format: "0,0" },
  { key: "success_rate", label: "Success Rate", unit: "percent", format: "0.0%" },
  { key: "distinct_users", label: "Distinct Users", unit: "count", format: "0,0" },
  { key: "distinct_ips", label: "Distinct IPs", unit: "count", format: "0,0" },
];

export const FAILURE_BREAKDOWN_CARDS = [
  { key: "total_failures", label: "Total Failures", unit: "count", format: "0,0" },
  { key: "distinct_failed_accounts", label: "Affected Accounts", unit: "count", format: "0,0" },
  { key: "distinct_failed_ips", label: "Source IPs", unit: "count", format: "0,0" },
];

export const USER_ACTIVITY_CARDS = [
  { key: "active_users", label: "Active Users", unit: "count", format: "0,0" },
  { key: "audited_actors", label: "Audited Actors", unit: "count", format: "0,0" },
  { key: "authenticated_users", label: "Authenticated Users", unit: "count", format: "0,0" },
  { key: "audit_events", label: "Audited Events", unit: "count", format: "0,0" },
];

// ---- 3. Audit & Compliance ----------------------------------------------
export const AUDIT_KPIS = [
  K("adm.audit_activity", "Audit Activity", "count", "0,0", "R1", true, "Audited actions by plane / action."),
  K("adm.compliance", "Compliance Events", "count", "0,0", "R1", true, "GDPR consent / SAR / export / retention."),
  K("adm.report_usage", "Report Usage", "count", "0,0", "R2", true, "Report views + exports.", "Per-report breakdown sharpens with the event spine."),
  K("adm.role_changes", "Role Changes", "count", "0,0", "R2", false, "Role/permission changes.", "DECLARED — role changes are currently unlogged."),
];

export const AUDIT_BREAKDOWN_CARDS = [
  { key: "audit_events", label: "Audit Events", unit: "count", format: "0,0" },
  { key: "security_actions", label: "Security Actions", unit: "count", format: "0,0" },
  { key: "sensitive_actions", label: "Sensitive Actions", unit: "count", format: "0,0" },
  { key: "compliance_actions", label: "Compliance Actions", unit: "count", format: "0,0" },
  { key: "report_actions", label: "Report Access", unit: "count", format: "0,0" },
  { key: "distinct_actions", label: "Distinct Action Types", unit: "count", format: "0,0" },
];

export const COMPLIANCE_BREAKDOWN_CARDS = [
  { key: "compliance_events", label: "Compliance Events", unit: "count", format: "0,0" },
  { key: "consent_events", label: "Consent Records", unit: "count", format: "0,0" },
  { key: "sar_requests", label: "Subject-Access Requests", unit: "count", format: "0,0" },
  { key: "data_exports", label: "Data Exports", unit: "count", format: "0,0" },
  { key: "retention_runs", label: "Retention Runs", unit: "count", format: "0,0" },
];

export const REPORT_USAGE_CARDS = [
  { key: "report_accesses", label: "Report Accesses", unit: "count", format: "0,0" },
  { key: "report_views", label: "Report Views", unit: "count", format: "0,0" },
  { key: "report_exports", label: "Report Exports", unit: "count", format: "0,0" },
  { key: "distinct_users", label: "Distinct Users", unit: "count", format: "0,0" },
  { key: "distinct_reports", label: "Distinct Reports", unit: "count", format: "0,0" },
];

// ---- 4. Data Quality & System Health ------------------------------------
export const DATA_QUALITY_KPIS = [
  K("adm.data_quality", "Data-Quality Health", "count", "0,0", "R2", true, "Reporting data-quality defects.", "Snapshot drift + department-ownership coverage need their monitors."),
];

export const DATA_QUALITY_CARDS = [
  { key: "total_defects", label: "Total Defects", unit: "count", format: "0,0" },
  { key: "missing_attribution", label: "Missing Attribution", unit: "count", format: "0,0" },
  { key: "unresolved_actor_logins", label: "Unresolved Actor Logins", unit: "count", format: "0,0" },
  { key: "status_drift", label: "Status Drift", unit: "count", format: "0,0" },
  { key: "missing_department_ownership", label: "Missing Dept Ownership", unit: "count", format: "0,0" },
];

// ---- 5. Reporting Utilities — exportable / drillable -----------------------
export const ALL_EXPORTABLE = [
  K("adm.login_success_rate", "Login Success Rate", "percent", "0.0%", "R1", true, ""),
  K("adm.login_failures", "Login Failures", "count", "0,0", "R1", true, ""),
  K("adm.audit_activity", "Audit Activity", "count", "0,0", "R1", true, ""),
  K("adm.compliance", "Compliance Events", "count", "0,0", "R1", true, ""),
  K("adm.report_usage", "Report Usage", "count", "0,0", "R2", true, ""),
  K("adm.user_activity", "Active Users", "count", "0,0", "R2", true, ""),
  K("adm.data_quality", "Data-Quality Health", "count", "0,0", "R2", true, ""),
];

export const ADMIN_TABS = [
  { value: "overview", label: "Admin Overview" },
  { value: "access", label: "User & Access" },
  { value: "audit", label: "Audit & Compliance" },
  { value: "quality", label: "Data Quality & System" },
  { value: "utilities", label: "Reporting Utilities" },
];
