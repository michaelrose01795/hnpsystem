// Cross-component pub/sub for whether the presentation overlay (highlight ring +
// callout popup) is currently hidden. PresentationProvider owns the source of
// truth in React state, but the Sidebar (which lives in the global Layout shell
// above PresentationProvider in the tree) needs to read and toggle the same
// value. Rather than hoist the provider, both sides talk to this module.
//
// The flag is also mirrored to sessionStorage so that hiding the overlay
// survives a page reload or navigation between presentation pages — the
// "Show overlay" button then reliably resumes the deck from where it left off.

const STATE_KEY = "__PRESENTATION_OVERLAY_HIDDEN__";
const STORAGE_KEY = "presentation:overlayHidden";
const EVENT_NAME = "presentation:overlay-visibility-change";

function inWindow() {
  return typeof window !== "undefined";
}

function readStorage() {
  if (!inWindow()) return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isOverlayHidden() {
  if (!inWindow()) return false;
  // The live in-memory flag wins once set; otherwise fall back to the
  // persisted value so a mid-presentation reload keeps the overlay hidden.
  if (typeof window[STATE_KEY] === "boolean") return window[STATE_KEY];
  const stored = readStorage();
  window[STATE_KEY] = stored;
  return stored;
}

export function setOverlayHidden(value) {
  if (!inWindow()) return;
  const next = Boolean(value);
  if (window[STATE_KEY] === next) return;
  window[STATE_KEY] = next;
  try {
    if (next) window.sessionStorage.setItem(STORAGE_KEY, "1");
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* sessionStorage unavailable — in-memory flag still works */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
  } catch {
    /* ignore — IE-style CustomEvent missing, very unlikely */
  }
}

// Drop the persisted flag entirely — used when leaving the presentation so a
// fresh session starts with the overlay visible.
export function clearOverlayHidden() {
  if (!inWindow()) return;
  window[STATE_KEY] = false;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function subscribeOverlayVisibility(cb) {
  if (!inWindow()) return () => {};
  const handler = (e) => cb(Boolean(e?.detail));
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
