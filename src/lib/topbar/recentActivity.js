// file location: src/lib/topbar/recentActivity.js
//
// Global recent activity (Phase 3.2) — PURE route classification. Turns a route
// the user just visited into a durable "recent item" the workspace can resurface
// (in the command palette and the productivity panel). No React/storage/window.
//
// Categories: job | customer | report | vehicle | workflow | search.
// `search` items are recorded explicitly (recordSearch), not derived from a
// route, so they carry a `query` instead of an `href` and are re-run by
// re-opening the palette pre-filled.
//
// HOW TO ADD A CATEGORY: add a rule to RECENT_RULES (first-match-wins) and, if
// it needs display metadata, an entry in RECENT_CATEGORIES. Nothing downstream
// changes.

export const RECENT_CATEGORIES = {
  job: { label: "Job card", icon: "🔧", order: 1 },
  customer: { label: "Customer", icon: "👤", order: 2 },
  vehicle: { label: "Vehicle", icon: "🚗", order: 3 },
  report: { label: "Report", icon: "📊", order: 4 },
  workflow: { label: "Workflow", icon: "🧭", order: 5 },
  search: { label: "Search", icon: "🔎", order: 6 },
};

function titleCaseSegment(segment) {
  return String(segment || "")
    .replace(/\[|\]/g, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Ordered, first-match-wins. Each rule returns a partial item (category + id +
// label + subtitle) from the path segments, or null to skip. `base` is the path
// with query/hash stripped; `segs` are its non-empty segments.
const RECENT_RULES = [
  {
    // Job cards across the surfaces that open a specific job.
    category: "job",
    match: (base) => /^\/(job-cards|jobcards|tech|valet)\/[^/]+/.test(base),
    build: (segs) => {
      const id = segs[segs.length - 1];
      return { id, label: /^\d+$/.test(id) ? `Job ${id}` : titleCaseSegment(id) };
    },
  },
  {
    category: "workflow",
    match: (base) => /^\/vhc\/[^/]+/.test(base),
    build: (segs) => {
      const id = segs.find((s) => /^\d+$/.test(s)) || segs[segs.length - 1];
      return { id, label: `VHC ${id}`, subtitle: "Vehicle health check" };
    },
  },
  {
    category: "customer",
    match: (base) => /^\/customers\/[^/]+/.test(base),
    build: (segs) => ({ id: segs[1], label: titleCaseSegment(segs[1]) }),
  },
  {
    category: "vehicle",
    match: (base) => /^\/vehicles\/[^/]+/.test(base),
    build: (segs) => ({ id: segs[1], label: titleCaseSegment(segs[1]) }),
  },
  {
    category: "report",
    match: (base) => /^\/reports\/[^/]+/.test(base),
    build: (segs) => ({ id: segs[1], label: `${titleCaseSegment(segs[1])} report` }),
  },
  {
    category: "workflow",
    match: (base) => /^\/(new-order|goods-in|delivery-planner)(\/[^/]+)?/.test(base),
    build: (segs) => {
      const head = titleCaseSegment(segs[0]);
      const id = segs[1];
      return { id: id || segs[0], label: id ? `${head}: ${titleCaseSegment(id)}` : head };
    },
  },
];

// Classify a full asPath into a recent item, or null when the route is not a
// "viewable record/workflow". `ts` is injected by the caller (pure module) so
// results are deterministic in tests.
export function classifyRoute(asPath, ts = 0) {
  if (!asPath || typeof asPath !== "string") return null;
  const base = asPath.split("?")[0].split("#")[0];
  if (!base || base === "/") return null;
  const segs = base.split("/").filter(Boolean);

  for (const rule of RECENT_RULES) {
    if (!rule.match(base)) continue;
    const partial = rule.build(segs) || {};
    const meta = RECENT_CATEGORIES[rule.category] || {};
    return {
      category: rule.category,
      id: partial.id || base,
      href: base,
      label: partial.label || titleCaseSegment(segs[segs.length - 1]),
      subtitle: partial.subtitle || meta.label || "",
      icon: meta.icon || "•",
      ts,
    };
  }
  return null;
}

// Build a recorded-search item from a raw query string (or null when blank).
export function buildSearchItem(query, ts = 0) {
  const q = String(query || "").trim();
  if (!q) return null;
  const meta = RECENT_CATEGORIES.search;
  return {
    category: "search",
    id: `search:${q.toLowerCase()}`,
    href: null,
    query: q,
    label: q,
    subtitle: "Search",
    icon: meta.icon,
    ts,
  };
}

// Map a recent item onto a command-palette command source. Search items carry no
// href, so they re-run by re-opening the palette pre-filled (the caller wires the
// `run`).
export function recentToCommandSource(item, { onRunSearch } = {}) {
  if (!item) return null;
  const base = {
    id: `recent:${item.id}`,
    title: item.label,
    subtitle: item.subtitle,
    keywords: [item.category, item.subtitle].filter(Boolean),
    icon: item.icon,
  };
  if (item.category === "search") {
    return { ...base, run: () => onRunSearch?.(item.query) };
  }
  return { ...base, href: item.href };
}

export const __test__ = { RECENT_RULES };
