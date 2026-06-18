// file location: src/pages/api/reports/catalog.js
//
// GET /api/reports/catalog[?department=&tier=&readiness=]
// Lists the KPIs the caller's scope is permitted to see (Phase-1 §14 KPI-level
// gate). Drives menus / scorecard composition without exposing the resolver
// internals. Read-only metadata; no figures, so no per-KPI audit needed.

import { withReportingAuth } from "@/lib/reporting/api";
import { getVisibleCatalog } from "@/lib/reporting/engine";

async function handler(req, res, rctx) {
  const { department, tier, readiness } = req.query;
  const filter = {};
  if (department) filter.department = String(department);
  if (tier) filter.tier = String(tier);
  if (readiness) filter.readiness = String(readiness);

  const items = getVisibleCatalog(rctx.scope, filter);
  return rctx.sendOk({ data: { count: items.length, kpis: items } });
}

export default withReportingAuth(handler, { methods: ["GET"] });
