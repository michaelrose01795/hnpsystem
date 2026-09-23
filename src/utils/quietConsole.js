// file location: src/utils/quietConsole.js
//
// Decides what is allowed to reach the console. The default is deliberately
// narrow: errors and warnings only. Everything informational — timelines,
// stage timings, navigation banners — is a debug channel that has to be turned
// on (see src/utils/debugChannels.js), so an ordinary F12 shows only things
// that actually went wrong.
//
// Override the level with NEXT_PUBLIC_LOG_LEVEL / LOG_LEVEL:
//   silent | error | warn | info | debug

import { installDebugChannelConsole } from "@/utils/debugChannels";

const LOG_LEVELS = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

// Warnings are real signal — a failed realtime subscription or an invalid
// status transition is worth seeing while developing. In production they are
// noise for the user, and `compiler.removeConsole` in next.config.mjs keeps
// log/info/debug out of the bundle anyway.
const DEFAULT_LEVEL =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production"
    ? "warn"
    : "error";

const rawLevel =
  (typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_LOG_LEVEL || process.env.LOG_LEVEL)) ||
  DEFAULT_LEVEL;
const normalizedLevel = String(rawLevel).toLowerCase();
const activeLevel = LOG_LEVELS[normalizedLevel] ?? LOG_LEVELS[DEFAULT_LEVEL];

const allowInfo = activeLevel >= LOG_LEVELS.info;
const allowWarn = activeLevel >= LOG_LEVELS.warn;
const allowError = activeLevel >= LOG_LEVELS.error;
const allowDebug = activeLevel >= LOG_LEVELS.debug;

const noop = () => {};

if (!globalThis.__HNP_QUIET_CONSOLE__) {
  // Preserve the native console methods before they are silenced so diagnostic
  // tooling (loadTrace.js, stageTimings.js) can still print at any log level.
  globalThis.__HNP_NATIVE_CONSOLE__ = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
    table: (console.table || console.log).bind(console),
    group: (console.group || console.log).bind(console),
    groupCollapsed: (console.groupCollapsed || console.log).bind(console),
    groupEnd: (console.groupEnd || noop).bind(console),
  };

  if (!allowInfo) {
    console.log = noop;
    console.info = noop;
  }
  if (!allowWarn) {
    console.warn = noop;
  }
  if (!allowError) {
    console.error = noop;
  }
  if (!allowDebug) {
    console.debug = noop;
  }

  globalThis.__HNP_QUIET_CONSOLE__ = true;
}

// hnpDebug() is how a developer turns the diagnostic channels back on. It has
// to exist even when every channel is off, so it is installed unconditionally.
installDebugChannelConsole();
