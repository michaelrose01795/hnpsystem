// file location: src/lib/reporting/queryBuilder.js
//
// QUERY framework. Centralises CORRECT counting/summing for reporting (Phase-1
// §9.11, Goal G1). The audit found dashboard numbers wrong because helpers used
// `.limit(40)` as a "total" and overlapping ILIKE counts. Every reporting figure
// goes through here so that never recurs:
//
//   - counts use exact count queries (head:true, count:'exact'), never .limit()
//   - sums fetch the full column (paginated), never a truncated page
//   - date ranges/dept scope apply uniformly from the normalised filter
//
// These are building blocks for KPI resolvers; they are the ONLY sanctioned way
// to produce a reported total.

import { supabase } from "@/lib/database/supabaseClient";

const MAX_SUM_ROWS = 100000; // guard; warns rather than silently truncating

// Apply a normalised filter's date range to a query against `dateColumn`.
export function applyDateRange(query, dateColumn, filter) {
  if (!dateColumn || !filter?.dateRange) return query;
  let q = query;
  if (filter.dateRange.from) q = q.gte(dateColumn, filter.dateRange.from);
  if (filter.dateRange.to) q = q.lte(dateColumn, filter.dateRange.to);
  return q;
}

// Exact count of rows matching a builder. `build(q)` receives the base query and
// returns it with filters applied. Returns a number (0 on error — logged).
export async function countRows(table, build = (q) => q, { client = supabase } = {}) {
  try {
    let q = client.from(table).select("*", { head: true, count: "exact" });
    q = build(q);
    const { count, error } = await q;
    if (error) {
      console.warn(`[reporting] countRows(${table}) failed:`, error.message);
      return 0;
    }
    return count || 0;
  } catch (err) {
    console.warn(`[reporting] countRows(${table}) threw:`, err?.message || err);
    return 0;
  }
}

// Full (non-truncated) sum of a numeric column. Paginates to avoid the default
// 1000-row PostgREST cap acting as a hidden .limit(). Returns { sum, count, capped }.
export async function sumColumn(table, column, build = (q) => q, { client = supabase, pageSize = 1000 } = {}) {
  let sum = 0;
  let count = 0;
  let from = 0;
  let capped = false;
  try {
    while (true) {
      let q = client.from(table).select(column);
      q = build(q).range(from, from + pageSize - 1);
      const { data, error } = await q;
      if (error) {
        console.warn(`[reporting] sumColumn(${table}.${column}) failed:`, error.message);
        break;
      }
      if (!data || data.length === 0) break;
      for (const row of data) {
        const v = Number(row?.[column]);
        if (Number.isFinite(v)) sum += v;
      }
      count += data.length;
      if (data.length < pageSize) break;
      from += pageSize;
      if (count >= MAX_SUM_ROWS) {
        capped = true;
        console.warn(`[reporting] sumColumn(${table}.${column}) hit MAX_SUM_ROWS guard`);
        break;
      }
    }
  } catch (err) {
    console.warn(`[reporting] sumColumn(${table}.${column}) threw:`, err?.message || err);
  }
  return { sum, count, capped };
}

// Full (non-truncated) sum of a numeric column where the query needs a custom
// select shape, e.g. an invoice-line total filtered by parent invoice date via
// an embedded join. The summed column must still live on the base table.
export async function sumColumnFromSelect(
  table,
  column,
  select,
  build = (q) => q,
  { client = supabase, pageSize = 1000 } = {}
) {
  let sum = 0;
  let count = 0;
  let from = 0;
  let capped = false;
  try {
    while (true) {
      let q = client.from(table).select(select || column);
      q = build(q).range(from, from + pageSize - 1);
      const { data, error } = await q;
      if (error) {
        console.warn(`[reporting] sumColumnFromSelect(${table}.${column}) failed:`, error.message);
        break;
      }
      if (!data || data.length === 0) break;
      for (const row of data) {
        const v = Number(row?.[column]);
        if (Number.isFinite(v)) sum += v;
      }
      count += data.length;
      if (data.length < pageSize) break;
      from += pageSize;
      if (count >= MAX_SUM_ROWS) {
        capped = true;
        console.warn(`[reporting] sumColumnFromSelect(${table}.${column}) hit MAX_SUM_ROWS guard`);
        break;
      }
    }
  } catch (err) {
    console.warn(`[reporting] sumColumnFromSelect(${table}.${column}) threw:`, err?.message || err);
  }
  return { sum, count, capped };
}

