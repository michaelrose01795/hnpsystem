// file location: src/pages/api/cron/aggregate-kpis-yearly.js
//
// Yearly rollup (Phase-2 §10.1). Rolls last complete year up from monthly
// snapshots into kpi_yearly_snapshot. POST + Bearer CRON_SECRET.
import { handleAggregationCron } from "@/lib/reporting/aggregation/cronHandler";

export default function handler(req, res) {
  return handleAggregationCron(req, res, "yearly");
}
