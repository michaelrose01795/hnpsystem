// file location: src/pages/api/cron/aggregate-kpis-daily.js
//
// Daily KPI aggregation (Phase-2 §10.1). Computes yesterday's KPI snapshots from
// source and UPSERTs kpi_daily_snapshot. Idempotent — safe to re-run / backfill
// via ?day=YYYY-MM-DD. POST + Bearer CRON_SECRET (matches the existing cron pattern).
import { handleAggregationCron } from "@/lib/reporting/aggregation/cronHandler";

export default function handler(req, res) {
  return handleAggregationCron(req, res, "daily");
}
