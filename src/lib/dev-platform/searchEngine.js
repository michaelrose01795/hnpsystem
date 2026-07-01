// file location: src/lib/dev-platform/searchEngine.js
//
// Phase 8 — Developer Platform shared search / filter / sort engine. PURE and
// generic (no React, no I/O, no window) so every platform surface — the Support
// Centre queue, saved-views, future dashboards — runs one consistent engine
// instead of hand-rolling filtering per page.
//
// applyQuery(items, spec) filters by free text + field filters, then sorts, and
// returns a NEW array (input never mutated). The Support Centre's domain-specific
// enum/impact logic still lives in adminView.js; this engine is the generic
// substrate it (and everything else) can compose with.

// Resolve a field accessor: a string key ("a.b.c" dotted paths supported) or a
// function (item) => value.
function readField(item, field) {
  if (typeof field === "function") return field(item);
  if (typeof field !== "string") return undefined;
  if (!field.includes(".")) return item?.[field];
  return field.split(".").reduce((acc, part) => (acc == null ? acc : acc[part]), item);
}

// Split a query into lowercased tokens; every token must match (AND semantics).
export function tokenize(q) {
  return String(q || "")
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function stringifyValue(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(stringifyValue).join(" ");
  if (typeof value === "object") {
    try {
      return Object.values(value).map(stringifyValue).join(" ");
    } catch {
      return "";
    }
  }
  return String(value);
}

/**
 * Does `item` match every token in `q`, searching across `fields`?
 * Empty query → true. Empty fields → searches nothing → false for a non-empty q.
 */
export function matchesText(item, q, fields = []) {
  const tokens = tokenize(q);
  if (tokens.length === 0) return true;
  const haystack = fields.map((f) => stringifyValue(readField(item, f))).join(" ").toLowerCase();
  return tokens.every((tok) => haystack.includes(tok));
}

// A filter value matches when: it is null/undefined/"" (no constraint), or the
// item's field equals it, or (array value) the field is one of the values, or a
// custom matcher in `matchers` returns true.
function matchesFilters(item, filters = {}, matchers = {}) {
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;

    if (typeof matchers[key] === "function") {
      if (!matchers[key](item, value)) return false;
      continue;
    }

    const actual = readField(item, key);
    if (Array.isArray(value)) {
      if (!value.map(String).includes(String(actual))) return false;
    } else if (typeof value === "boolean") {
      if (Boolean(actual) !== value) return false;
    } else if (String(actual) !== String(value)) {
      return false;
    }
  }
  return true;
}

/**
 * applyQuery — the one entry point.
 *
 * @param {object[]} items
 * @param {object} spec
 * @param {string} [spec.q]                 free-text query
 * @param {Array<string|Function>} [spec.searchFields]  fields the query searches
 * @param {object} [spec.filters]           { key: value | value[] | boolean }
 * @param {object} [spec.matchers]          { key: (item, value) => boolean } custom filters
 * @param {string} [spec.sort]              key into `spec.sorters`
 * @param {object} [spec.sorters]           { key: (a, b) => number }
 * @param {string} [spec.defaultSort]       fallback sort key
 * @returns {object[]} a new, filtered + sorted array
 */
export function applyQuery(items = [], spec = {}) {
  const {
    q = "",
    searchFields = [],
    filters = {},
    matchers = {},
    sort,
    sorters = {},
    defaultSort,
  } = spec;

  const filtered = (Array.isArray(items) ? items : []).filter(
    (item) => matchesText(item, q, searchFields) && matchesFilters(item, filters, matchers)
  );

  const sortKey = sort && sorters[sort] ? sort : defaultSort && sorters[defaultSort] ? defaultSort : null;
  if (!sortKey) return filtered;
  // slice() so the caller's array (and our filtered copy's order guarantees) stay clean.
  return filtered.slice().sort(sorters[sortKey]);
}

export { readField, matchesFilters };
