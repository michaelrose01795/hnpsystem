// Section-key -> source file/line resolution for the dev-layout overlay and for
// Help & Diagnostics code-ownership stamping.
//
// PERFORMANCE NOTE
// ----------------
// `sectionSourceMap.generated.js` is ~155KB of generated data (one entry per
// dev-layout section key in the app). This module used to import it statically
// AND build its lookup indexes at module-evaluation time. Because
// `SupportReportContext` (a global provider) and `lib/support/diagnostics.js`
// both import from here, that data landed in the first-load bundle of 54 page
// routes — including every job-card route — and cost a full pass over the map
// on every boot.
//
// The map is now loaded on demand. `findDevLayoutSectionSources` stays
// SYNCHRONOUS (captureDiagnostics runs on the error-boundary path and cannot
// become async) and returns [] until the map is resolved — exactly the same
// result it already returns for an unknown key, which every caller handles.
// `ensureDevLayoutSectionSources()` triggers the load; SupportReportContext
// warms it on idle after mount, so in practice the map is present long before a
// user opens the support modal or the overlay.
import { DEV_LAYOUT_SECTION_SOURCE_MAP_HASH } from "@/lib/dev-layout/sectionSourceMapHash";

// Stable hash of the section source map that shipped in THIS bundle. Help &
// Diagnostics (Phase 5) reads it to pin code-ownership resolution to the deployed
// map and to detect drift. Older generated files predate the constant → fall back
// to an empty string rather than crash. Re-exported from a hash-only module so
// reading it does not pull the map itself into the bundle.
export const getSectionSourceMapHash = () => DEV_LAYOUT_SECTION_SOURCE_MAP_HASH || "";

const escapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const patternToRegExp = (pattern) => {
  const parts = String(pattern || "").split("*").map(escapeRegExp);
  return new RegExp(`^${parts.join(".*")}$`);
};

// Populated by buildIndexes() once the generated map has been imported.
let exactByKey = null;
let dynamicEntries = null;
let loadPromise = null;

function buildIndexes(sourceMap) {
  const exact = new Map();
  const dynamic = [];

  sourceMap.forEach((entry) => {
    if (!entry?.key) return;
    if (entry.dynamic || String(entry.key).includes("*")) {
      dynamic.push({
        ...entry,
        matcher: patternToRegExp(entry.key),
        specificity: String(entry.key).replace(/\*/g, "").length,
      });
      return;
    }
    if (!exact.has(entry.key)) {
      exact.set(entry.key, []);
    }
    exact.get(entry.key).push(entry);
  });

  dynamic.sort((left, right) => right.specificity - left.specificity);

  exactByKey = exact;
  dynamicEntries = dynamic;
}

/**
 * Load the generated section source map (idempotent). Returns a promise that
 * resolves once `findDevLayoutSectionSources` can answer queries.
 * @returns {Promise<void>}
 */
export function ensureDevLayoutSectionSources() {
  if (exactByKey) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = import("@/lib/dev-layout/sectionSourceMap.generated")
      .then((mod) => {
        buildIndexes(mod.DEV_LAYOUT_SECTION_SOURCE_MAP || []);
      })
      .catch((error) => {
        // Never let a failed diagnostic import break the page it is diagnosing.
        console.warn("[dev-layout] section source map failed to load", error?.message || error);
        buildIndexes([]);
      });
  }
  return loadPromise;
}

/** True once the map is resolved and lookups can return matches. */
export const isDevLayoutSectionSourcesReady = () => exactByKey !== null;

export const findDevLayoutSectionSources = (sectionKey) => {
  const key = String(sectionKey || "");
  if (!key) return [];

  // Not loaded yet — kick off the load for next time and answer "no match",
  // which is the same shape callers already get for an unrecognised key.
  if (!exactByKey) {
    void ensureDevLayoutSectionSources();
    return [];
  }

  const exact = exactByKey.get(key);
  if (exact?.length) return exact;

  return dynamicEntries.filter((entry) => entry.matcher.test(key));
};
