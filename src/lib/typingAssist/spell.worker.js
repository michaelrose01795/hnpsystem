// file location: src/lib/typingAssist/spell.worker.js
//
// Web Worker for the typing assistant's spell checker. Parsing the Hunspell
// dictionary takes a moment and a few megabytes, and suggestion search is the
// most expensive thing the assistant does — so none of it runs on the thread
// that paints the page and handles typing. Started by spellClient.js.

import { createSpellHost, loadSpellEngine } from "./spellLoader";

let hostPromise = null;

function host() {
  if (!hostPromise) {
    hostPromise = loadSpellEngine().then(createSpellHost);
    // A failed download must not poison every later request.
    hostPromise.catch(() => {
      hostPromise = null;
    });
  }
  return hostPromise;
}

self.onmessage = async (event) => {
  const { id, type, payload } = event.data || {};
  try {
    const handle = await host();
    self.postMessage({ id, result: handle(type, payload) });
  } catch (error) {
    self.postMessage({ id, error: String(error?.message || error) });
  }
};
