// file location: src/lib/reporting/export.js
//
// PRIORITY 10 — EXPORT framework (Phase-1 §9 export; Standard Reporting Model
// §10). CSV first (PDF later, M4). Any table/report can be exported with the
// active filters applied; exports of sensitive data are permission-gated and the
// access is audited (Phase-1 §9.12 / §9.13) — the audit happens at the API layer.
//
// This module is the pure formatter: rows + column spec → CSV text. The async
// "export job" model (Phase-1 §9.4 POST /reports/export) is represented here by a
// synchronous CSV build for the foundation; large/async PDF export is a later phase.

export const EXPORT_FORMATS = Object.freeze(["csv"]); // pdf added at M4

// RFC-4180-ish CSV cell escaping.
function escapeCsvCell(value) {
  if (value == null) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// columns: [{ key, label }] or array of strings. rows: array of objects.
export function toCsv(rows = [], columns = null) {
  const cols =
    columns && columns.length
      ? columns.map((c) => (typeof c === "string" ? { key: c, label: c } : c))
      : inferColumns(rows);
  const header = cols.map((c) => escapeCsvCell(c.label ?? c.key)).join(",");
  const body = rows
    .map((row) => cols.map((c) => escapeCsvCell(row?.[c.key])).join(","))
    .join("\r\n");
  return rows.length ? `${header}\r\n${body}` : header;
}

function inferColumns(rows) {
  const keys = new Set();
  for (const row of rows.slice(0, 50)) {
    Object.keys(row || {}).forEach((k) => keys.add(k));
  }
  return Array.from(keys).map((k) => ({ key: k, label: k }));
}

// Build a complete export payload: { filename, mime, content }. `name` seeds the
// filename; `stampIso` is passed in (scripts can't call Date.now in workflows).
export function buildCsvExport({ name = "report", rows = [], columns = null, stampIso = null } = {}) {
  const stamp = (stampIso || new Date().toISOString()).replace(/[:.]/g, "-").slice(0, 19);
  const safeName = String(name).replace(/[^a-z0-9_-]+/gi, "_");
  return {
    filename: `${safeName}_${stamp}.csv`,
    mime: "text/csv; charset=utf-8",
    content: toCsv(rows, columns),
    rowCount: rows.length,
  };
}

export default buildCsvExport;