// Full (non-truncated) sum of the PRODUCT of two numeric columns — e.g. value =
// Σ (unit_price × quantity_fitted) or stock value = Σ (qty_in_stock × unit_cost).
// Paginates the same way as sumColumn so the figure is a true total, never a
// page. Rows where either factor is non-finite are skipped. Returns { sum, count,
// capped }. (Workshop KPIs never needed a product sum — labour sales is a scalar
// × a config rate — but every Parts value/margin/stock KPI does, so this lives in
// the shared builder for any future package to reuse.)
export async function sumProduct(
  table,
  columnA,
  columnB,
  build = (q) => q,
  { client = supabase, pageSize = 1000 } = {}
) {
  let sum = 0;
  let count = 0;
  let from = 0;
  let capped = false;
  try {
    while (true) {
      let q = client.from(table).select(`${columnA},${columnB}`);
      q = build(q).range(from, from + pageSize - 1);
      const { data, error } = await q;
      if (error) {
        console.warn(`[reporting] sumProduct(${table}.${columnA}×${columnB}) failed:`, error.message);
        break;
      }
      if (!data || data.length === 0) break;
      for (const row of data) {
        const a = Number(row?.[columnA]);
        const b = Number(row?.[columnB]);
        if (Number.isFinite(a) && Number.isFinite(b)) sum += a * b;
      }
      count += data.length;
      if (data.length < pageSize) break;
      from += pageSize;
      if (count >= MAX_SUM_ROWS) {
        capped = true;
        console.warn(`[reporting] sumProduct(${table}.${columnA}×${columnB}) hit MAX_SUM_ROWS guard`);
        break;
      }
    }
  } catch (err) {
    console.warn(`[reporting] sumProduct(${table}.${columnA}×${columnB}) threw:`, err?.message || err);
  }
  return { sum, count, capped };
}

// Distribution: count rows grouped by a column's value (e.g. open parts by
// status). Returns a map { value -> count }. Paginated, full (not truncated).
export async function groupCount(table, column, build = (q) => q, { client = supabase, pageSize = 1000 } = {}) {
  const out = {};
  let from = 0;
  try {
    while (true) {
      let q = client.from(table).select(column);
      q = build(q).range(from, from + pageSize - 1);
      const { data, error } = await q;
      if (error) {
        console.warn(`[reporting] groupCount(${table}.${column}) failed:`, error.message);
        break;
      }
      if (!data || data.length === 0) break;
      for (const row of data) {
        const key = row?.[column] == null ? "(null)" : String(row[column]);
        out[key] = (out[key] || 0) + 1;
      }
      if (data.length < pageSize) break;
      from += pageSize;
    }
  } catch (err) {
    console.warn(`[reporting] groupCount(${table}.${column}) threw:`, err?.message || err);
  }
  return out;
}

// Fetch the contributing rows behind a number (drill-down support). Bounded by
// `limit` (a genuine page for display, not a total — totals use countRows).
export async function fetchRows(table, columns, build = (q) => q, { client = supabase, limit = 200, orderBy, ascending = false } = {}) {
  try {
    let q = client.from(table).select(columns);
    q = build(q);
    if (orderBy) q = q.order(orderBy, { ascending });
    q = q.limit(limit);
    const { data, error } = await q;
    if (error) {
      console.warn(`[reporting] fetchRows(${table}) failed:`, error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn(`[reporting] fetchRows(${table}) threw:`, err?.message || err);
    return [];
  }
}

// Fetch every matching row for a resolver that must inspect JSONB or derived
// state in application code. This is still bounded by MAX_SUM_ROWS so a malformed
// report cannot silently scan forever.
export async function fetchAllRows(
  table,
  columns,
  build = (q) => q,
  { client = supabase, pageSize = 1000, orderBy, ascending = false } = {}
) {
  const rows = [];
  let from = 0;
  try {
    while (true) {
      let q = client.from(table).select(columns);
      q = build(q);
      if (orderBy) q = q.order(orderBy, { ascending });
      q = q.range(from, from + pageSize - 1);
      const { data, error } = await q;
      if (error) {
        console.warn(`[reporting] fetchAllRows(${table}) failed:`, error.message);
        break;
      }
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
      if (rows.length >= MAX_SUM_ROWS) {
        console.warn(`[reporting] fetchAllRows(${table}) hit MAX_SUM_ROWS guard`);
        break;
      }
    }
  } catch (err) {
    console.warn(`[reporting] fetchAllRows(${table}) threw:`, err?.message || err);
  }
  return rows;
}

const queryBuilder = { applyDateRange, countRows, sumColumn, sumColumnFromSelect, sumProduct, groupCount, fetchRows, fetchAllRows };
export default queryBuilder;
