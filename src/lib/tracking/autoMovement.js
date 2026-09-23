// file location: src/lib/tracking/autoMovement.js
//
// Automatic tracking movement rules — the single source of truth.
//
// Ownership
// ---------
// These rules used to live inside src/pages/tracking/index.js, where a Supabase
// Realtime subscription on `public.jobs` watched every UPDATE and, on a match,
// POSTed the movement itself. That put the write in the wrong place twice over:
//
//   * it only happened if somebody had /tracking open, so a status change made
//     out of hours (or simply while nobody was on that page) produced no
//     movement at all; and
//   * `performed_by` was the *viewer's* user id, so the timeline credited the
//     movement to whichever member of staff happened to have the tab open
//     rather than to whoever changed the status.
//
// Movement is now recorded by the status-changing action itself (see
// `recordAutomaticMovementForStatus` in src/lib/database/tracking.js, called
// from `updateJob` and from /api/tracking/next-action with a session-derived
// actor). This module stays framework-free so both sides share one rule table.
//
// A note on coverage, deliberately left as-is
// ------------------------------------------
// Of the three keys below, only `complete` can currently match a value that is
// actually written to `jobs.status`. The canonical labels are Booked, Checked
// In, In Progress, Invoiced, Released and Cancelled (src/lib/status/catalog/
// job.js); `"workshop in progress"` and `"wash"` match none of them, and
// `autoSetBeingWashedStatus` does not change the main status at all. Widening
// the keys would start creating movements that do not happen today, which is a
// workflow change, not a correctness fix — so the table is preserved exactly as
// it was and the gap is documented instead.
export const AUTO_MOVEMENT_RULES = {
  "workshop in progress": {
    keyLocation: "Workshop Cupboard – Jobs in Progress",
    vehicleLocation: "In Workshop",
    vehicleStatus: "In Workshop",
  },
  wash: {
    keyLocation: "Workshop Cupboard – Wash",
    vehicleStatus: "Wash",
  },
  complete: {
    keyLocation: "Workshop Cupboard – Complete",
    vehicleLocation: "Ready for Release",
    vehicleStatus: "Ready for Release",
  },
};

export const getAutoMovementRule = (status) => {
  if (!status) return null;
  return AUTO_MOVEMENT_RULES[String(status).trim().toLowerCase()] || null;
};

export default getAutoMovementRule;
