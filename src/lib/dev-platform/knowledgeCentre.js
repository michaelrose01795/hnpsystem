// file location: src/lib/dev-platform/knowledgeCentre.js
//
// Phase 10 — engineering knowledge centre. PURE derivation that links RECURRING
// incidents (light rows sharing a diagnostics fingerprint) to their curated
// write-ups (support_knowledge_entries) and past investigations, and suggests
// documenting clusters that recur but have no entry yet. No diagnostics blob —
// it reads only the light-row fingerprint + route + status + timestamps and the
// curated entries. node-testable (inject `now`).

const arr = (v) => (Array.isArray(v) ? v : []);
const ms = (d) => {
  const t = Date.parse(d);
  return Number.isFinite(t) ? t : null;
};
const isOpen = (status) => !["resolved", "wont_fix", "duplicate"].includes(status);

/** Cluster reports by fingerprint (only clusters of ≥ minOccurrences are kept). */
export function clusterByFingerprint(reports = [], { minOccurrences = 2 } = {}) {
  const groups = new Map();
  for (const r of arr(reports)) {
    const fp = r?.fingerprint;
    if (!fp) continue;
    if (!groups.has(fp)) {
      groups.set(fp, { fingerprint: fp, reportIds: [], routes: new Set(), open: 0, firstSeen: null, lastSeen: null });
    }
    const g = groups.get(fp);
    g.reportIds.push(r.id);
    if (r.route) g.routes.add(r.route);
    if (isOpen(r.status)) g.open += 1;
    const t = ms(r.created_at);
    if (t != null) {
      if (g.firstSeen == null || t < ms(g.firstSeen)) g.firstSeen = r.created_at;
      if (g.lastSeen == null || t > ms(g.lastSeen)) g.lastSeen = r.created_at;
    }
  }
  return Array.from(groups.values())
    .filter((g) => g.reportIds.length >= minOccurrences)
    .map((g) => ({
      fingerprint: g.fingerprint,
      occurrences: g.reportIds.length,
      reportIds: g.reportIds,
      routes: Array.from(g.routes),
      open: g.open,
      firstSeen: g.firstSeen,
      lastSeen: g.lastSeen,
    }))
    .sort((a, b) => b.occurrences - a.occurrences);
}

/** Index curated knowledge entries by the fingerprint they document. */
function entriesByFingerprint(entries) {
  const map = new Map();
  for (const e of arr(entries)) {
    if (e?.fingerprint) map.set(e.fingerprint, e);
  }
  return map;
}

/**
 * Build the knowledge centre payload.
 *
 * @param {object[]} reports  light rows (id, fingerprint, route, status, created_at)
 * @param {object[]} entries  curated support_knowledge_entries rows
 * @param {{ now?: string, minOccurrences?: number }} [opts]
 * @returns {{
 *   entries: object[],
 *   recurringIncidents: object[],   // clusters, annotated with any documenting entry
 *   suggestions: object[],          // clusters recurring but undocumented
 *   stats: object
 * }}
 */
export function buildKnowledgeCentre(reports = [], entries = [], opts = {}) {
  const clusters = clusterByFingerprint(reports, { minOccurrences: opts.minOccurrences ?? 2 });
  const byFp = entriesByFingerprint(entries);

  const recurringIncidents = clusters.map((c) => {
    const entry = byFp.get(c.fingerprint) || null;
    return {
      ...c,
      documented: Boolean(entry),
      entryId: entry?.id || null,
      entryTitle: entry?.title || null,
    };
  });

  const suggestions = recurringIncidents
    .filter((c) => !c.documented)
    .map((c) => ({
      fingerprint: c.fingerprint,
      occurrences: c.occurrences,
      reportIds: c.reportIds,
      routes: c.routes,
      open: c.open,
      reason: `Recurred ${c.occurrences}× across ${c.routes.length || 1} route(s)${c.open ? `, ${c.open} still open` : ""} — worth a knowledge entry.`,
      suggestedTitle: `Recurring incident on ${c.routes[0] || "unknown route"}`,
    }));

  const published = arr(entries).filter((e) => (e?.status || "published") === "published");

  return {
    entries: arr(entries)
      .slice()
      .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || ""))),
    recurringIncidents,
    suggestions,
    stats: {
      totalEntries: arr(entries).length,
      publishedEntries: published.length,
      recurringCount: recurringIncidents.length,
      undocumentedRecurring: suggestions.length,
    },
  };
}

/** Find the curated entry (if any) that documents a report's fingerprint. */
export function matchEntryForReport(report, entries = []) {
  const fp = report?.diagnostics?.fingerprint || report?.fingerprint;
  if (!fp) return null;
  return arr(entries).find((e) => e?.fingerprint === fp) || null;
}
