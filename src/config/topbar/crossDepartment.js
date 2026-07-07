// file location: src/config/topbar/crossDepartment.js
//
// CROSS-DEPARTMENT COORDINATION (Phase 4.7) — PURE registry. Surfaces the
// contextual operational links between departments so work flows across the
// business without hunting: Workshop ↔ Parts ↔ Service ↔ MOT ↔ Valeting ↔
// Accounts ↔ Sales. Each link points at the other department's workspace and
// carries an `audience` (that department's code) the comms layer (4.4) can turn
// into a "message their team" action.
//
// No React/window/storage. Adding a new department's coordination = one edit to
// DEPARTMENT_COORDINATION (and it appears wherever any other department links to
// it). Page-contextual boosts (e.g. "on a job card → chase parts") layer on top.

// Base coordination graph: for each department, the other departments it most
// often needs, with the handoff framed as an action.
const DEPARTMENT_COORDINATION = {
  workshop: [
    { toDept: "parts", label: "Chase parts for a job", subtitle: "Parts", href: "/parts" },
    { toDept: "service", label: "Update the service desk", subtitle: "Service", href: "/job-cards" },
    { toDept: "mot", label: "Book a retest slot", subtitle: "MOT", href: "/job-cards/appointments" },
    { toDept: "valeting", label: "Send a vehicle to valet", subtitle: "Valeting", href: "/valet" },
  ],
  service: [
    { toDept: "workshop", label: "Check workshop progress", subtitle: "Workshop", href: "/nextjobs" },
    { toDept: "parts", label: "Check parts availability", subtitle: "Parts", href: "/parts" },
    { toDept: "valeting", label: "Confirm valet before handover", subtitle: "Valeting", href: "/valet" },
    { toDept: "accounts", label: "Query an invoice", subtitle: "Accounts", href: "/accounts/invoices" },
  ],
  parts: [
    { toDept: "workshop", label: "Tell workshop parts are in", subtitle: "Workshop", href: "/nextjobs" },
    { toDept: "service", label: "Update service on a back-order", subtitle: "Service", href: "/job-cards" },
    { toDept: "accounts", label: "Reconcile a supplier invoice", subtitle: "Accounts", href: "/accounts/invoices" },
  ],
  mot: [
    { toDept: "workshop", label: "Send a failure to workshop", subtitle: "Workshop", href: "/nextjobs" },
    { toDept: "service", label: "Notify service of the result", subtitle: "Service", href: "/job-cards" },
  ],
  valeting: [
    { toDept: "service", label: "Flag a vehicle ready for handover", subtitle: "Service", href: "/job-cards" },
    { toDept: "workshop", label: "Confirm work finished before valet", subtitle: "Workshop", href: "/nextjobs" },
  ],
  paint: [
    { toDept: "workshop", label: "Coordinate a strip / refit", subtitle: "Workshop", href: "/nextjobs" },
    { toDept: "parts", label: "Order paint & consumables", subtitle: "Parts", href: "/parts" },
  ],
  accounts: [
    { toDept: "service", label: "Resolve a service query", subtitle: "Service", href: "/job-cards" },
    { toDept: "parts", label: "Reconcile parts spend", subtitle: "Parts", href: "/parts" },
  ],
  management: [
    { toDept: "workshop", label: "Review workshop load", subtitle: "Workshop", href: "/nextjobs" },
    { toDept: "service", label: "Review the service diary", subtitle: "Service", href: "/job-cards/appointments" },
    { toDept: "parts", label: "Review parts pipeline", subtitle: "Parts", href: "/parts" },
  ],
};

// Page-contextual boosts: when the current route implies a specific handoff,
// promote it. Matched by regex against the pathname; deduped against the base set.
const CONTEXTUAL_BOOSTS = [
  {
    when: /^\/(job-cards|tech)\/[^/]+/,
    links: [
      { toDept: "parts", label: "Chase parts for this job", subtitle: "This job", href: "/parts", weight: 100 },
      { toDept: "service", label: "Message service about this job", subtitle: "This job", href: null, weight: 90 },
    ],
  },
  {
    when: /^\/vhc\//,
    links: [
      { toDept: "service", label: "Send this VHC for authorisation", subtitle: "Approval", href: "/job-cards", weight: 95 },
      { toDept: "parts", label: "Request parts from this VHC", subtitle: "Parts", href: "/parts", weight: 85 },
    ],
  },
  {
    when: /^\/(parts|deliveries|goods-in)/,
    links: [
      { toDept: "workshop", label: "Tell workshop parts have landed", subtitle: "Workshop", href: "/nextjobs", weight: 80 },
    ],
  },
];

// Resolve the coordination links for the viewer. Contextual boosts rank first,
// then the base graph for their department; deduped by target department, the
// viewer's own department excluded, capped to `limit`.
export function resolveCoordinationLinks(
  { department = null, pathname = "" } = {},
  { limit = 6 } = {}
) {
  const base = (DEPARTMENT_COORDINATION[department] || []).map((l, i) => ({
    ...l,
    weight: 50 - i, // preserve declared order under the boosts
  }));

  const boosts = [];
  for (const rule of CONTEXTUAL_BOOSTS) {
    let applies = false;
    try {
      applies = rule.when.test(pathname || "");
    } catch {
      applies = false;
    }
    if (applies) boosts.push(...rule.links);
  }

  const all = [...boosts, ...base].sort((a, b) => (b.weight || 0) - (a.weight || 0));

  const seen = new Set();
  const out = [];
  for (const link of all) {
    if (!link.toDept || link.toDept === department) continue;
    if (seen.has(link.toDept)) continue;
    seen.add(link.toDept);
    out.push({
      id: `coordinate:${link.toDept}`,
      toDept: link.toDept,
      audience: link.toDept, // comms layer → "message their team"
      label: link.label,
      subtitle: link.subtitle || null,
      href: link.href || null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export const __test__ = { DEPARTMENT_COORDINATION, CONTEXTUAL_BOOSTS };
