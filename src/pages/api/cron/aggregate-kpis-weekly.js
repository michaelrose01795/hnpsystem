// file location: src/pages/api/cron/aggregate-kpis-weekly.js
//
// Weekly rollup (Phase-2 §10.1). Rolls last complete ISO week up from daily
// snapshots into kpi_weekly_snapshot. POST + Bearer CRON_SECRET.
import { handleAggregationCron } from "@/lib/reporting/aggregation/cronHandler";

export default function handler(req, res) {
  return handleAggregationCron(req, res, "weekly");
}
