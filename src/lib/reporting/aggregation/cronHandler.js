// file location: src/lib/reporting/aggregation/cronHandler.js
//
// Shared cron handler for the KPI aggregation endpoints. Mirrors the existing
// cron convention (src/pages/api/cron/auto-clockout.js): POST only, Bearer
// CRON_SECRET auth (skipped when the secret is unset, for local runs), JSON
// { success, message, ... } response.
//
// The five aggregate-kpis-<cadence> route files are one-line wrappers around this.

import { runAggregation } from "./runner";
import { aggregationWindow } from "./schedule";

export async function handleAggregationCron(req, res, cadence) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    // Allow explicit overrides for backfill/recompute: ?day=, ?periodKey=.
    const base = aggregationWindow(cadence);
    const opts = { ...base };
    if (req.query.day) opts.day = String(req.query.day);
    if (req.query.periodKey) opts.periodKey = String(req.query.periodKey);
    if (req.query.lowerFrom) opts.lowerFrom = String(req.query.lowerFrom);
    if (req.query.lowerTo) opts.lowerTo = String(req.query.lowerTo);

    const result = await runAggregation(opts);
    return res.status(200).json({
      success: result.ok !== false,
      message: `aggregate-kpis-${cadence} complete`,
      cadence,
      periodKey: result.periodKey || opts.day || opts.periodKey || null,
      kpiCount: result.kpiCount ?? 0,
      rowCount: result.rowCount ?? 0,
      skipped: result.skipped || result.error || undefined,
    });
  } catch (error) {
    console.error(`[reporting] aggregate-kpis-${cadence} cron error:`, error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export default handleAggregationCron;
