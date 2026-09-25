// file location: src/features/workspaces/workspaceBridge.js
//
// The message protocol between the HOST document (the page the user loaded,
// which owns the one global sidebar, topbar and status drawer) and each
// workspace, which is a same-origin iframe of the app running in embedded mode.
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
  COMMAND: "hnp-workspace/command",
  // host -> frame
  NAVIGATE: "hnp-workspace/navigate",
  STATUS: "hnp-workspace/status",
});

// Shell-level commands the right-click menu (or any page) can ask for. Only the
// host carries them out; a frame forwards them by message.
export const WORKSPACE_COMMANDS = Object.freeze({
  ENTER: "enter", // split the page-card area (multi workspace on)
  ADD: "add", // one more workspace
  CLOSE: "close", // close the workspace the request came from
  EXIT: "exit", // back to one page card, keeping the requesting/focused page
});

// Same-document request to open a link in another workspace. Pages call
// openInOtherWorkspace(); the host listens for this event.
export const OPEN_IN_WORKSPACE_EVENT = "hnp:workspace-open";
// Same-document shell command (see WORKSPACE_COMMANDS).
export const WORKSPACE_COMMAND_EVENT = "hnp:workspace-command";

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

// What the shell can do right now. The host sets its own copy; a frame receives
// the host's copy by STATUS message. Read by the right-click menu, so its
// "Multi workspace" section only offers what will actually work.
const CLOSED_STATUS = Object.freeze({ available: false, active: false, canAdd: false, count: 1 });
let hostStatus = CLOSED_STATUS;
let embeddedStatus = { available: true, active: true, canAdd: false, count: 2 };

export const setWorkspaceHostStatus = (status) => {
  hostStatus = status ? { ...CLOSED_STATUS, ...status } : CLOSED_STATUS;
};

export const setEmbeddedWorkspaceStatus = (status) => {
  embeddedStatus = { ...embeddedStatus, ...status, available: true, active: true };
};

/**
 * { available, active, canAdd, count, inWorkspace } for this document.
 * `inWorkspace` is true inside a workspace frame (commands then act on it).
 */
export function getWorkspaceShellStatus() {
  if (typeof window === "undefined") return { ...CLOSED_STATUS, inWorkspace: false };
  if (getEmbeddedWorkspaceId()) return { ...embeddedStatus, inWorkspace: true };
  return { ...hostStatus, inWorkspace: false };
}

/** Ask the shell to run a WORKSPACE_COMMANDS entry. Returns false if it cannot. */
export function runWorkspaceCommand(command) {
  if (typeof window === "undefined" || !command) return false;
  if (getEmbeddedWorkspaceId()) return postToHost(WORKSPACE_MESSAGES.COMMAND, { command });
  if (!hostStatus.available) return false;
  window.dispatchEvent(new CustomEvent(WORKSPACE_COMMAND_EVENT, { detail: { command } }));
  return true;
}

/** True when a link can be sent to another workspace from this document. */
export function canOpenInOtherWorkspace() {
  if (typeof window === "undefined") return false;
  return Boolean(getEmbeddedWorkspaceId()) || hostStatus.available;
}

/**
 * Open `href` in another workspace — the most recently used other one, or a new
 * one when there is room (turning multi workspace on if it is off). Works from
 * the host page and from inside a workspace. Returns false when the workspace
 * system is unavailable (callers then fall back to normal navigation).
 */
export function openInOtherWorkspace(href) {
  if (!href || typeof window === "undefined") return false;
  if (getEmbeddedWorkspaceId()) return postToHost(WORKSPACE_MESSAGES.OPEN, { href });
  if (!hostStatus.available) return false;
  window.dispatchEvent(new CustomEvent(OPEN_IN_WORKSPACE_EVENT, { detail: { href } }));
  return true;
}
