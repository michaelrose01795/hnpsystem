// file location: src/lib/typingAssist/settings.js
//
// Typing assistant preferences, the personal dictionary and the learned word
// model — all kept in localStorage on this device only. Nothing typed ever
// leaves the browser: the spell checker runs in a Web Worker against a static
// dictionary file.
//
// Changes broadcast to every open tab (storage event) and to every listener in
// this tab (a window event), so the settings panel and the global controller
// stay in step without a shared React context.

const SETTINGS_KEY = "hnp-typing-assist:settings:v1";
const DICTIONARY_KEY = "hnp-typing-assist:dictionary:v1";
export const MODEL_KEY = "hnp-typing-assist:model:v1";
const CHANGE_EVENT = "hnp-typing-assist:change";
const MAX_DICTIONARY_WORDS = 2000;

export const DEFAULT_TYPING_ASSIST_SETTINGS = Object.freeze({
  enabled: true, // master switch — off restores the browser's own spellcheck
  spelling: true, // red underline
  grammar: true, // blue underline
  predictions: true, // grey ghost word, accepted with Tab
  ukSpelling: true, // flag American spellings (color -> colour)
  learn: true, // learn the words you type most to improve predictions
});

const hasStorage = () => {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
};

function readJson(key, fallback) {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (!hasStorage()) return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode) — the assistant still works for
    // this session, it just will not remember.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key } }));
}

export function readTypingAssistSettings() {
  const stored = readJson(SETTINGS_KEY, {});
  const merged = { ...DEFAULT_TYPING_ASSIST_SETTINGS };
  for (const key of Object.keys(merged)) {
    if (typeof stored?.[key] === "boolean") merged[key] = stored[key];
  }
  return merged;
}

export function writeTypingAssistSettings(patch) {
  const next = { ...readTypingAssistSettings(), ...patch };
  writeJson(SETTINGS_KEY, next);
  return next;
}

export function resetTypingAssistSettings() {
  writeJson(SETTINGS_KEY, null);
  return readTypingAssistSettings();
}

export function readPersonalDictionary() {
  const stored = readJson(DICTIONARY_KEY, []);
  return Array.isArray(stored) ? stored.filter((w) => typeof w === "string") : [];
}

export function addToPersonalDictionary(word) {
  const clean = String(word || "").trim().toLowerCase();
  if (!clean) return readPersonalDictionary();
  const words = readPersonalDictionary().filter((w) => w !== clean);
  words.push(clean);
  const next = words.slice(-MAX_DICTIONARY_WORDS);
  writeJson(DICTIONARY_KEY, next);
  return next;
}

export function removeFromPersonalDictionary(word) {
  const clean = String(word || "").trim().toLowerCase();
  const next = readPersonalDictionary().filter((w) => w !== clean);
  writeJson(DICTIONARY_KEY, next);
  return next;
}

export function readLearnedModel() {
  return readJson(MODEL_KEY, null);
}

export function writeLearnedModel(state) {
  // Not broadcast per keystroke: the model is written on blur and is only
  // re-read when a field is next focused.
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(MODEL_KEY, JSON.stringify(state));
  } catch {
    /* storage full — predictions keep working from memory */
  }
}

export function clearLearnedModel() {
  writeJson(MODEL_KEY, null);
}

// Calls `listener(key)` whenever settings, the dictionary or the model change
// in this tab or another. Returns an unsubscribe function.
export function subscribeTypingAssist(listener) {
  if (typeof window === "undefined") return () => {};
  const onLocal = (event) => listener(event.detail?.key || null);
  const onStorage = (event) => {
    if (!event.key || event.key.startsWith("hnp-typing-assist:")) listener(event.key || null);
  };
  window.addEventListener(CHANGE_EVENT, onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onLocal);
    window.removeEventListener("storage", onStorage);
  };
}
