// file location: src/lib/database/allAccessVisibility.js
//
// The All Access demo account is INVISIBLE to everybody else.
//
// It has a real `users` row (see ./allAccessUser.js) so that per-user features
// work during a demonstration — but it describes a person who does not exist, so
// it must never turn up in a staff list, a roster, an assignment dropdown, an
// employee directory, a presence panel or the developer login picker. Otherwise
// real staff would see a colleague who isn't there, and, worse, anyone could
// pick it out of the Developer Login dropdown and inherit its full access.
//
// One rule, one place: every query that LISTS users applies the filter below.
// Single-row lookups BY ID are deliberately left alone — that is how the demo
// account loads its own profile, clock and settings.
//
// Deliberately dependency-free (no Supabase import) so it is cheap to pull into
// any data module.

// The demo account's fixed address — the key everything else keys off.
export const ALL_ACCESS_EMAIL = "alex.morgan@hnp-demo.co.uk";

/**
 * Hide the demo account from a Supabase query that lists users.
 *
 * `users.email` is NOT NULL in the schema, so this cannot silently drop rows
 * with a null email the way a nullable-column `neq` would.
 *
 * @param {object} query a Supabase query builder over the `users` table
 * @param {string} [column] the email column's name when it is aliased or joined
 * @returns {object} the same builder, filtered
 */
export function excludeAllAccessUser(query, column = "email") {
  return query.neq(column, ALL_ACCESS_EMAIL);
}

/**
 * The same rule for rows already in memory (aggregations, joins and RPC results
 * that cannot be filtered in SQL).
 *
 * @param {Array<object>} rows
 * @param {(row: object) => string|null|undefined} [readEmail]
 */
export function withoutAllAccessUser(rows = [], readEmail = (row) => row?.email) {
  return (Array.isArray(rows) ? rows : []).filter(
    (row) => String(readEmail(row) || "").toLowerCase() !== ALL_ACCESS_EMAIL
  );
}
