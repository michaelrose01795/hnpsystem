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
// VEHICLE LOCATION AND KEY LOCATION ARE SEPARATE
// ----------------------------------------------
// A rule can move the car, the keys, both or neither, and the two halves are
// declared separately. `vehicleSection` is a section id from the canonical
// vehicle registry (src/lib/tracking/vehicleLocations.js) and is resolved to
// its label here, at module load — so a rule can never write a vehicle
// location the rest of the app does not recognise, and a typo fails loudly in
// the unit tests instead of silently creating free text in the database.
// `keyLocation` is key-domain text and is passed through untouched.
//
// WHICH STATUSES ACTUALLY FIRE
// ----------------------------
// The canonical `jobs.status` labels are Booked, Checked In, In Progress,
// Invoiced, Released and Cancelled (src/lib/status/catalog/job.js). The legacy
// sub-status vocabulary (being_valeted, being_washed, ready_for_valet, …)
// still appears in LEGACY_TO_MAIN and can reach this function from older
// callers, so those keys are listed too — they are inert unless one arrives.
//
//   Status key              Vehicle -> section   Why it is safe
//   ----------------------  -------------------  ---------------------------------
//   in progress             Workshop             A job whose main status is In
//                                                Progress is being worked on — the
//                                                car is in the workshop. NEW: this
//                                                is the only key that matches a
//                                                live canonical status, so it is
//                                                the one rule that changes what
//                                                happens today. Vehicle only —
//                                                it never moves the keys — and
//                                                skipped when the car is already
//                                                recorded in Workshop.
//   workshop in progress    Workshop             Existing rule. Previously wrote
//                                                the free text "In Workshop"; now
//                                                writes the canonical "Workshop".
//   wash / being washed /   Valet                Existing `wash` rule only moved
//   being valeted                                the keys; it now moves the car to
//                                                Valet too. The status literally
//                                                means the car is being valeted.
//   complete                Service              Existing rule. Previously wrote
//                                                the free text "Ready for
//                                                Release"; the canonical section
//                                                for a car awaiting collection is
//                                                Service (it was already an alias).
//
// PAINT — NOT AUTOMATED (needs business confirmation)
// ---------------------------------------------------
// Nothing in the job or tracking status model means "this car is in paint":
// there is no paint status, sub-status or workflow stage anywhere in
// src/lib/status/. Inventing one would move cars on a guess. PAINT_STATUS_KEYS
// below is the hook — add the confirmed status key(s) and Paint automation
// switches on with no other change. Until then Paint is a manual destination.
//
// Showroom and Off Site are manual by design. `released` is deliberately NOT
// mapped to Off Site: a released job's car may still be on the forecourt.
import { VEHICLE_LOCATION_BY_ID } from "@/lib/tracking/vehicleLocations";

// Confirmed status keys that mean "the car is in paint". Empty on purpose —
// see the note above. Example once confirmed: ["in paint", "at body shop"].
export const PAINT_STATUS_KEYS = [];

const RULE_DEFINITIONS = {
  // VEHICLE ONLY. This is new automation, so it deliberately does not move the
  // keys as well — where the keys hang on an In Progress job is a key-domain
  // decision nobody has asked this rule to make. It is also idempotent (see
  // recordAutomaticMovementForStatus): re-saving an In Progress job never
  // writes a second Workshop movement.
  "in progress": {
    vehicleSection: "workshop",
    vehicleStatus: "In Workshop",
  },
  "workshop in progress": {
    vehicleSection: "workshop",
    keyLocation: "Workshop Cupboard – Jobs in Progress",
    vehicleStatus: "In Workshop",
  },
  wash: {
    vehicleSection: "valet",
    keyLocation: "Workshop Cupboard – Wash",
    vehicleStatus: "Wash",
  },
  "being washed": {
    vehicleSection: "valet",
    keyLocation: "Workshop Cupboard – Wash",
    vehicleStatus: "Wash",
  },
  "being valeted": {
    vehicleSection: "valet",
    keyLocation: "Workshop Cupboard – Wash",
    vehicleStatus: "Wash",
  },
  complete: {
    vehicleSection: "service",
    keyLocation: "Workshop Cupboard – Complete",
    vehicleStatus: "Ready for Release",
  },
  ...Object.fromEntries(
    PAINT_STATUS_KEYS.map((key) => [key, { vehicleSection: "paint", vehicleStatus: "In Paint" }])
  ),
};

// Status text arrives as "In Progress", "in_progress" or "IN-PROGRESS"
// depending on the caller; they are all the same status.
export const normaliseAutoMovementStatus = (status) =>
  String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const resolveRule = (key, definition) => {
  const section = definition.vehicleSection ? VEHICLE_LOCATION_BY_ID.get(definition.vehicleSection) : null;
  if (definition.vehicleSection && !section) {
    throw new Error(`autoMovement: rule "${key}" names unknown vehicle section "${definition.vehicleSection}"`);
  }
  if (section && !section.supportsAutoMovement) {
    throw new Error(`autoMovement: rule "${key}" targets "${section.label}", which does not support automatic movement`);
  }
  return Object.freeze({
    ...(definition.keyLocation ? { keyLocation: definition.keyLocation } : {}),
    ...(section ? { vehicleLocation: section.label, vehicleSection: section.id } : {}),
    vehicleStatus: definition.vehicleStatus,
  });
};

export const AUTO_MOVEMENT_RULES = Object.freeze(
  Object.fromEntries(
    Object.entries(RULE_DEFINITIONS).map(([key, definition]) => [key, resolveRule(key, definition)])
  )
);

export const getAutoMovementRule = (status) => {
  if (!status) return null;
  return AUTO_MOVEMENT_RULES[normaliseAutoMovementStatus(status)] || null;
};

export default getAutoMovementRule;
