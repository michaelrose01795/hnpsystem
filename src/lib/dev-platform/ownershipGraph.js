// file location: src/lib/dev-platform/ownershipGraph.js
//
// Phase 9 — Developer Platform code-ownership & dependency/impact mapping. PURE,
// node-testable aggregation over the LIGHT report rows. It reuses the code
// ownership the capture engine already resolves for free (source_file /
// source_line via the data-dev-section-key → sectionSourceMap map) and rolls it
// up into: an ownership explorer (which files/modules attract the most issues),
// a module → route dependency/impact graph (which routes exercise which module),
// and affected-feature/module visualisation.
//
// No React, no I/O, no window.

import { isOpenStatus, severityRank } from "@/lib/support/adminView";

const arr = (v) => (Array.isArray(v) ? v : []);
const ms = (v) => {
  const t = Date.parse(String(v || ""));
  return Number.isFinite(t) ? t : null;
};
const stripQuery = (r) => String(r || "").split("?")[0];

// The owning module of a source file = its directory. `src/components/VHC/X.js`
// → `src/components/VHC`. Files with no directory fall back to the file itself.
export function moduleOf(file) {
  const f = String(file || "").replace(/\\/g, "/").trim();
  if (!f) return null;
  const slash = f.lastIndexOf("/");
  return slash > 0 ? f.slice(0, slash) : f;
}

// A human feature label from a module path: last meaningful segment, title-ish.
export function featureOf(modulePath) {
  const m = String(modulePath || "").replace(/\\/g, "/");
  if (!m) return null;
  const seg = m.split("/").filter(Boolean).pop();
  return seg || null;
}

// ---------------------------------------------------------------------------
// Ownership explorer — one row per source file, ranked by how many (and how
// severe) the reports touching it are. Carries a clickable source ref.
// ---------------------------------------------------------------------------
export function ownershipRows(reports = [], { limit = 30 } = {}) {
  const files = new Map();
  for (const r of arr(reports)) {
    const file = r.source_file || null;
    if (!file) continue;
    if (!files.has(file)) {
      files.set(file, {
        file,
        module: moduleOf(file),
        line: r.source_line ?? null,
        total: 0,
        open: 0,
        regressions: 0,
        maxSeverity: 0,
        routes: new Set(),
        sections: new Set(),
        lastSeen: null,
      });
    }
    const g = files.get(file);
    g.total += 1;
    if (isOpenStatus(r.status)) g.open += 1;
    if (r.inv_regression === true) g.regressions += 1;
    g.maxSeverity = Math.max(g.maxSeverity, severityRank(r));
    if (r.route) g.routes.add(stripQuery(r.route));
    if (r.section_key) g.sections.add(r.section_key);
    const t = ms(r.created_at);
    if (t != null && (g.lastSeen == null || t > ms(g.lastSeen))) {
      g.lastSeen = r.created_at;
      g.line = r.source_line ?? g.line;
    }
  }
  return Array.from(files.values())
    .map((g) => ({
      file: g.file,
      line: g.line,
      module: g.module,
      feature: featureOf(g.module),
      total: g.total,
      open: g.open,
      regressions: g.regressions,
      maxSeverity: g.maxSeverity,
      routes: Array.from(g.routes),
      sections: Array.from(g.sections),
      lastSeen: g.lastSeen,
    }))
    .sort((a, b) => b.open - a.open || b.total - a.total || b.maxSeverity - a.maxSeverity)
    .slice(0, Math.max(1, limit));
}

// ---------------------------------------------------------------------------
// Module impact — roll the file rows up to the owning module (directory), so a
// feature area's total exposure is visible even when spread across files.
// ---------------------------------------------------------------------------
export function moduleImpact(reports = [], { limit = 20 } = {}) {
  const modules = new Map();
  for (const r of arr(reports)) {
    const mod = moduleOf(r.source_file);
    if (!mod) continue;
    if (!modules.has(mod)) {
      modules.set(mod, { module: mod, feature: featureOf(mod), total: 0, open: 0, regressions: 0, maxSeverity: 0, files: new Set(), routes: new Set() });
    }
    const g = modules.get(mod);
    g.total += 1;
    if (isOpenStatus(r.status)) g.open += 1;
    if (r.inv_regression === true) g.regressions += 1;
    g.maxSeverity = Math.max(g.maxSeverity, severityRank(r));
    if (r.source_file) g.files.add(r.source_file);
    if (r.route) g.routes.add(stripQuery(r.route));
  }
  return Array.from(modules.values())
    .map((g) => ({
      module: g.module,
      feature: g.feature,
      total: g.total,
      open: g.open,
      regressions: g.regressions,
      maxSeverity: g.maxSeverity,
      fileCount: g.files.size,
      routes: Array.from(g.routes),
    }))
    .sort((a, b) => b.total - a.total || b.open - a.open)
    .slice(0, Math.max(1, limit));
}

// ---------------------------------------------------------------------------
// Dependency / impact edges — route → module relationships, weighted by how many
// reports connect them. This is the substrate for an interactive impact graph:
// "which modules does this route depend on / which routes does this module
// affect". Deduped, weighted edges (no self-loops, no null endpoints).
// ---------------------------------------------------------------------------
export function dependencyEdges(reports = [], { limit = 60 } = {}) {
  const edges = new Map();
  for (const r of arr(reports)) {
    const route = r.route ? stripQuery(r.route) : null;
    const mod = moduleOf(r.source_file);
    if (!route || !mod) continue;
    const key = `${route}¦${mod}`;
    if (!edges.has(key)) edges.set(key, { route, module: mod, feature: featureOf(mod), weight: 0, open: 0 });
    const e = edges.get(key);
    e.weight += 1;
    if (isOpenStatus(r.status)) e.open += 1;
  }
  return Array.from(edges.values())
    .sort((a, b) => b.weight - a.weight)
    .slice(0, Math.max(1, limit));
}

// ---------------------------------------------------------------------------
// Affected features — the distinct feature areas currently attracting reports,
// with counts, for an at-a-glance "what's affected" visualisation.
// ---------------------------------------------------------------------------
export function affectedFeatures(reports = []) {
  const features = new Map();
  for (const r of arr(reports)) {
    const feature = featureOf(moduleOf(r.source_file)) || "unknown";
    if (!features.has(feature)) features.set(feature, { feature, total: 0, open: 0 });
    const g = features.get(feature);
    g.total += 1;
    if (isOpenStatus(r.status)) g.open += 1;
  }
  return Array.from(features.values()).sort((a, b) => b.total - a.total);
}

// ---------------------------------------------------------------------------
// build — compose the whole ownership map payload.
// ---------------------------------------------------------------------------
export function buildOwnershipMap(reports = [], { now = Date.now() } = {}) {
  const owners = ownershipRows(reports);
  return {
    generatedAt: new Date(now).toISOString(),
    fileCount: owners.length,
    files: owners,
    modules: moduleImpact(reports),
    edges: dependencyEdges(reports),
    features: affectedFeatures(reports),
  };
}
