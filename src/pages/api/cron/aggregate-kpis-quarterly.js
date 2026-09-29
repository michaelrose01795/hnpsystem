// file location: src/pages/api/cron/aggregate-kpis-quarterly.js
//
// Quarterly rollup (Phase-2 §10.1). Rolls last complete quarter up from monthly
// snapshots into kpi_quarterly_snapshot. POST + Bearer CRON_SECRET.
import { handleAggregationCron } from "@/lib/reporting/aggregation/cronHandler";
import { withAuditRequest } from "@/lib/audit/withAuditRequest";

function handler(req, res) {
  return handleAggregationCron(req, res, "quarterly");
}

export default withAuditRequest(handler, { actor: "system" });
