// file location: src/pages/api/cron/aggregate-kpis-monthly.js
//
// Monthly rollup (Phase-2 §10.1). Rolls last complete month up from daily
// snapshots into kpi_monthly_snapshot. POST + Bearer CRON_SECRET.
import { handleAggregationCron } from "@/lib/reporting/aggregation/cronHandler";
import { withAuditRequest } from "@/lib/audit/withAuditRequest";

function handler(req, res) {
  return handleAggregationCron(req, res, "monthly");
}

export default withAuditRequest(handler, { actor: "system" });
