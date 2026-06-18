// file location: src/pages/api/reports/table.js
//
// GET /api/reports/table?id=<kpiId>&page=1&pageSize=50
// A paginated tabular report — for the foundation this is the KPI's drill-down
// rows served with server-side pagination (the ReportTable block, §10). Sorting/
// filtering beyond the normalised filter is a later UI phase.

import { withReportingAuth } from "@/lib/reporting/api";
import { getDrilldown } from "@/lib/reporting/engine";
import { auditReportAccess } from "@/lib/reporting/audit";

async function handler(req, res, rctx) {
  const id = req.query.id || req.query.kpi;
  if (!id) return rctx.sendError("Provide ?id=<kpiId>", 400);

  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize) || 50));

  await auditReportAccess({ req, res, action: "view", reportId: `table:${id}`, filter: rctx.filter, scope: rctx.scope });

  const result = await getDrilldown(String(id), rctx);
  const allRows = result.rows || [];
  const start = (page - 1) * pageSize;
  const rows = allRows.slice(start, start + pageSize);

  return rctx.sendOk({
    data: {
      kpiId: result.kpiId,
      entityType: result.entityType,
      rows,
      pagination: { page, pageSize, total: allRows.length, pages: Math.ceil(allRows.length / pageSize) },
    },
    warnings: result.warnings,
  });
}

export default withReportingAuth(handler, { methods: ["GET"] });
