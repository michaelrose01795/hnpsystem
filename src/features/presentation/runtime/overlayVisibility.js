// Cross-component pub/sub for whether the presentation overlay (highlight ring +
// callout popup) is currently hidden. PresentationProvider owns the source of
// truth in React state, but the Sidebar (which lives in the global Layout shell
// above PresentationProvider in the tree) needs to read and toggle the same
// value. Rather than hoist the provider, both sides talk to this module.

const STATE_KEY = "__PRESENTATION_OVERLAY_HIDDEN__";
const EVENT_NAME = "presentation:overlay-visibility-change";

function inWindow() {
  return typeof window !== "undefined";
}

export function isOverlayHidden() {
  if (!inWindow()) return false;
  return window[STATE_KEY] === true;
}

export function setOverlayHidden(value) {
  if (!inWindow()) return;
  const next = Boolean(value);
  if (window[STATE_KEY] === next) return;
  window[STATE_KEY] = next;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
  } catch {
    /* ignore — IE-style CustomEvent missing, very unlikely */
  }
}

export function subscribeOverlayVisibility(cb) {
  if (!inWindow()) return () => {};
  const handler = (e) => cb(Boolean(e?.detail));
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
