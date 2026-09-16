// file location: src/features/website/hooks/useVehicleShortlist.js
// Favourites and the compare list for the customer vehicle cards.
//
// There is no customer-favourites table in the schema, so the shortlist lives
// in this browser's localStorage, keyed by stock number (never by reg — see
// src/lib/stock/stockNumber.js). One module-level store backs every card on
// the page and the compare tray, so pressing the heart on one card updates
// the tray without prop drilling, and a second tab stays in step through the
// `storage` event.
//
// The server snapshot is always empty, so the first client render matches the
// server HTML and the saved state appears straight after hydration.

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "hnp-website-vehicle-shortlist";

// More than three columns of specification stops fitting on a phone.
export const COMPARE_LIMIT = 3;

const EMPTY = Object.freeze({ favourites: [], compare: [] });

const asIds = (value) => (Array.isArray(value) ? value.filter((id) => typeof id === "string") : []);

let snapshot = EMPTY;
let hydrated = false;
const listeners = new Set();

const load = () => {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    return raw
      ? { favourites: asIds(raw.favourites), compare: asIds(raw.compare).slice(0, COMPARE_LIMIT) }
      : EMPTY;
  } catch {
    return EMPTY;
  }
};

const getSnapshot = () => {
  if (!hydrated) {
    hydrated = true;
    snapshot = load();
  }
  return snapshot;
};

const getServerSnapshot = () => EMPTY;

const commit = (next) => {
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode / storage full: the shortlist still works for this visit.
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener) => {
  listeners.add(listener);
  const onStorage = (event) => {
    if (event.key !== STORAGE_KEY) return;
    snapshot = load();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

const toggleIn = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export default function useVehicleShortlist() {
  const { favourites, compare } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleFavourite = useCallback((id) => {
    if (!id) return;
    const current = getSnapshot();
    commit({ ...current, favourites: toggleIn(current.favourites, id) });
  }, []);

  // Adding a fourth car is refused rather than silently dropping the first —
  // the card disables its compare button when the list is full.
  const toggleCompare = useCallback((id) => {
    if (!id) return;
    const current = getSnapshot();
    if (!current.compare.includes(id) && current.compare.length >= COMPARE_LIMIT) return;
    commit({ ...current, compare: toggleIn(current.compare, id) });
  }, []);

  const clearCompare = useCallback(() => {
    commit({ ...getSnapshot(), compare: [] });
  }, []);

  return {
    favourites,
    compare,
    compareFull: compare.length >= COMPARE_LIMIT,
    isFavourite: (id) => favourites.includes(id),
    isComparing: (id) => compare.includes(id),
    toggleFavourite,
    toggleCompare,
    clearCompare,
  };
}
