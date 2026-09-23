// file location: src/features/loanCars/loanCarAccess.js
//
// Who can do what on the loan car tracker. Pure and shared: the API routes use
// it to enforce, the tracking page uses it to decide whether the Loan Cars tab
// shows, and the panel uses the capabilities the API echoes back to decide which
// controls to render. Role lists come from src/lib/auth/roles.js — never
// hard-coded here.

import {
  ADMIN_ROLES,
  DEALERSHIP_MANAGER_ROLES,
  RECEPTION_ROLES,
  SERVICE_DESK_ROLES,
  WORKSHOP_CONTROLLER_ROLES,
  WORKSHOP_FLOOR_ROLES,
} from "@/lib/auth/roles";

const lower = (roles = []) => roles.map((role) => String(role || "").trim().toLowerCase()).filter(Boolean);
const includesAny = (roles, candidates) => candidates.some((role) => roles.includes(String(role).toLowerCase()));

// Management and workshop control run the fleet: they can move a booking's
// dates from the calendar, delete bookings and edit vehicles.
const LOAN_CAR_MANAGER_ROLES = Array.from(
  new Set([...WORKSHOP_CONTROLLER_ROLES, ...DEALERSHIP_MANAGER_ROLES, ...ADMIN_ROLES])
);

// Reception and the service desk copy bookings across from the external
// system, hand cars over and take them back.
const LOAN_CAR_DESK_ROLES = Array.from(new Set([...RECEPTION_ROLES, ...SERVICE_DESK_ROLES]));

// The workshop floor needs to see which loan cars are out and when they are
// due back, but does not book them.
const LOAN_CAR_VIEW_ONLY_ROLES = Array.from(new Set([...WORKSHOP_FLOOR_ROLES]));

export const LOAN_CAR_ROLES = Array.from(
  new Set([...LOAN_CAR_MANAGER_ROLES, ...LOAN_CAR_DESK_ROLES, ...LOAN_CAR_VIEW_ONLY_ROLES])
);

export const NO_LOAN_CAR_CAPABILITIES = Object.freeze({
  view: false,
  book: false,
  handover: false,
  adjust: false,
  remove: false,
  manageFleet: false,
});

const ALL_LOAN_CAR_CAPABILITIES = Object.freeze({
  view: true,
  book: true,
  handover: true,
  adjust: true,
  remove: true,
  manageFleet: true,
});

/**
 * Resolve the loan car capabilities for a set of roles.
 *
 *   view        see the calendar, bookings and activity
 *   book        create / edit bookings (New loan booking, Quick add)
 *   handover    mark a car out and record its return
 *   adjust      change a booking's duration by dragging it on the calendar
 *   remove      delete a booking
 *   manageFleet add / edit / retire vehicles and set unavailable periods
 *
 * @param {string[]} roles
 * @param {boolean} hasAllAccess  The All Access demo role.
 */
export function resolveLoanCarCapabilities(roles = [], hasAllAccess = false) {
  const normalised = lower(roles);
  if (hasAllAccess || includesAny(normalised, LOAN_CAR_MANAGER_ROLES)) {
    return { ...ALL_LOAN_CAR_CAPABILITIES };
  }
  if (includesAny(normalised, LOAN_CAR_DESK_ROLES)) {
    return { ...NO_LOAN_CAR_CAPABILITIES, view: true, book: true, handover: true };
  }
  if (includesAny(normalised, LOAN_CAR_VIEW_ONLY_ROLES)) {
    return { ...NO_LOAN_CAR_CAPABILITIES, view: true };
  }
  return { ...NO_LOAN_CAR_CAPABILITIES };
}

/** True when the roles may open the loan car tracker at all. */
export const canViewLoanCars = (roles = [], hasAllAccess = false) =>
  resolveLoanCarCapabilities(roles, hasAllAccess).view;
