// file location: src/features/stockControl/stockAccess.js
//
// Who can do what on the stock-control tracker. Pure and shared: the API routes
// use it to enforce, the tracking page uses it to decide whether the Oil/Stock
// tab shows, and the panel uses the capabilities the API echoes back to decide
// which controls to render. Role lists come from src/lib/auth/roles.js — never
// hard-coded here. Same shape as src/features/loanCars/loanCarAccess.js.

import {
  ADMIN_ROLES,
  DEALERSHIP_MANAGER_ROLES,
  PARTS_DEPARTMENT_ROLES,
  WORKSHOP_CONTROLLER_ROLES,
  WORKSHOP_FLOOR_ROLES,
} from "@/lib/auth/roles";

const lower = (roles = []) => roles.map((role) => String(role || "").trim().toLowerCase()).filter(Boolean);
const includesAny = (roles, candidates) => candidates.some((role) => roles.includes(String(role).toLowerCase()));

// Workshop control, dealership management and admin run the stock system:
// everything, including archiving items and configuring categories/locations.
const STOCK_MANAGER_ROLES = Array.from(
  new Set([...WORKSHOP_CONTROLLER_ROLES, ...DEALERSHIP_MANAGER_ROLES, ...ADMIN_ROLES])
);

// Parts buys, receives and counts stock and maintains the item records.
const STOCK_PARTS_ROLES = Array.from(new Set([...PARTS_DEPARTMENT_ROLES]));

// The workshop floor checks levels, books stock out against jobs and flags
// items that need ordering.
const STOCK_FLOOR_ROLES = Array.from(new Set([...WORKSHOP_FLOOR_ROLES]));

export const STOCK_ROLES = Array.from(
  new Set([...STOCK_MANAGER_ROLES, ...STOCK_PARTS_ROLES, ...STOCK_FLOOR_ROLES])
);

export const NO_STOCK_CAPABILITIES = Object.freeze({
  view: false,
  check: false,
  use: false,
  requestOrder: false,
  receive: false,
  order: false,
  adjust: false,
  stocktake: false,
  manage: false,
  archive: false,
  configure: false,
  viewCosts: false,
});

const ALL_STOCK_CAPABILITIES = Object.freeze(
  Object.fromEntries(Object.keys(NO_STOCK_CAPABILITIES).map((key) => [key, true]))
);

const FLOOR_CAPABILITIES = Object.freeze({
  ...NO_STOCK_CAPABILITIES,
  view: true,
  check: true,
  use: true,
  requestOrder: true,
});

const PARTS_CAPABILITIES = Object.freeze({
  ...FLOOR_CAPABILITIES,
  receive: true,
  order: true,
  adjust: true,
  stocktake: true,
  manage: true,
  viewCosts: true,
});

/**
 * Resolve the stock capabilities for a set of roles.
 *
 *   view          see the tracker, items, orders and history
 *   check         record a physical level / quantity check
 *   use           book stock out (usage), optionally against a job
 *   requestOrder  flag an item as Order Required
 *   receive       book stock in and mark deliveries received (incl. partial)
 *   order         raise, update and cancel orders
 *   adjust        make audited manual adjustments
 *   stocktake     run a guided stocktake
 *   manage        create and edit items, including tank calibration
 *   archive       archive and restore items
 *   configure     add / rename / retire categories and locations
 *   viewCosts     see unit costs, purchase history and stock value
 *
 * @param {string[]} roles
 * @param {boolean} hasAllAccess  The All Access demo role.
 */
export function resolveStockCapabilities(roles = [], hasAllAccess = false) {
  const normalised = lower(roles);
  if (hasAllAccess || includesAny(normalised, STOCK_MANAGER_ROLES)) return { ...ALL_STOCK_CAPABILITIES };
  if (includesAny(normalised, STOCK_PARTS_ROLES)) return { ...PARTS_CAPABILITIES };
  if (includesAny(normalised, STOCK_FLOOR_ROLES)) return { ...FLOOR_CAPABILITIES };
  return { ...NO_STOCK_CAPABILITIES };
}

/** True when the roles may open the Oil/Stock tab at all. */
export const canViewStock = (roles = [], hasAllAccess = false) =>
  resolveStockCapabilities(roles, hasAllAccess).view;
