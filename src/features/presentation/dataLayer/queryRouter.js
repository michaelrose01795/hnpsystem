// Central dispatcher for the presentation stub client.
// Each `.from(table).select(...).eq(...)` chain accumulates a query descriptor
// then calls routeSupabaseQuery() at a terminator (.then / .single / .maybeSingle).
// We honour the common Supabase filters used across the app so real page-ui
// handlers run unchanged against mock data.

import { getMockRows } from "../mockData";

function withDefaultColumns(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return row;
  return {
    archived: false,
    is_active: true,
    deleted_at: null,
    org_id: null,
    tenant_id: null,
    ...row,
  };
}

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

// Split a PostgREST or() expression on top-level commas only, so an
// `in.(a,b,c)` value is not split on its own inner commas.
function splitOrExpression(expression) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of expression) {
    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

// Evaluate a single `column.op.value` clause from an or() expression, reusing
// the same operator semantics as a normal filter.
function matchesOrPart(row, part) {
  const match = part.match(/^([a-zA-Z0-9_]+)\.([a-zA-Z]+)\.(.*)$/);
  if (!match) return false;
  const [, column, op, rawValue] = match;
  if (op === "in") {
    const values = rawValue
      .replace(/^\(|\)$/g, "")
      .split(",")
      .map((value) => value.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
    return matchesFilter(row, { kind: "in", column, value: values });
  }
  let value = rawValue;
  if (op === "is") {
    if (value === "null") value = null;
    else if (value === "true") value = true;
    else if (value === "false") value = false;
  }
  return matchesFilter(row, { kind: op, column, value });
}

function matchesOrExpression(row, expression) {
  if (typeof expression !== "string" || expression.trim().length === 0) return true;
  return splitOrExpression(expression).some((part) => matchesOrPart(row, part));
}

export function routeSupabaseQuery(descriptor) {
  const {
    table,
    op = "select",
    filters = [],
    orFilters = [],
    orderBy = [],
    limit = null,
    range = null,
    single = false,
    maybeSingle = false,
  } = descriptor || {};

  if (!table) {
    return { data: single || maybeSingle ? null : [], error: null, count: 0, status: 200, statusText: "OK" };
  }

  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug("[presentation] routeSupabaseQuery", { table, descriptor });
  }

  // Writes are no-ops; return what was sent so optimistic handlers succeed.
  if (op === "insert" || op === "update" || op === "upsert" || op === "delete") {
    const payload = descriptor.payload;
    const data = Array.isArray(payload) ? payload : payload != null ? [payload] : [];
    if (single || maybeSingle) return { data: data[0] ?? null, error: null, count: data.length, status: 200, statusText: "OK" };
    return { data, error: null, count: data.length, status: 200, statusText: "OK" };
  }

  const rows = (getMockRows(table) || []).map(withDefaultColumns);
  let result = rows.filter(
    (row) =>
      filters.every((f) => matchesFilter(row, f)) &&
      orFilters.every((expression) => matchesOrExpression(row, expression))
  );

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

  if (descriptor.head) return { data: { count: total }, error: null, count: total, status: 200, statusText: "OK" };
  if (single) return { data: result[0] ?? null, error: null, count: total, status: 200, statusText: "OK" };
  if (maybeSingle) return { data: result[0] ?? null, error: null, count: total, status: 200, statusText: "OK" };
  return { data: result, error: null, count: total, status: 200, statusText: "OK" };
}
