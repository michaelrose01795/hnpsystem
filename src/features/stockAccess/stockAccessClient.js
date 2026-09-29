// file location: src/features/stockAccess/stockAccessClient.js
//
// Browser calls to /api/access/*. Every Stock Access component goes through
// these, so request shapes live in one place. Errors are thrown as Error with
// the API's `status` / `code` / `canOverride` / `duplicateId` attached, so the
// action sheet can offer an authorised override on a shortage.

import { buildApiUrl } from "@/utils/apiClient";

const BASE = "/api/access";

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(buildApiUrl(`${BASE}${path}`), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const error = new Error(payload?.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.code = payload?.code || null;
    error.canOverride = payload?.canOverride === true;
    error.duplicateId = payload?.duplicateId || null;
    throw error;
  }
  return payload.data;
}

/** A fresh idempotency key for one submission (one per form, not per tap). */
export function newRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // RFC 4122 v4 fallback for older browsers.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    return (char === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

const encode = encodeURIComponent;

// Every call names the store (src/config/stockAccessStores.js) it is for; the
// API scopes reads to that store and checks the caller's rights in it. Calls
// by item / request / record id are scoped by the record's own store.
export const loadAccess = (store) => request(`?store=${encode(store)}`);
export const recordTransaction = (store, body) => request("/transactions", { method: "POST", body: { ...body, store } });

export const loadManage = (store) => request(`/items?store=${encode(store)}`);
export const loadItemDetail = (id) => request(`/items/${encode(id)}`);
export const createAccessItem = (store, fields) => request("/items", { method: "POST", body: { ...fields, store } });
export const updateAccessItem = (id, fields) => request(`/items/${encode(id)}`, { method: "PUT", body: fields });
export const setAccessItemActive = (id, active, reason = "") =>
  request(`/items/${encode(id)}`, { method: "PATCH", body: { action: active ? "activate" : "deactivate", reason } });

export const requestRestock = (body) => request("/restock", { method: "POST", body });
export const updateRestock = (body) => request("/restock", { method: "PUT", body });

export const storeWarrantyPart = (store, body) => request("/warranty", { method: "POST", body: { ...body, store } });
export const updateWarrantyPart = (body) => request("/warranty", { method: "PUT", body });

export const loadActivity = (store, { days = 7, action = "" } = {}) =>
  request(`/activity?store=${encode(store)}&days=${encode(days)}${action ? `&action=${encode(action)}` : ""}`);
export const saveAccessLocation = (store, body) => request("/locations", { method: "POST", body: { ...body, store } });
