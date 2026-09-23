// file location: src/lib/typingAssist/spellLoader.js
//
// Loads the en-GB Hunspell dictionary into nspell and answers spell requests.
// Used inside the Web Worker (spell.worker.js) and, only if a browser cannot
// start that worker, lazily on the main thread by spellClient.js.
//
// The dictionary is a static file in public/dictionaries/en-GB (SCOWL en_GB-ise,
// MIT/BSD — see LICENSE.txt beside it), fetched once and then served from the
// HTTP cache. It is never bundled into JavaScript.

import nspell from "nspell";
import { createSpellEngine } from "./spellEngine";

export const DICTIONARY_URLS = Object.freeze({
  aff: "/dictionaries/en-GB/en-GB.aff",
  dic: "/dictionaries/en-GB/en-GB.dic",
});

export async function loadSpellEngine(fetchImpl = fetch) {
  const [aff, dic] = await Promise.all(
    [DICTIONARY_URLS.aff, DICTIONARY_URLS.dic].map(async (url) => {
      const response = await fetchImpl(url);
      if (!response.ok) throw new Error(`Dictionary request failed: ${url} (${response.status})`);
      return response.text();
    })
  );
  const dictionary = nspell(aff, dic);
  return createSpellEngine(dictionary, { words: Object.keys(dictionary.data || {}) });
}

// One request handler, so the worker and the fallback behave identically.
//   check    { words, ukSpelling }   -> [[word, reason], ...] for the wrong ones
//   suggest  { word, ukSpelling }    -> ["suggestion", ...]
//   complete { prefix, limit }       -> ["word", ...]
//   personal { words }               -> true
export function createSpellHost(engine) {
  let personal = new Set();
  return function handle(type, payload = {}) {
    switch (type) {
      case "check":
        return (payload.words || [])
          .map((word) => {
            const verdict = engine.check(word, { personal, ukSpelling: payload.ukSpelling !== false });
            return verdict.ok ? null : [word, verdict.reason];
          })
          .filter(Boolean);
      case "suggest":
        return engine.suggest(payload.word, { ukSpelling: payload.ukSpelling !== false });
      case "complete":
        return engine.complete(payload.prefix, payload.limit);
      case "personal":
        personal = new Set((payload.words || []).map((w) => String(w).toLowerCase()));
        return true;
      case "warm":
        return true;
      default:
        throw new Error(`Unknown spell request: ${type}`);
    }
  };
}
