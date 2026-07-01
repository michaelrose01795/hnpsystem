// file location: src/lib/support/triageValidation.js
//
// Help & Diagnostics ("support") — Phase 6. PURE validation / query-shaping logic
// for the developer Support Centre, split out of the DB helper so it is
// node-testable WITHOUT importing the Supabase client (which fails fast on
// missing env). src/lib/database/support.js imports these; the API layer can too.

export const SUPPORT_STATUSES = Object.freeze(["new", "triaged", "in_progress", "resolved", "wont_fix", "duplicate"]);
export const SUPPORT_SEVERITIES = Object.freeze(["unset", "low", "medium", "high", "critical"]);
export const SUPPORT_CATEGORIES_SET = Object.freeze(["bug", "question", "suggestion", "visual", "data", "other"]);

const STATUS_SET = new Set(SUPPORT_STATUSES);
const SEVERITY_SET = new Set(SUPPORT_SEVERITIES);
const SORTABLE = new Set(["created_at", "updated_at"]);

/**
 * Escape a free-text search term for a PostgREST .or(...) ilike expression:
 * commas, parentheses and wildcards are structural there, so strip them.
 * @param {string} q
 * @returns {string}
 */
export function sanitiseSearch(q) {
  return String(q || "").replace(/[(),*]/g, " ").trim().slice(0, 120);
}

/**
 * Build the validated triage patch (only the columns the caller actually set).
 * Throws on an invalid enum value.
 * @param {{ status?: string, severity?: string, assignedTo?: number|null, duplicateOf?: string|null }} updates
 * @returns {object} column patch (without updated_at)
 */
export function buildTriagePatch(updates = {}) {
  const patch = {};
  if (updates.status !== undefined) {
    if (!STATUS_SET.has(updates.status)) throw new Error(`Invalid status: ${updates.status}`);
    patch.status = updates.status;
  }
  if (updates.severity !== undefined) {
    if (!SEVERITY_SET.has(updates.severity)) throw new Error(`Invalid severity: ${updates.severity}`);
    patch.severity = updates.severity;
  }
  if (updates.assignedTo !== undefined) {
    patch.assigned_to = Number.isInteger(updates.assignedTo) ? updates.assignedTo : null;
  }
  if (updates.duplicateOf !== undefined) {
    patch.duplicate_of =
      typeof updates.duplicateOf === "string" && updates.duplicateOf ? updates.duplicateOf : null;
  }
  return patch;
}

const toIntOrUndef = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) ? n : undefined;
};

/**
 * Normalise an untrusted list-filter input (e.g. an API req.query) into the clean
 * shape listSupportReports expects. Clamps limit/offset, validates enums (drops
 * unknown values), coerces the sort direction, and marks unassigned.
 * @param {object} raw
 * @returns {{ status?: string, category?: string, severity?: string, q?: string,
 *   sortBy: string, sortDir: "asc"|"desc", limit: number, offset: number,
 *   unassigned: boolean, assignedTo?: number }}
 */
export function normaliseListFilters(raw = {}) {
  const out = {
    sortBy: SORTABLE.has(raw.sortBy) ? raw.sortBy : "created_at",
    sortDir: raw.sortDir === "asc" ? "asc" : "desc",
    limit: Math.min(Math.max(toIntOrUndef(raw.limit) ?? 50, 1), 200),
    offset: Math.max(toIntOrUndef(raw.offset) ?? 0, 0),
    unassigned: raw.unassigned === "1" || raw.unassigned === "true" || raw.unassigned === true,
  };
  if (STATUS_SET.has(raw.status)) out.status = raw.status;
  if (SEVERITY_SET.has(raw.severity)) out.severity = raw.severity;
  if (SUPPORT_CATEGORIES_SET.includes(raw.category)) out.category = raw.category;
  const q = sanitiseSearch(raw.q);
  if (q) out.q = q;
  const assigned = toIntOrUndef(raw.assignedTo);
  if (!out.unassigned && assigned !== undefined) out.assignedTo = assigned;
  return out;
}
