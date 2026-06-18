// file location: src/lib/database/reporting/snapshots.js
//
// SNAPSHOT framework data layer (Phase-2 §9). Read/upsert KPI snapshots across
// the daily→weekly→monthly→quarterly→yearly pyramid + entity-state snapshots.
//
// Snapshots are immutable once written except by explicit recompute, which
// UPSERTs the same (kpi_id, period, department, team, formula_version) key —
// making aggregation idempotent (Phase-2 §9.5 / §10.4). Store ratio INPUTS
// (numerator/denominator/count), never just the ratio (ADR-16).

import { supabase, supabaseService } from "@/lib/database/supabaseClient";
import { reportingTableExists } from "./tableAvailability";

// Cadence → { table, periodColumn, conflictKey }.
const CADENCE_TABLES = {
  daily: {
    table: "kpi_daily_snapshot",
    periodColumn: "day",
    conflict: "kpi_id,day,department,team,formula_version",
  },
  weekly: {
    table: "kpi_weekly_snapshot",
    periodColumn: "iso_week",
    conflict: "kpi_id,iso_week,department,team,formula_version",
  },
  monthly: {
    table: "kpi_monthly_snapshot",
    periodColumn: "year_month",
    conflict: "kpi_id,year_month,department,team,formula_version",
  },
  quarterly: {
    table: "kpi_quarterly_snapshot",
    periodColumn: "year_quarter",
    conflict: "kpi_id,year_quarter,department,team,formula_version",
  },
  yearly: {
    table: "kpi_yearly_snapshot",
    periodColumn: "year",
    conflict: "kpi_id,year,department,team,formula_version",
  },
};

export function snapshotTableForCadence(cadence) {
  return CADENCE_TABLES[cadence] || null;
}

// Upsert a batch of snapshot rows for a cadence. Each row: { kpiId, period,
// department, team, value, numerator, denominator, count, amountGbp,
// formulaVersion, source }. Idempotent on the cadence's conflict key.
export async function upsertSnapshots(cadence, rows = []) {
  const meta = CADENCE_TABLES[cadence];
  if (!meta) return { ok: false, skipped: `unknown cadence "${cadence}"` };
  if (!supabaseService) return { ok: false, skipped: "no service client" };
  if (rows.length === 0) return { ok: true, written: 0 };
  if (!(await reportingTableExists(meta.table))) return { ok: false, skipped: "table not applied" };

  const records = rows.map((r) => ({
    kpi_id: r.kpiId,
    [meta.periodColumn]: r.period,
    department: r.department || "all",
    team: r.team || "all",
    value: r.value ?? null,
    numerator: r.numerator ?? null,
    denominator: r.denominator ?? null,
    count: r.count ?? null,
    amount_gbp: r.amountGbp ?? null,
    formula_version: r.formulaVersion || "v1",
    source: r.source || null,
    built_at: new Date().toISOString(),
  }));
  // Drop the `source` column for cadences whose table doesn't have it (rollups).
  if (cadence !== "daily") records.forEach((rec) => delete rec.source);

  try {
    const { error } = await supabaseService
      .from(meta.table)
      .upsert(records, { onConflict: meta.conflict });
    if (error) {
      console.warn(`[reporting] upsertSnapshots(${meta.table}) failed:`, error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, written: records.length };
  } catch (err) {
    console.warn(`[reporting] upsertSnapshots(${meta.table}) threw:`, err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

// Read snapshot rows for a KPI over a period range. `range` = { from, to } in the
// period column's units (dates for daily, iso-week strings, etc.). Returns [] when
// the snapshot table is absent (the resolver then falls back to live — §9.9/G8).
export async function readSnapshots(cadence, { kpiId, department = "all", team = "all", from, to } = {}) {
  const meta = CADENCE_TABLES[cadence];
  if (!meta) return [];
  if (!(await reportingTableExists(meta.table))) return [];
  try {
    let q = supabase.from(meta.table).select("*").eq("kpi_id", kpiId);
    if (department) q = q.eq("department", department);
    if (team) q = q.eq("team", team);
    if (from != null) q = q.gte(meta.periodColumn, from);
    if (to != null) q = q.lte(meta.periodColumn, to);
    q = q.order(meta.periodColumn, { ascending: true });
    const { data, error } = await q;
    if (error) {
      console.warn(`[reporting] readSnapshots(${meta.table}) failed:`, error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn(`[reporting] readSnapshots(${meta.table}) threw:`, err?.message || err);
    return [];
  }
}

// Upsert entity-state (backlog) snapshot rows. Each: { metricId, day, department,
// bucket, count, amountGbp }.
export async function upsertEntityStateSnapshots(rows = []) {
  if (!supabaseService) return { ok: false, skipped: "no service client" };
  if (rows.length === 0) return { ok: true, written: 0 };
  if (!(await reportingTableExists("report_entity_state_snapshot")))
    return { ok: false, skipped: "table not applied" };
  const records = rows.map((r) => ({
    metric_id: r.metricId,
    day: r.day,
    department: r.department || "all",
    bucket: r.bucket,
    count: r.count ?? null,
    amount_gbp: r.amountGbp ?? null,
    built_at: new Date().toISOString(),
  }));
  try {
    const { error } = await supabaseService
      .from("report_entity_state_snapshot")
      .upsert(records, { onConflict: "metric_id,day,department,bucket" });
    if (error) return { ok: false, error: error.message };
    return { ok: true, written: records.length };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// Record an aggregation run for lineage / pipeline health (Phase-2 §10.1).
export async function recordAggregationRun({ cadence, periodKey, kpiCount, rowCount, status = "ok", reason = null }) {
  if (!supabaseService) return { ok: false };
  if (!(await reportingTableExists("report_aggregation_run"))) return { ok: false };
  try {
    const { error } = await supabaseService.from("report_aggregation_run").insert([
      {
        cadence,
        period_key: periodKey,
        kpi_count: kpiCount ?? null,
        row_count: rowCount ?? null,
        status,
        reason,
        finished_at: new Date().toISOString(),
      },
    ]);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

export default upsertSnapshots;
