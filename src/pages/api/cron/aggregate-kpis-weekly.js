// file location: src/pages/api/cron/aggregate-kpis-weekly.js
//
// Weekly rollup (Phase-2 §10.1). Rolls last complete ISO week up from daily
// snapshots into kpi_weekly_snapshot. POST + Bearer CRON_SECRET.
import { handleAggregationCron } from "@/lib/reporting/aggregation/cronHandler";
import { withAuditRequest } from "@/lib/audit/withAuditRequest";

function handler(req, res) {
  return handleAggregationCron(req, res, "weekly");
}

export default withAuditRequest(handler, { actor: "system" });
