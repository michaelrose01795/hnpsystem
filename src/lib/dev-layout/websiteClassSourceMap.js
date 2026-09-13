// file location: src/lib/dev-layout/websiteClassSourceMap.js
//
// Customer-class -> source file/line resolution for the dev-layout overlay on
// /website. Staff sections resolve through data-dev-section-key registrations
// (sectionSourceMap.js); /website registers none, so the overlay resolves a
// selected card by its `ws-*` / `website-*` classes instead.
//
// Kept apart from the section source map on purpose: that map's hash pins Help
// & Diagnostics code-ownership, and the staff-style-review locate API reads it
// per file. Website class entries would shift both. This map is only ever
// loaded by the overlay, and only on the website surface.
//
// Same loading contract as sectionSourceMap.js: lookups are synchronous and
// answer [] until `ensureWebsiteClassSources()` has resolved.

let entriesByClass = null;
let loadPromise = null;

function buildIndex(sourceMap) {
  const index = new Map();
  sourceMap.forEach((entry) => {
    if (!entry?.className) return;
    if (!index.has(entry.className)) index.set(entry.className, []);
    index.get(entry.className).push(entry);
  });
  entriesByClass = index;
}

export function ensureWebsiteClassSources() {
  if (entriesByClass) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = import("@/lib/dev-layout/websiteClassSourceMap.generated")
      .then((mod) => {
        buildIndex(mod.WEBSITE_CLASS_SOURCE_MAP || []);
      })
      .catch((error) => {
        // Never let a failed diagnostic import break the page it is diagnosing.
        console.warn("[dev-layout] website class source map failed to load", error?.message || error);
        buildIndex([]);
      });
  }
  return loadPromise;
}

export const isWebsiteClassSourcesReady = () => entriesByClass !== null;

export const findWebsiteClassSources = (className) => {
  const key = String(className || "");
  if (!key) return [];
  if (!entriesByClass) {
    void ensureWebsiteClassSources();
    return [];
  }
  return entriesByClass.get(key) || [];
};
