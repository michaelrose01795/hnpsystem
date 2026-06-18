// file location: src/pages/api/reports/kpi.js
//
// GET /api/reports/kpi?id=<kpiId>            → one KPI point value
// GET /api/reports/kpi?ids=<a,b,c>           → many KPI values (scorecard strip)
// Accepts the normalised filter via query (?range=last_7d&department=workshop&...).
// Returns the standard reporting envelope. Report access is audited.

import { withReportingAuth } from "@/lib/reporting/api";
import { getKpiValue, getKpiValues } from "@/lib/reporting/engine";
import { auditReportAccess } from "@/lib/reporting/audit";

async function handler(req, res, rctx) {
  const { id, ids } = req.query;
  const idList = ids ? String(ids).split(",").map((s) => s.trim()).filter(Boolean) : id ? [String(id)] : [];

  if (idList.length === 0) {
    return rctx.sendError("Provide ?id=<kpiId> or ?ids=<a,b,c>", 400);
  }

  await auditReportAccess({ req, res, action: "view", reportId: idList.join(","), filter: rctx.filter, scope: rctx.scope });

  if (idList.length === 1) {
    const result = await getKpiValue(idList[0], rctx);
    return rctx.sendOk({ data: result, provenance: result.provenance, warnings: result.warnings });
  }

  const results = await getKpiValues(idList, rctx);
  const warnings = Array.from(new Set(results.flatMap((r) => r.warnings || [])));
  return rctx.sendOk({ data: results, warnings });
}

export default withReportingAuth(handler, { methods: ["GET"] });
