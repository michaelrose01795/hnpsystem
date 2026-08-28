// file location: src/lib/jobClocking/totals.js
//
// Pure clocking helpers, with no database dependency.
//
// These two functions do arithmetic on rows that have already been fetched — no
// I/O, no client, no session. They lived in src/lib/database/jobClocking.js
// purely because that is where clocking code was collected, and that co-location
// had a real cost: a component that calls sumJobClockingHours() synchronously
// during render (inside a useMemo, so it cannot be deferred behind a dynamic
// import) pulled the whole clocking module, which resolves the Supabase browser
// client — 213 KB of @supabase/supabase-js — into the first load of every route
// that renders it.
//
// The implementations are unchanged. src/lib/database/jobClocking.js re-exports
// both, so every existing import keeps working and the tests that import them
// from there still pass; only the render-path callers import from here.

/**
 * Total the hours on a set of clocking entries.
 * Accepts either camelCase or snake_case rows, ignores non-positive values.
 */
export const sumJobClockingHours = (entries = []) => {
  if (!Array.isArray(entries)) {
    return 0;
  }

  const total = entries.reduce((sum, entry) => {
    const hours = Number(entry?.hoursWorked ?? entry?.hours_worked ?? 0);
    return Number.isFinite(hours) && hours > 0 ? sum + hours : sum;
  }, 0);

  return Number(total.toFixed(2));
};

/**
 * Resolve the window a clocking entry should be displayed over. An entry with no
 * clock-out is still running, so it is measured to `now`.
 */
export const resolveClockingDisplayWindow = ({ clockIn = null, clockOut = null, now = Date.now() } = {}) => {
  const isActive = !clockOut;
  const completedClockOut = isActive ? null : clockOut;
  const durationEnd = completedClockOut || new Date(now).toISOString();

  return {
    clockIn,
    completedClockOut,
    durationEnd,
    isActive,
  };
};
