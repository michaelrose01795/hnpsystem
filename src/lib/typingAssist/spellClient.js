// file location: src/lib/typingAssist/spellClient.js
//
// Main-thread client for the spell worker, with caching. Every word's verdict
// is cached, so after the first check of a field only NEW words cross to the
// worker. Starts the worker lazily (first focus of an eligible field) and
// falls back to loading the dictionary on the main thread if a worker cannot
// be created.

let worker = null; // null = not started, false = unavailable
let sequence = 0;
const pending = new Map();
let fallbackHost = null;
let personalWords = [];

const verdicts = new Map(); // `${uk}|word` -> reason | null
const suggestions = new Map(); // `${uk}|word` -> string[]
const completions = new Map(); // prefix -> string[]

function fallback(type, payload) {
  if (!fallbackHost) {
    fallbackHost = import("./spellLoader").then(async (mod) => {
      const handle = mod.createSpellHost(await mod.loadSpellEngine());
      handle("personal", { words: personalWords });
      return handle;
    });
    fallbackHost.catch(() => {
      fallbackHost = null;
    });
  }
  return fallbackHost.then((handle) => handle(type, payload));
}

function failOverPending() {
  worker = false;
  for (const [id, request] of pending) {
    pending.delete(id);
    fallback(request.type, request.payload).then(request.resolve, request.reject);
  }
}

function startWorker() {
  if (worker !== null) return worker;
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    worker = false;
    return worker;
  }
  try {
    worker = new Worker(new URL("./spell.worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (event) => {
      const { id, result, error } = event.data || {};
      const request = pending.get(id);
      if (!request) return;
      pending.delete(id);
      if (error) request.reject(new Error(error));
      else request.resolve(result);
    };
    worker.onerror = (event) => {
      event?.preventDefault?.();
      failOverPending();
    };
    if (personalWords.length) worker.postMessage({ id: 0, type: "personal", payload: { words: personalWords } });
  } catch {
    worker = false;
  }
  return worker;
}

function request(type, payload) {
  const active = startWorker();
  if (!active) return fallback(type, payload);
  return new Promise((resolve, reject) => {
    sequence += 1;
    pending.set(sequence, { resolve, reject, type, payload });
    active.postMessage({ id: sequence, type, payload });
  });
}

// Start loading the dictionary before the user needs it.
export function warmSpellChecker() {
  return request("warm", {}).catch(() => false);
}

export function setPersonalWords(words) {
  const next = [...new Set((words || []).map((w) => String(w).toLowerCase()))].sort();
  if (next.join("\n") === personalWords.join("\n")) return;
  personalWords = next;
  verdicts.clear();
  suggestions.clear();
  if (worker) worker.postMessage({ id: 0, type: "personal", payload: { words: personalWords } });
  else if (fallbackHost) fallbackHost.then((handle) => handle("personal", { words: personalWords }));
}

// Resolves to Map(word -> "misspelt" | "us-spelling") for the words that are wrong.
export async function checkWords(words, { ukSpelling = true } = {}) {
  const prefix = ukSpelling ? "1|" : "0|";
  const unique = [...new Set(words)];
  const unknown = unique.filter((word) => !verdicts.has(prefix + word));
  if (unknown.length) {
    const wrong = new Map(await request("check", { words: unknown, ukSpelling }));
    for (const word of unknown) verdicts.set(prefix + word, wrong.get(word) || null);
  }
  const result = new Map();
  for (const word of unique) {
    const reason = verdicts.get(prefix + word);
    if (reason) result.set(word, reason);
  }
  return result;
}

// Synchronous peek at the cache: undefined = not checked yet.
export function cachedVerdict(word, { ukSpelling = true } = {}) {
  const key = (ukSpelling ? "1|" : "0|") + word;
  return verdicts.has(key) ? verdicts.get(key) : undefined;
}

export async function suggestionsFor(word, { ukSpelling = true } = {}) {
  const key = (ukSpelling ? "1|" : "0|") + word;
  if (!suggestions.has(key)) suggestions.set(key, await request("suggest", { word, ukSpelling }));
  return suggestions.get(key);
}

export async function completionsFor(prefix) {
  const key = String(prefix).toLowerCase();
  if (!completions.has(key)) completions.set(key, await request("complete", { prefix: key, limit: 3 }));
  return completions.get(key);
}
