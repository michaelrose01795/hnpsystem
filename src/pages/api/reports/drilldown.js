// file location: src/pages/api/reports/drilldown.js
//
// GET /api/reports/drilldown?id=<kpiId>  → the contributing records behind a KPI.
// Permission-gated identically to the KPI itself (you can only drill what you can
// see). Returns the rows + the source entity type for row-linking.

import { withReportingAuth } from "@/lib/reporting/api";
import { getDrilldown } from "@/lib/reporting/engine";
import { auditReportAccess } from "@/lib/reporting/audit";

async function handler(req, res, rctx) {
  const id = req.query.id || req.query.kpi;
  if (!id) return rctx.sendError("Provide ?id=<kpiId>", 400);

  await auditReportAccess({ req, res, action: "view", reportId: `drilldown:${id}`, filter: rctx.filter, scope: rctx.scope });

  const result = await getDrilldown(String(id), rctx);
  return rctx.sendOk({
    data: { kpiId: result.kpiId, entityType: result.entityType, rows: result.rows, count: result.count },
    warnings: result.warnings,
  });
}

export default withReportingAuth(handler, { methods: ["GET"] });
