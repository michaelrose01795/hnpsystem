// file location: src/config/stockAccessStores.js
//
// The Stock Access stores. Each store is its own page under /access with its
// own items, but every store shares the same tables (rows carry `store_key`),
// the same API, the same ledger and the same audit trail — so reporting, stock
// valuation and cross-store search keep working as stores are added.
//
// ADDING A STORE (e.g. yellow storage)
//   1. Add an entry below. `key` is the URL segment and the store_key stored
//      on its rows: lower-case letters, numbers and hyphens, never renamed
//      once items exist.
//   2. Add two page files that render the shared screens for it:
//        src/pages/access/<key>/index.js   (copy src/pages/access/back-shed/index.js)
//        src/pages/access/<key>/manage.js  (copy src/pages/access/back-shed/manage.js)
//   3. Nothing else: the sidebar (Workshop group; Manage in Parts), page
//      access, API scoping and the /access hub all read this list. Users with
//      a saved custom sidebar layout pick the new pages up after a
//      SIDEBAR_LAYOUT_MIGRATION version bump in
//      src/config/workspace/departments.js.
//
// Optional per store:
//   userRoles     who may log movements (default STOCK_ACCESS_USER_ROLES)
//   managerRoles  who may manage it    (default STOCK_ACCESS_MANAGER_ROLES)

export const STOCK_ACCESS_STORES = Object.freeze([
  Object.freeze({
    key: "back-shed",
    label: "Back Shed",
    description: "Tools, consumables, oils and parts kept in the back shed.",
  }),
]);

export const STOCK_ACCESS_HUB_HREF = "/access";

export const storeHref = (store) => `${STOCK_ACCESS_HUB_HREF}/${store.key}`;
export const storeManageHref = (store) => `${STOCK_ACCESS_HUB_HREF}/${store.key}/manage`;

const STORE_BY_KEY = new Map(STOCK_ACCESS_STORES.map((store) => [store.key, store]));

/** The store for a key, or null when the key is not a registered store. */
export const getStockAccessStore = (key) => STORE_BY_KEY.get(String(key || "").trim().toLowerCase()) || null;

export const DEFAULT_STOCK_ACCESS_STORE_KEY = STOCK_ACCESS_STORES[0].key;
