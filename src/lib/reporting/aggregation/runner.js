// file location: src/lib/reporting/aggregation/runner.js
//
// PRIORITY 6 & 7 — SNAPSHOT + AGGREGATION frameworks (Phase-2 §9/§10).
//
// The aggregation runner computes KPI snapshots off the operational/event data
// and UPSERTs them into the snapshot pyramid. It is:
//   - IDEMPOTENT — re-running a period overwrites that period's rows (ADR-17/§10.4).
//   - INCREMENTAL — one period at a time, bounded (O(rows-in-period)).
//   - CADENCED — daily computes from source; weekly/monthly/quarterly/yearly roll
//     up from the level below (never re-scan raw unless rebuilding — §10.2).
//
// Invoked by the cron endpoints (src/pages/api/cron/aggregate-kpis-*.js).
//
// For the foundation this computes the IMPLEMENTED seed KPIs; every future KPI
// added to the catalogue (with a resolver) is picked up automatically — no
// runner change needed. Stores ratio inputs (num/den/count), not just the ratio.

import { listKpis } from "../kpiCatalog";
import { resolveKpiValue } from "../resolver";
import { upsertSnapshots, readSnapshots, recordAggregationRun, snapshotTableForCadence } from "@/lib/database/reporting/snapshots";
import { emitReportEvent } from "@/lib/database/reporting/reportEvent";

const pad2 = (n) => String(n).padStart(2, "0");

function dayKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Build the {from,to} ISO window for a single day key (YYYY-MM-DD).
function dayWindow(key) {
  return { from: `${key}T00:00:00.000Z`, to: `${key}T23:59:59.999Z`, preset: null };
}

// ---- Daily: compute from source via each KPI's resolver --------------------
async function aggregateDaily({ day, kpiIds, scope }) {
  const date = day ? new Date(`${day}T12:00:00.000Z`) : new Date();
  const key = dayKey(date);
  // Only KPIs with a resolver are computable; declared-only KPIs are skipped.
  let kpis = listKpis({ implemented: true });
  if (Array.isArray(kpiIds) && kpiIds.length) kpis = kpis.filter((k) => kpiIds.includes(k.id));

  const rows = [];
  for (const kpi of kpis) {
    const filter = { dateRange: dayWindow(key), granularity: "day", department: null };
    const result = await resolveKpiValue(kpi, { filter, scope });
    rows.push({
      kpiId: kpi.id,
      period: key,
      department: kpi.department || "all",
      team: "all",
      value: result.value ?? null,
      numerator: result.numerator ?? null,
      denominator: result.denominator ?? null,
      count: result.count ?? null,
      amountGbp: result.amountGbp ?? null,
      formulaVersion: kpi.formulaVersion,
      source: result.provenance?.live ? "live-fallback" : result.provenance?.source || "base",
    });
  }
  const res = await upsertSnapshots("daily", rows);
  return { periodKey: key, kpiCount: kpis.length, rowCount: res.written || 0, ...res };
}

// ---- Rollup: derive a coarser cadence from the level below -----------------
const ROLLUP_FROM = { weekly: "daily", monthly: "daily", quarterly: "monthly", yearly: "monthly" };

function periodKeyForCadence(date, cadence) {
  const y = date.getFullYear();
  if (cadence === "monthly") return `${y}-${pad2(date.getMonth() + 1)}`;
  if (cadence === "quarterly") return `${y}-Q${Math.floor(date.getMonth() / 3) + 1}`;
  if (cadence === "yearly") return String(y);
  // weekly handled by ISO week in trendBuilder; here we accept an explicit key.
  return dayKey(date);
}

async function aggregateRollup({ cadence, periodKey, lowerFrom, lowerTo }) {
  const source = ROLLUP_FROM[cadence];
  const meta = snapshotTableForCadence(cadence);
  if (!meta) return { skipped: `unknown cadence ${cadence}` };
  // Read all KPIs we have lower-cadence snapshots for in the window, recombine.
  const kpis = listKpis({ implemented: true });
  const rows = [];
  for (const kpi of kpis) {
    const lower = await readSnapshots(source, {
      kpiId: kpi.id,
      department: kpi.department || "all",
      from: lowerFrom,
      to: lowerTo,
    });
    if (!lower.length) continue;
    const num = lower.reduce((s, r) => s + (Number(r.numerator) || 0), 0);
    const den = lower.reduce((s, r) => s + (Number(r.denominator) || 0), 0);
    const count = lower.reduce((s, r) => s + (Number(r.count) || 0), 0);
    const amountGbp = lower.reduce((s, r) => s + (Number(r.amount_gbp) || 0), 0);
    const sumValue = lower.reduce((s, r) => s + (Number(r.value) || 0), 0);
    let value;
    if (kpi.aggregation === "ratio") value = den > 0 ? (num / den) * 100 : null;
    else if (kpi.aggregation === "point_in_time") value = lower[lower.length - 1]?.value ?? null;
    else value = sumValue;
    rows.push({
      kpiId: kpi.id,
      period: periodKey,
      department: kpi.department || "all",
      team: "all",
      value,
      numerator: num,
      denominator: den,
      count,
      amountGbp,
      formulaVersion: kpi.formulaVersion,
    });
  }
  const res = await upsertSnapshots(cadence, rows);
  return { periodKey, kpiCount: rows.length, rowCount: res.written || 0, ...res };
}

// Public entry point. opts: { cadence, day, periodKey, lowerFrom, lowerTo, kpiIds, scope }.
export async function runAggregation(opts = {}) {
  const { cadence = "daily" } = opts;
  let outcome;
  try {
    if (cadence === "daily") {
      outcome = await aggregateDaily(opts);
    } else {
      outcome = await aggregateRollup(opts);
    }
  } catch (err) {
    console.error(`[reporting] aggregation(${cadence}) failed:`, err?.message || err);
    await recordAggregationRun({ cadence, periodKey: opts.day || opts.periodKey || "?", status: "failed", reason: err?.message });
    return { ok: false, cadence, error: err?.message || String(err) };
  }

  await recordAggregationRun({
    cadence,
    periodKey: outcome.periodKey,
    kpiCount: outcome.kpiCount,
    rowCount: outcome.rowCount,
    status: outcome.ok === false ? "partial" : "ok",
    reason: outcome.skipped || null,
  });

  // Lineage event (best-effort; no-op until emits are enabled).
  await emitReportEvent({
    event: {
      eventName: "SNAPSHOT_BUILT",
      entityType: "report",
      entityId: `${cadence}:${outcome.periodKey}`,
      ownerDepartment: "system",
      actorKind: "system",
      quantity: outcome.kpiCount,
      payload: { cadence, periodKey: outcome.periodKey, rowCount: outcome.rowCount },
    },
  });

  return { ok: true, cadence, ...outcome };
}

export default runAggregation;

export { periodKeyForCadence };
