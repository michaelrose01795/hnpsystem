// file location: src/utils/debugChannels.js
//
// One opt-in switch for every diagnostic channel that prints to the browser
// console. Diagnostics are OFF by default so F12 shows only errors, warnings
// and whatever the page itself reports — turning a channel on is a deliberate
// act, not the resting state.
//
// Turn channels on from the console:
//
//   hnpDebug("trace")        — enable one channel (persists across reloads)
//   hnpDebug("trace,nav")    — enable several
//   hnpDebug("all")          — enable everything
//   hnpDebug(false)          — turn everything back off
//   hnpDebug()               — print what is currently enabled
//
// Or per-visit, without persisting, via the URL: ?debug=trace,nav
//
// Channels:
//   trace  — [HNP-TRACE] mount/state/nav timeline (src/utils/loadTrace.js)
//   nav    — [NAV] navigation banners and router event log (src/pages/_app.js)

const STORAGE_KEY = "hnp-debug-channels";

export const DEBUG_CHANNELS = ["trace", "nav"];

const isBrowser = () => typeof window !== "undefined";

const parse = (raw) =>
  String(raw || "")
    .split(/[,\s]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

const readStored = () => {
  if (!isBrowser()) return [];
  try {
    return parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // localStorage unavailable (private mode / blocked cookies).
    return [];
  }
};

const readUrl = () => {
  if (!isBrowser()) return [];
  try {
    return parse(new URLSearchParams(window.location.search).get("debug"));
  } catch {
    return [];
  }
};

// Resolved once per document. A channel flipped at runtime via hnpDebug()
// updates this set immediately, but listeners installed at mount time only
// re-read it on the next reload — which is why hnpDebug() says so.
let active = null;

const resolve = () => {
  if (active) return active;
  active = new Set([...readStored(), ...readUrl()]);
  return active;
};

export function isDebugChannelEnabled(channel) {
  if (!isBrowser()) return false;
  const set = resolve();
  return set.has("all") || set.has("*") || set.has(channel);
}

export function enabledDebugChannels() {
  return isBrowser() ? Array.from(resolve()) : [];
}

// Installs window.hnpDebug(). Safe to call more than once.
export function installDebugChannelConsole() {
  if (!isBrowser() || window.hnpDebug) return;

  const native = globalThis.__HNP_NATIVE_CONSOLE__ || console;

  const describe = () => {
    const list = enabledDebugChannels();
    return list.length
      ? `debug channels on: ${list.join(", ")}`
      : `debug channels off — hnpDebug("${DEBUG_CHANNELS.join(",")}") to enable, then reload`;
  };

  const hnpDebug = (value) => {
    if (value === undefined) return describe();

    const next =
      value === false || value === null || value === "" || value === "off"
        ? []
        : parse(Array.isArray(value) ? value.join(",") : value);

    const unknown = next.filter(
      (name) => name !== "all" && name !== "*" && !DEBUG_CHANNELS.includes(name)
    );
    if (unknown.length) {
      return `unknown channel(s): ${unknown.join(", ")} — available: ${DEBUG_CHANNELS.join(", ")}, all`;
    }

    try {
      if (next.length) window.localStorage.setItem(STORAGE_KEY, next.join(","));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      return "could not persist — localStorage is unavailable in this context";
    }

    active = new Set(next);
    return next.length
      ? `debug channels on: ${next.join(", ")} — reload to install their listeners`
      : "debug channels off — reload to remove their listeners";
  };

  hnpDebug.channels = () => DEBUG_CHANNELS.slice();
  hnpDebug.enabled = enabledDebugChannels;

  window.hnpDebug = hnpDebug;

  // A single line, only when something is on, so a normal boot prints nothing.
  if (enabledDebugChannels().length) native.log(`[HNP] ${describe()}`);
}

export default { isDebugChannelEnabled, enabledDebugChannels, installDebugChannelConsole, DEBUG_CHANNELS };
