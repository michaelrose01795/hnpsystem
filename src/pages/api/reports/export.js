// file location: src/pages/api/reports/export.js
//
// GET/POST /api/reports/export?id=<kpiId>[&format=csv]
// Exports a KPI's drill-down rows as CSV with the active filters applied. Export
// of sensitive data is permission-gated (via the KPI's permission, enforced in
// the engine) and the export action is AUDITED (Phase-1 §9.12/§9.13).

import { withReportingAuth } from "@/lib/reporting/api";
import { getDrilldown } from "@/lib/reporting/engine";
import { auditReportAccess } from "@/lib/reporting/audit";
import { buildCsvExport } from "@/lib/reporting/export";
import { getReportingFlag } from "@/lib/reporting/config/flags";
import { buildErrorEnvelope } from "@/lib/reporting/envelope";

async function handler(req, res, rctx) {
  if (!getReportingFlag("reporting_export_enabled")) {
    return res.status(200).json(buildErrorEnvelope("export is disabled"));
  }
  const id = req.query.id || req.body?.id;
  if (!id) return rctx.sendError("Provide ?id=<kpiId>", 400);

  const format = String(req.query.format || "csv").toLowerCase();
  if (format !== "csv") return rctx.sendError("Only csv export is supported in this phase", 400);

  // Permission is enforced inside the engine drill-down; if not permitted, rows
  // come back empty with a warning (no sensitive data leaks).
  const result = await getDrilldown(String(id), rctx);
  if (!result.ok && (!result.rows || result.rows.length === 0)) {
    // Either not permitted or no drill-down — return the warning, not a file.
    return rctx.sendError((result.warnings || []).join("; ") || "nothing to export", 403);
  }

  // Audit the export AFTER establishing the caller may see the data.
  await auditReportAccess({ req, res, action: "export", reportId: `export:${id}`, filter: rctx.filter, scope: rctx.scope });

  const csv = buildCsvExport({ name: String(id), rows: result.rows });
  res.setHeader("Content-Type", csv.mime);
  res.setHeader("Content-Disposition", `attachment; filename="${csv.filename}"`);
  return res.status(200).send(csv.content);
}

export default withReportingAuth(handler, { methods: ["GET", "POST"] });
