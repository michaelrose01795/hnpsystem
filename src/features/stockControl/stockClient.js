// file location: src/features/stockControl/stockClient.js
//
// Browser calls to /api/tracking/stock/*. Every panel component goes through
// these, so request shapes live in one place. Errors are thrown as Error with
// the API's `code` / `duplicateId` / `data` attached, so callers can offer
// "Open existing item" on a duplicate.

import { buildApiUrl } from "@/utils/apiClient";

const BASE = "/api/tracking/stock";

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
    error.duplicateId = payload?.duplicateId || null;
    error.data = payload?.data || null;
    throw error;
  }
  return payload.data;
}

export const loadStock = () => request("");

// /tracking/Oil-Stock starts the stock request on mount, in parallel with the
// panel chunk, and the panel's first load picks the same request up — whichever
// of the two asks first (on a return visit the cached chunk mounts the panel
// before the page's effect runs). An in-flight request is always shared, and a
// finished one for a few seconds after it lands (the chunk can arrive after the
// data on a slow connection); a later visit fetches again. Refreshes after a
// change use loadStock.
const STOCK_REUSE_MS = 5000;
let stockPromise = null;
let stockSettledAt = null; // null while the request is in flight

export function prefetchStock() {
  const stale = stockSettledAt !== null && Date.now() - stockSettledAt > STOCK_REUSE_MS;
  if (!stockPromise || stale) {
    stockSettledAt = null;
    const pending = loadStock().then(
      (data) => {
        if (stockPromise === pending) stockSettledAt = Date.now();
        return data;
      },
      (error) => {
        if (stockPromise === pending) stockPromise = null; // let the next caller retry
        throw error;
      }
    );
    stockPromise = pending;
  }
  return stockPromise;
}

export const loadItemHistory = (id) => request(`/${encodeURIComponent(id)}`);
export const createStockItem = (fields) => request("", { method: "POST", body: fields });
export const updateStockItem = (id, fields) => request(`/${encodeURIComponent(id)}`, { method: "PUT", body: fields });
export const setStockItemArchived = (id, archived, reason = "") =>
  request(`/${encodeURIComponent(id)}`, { method: "PATCH", body: { action: archived ? "archive" : "restore", reason } });
export const recordStockAction = (body) => request("/movements", { method: "POST", body });
export const createStockOrder = (body) => request("/orders", { method: "POST", body });
export const updateStockOrder = (body) => request("/orders", { method: "PUT", body });
export const receiveStockOrder = (body) => request("/orders", { method: "PUT", body: { ...body, action: "receive" } });
export const cancelStockOrder = (id, reason = "") => request("/orders", { method: "PUT", body: { id, action: "cancel", reason } });
export const stocktakeRequest = (body) => request("/stocktakes", { method: "POST", body });
export const saveStockSetting = (body) => request("/settings", { method: "POST", body });
