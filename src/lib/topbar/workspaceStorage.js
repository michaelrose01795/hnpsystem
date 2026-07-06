// file location: src/lib/topbar/workspaceStorage.js
//
// Small, reusable, SSR-safe persistence layer for the top-bar workspace
// features that keep per-user state on the device: Continue-Where-You-Left-Off
// (Phase 2.3) and Pinned shortcuts (Phase 2.5). Deliberately dependency-free and
// framework-agnostic so any hook can reuse it.
//
// Design notes:
//  - Everything is namespaced under a single prefix and keyed per user so two
//    accounts on one browser never see each other's state.
//  - All access is wrapped so a disabled/at-quota/private-mode localStorage can
//    never throw into the render tree — reads degrade to a default, writes no-op.
//  - A tiny same-tab pub/sub lets multiple hook instances (e.g. a topbar chip and
//    a menu) stay in sync without a full context provider, plus it bridges the
//    native `storage` event for cross-tab sync.

const PREFIX = "hnp:topbar";

// ---------------------------------------------------------------------------
// Low-level safe storage access.
// ---------------------------------------------------------------------------
function getStore() {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

// Build the fully-qualified storage key for a feature + user. A missing user id
// falls back to "anon" so the app still works pre-auth (state is simply not
// shared with a signed-in identity).
export function buildKey(feature, userId) {
  const scope = userId ? String(userId) : "anon";
  return `${PREFIX}:${scope}:${feature}`;
}

export function readJSON(key, fallback = null) {
  const store = getStore();
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  const store = getStore();
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    emit(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key) {
  const store = getStore();
  if (!store) return false;
  try {
    store.removeItem(key);
    emit(key, null);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Same-tab + cross-tab subscription. Callbacks receive (key, value).
// ---------------------------------------------------------------------------
const listeners = new Set();

function emit(key, value) {
  listeners.forEach((cb) => {
    try {
      cb(key, value);
    } catch {
      // A broken listener must never break a write.
    }
  });
}

let storageBound = false;
function ensureCrossTabBridge() {
  if (storageBound || typeof window === "undefined") return;
  storageBound = true;
  window.addEventListener("storage", (event) => {
    if (!event.key || !event.key.startsWith(`${PREFIX}:`)) return;
    let parsed = null;
    try {
      parsed = event.newValue == null ? null : JSON.parse(event.newValue);
    } catch {
      parsed = null;
    }
    emit(event.key, parsed);
  });
}

// Subscribe to changes for a specific key. Returns an unsubscribe function.
export function subscribe(key, callback) {
  ensureCrossTabBridge();
  const wrapped = (changedKey, value) => {
    if (changedKey === key) callback(value);
  };
  listeners.add(wrapped);
  return () => listeners.delete(wrapped);
}

// ---------------------------------------------------------------------------
// Bounded most-recent list helper (used by Continue-Where-You-Left-Off). Keeps
// the newest entry first, de-duplicates by `id`, and caps the length.
// ---------------------------------------------------------------------------
export function pushRecent(key, entry, { max = 12, dedupeBy = "id" } = {}) {
  if (!entry || entry[dedupeBy] == null) return readJSON(key, []);
  const current = readJSON(key, []);
  const list = Array.isArray(current) ? current : [];
  const filtered = list.filter((item) => item?.[dedupeBy] !== entry[dedupeBy]);
  const next = [entry, ...filtered].slice(0, max);
  writeJSON(key, next);
  return next;
}
