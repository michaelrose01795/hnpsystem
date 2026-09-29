// file location: src/features/stockAccess/stockAccessPermissions.js
//
// Who can do what in Stock Access. Pure and shared: the /api/access routes
// enforce it, the pages use it to decide what to render, and the workspace
// nav uses the same role lists. Role strings come from src/lib/auth/roles.js —
// never hard-coded here. Same shape as src/features/stockControl/stockAccess.js.

import {
  STOCK_ACCESS_MANAGER_ROLES,
  STOCK_ACCESS_USER_ROLES,
} from "@/lib/auth/roles";
import { STOCK_ACCESS_STORES } from "@/config/stockAccessStores";

export { STOCK_ACCESS_MANAGER_ROLES, STOCK_ACCESS_USER_ROLES };

const lower = (roles = []) => roles.map((role) => String(role || "").trim().toLowerCase()).filter(Boolean);
const includesAny = (roles, candidates) => candidates.some((role) => roles.includes(String(role).toLowerCase()));

export const NO_STOCK_ACCESS_CAPABILITIES = Object.freeze({
  view: false,
  transact: false,
  requestRestock: false,
  storeWarranty: false,
  manage: false,
  adjust: false,
  processRestock: false,
  overrideNegative: false,
  manageCustody: false,
  manageWarranty: false,
  viewCosts: false,
});

const USER_CAPABILITIES = Object.freeze({
  ...NO_STOCK_ACCESS_CAPABILITIES,
  view: true,
  transact: true,
  requestRestock: true,
  storeWarranty: true,
});

const MANAGER_CAPABILITIES = Object.freeze(
  Object.fromEntries(Object.keys(NO_STOCK_ACCESS_CAPABILITIES).map((key) => [key, true]))
);

/**
 * Resolve Stock Access capabilities for a set of roles.
 *
 *   view              open /access and see items and their status
 *   transact          take out, return and use stock
 *   requestRestock    flag an item as running low / out
 *   storeWarranty     log a part into warranty storage
 *   manage            open /access/manage; create / edit / deactivate items,
 *                     thresholds, locations, full histories
 *   adjust            audited manual stock adjustments (reason required)
 *   processRestock    order, receive (incl. partial) and cancel requests
 *   overrideNegative  let a movement take stock below zero, with a reason
 *   manageCustody     mark checked-out items missing / found / written off,
 *                     or returned on someone's behalf
 *   manageWarranty    move warranty parts to awaiting return / returned / disposed
 *   viewCosts         see unit costs and stock value
 *
 * @param {string[]} roles
 * @param {boolean} hasAllAccess  The All Access demo role.
 * @param {object} [store]        A store from src/config/stockAccessStores.js;
 *                                its own role lists win over the defaults.
 */
export function resolveStockAccessCapabilities(roles = [], hasAllAccess = false, store = null) {
  const normalised = lower(roles);
  if (hasAllAccess || includesAny(normalised, storeManagerRoles(store))) return { ...MANAGER_CAPABILITIES };
  if (includesAny(normalised, storeUserRoles(store))) return { ...USER_CAPABILITIES };
  return { ...NO_STOCK_ACCESS_CAPABILITIES };
}

/** Who may manage a store (its override, else the default list). */
export const storeManagerRoles = (store) => store?.managerRoles || STOCK_ACCESS_MANAGER_ROLES;

/** Who may log movements in a store; managers always may. */
export const storeUserRoles = (store) =>
  Array.from(new Set([...(store?.userRoles || STOCK_ACCESS_USER_ROLES), ...storeManagerRoles(store)]));

// Route guards: anyone who may use / manage at least one store. Each route
// then checks the capability for the store the request names.
export const ANY_STORE_USER_ROLES = Array.from(new Set(STOCK_ACCESS_STORES.flatMap((store) => storeUserRoles(store))));
export const ANY_STORE_MANAGER_ROLES = Array.from(new Set(STOCK_ACCESS_STORES.flatMap((store) => storeManagerRoles(store))));
