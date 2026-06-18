// file location: src/lib/reporting/filters.js
//
// FILTER framework (Phase-1 §9.9). The single normalised filter object used by
// every reporting endpoint, the engine, the cache key, and (later) the FilterBar.
//
//   { dateRange:{from,to,preset}, granularity, department, team, user, status,
//     entityType, search, compareTo }
//
// Filters are URL-encodable (shareable / saveable) and validated against each
// KPI's allowed dimensions by the engine.

import { isDepartmentCode } from "./config/departments";

export const GRANULARITIES = Object.freeze(["day", "week", "month", "quarter", "year"]);

// Date-range presets → {from,to} resolver. Kept pure (caller passes `now` so the
// workflow/aggregation layers stay deterministic; defaults to real time for APIs).
export const DATE_PRESETS = Object.freeze([
  "today",
  "yesterday",
  "last_7d",
  "last_14d",
  "last_30d",
  "last_90d",
  "this_week",
  "this_month",
  "this_quarter",
  "this_year",
  "month_to_date",
  "year_to_date",
]);

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// Resolve a preset to an ISO {from,to}. `now` injectable for determinism.
export function resolvePreset(preset, now = new Date()) {
  const today = startOfDay(now);
  switch (preset) {
    case "today":
      return { from: today.toISOString(), to: endOfDay(now).toISOString() };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: y.toISOString(), to: endOfDay(y).toISOString() };
    }
    case "last_7d":
      return { from: addDays(today, -6).toISOString(), to: endOfDay(now).toISOString() };
    case "last_14d":
      return { from: addDays(today, -13).toISOString(), to: endOfDay(now).toISOString() };
    case "last_30d":
      return { from: addDays(today, -29).toISOString(), to: endOfDay(now).toISOString() };
    case "last_90d":
      return { from: addDays(today, -89).toISOString(), to: endOfDay(now).toISOString() };
    case "this_week": {
      const dow = (today.getDay() + 6) % 7; // Monday=0
      return { from: addDays(today, -dow).toISOString(), to: endOfDay(now).toISOString() };
    }
    case "this_month":
    case "month_to_date": {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: first.toISOString(), to: endOfDay(now).toISOString() };
    }
    case "this_quarter": {
      const q = Math.floor(today.getMonth() / 3) * 3;
      const first = new Date(today.getFullYear(), q, 1);
      return { from: first.toISOString(), to: endOfDay(now).toISOString() };
    }
    case "this_year":
    case "year_to_date": {
      const first = new Date(today.getFullYear(), 0, 1);
      return { from: first.toISOString(), to: endOfDay(now).toISOString() };
    }
    default:
      return { from: addDays(today, -6).toISOString(), to: endOfDay(now).toISOString() };
  }
}

const cleanStr = (v) => (v == null ? null : String(v).trim() || null);

// Normalise any raw filter input (query string object, JSON body, partial) into
// the canonical shape. Invalid/unknown values are dropped, not errored.
export function normaliseFilter(raw = {}, now = new Date()) {
  const out = {
    dateRange: { from: null, to: null, preset: null },
    granularity: "day",
    department: null,
    team: null,
    user: null,
    status: null,
    entityType: null,
    search: null,
    compareTo: null,
  };

  // Date range: explicit from/to win; else a preset; else default last_7d.
  const from = cleanStr(raw?.dateRange?.from ?? raw.from);
  const to = cleanStr(raw?.dateRange?.to ?? raw.to);
  const preset = cleanStr(raw?.dateRange?.preset ?? raw.preset ?? raw.range);
  if (from || to) {
    out.dateRange = { from: from || null, to: to || null, preset: null };
  } else if (preset && DATE_PRESETS.includes(preset)) {
    out.dateRange = { ...resolvePreset(preset, now), preset };
  } else {
    out.dateRange = { ...resolvePreset("last_7d", now), preset: "last_7d" };
  }

  const g = cleanStr(raw.granularity);
  if (g && GRANULARITIES.includes(g)) out.granularity = g;

  const dept = cleanStr(raw.department);
  if (dept && isDepartmentCode(dept)) out.department = dept;

  out.team = cleanStr(raw.team);
  out.user = cleanStr(raw.user);
  out.status = cleanStr(raw.status);
  out.entityType = cleanStr(raw.entityType ?? raw.entity_type);
  out.search = cleanStr(raw.search);

  const compareTo = cleanStr(raw.compareTo ?? raw.compare_to);
  if (compareTo) out.compareTo = compareTo;

  return out;
}

// Validate a normalised filter. Returns { ok, errors[] }.
export function validateFilter(filter) {
  const errors = [];
  if (!filter?.dateRange?.from || !filter?.dateRange?.to) {
    errors.push("dateRange.from and dateRange.to are required");
  } else if (new Date(filter.dateRange.from) > new Date(filter.dateRange.to)) {
    errors.push("dateRange.from is after dateRange.to");
  }
  if (filter.department && !isDepartmentCode(filter.department)) {
    errors.push(`unknown department "${filter.department}"`);
  }
  if (filter.granularity && !GRANULARITIES.includes(filter.granularity)) {
    errors.push(`unknown granularity "${filter.granularity}"`);
  }
  return { ok: errors.length === 0, errors };
}

// Stable hash of a filter for cache keys (order-independent JSON).
export function filterHash(filter) {
  const stable = JSON.stringify(filter, Object.keys(filter || {}).sort());
  let h = 0x811c9dc5;
  for (let i = 0; i < stable.length; i += 1) {
    h ^= stable.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h >>> 0).toString(16);
}

export default normaliseFilter;
