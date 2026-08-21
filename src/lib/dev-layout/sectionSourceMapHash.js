// Hash-only view of the generated dev-layout section source map.
//
// `sectionSourceMap.generated.js` exports both the ~155KB map and a small hash
// of it. Help & Diagnostics needs only the hash on the boot path (to stamp which
// map a report was captured against). Re-exporting just the constant from this
// dedicated module lets the bundler drop the map array for consumers that want
// the hash alone — the generated file is pure data with no side effects, so the
// unused export is safely tree-shaken.
//
// The map itself is loaded on demand by `./sectionSourceMap`.
//
// NOTE: this re-exports from `sectionSourceMapHash.generated.js`, a hash-ONLY
// file written by the same generator, not from `sectionSourceMap.generated.js`.
// Re-exporting the constant from the map file does not tree-shake the map array
// away under Turbopack — it kept the full 155KB in the first-load bundle of 54
// page routes, which is the whole problem this module exists to solve.
export { DEV_LAYOUT_SECTION_SOURCE_MAP_HASH } from "@/lib/dev-layout/sectionSourceMapHash.generated";
