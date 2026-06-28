// file location: src/pages/api/reports/data-quality.js
//
// GET /api/reports/data-quality
// Phase-15 — Reporting Data-Quality Monitor endpoint (Phase-2 §13.3).
//
// Returns the reporting health indicators (missing ownership / attribution,
// status drift, invalid KPI inputs, snapshot / event / audit failures) plus a
// rolled-up health score, on the standard reporting envelope. Read-only,
// pure-read; the monitor never writes.
//
// Access: management oversight only. The reporting platform's data-quality view
// is a governance surface, so it is gated to CROSS-DEPARTMENT / EXECUTIVE scope
// (Management, General/Admin Manager, Owner) — operational and single-department
// users are refused, consistent with the Admin report package's gating.

import { withReportingAuth } from "@/lib/reporting/api";
import { SCOPE_LEVELS } from "@/lib/reporting/permissionScope";
import { runDataQualityMonitors } from "@/lib/reporting/dataQuality";
import { auditReportAccess } from "@/lib/reporting/audit";

const ALLOWED_LEVELS = new Set([SCOPE_LEVELS.CROSS_DEPARTMENT, SCOPE_LEVELS.EXECUTIVE]);

async function handler(req, res, rctx) {
  if (!ALLOWED_LEVELS.has(rctx.scope.level)) {
    return rctx.sendError("Reporting data-quality is restricted to management scope", 403);
  }

  const result = await runDataQualityMonitors({ filter: rctx.filter });

  // This view itself is auditable (who inspected platform health).
  await auditReportAccess({
    req,
    res,
    action: "view",
    reportId: "reports.data_quality",
    filter: rctx.filter,
    scope: rctx.scope,
  });

  return rctx.sendOk({
    data: result,
    source: "live",
    warnings: result.summary.inactive
      ? [`${result.summary.inactive} monitor(s) inactive — their source capture is not yet accruing`]
      : [],
  });
}

export default withReportingAuth(handler, { methods: ["GET"] });
