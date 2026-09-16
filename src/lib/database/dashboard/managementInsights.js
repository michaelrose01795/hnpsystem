import dayjs from "dayjs";
import { supabase } from "@/lib/database/supabaseClient";

// Dashboard-only readers retain exact counts and exhaust the default row limit.
export async function dashboardCount(query) {
  const { count, error } = await query;
  if (error) throw error;
  if (count == null) throw new Error("Dashboard count was not returned.");
  return count;
}

export async function dashboardRows(makeQuery) {
  const rows = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await makeQuery().range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

export function dashboardWindow(days = 7, now = dayjs()) {
  const duration = days === 30 ? 30 : 7;
  const start = now.subtract(duration - 1, "day").startOf("day");
  // `previousStart` opens an equal-length window immediately before `start`, so
  // headline figures can be compared like-for-like with the period before them.
  return { days: duration, start, previousStart: start.subtract(duration, "day"),
    end: now.add(1, "day").startOf("day"), today: now.startOf("day"), now };
}

export function dailySeries(rows, field, start, days) {
  const counts = new Map();
  for (const row of rows) {
    if (!row[field] || !dayjs(row[field]).isValid()) continue;
    const key = dayjs(row[field]).format("YYYY-MM-DD");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from({ length: days }, (_, index) => {
    const key = start.add(index, "day").format("YYYY-MM-DD");
    return { key, value: counts.get(key) || 0 };
  });
}

export const readAppointmentWindow = (start, end) => dashboardRows(() =>
  supabase.from("appointments")
    .select("appointment_id,scheduled_time,status,job:job_id(job_number,vehicle_reg)")
    .gte("scheduled_time", start.toISOString()).lt("scheduled_time", end.toISOString())
    .order("scheduled_time").order("appointment_id")
);

// ---------------------------------------------------------------------------
// Aggregation helpers shared by the manager and admin dashboards.
// Kept here (rather than in either dashboard file) because both views build the
// same shapes: a daily series, a labelled breakdown and a period-on-period
// delta. None of these touch Supabase — they operate on rows already fetched.
// ---------------------------------------------------------------------------

// Sums a numeric column per day instead of counting rows. Used for invoiced
// value, clocked hours and any other "how much", not "how many", trend.
export function dailySumSeries(rows, dateField, valueField, start, days) {
  const totals = new Map();
  for (const row of rows) {
    if (!row?.[dateField] || !dayjs(row[dateField]).isValid()) continue;
    const amount = Number(row[valueField]);
    if (!Number.isFinite(amount)) continue;
    const key = dayjs(row[dateField]).format("YYYY-MM-DD");
    totals.set(key, (totals.get(key) || 0) + amount);
  }
  return Array.from({ length: days }, (_, index) => {
    const key = start.add(index, "day").format("YYYY-MM-DD");
    return { key, value: Math.round((totals.get(key) || 0) * 100) / 100 };
  });
}

// Averages a per-row measure per day, skipping days with no rows so an empty
// day reads as zero rather than as a misleading dip in the average.
export function dailyAverageSeries(rows, dateField, measure, start, days) {
  const buckets = new Map();
  for (const row of rows) {
    if (!row?.[dateField] || !dayjs(row[dateField]).isValid()) continue;
    const value = measure(row);
    if (!Number.isFinite(value)) continue;
    const key = dayjs(row[dateField]).format("YYYY-MM-DD");
    const bucket = buckets.get(key) || { total: 0, count: 0 };
    bucket.total += value;
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  return Array.from({ length: days }, (_, index) => {
    const key = start.add(index, "day").format("YYYY-MM-DD");
    const bucket = buckets.get(key);
    return { key, value: bucket ? Math.round((bucket.total / bucket.count) * 10) / 10 : 0 };
  });
}

// Counts rows by label and returns the largest first. `limit` folds the tail
// into a single "Other" row so a long tail cannot swamp a chart.
export function tally(rows, labelOf, { limit = 0, fallback = "Not recorded" } = {}) {
  const counts = new Map();
  for (const row of rows) {
    const label = labelOf(row) || fallback;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const ordered = [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  if (!limit || ordered.length <= limit) return ordered;
  const head = ordered.slice(0, limit);
  const tailTotal = ordered.slice(limit).reduce((sum, item) => sum + item.value, 0);
  return tailTotal ? [...head, { label: "Other", value: tailTotal }] : head;
}

// Sorts rows into fixed, ordered buckets. Always returns every bucket, so an
// empty category still renders and the shape of the chart stays stable.
export function bucket(rows, definitions, valueOf) {
  const result = definitions.map(({ label }) => ({ label, value: 0 }));
  for (const row of rows) {
    const value = valueOf(row);
    const index = definitions.findIndex((definition) => definition.test(value, row));
    if (index >= 0) result[index].value += 1;
  }
  return result;
}

// Period-on-period movement. `percent` is null when the previous period was
// zero — a rise from nothing has no meaningful percentage.
export function delta(current, previous) {
  const from = Number(previous) || 0;
  const to = Number(current) || 0;
  return { current: to, previous: from, change: to - from, percent: from === 0 ? null : Math.round(((to - from) / from) * 1000) / 10 };
}

export const sum = (rows, valueOf) => rows.reduce((total, row) => {
  const value = Number(valueOf(row));
  return Number.isFinite(value) ? total + value : total;
}, 0);

export const average = (values) => {
  const usable = values.filter((value) => Number.isFinite(value));
  return usable.length ? usable.reduce((total, value) => total + value, 0) / usable.length : null;
};

export const median = (values) => {
  const usable = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!usable.length) return null;
  const middle = Math.floor(usable.length / 2);
  return usable.length % 2 ? usable[middle] : (usable[middle - 1] + usable[middle]) / 2;
};

export const userDisplayName = (user) =>
  [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.name || "Unknown user";
