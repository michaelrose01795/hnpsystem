// file location: src/lib/support/savedViews.js
//
// Help & Diagnostics ("support") — Phase 6. PURE, storage-injected persistence
// for the developer's custom saved views in the Support Centre. Views never
// leave the device (localStorage only); nothing here touches the network or the
// diagnostics blob. Mirrors the supportDraft.js pattern so it is node-testable.

export const SAVED_VIEWS_KEY = "hnp.support.savedViews.v1";
const MAX_VIEWS = 20;
const MAX_NAME = 60;

const getStore = (injected) => {
  if (injected) return injected;
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  return null;
};

// Keep only known, safe filter fields (never persist arbitrary objects).
const FILTER_KEYS = ["status", "severity", "category", "q", "sort", "unassigned", "openOnly", "regressionsOnly"];
export function normaliseView(view = {}) {
  const filters = {};
  const src = view.filters || {};
  for (const k of FILTER_KEYS) {
    if (src[k] === undefined || src[k] === null || src[k] === "") continue;
    filters[k] = typeof src[k] === "boolean" ? src[k] : String(src[k]).slice(0, 120);
  }
  return {
    id: String(view.id || "").slice(0, 60) || `view-${Math.abs(hashName(view.name || "view"))}`,
    name: String(view.name || "Untitled view").trim().slice(0, MAX_NAME),
    filters,
  };
}

// Deterministic id fallback (no Date.now / Math.random so it stays pure).
function hashName(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

/** Load saved views (returns [] on missing / corrupt storage). */
export function loadSavedViews(storage) {
  const store = getStore(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(SAVED_VIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normaliseView).slice(0, MAX_VIEWS);
  } catch {
    return [];
  }
}

/** Persist the full view list (capped). Swallows quota errors. */
export function saveSavedViews(views, storage) {
  const store = getStore(storage);
  if (!store) return false;
  try {
    const list = (Array.isArray(views) ? views : []).map(normaliseView).slice(0, MAX_VIEWS);
    store.setItem(SAVED_VIEWS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** Add (or replace by id) a saved view. Returns the new list. */
export function addSavedView(view, storage) {
  const next = normaliseView(view);
  const existing = loadSavedViews(storage).filter((v) => v.id !== next.id);
  const list = [...existing, next].slice(0, MAX_VIEWS);
  saveSavedViews(list, storage);
  return list;
}

/** Remove a saved view by id. Returns the new list. */
export function removeSavedView(id, storage) {
  const list = loadSavedViews(storage).filter((v) => v.id !== id);
  saveSavedViews(list, storage);
  return list;
}
