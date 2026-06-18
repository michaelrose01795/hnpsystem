// file location: src/lib/reporting/trendBuilder.js
//
// TREND framework (Phase-1 §9.1 trendBuilder; Phase-3 §3.3). Generalises the
// existing `buildSevenDaySeries` to an ARBITRARY date range + granularity
// (day/week/month/quarter/year), reading from the snapshot pyramid (Phase-2 §10.3
// "coarsest sufficient rollup"). Ratio KPIs trend the RECOMBINED ratio
// (Σnum÷Σden per bucket), never an average of daily ratios (Phase-3 §3.3).

import { readSnapshots } from "@/lib/database/reporting/snapshots";
import { buildProvenance, liveFallbackProvenance, unavailableProvenance } from "./provenance";

const pad2 = (n) => String(n).padStart(2, "0");

function isoWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${pad2(week)}`;
}

function periodKeyFor(date, granularity) {
  const y = date.getFullYear();
  switch (granularity) {
    case "day":
      return `${y}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    case "week":
      return isoWeek(date);
    case "month":
      return `${y}-${pad2(date.getMonth() + 1)}`;
    case "quarter":
      return `${y}-Q${Math.floor(date.getMonth() / 3) + 1}`;
    case "year":
      return String(y);
    default:
      return `${y}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }
}

// Generate the ordered bucket keys spanning [from,to] at a granularity.
export function generateBuckets(from, to, granularity) {
  const buckets = [];
  const seen = new Set();
  const start = new Date(from);
  const end = new Date(to);
  const cursor = new Date(start);
  // Step by day and collapse into the granularity key (robust + simple).
  let guard = 0;
  while (cursor <= end && guard < 4000) {
    const key = periodKeyFor(cursor, granularity);
    if (!seen.has(key)) {
      seen.add(key);
      buckets.push({ key });
    }
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return buckets;
}

const CADENCE_FOR_GRANULARITY = {
  day: "daily",
  week: "weekly",
  month: "monthly",
  quarter: "quarterly",
  year: "yearly",
};

// Recombine a set of snapshot rows in the same bucket into one point. For ratio
// KPIs, divide ΣnumeratorΣ/Σdenominator; for flow/value, sum value/amount.
function combineRows(rows, aggregation) {
  if (!rows.length) return { value: null, numerator: null, denominator: null, count: 0, amountGbp: 0 };
  const num = rows.reduce((s, r) => s + (Number(r.numerator) || 0), 0);
  const den = rows.reduce((s, r) => s + (Number(r.denominator) || 0), 0);
  const count = rows.reduce((s, r) => s + (Number(r.count) || 0), 0);
  const amountGbp = rows.reduce((s, r) => s + (Number(r.amount_gbp) || 0), 0);
  const sumValue = rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
  let value;
  if (aggregation === "ratio") value = den > 0 ? (num / den) * 100 : null;
  else if (aggregation === "point_in_time") value = rows[rows.length - 1]?.value ?? null;
  else value = sumValue;
  return { value, numerator: num, denominator: den, count, amountGbp };
}

// Build a trend series for a KPI over the filter's range/granularity.
// Returns { series:[{key,value,...}], provenance }.
export async function buildTrend(kpi, { filter, liveResolver } = {}) {
  const granularity = filter?.granularity || "day";
  const from = filter?.dateRange?.from;
  const to = filter?.dateRange?.to;
  const department = filter?.department || "all";
  const buckets = generateBuckets(from, to, granularity);
  const cadence = CADENCE_FOR_GRANULARITY[granularity] || "daily";

  // Try the snapshot pyramid first (the fast, consistent path).
  const periodFrom = buckets[0]?.key;
  const periodTo = buckets[buckets.length - 1]?.key;
  const snapshots = await readSnapshots(cadence, {
    kpiId: kpi.id,
    department,
    from: periodFrom,
    to: periodTo,
  });

  if (snapshots.length > 0) {
    const periodColumn = cadence === "daily" ? "day" : Object.keys(snapshots[0]).find((c) =>
      ["iso_week", "year_month", "year_quarter", "year"].includes(c)
    );
    const byBucket = new Map();
    for (const row of snapshots) {
      const key = String(row[periodColumn]);
      if (!byBucket.has(key)) byBucket.set(key, []);
      byBucket.get(key).push(row);
    }
    const series = buckets.map((b) => ({
      key: b.key,
      ...combineRows(byBucket.get(b.key) || [], kpi.aggregation),
    }));
    return {
      series,
      provenance: buildProvenance({ source: cadence === "daily" ? "snapshot" : "rollup", formulaVersion: kpi.formulaVersion }),
    };
  }

  // No snapshots: live fallback. If a per-bucket live resolver is supplied AND
  // the range is small (day granularity, <= 31 buckets), compute live per bucket.
  if (typeof liveResolver === "function" && granularity === "day" && buckets.length <= 31) {
    const series = [];
    for (const b of buckets) {
      const point = await liveResolver(b.key);
      series.push({ key: b.key, ...point });
    }
    return { series, provenance: liveFallbackProvenance({ formulaVersion: kpi.formulaVersion, reason: "trend served live per-bucket — no snapshots yet" }) };
  }

  // Otherwise return an empty, clearly-labelled scaffold (graceful degradation).
  return {
    series: buckets.map((b) => ({ key: b.key, value: null, count: 0 })),
    provenance: unavailableProvenance("trend unavailable — KPI snapshots not built yet (run the aggregation cron)"),
  };
}

export default buildTrend;
