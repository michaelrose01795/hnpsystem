// file location: src/config/topbar/liveDepartments.js
//
// The set of department codes that receive LIVE operational counts from the
// /api/status/operational-summary endpoint. Kept as a tiny pure module (no DB,
// no Supabase) so the client hook can import it without pulling the server-only
// query helper into the browser bundle. Must stay in sync with the departments
// handled by src/lib/database/dashboard/topbarSummary.js.
export const TOPBAR_LIVE_DEPARTMENTS = new Set([
  "workshop",
  "service",
  "mot",
  "valeting",
  "paint",
  "management",
  "parts",
]);

export function isLiveDepartment(department) {
  return Boolean(department) && TOPBAR_LIVE_DEPARTMENTS.has(department);
}
