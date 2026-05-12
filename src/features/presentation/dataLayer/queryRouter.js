// Central dispatcher for the presentation stub client.
// Each `.from(table).select(...).eq(...)` chain accumulates a query descriptor
// then calls routeSupabaseQuery() at a terminator (.then / .single / .maybeSingle).
// We honour the common Supabase filters used across the app so real page-ui
// handlers run unchanged against mock data.

import { getMockRows } from "../mockData";

function matchesFilter(row, { kind, column, value }) {
  if (kind === "eq") return row?.[column] == value;
  if (kind === "neq") return row?.[column] != value;
  if (kind === "gt") return row?.[column] > value;
  if (kind === "gte") return row?.[column] >= value;
  if (kind === "lt") return row?.[column] < value;
  if (kind === "lte") return row?.[column] <= value;
  if (kind === "in") return Array.isArray(value) && value.includes(row?.[column]);
  if (kind === "ilike") {
    const haystack = String(row?.[column] ?? "").toLowerCase();
    const needle = String(value ?? "").toLowerCase().replace(/^%/, "").replace(/%$/, "");
    return haystack.includes(needle);
  }
  if (kind === "like") {
    const haystack = String(row?.[column] ?? "");
    const needle = String(value ?? "").replace(/^%/, "").replace(/%$/, "");
    return haystack.includes(needle);
  }
  if (kind === "is") {
    if (value === null || value === "null") return row?.[column] == null;
    return row?.[column] === value;
  }
  if (kind === "contains") {
    const cell = row?.[column];
    if (Array.isArray(cell) && Array.isArray(value)) {
      return value.every((v) => cell.includes(v));
    }
    return false;
  }
  if (kind === "not") {
    return !matchesFilter(row, { kind: value?.op || "eq", column, value: value?.value });
  }
  return true;
}

export function routeSupabaseQuery(descriptor) {
  const {
    table,
    op = "select",
    filters = [],
    orderBy = [],
    limit = null,
    range = null,
    single = false,
    maybeSingle = false,
  } = descriptor || {};

  if (!table) {
    return { data: single || maybeSingle ? null : [], error: null, count: 0, status: 200, statusText: "OK" };
  }

  // Writes are no-ops; return what was sent so optimistic handlers succeed.
  if (op === "insert" || op === "update" || op === "upsert" || op === "delete") {
    const payload = descriptor.payload;
    const data = Array.isArray(payload) ? payload : payload != null ? [payload] : [];
    if (single || maybeSingle) return { data: data[0] ?? null, error: null, count: data.length, status: 200, statusText: "OK" };
    return { data, error: null, count: data.length, status: 200, statusText: "OK" };
  }

  const rows = getMockRows(table) || [];
  let result = rows.filter((row) => filters.every((f) => matchesFilter(row, f)));

  for (const { column, ascending = true } of orderBy) {
    result = [...result].sort((a, b) => {
      const av = a?.[column];
      const bv = b?.[column];
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return ascending ? -1 : 1;
      return ascending ? 1 : -1;
    });
  }

  const total = result.length;

  if (range && Array.isArray(range) && range.length === 2) {
    result = result.slice(range[0], range[1] + 1);
  } else if (typeof limit === "number") {
    result = result.slice(0, limit);
  }

  if (single) return { data: result[0] ?? null, error: null, count: total, status: 200, statusText: "OK" };
  if (maybeSingle) return { data: result[0] ?? null, error: null, count: total, status: 200, statusText: "OK" };
  return { data: result, error: null, count: total, status: 200, statusText: "OK" };
}
