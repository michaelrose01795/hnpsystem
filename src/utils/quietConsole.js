const LOG_LEVELS = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

const DEFAULT_LEVEL = "error";
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
  // tooling (see src/utils/loadTrace.js) can still print at any log level.
  globalThis.__HNP_NATIVE_CONSOLE__ = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
    table: (console.table || console.log).bind(console),
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
