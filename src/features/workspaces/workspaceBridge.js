// file location: src/features/workspaces/workspaceBridge.js
//
// The message protocol between the HOST document (the page the user loaded,
// which owns the one global sidebar) and each extra workspace, which is a
// same-origin iframe of the app running in embedded mode.
//
// A workspace frame is recognised by its window.name, which the host sets via
// the iframe's `name` attribute. window.name survives every navigation and
// reload inside the frame, so a workspace stays a workspace however the user
// moves around in it — unlike a query parameter, which the first link drops.
//
// Every message is same-origin only and carries the frame's workspace id; the
// host also checks event.source against the frame it created, so another
// window cannot drive a workspace.

export const WORKSPACE_FRAME_PREFIX = "hnp-workspace:";

export const WORKSPACE_MESSAGES = Object.freeze({
  // frame -> host
  READY: "hnp-workspace/ready",
  ROUTE: "hnp-workspace/route",
  FOCUS: "hnp-workspace/focus",
  OPEN: "hnp-workspace/open",
  // host -> frame
  NAVIGATE: "hnp-workspace/navigate",
});

// Same-document request to open a link in another workspace. Pages call
// openInOtherWorkspace(); the host listens for this event.
export const OPEN_IN_WORKSPACE_EVENT = "hnp:workspace-open";

export const frameNameFor = (id) => `${WORKSPACE_FRAME_PREFIX}${id}`;

/** The workspace id when this document is running inside a workspace frame. */
export function getEmbeddedWorkspaceId() {
  if (typeof window === "undefined") return null;
  try {
    if (window.self === window.top) return null;
    const name = String(window.name || "");
    if (!name.startsWith(WORKSPACE_FRAME_PREFIX)) return null;
    // Only trust the name when the parent is the same app.
    if (window.parent.location.origin !== window.location.origin) return null;
    return name.slice(WORKSPACE_FRAME_PREFIX.length) || null;
  } catch {
    // Cross-origin parent: reading its location throws. Not a workspace.
    return null;
  }
}

export function postToHost(type, payload = {}) {
  const id = getEmbeddedWorkspaceId();
  if (!id) return false;
  try {
    window.parent.postMessage({ type, id, ...payload }, window.location.origin);
    return true;
  } catch {
    return false;
  }
}

// Whether the workspace system is live in the host right now — set by the host
// so link affordances (context menu) only appear where they can work.
let hostAvailable = false;
export const setWorkspaceHostAvailable = (value) => {
  hostAvailable = Boolean(value);
};

/** True when a link can be sent to another workspace from this document. */
export function canOpenInOtherWorkspace() {
  if (typeof window === "undefined") return false;
  return Boolean(getEmbeddedWorkspaceId()) || hostAvailable;
}

/**
 * Open `href` in another workspace — the most recently used other one, or a new
 * one when there is room. Works from the host page and from inside a workspace.
 * Returns false when the workspace system is unavailable (callers then fall
 * back to normal navigation).
 */
export function openInOtherWorkspace(href) {
  if (!href || typeof window === "undefined") return false;
  if (getEmbeddedWorkspaceId()) return postToHost(WORKSPACE_MESSAGES.OPEN, { href });
  if (!hostAvailable) return false;
  window.dispatchEvent(new CustomEvent(OPEN_IN_WORKSPACE_EVENT, { detail: { href } }));
  return true;
}
