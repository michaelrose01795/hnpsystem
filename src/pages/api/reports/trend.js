// file location: src/pages/api/reports/trend.js
//
// GET /api/reports/trend?id=<kpiId>&range=last_30d&granularity=day&department=...
// Time series for a KPI over the filter's range/granularity. Reads the snapshot
// pyramid; live per-bucket fallback for small day ranges (labelled in provenance).

import { withReportingAuth } from "@/lib/reporting/api";
import { getTrend } from "@/lib/reporting/engine";
import { auditReportAccess } from "@/lib/reporting/audit";

async function handler(req, res, rctx) {
  const { id } = req.query;
  if (!id) return rctx.sendError("Provide ?id=<kpiId>", 400);

  await auditReportAccess({ req, res, action: "view", reportId: `trend:${id}`, filter: rctx.filter, scope: rctx.scope });

  const result = await getTrend(String(id), rctx);
  return rctx.sendOk({
    data: { kpiId: result.kpiId, label: result.label, series: result.series },
    provenance: result.provenance,
    warnings: result.warnings,
  });
}

export default withReportingAuth(handler, { methods: ["GET"] });
