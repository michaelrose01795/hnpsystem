// file location: src/lib/reporting/audit.js
//
// PRIORITY (audit integration) — Reporting audit (Phase-1 §9.13 / Phase-2 §11).
//
// Every report view/export is itself auditable: this writes a row into the
// EXISTING hash-chained `audit_log` (via src/lib/audit/auditLog.js) with
// action='report.view'|'report.export', entity_type='report', entity_id=reportId,
// and the active filter in `diff`. It also best-effort emits a REPORT_VIEWED /
// REPORT_EXPORTED report_event so report-usage KPIs (adm.report_usage) work once
// the spine is live. Reuses the existing audit backbone — no parallel audit engine
// (ADR-2). Non-blocking: an audit failure never fails the report request.

import { writeAuditLog } from "@/lib/audit/auditLog";
import { getAuditContext } from "@/lib/audit/auditContext";
import { emitReportEvent } from "@/lib/database/reporting/reportEvent";
import { getReportingFlag } from "./config/flags";

// Audit a report access. `action` is 'view' | 'export'. Best-effort.
export async function auditReportAccess({ req, res, action = "view", reportId, filter = null, scope = null } = {}) {
  if (!getReportingFlag("reporting_access_audit_enabled")) return;
  try {
    const ctx = await getAuditContext(req, res);
    await writeAuditLog({
      ...ctx,
      action: `report.${action}`,
      entityType: "report",
      entityId: reportId || "reports",
      diff: { filter, scopeLevel: scope?.level || null, departments: scope?.departments || null },
      reason: null,
    });

    // Mirror as a report_event for report-usage analytics (best-effort, flag-gated
    // inside emitReportEvent; no-op until emits are switched on).
    await emitReportEvent({
      event: {
        eventName: action === "export" ? "REPORT_EXPORTED" : "REPORT_VIEWED",
        entityType: "report",
        entityId: reportId || "reports",
        actorUserId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        ownerDepartment: "admin",
        payload: { filter, scopeLevel: scope?.level || null },
      },
    });
  } catch (err) {
    // Swallow — auditing must never break the report request.
    console.warn("[reporting] auditReportAccess failed (swallowed):", err?.message || err);
  }
}

export default auditReportAccess;
