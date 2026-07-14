// file location: src/config/topbar/contextualSuggestions.js
//
// Intelligent contextual suggestions (Phase 3.4) — PURE recommendation engine.
// Given where the user is (pathname), who they are (roles + department), what
// they've been doing (recent categories) and the live operational picture
// (metrics), it returns a short, ranked list of useful next actions.
//
// No React/window/storage — deterministic and unit-testable. The hook
// (src/hooks/useContextualSuggestions.js) supplies the live context; the command
// palette + productivity panel render whatever this returns.
//
// HOW TO ADD A SUGGESTION: add a rule to SUGGESTION_RULES. Each rule decides if
// it applies (`when`) and produces an action (`build`). Higher `weight` ranks
// higher. Nothing downstream changes.

// A context is:
//   { pathname, roles: string[], department, recentCategories: Set|string[],
//     metrics: { overdueJobs?, jobsWaiting?, partsToBook?, ... } }

function hasRole(ctx, ...roles) {
  return roles.some((r) => (ctx.roles || []).includes(r));
}
function onPath(ctx, re) {
  return re.test(ctx.pathname || "");
}
function recentlyUsed(ctx, category) {
  const set = ctx.recentCategories;
  if (!set) return false;
  return typeof set.has === "function" ? set.has(category) : set.includes(category);
}
function metric(ctx, key) {
  const v = ctx.metrics?.[key];
  return typeof v === "number" ? v : 0;
}

// Ordered rule set. `weight` breaks ties (higher first); `id` dedupes.
const SUGGESTION_RULES = [
  // --- Live operational nudges (highest value) ---
  {
    id: "review-overdue",
    weight: 100,
    when: (ctx) => metric(ctx, "overdueJobs") > 0,
    build: (ctx) => ({
      label: `Review ${metric(ctx, "overdueJobs")} overdue job${metric(ctx, "overdueJobs") === 1 ? "" : "s"}`,
      href: "/job-cards",
      subtitle: "Needs chasing",
      keywords: ["overdue", "late", "jobs"],
    }),
  },
  {
    id: "book-parts",
    weight: 92,
    when: (ctx) => metric(ctx, "partsToBook") > 0 && hasRole(ctx, "parts", "parts manager"),
    build: (ctx) => ({
      label: `Book in ${metric(ctx, "partsToBook")} awaiting part${metric(ctx, "partsToBook") === 1 ? "" : "s"}`,
      href: "/goods-in",
      subtitle: "Goods in",
      keywords: ["parts", "goods in", "book"],
    }),
  },
  // --- Page-contextual next steps ---
  {
    id: "job-start-vhc",
    weight: 80,
    when: (ctx) => onPath(ctx, /^\/(job-cards|tech)\/[^/]+/) && hasRole(ctx, "techs", "mot tester", "workshop manager"),
    build: () => ({
      label: "Start a vehicle health check",
      href: "/vhc",
      subtitle: "For this job",
      keywords: ["vhc", "health check", "inspection"],
    }),
  },
  {
    id: "reports-overview",
    weight: 60,
    when: (ctx) => onPath(ctx, /^\/reports\//),
    build: () => ({
      label: "Open reporting overview",
      href: "/reports/overview",
      subtitle: "All departments",
      keywords: ["reports", "overview", "kpi"],
    }),
  },
  // --- Role-standard actions ---
  {
    id: "create-job",
    weight: 55,
    when: (ctx) => hasRole(ctx, "service", "service manager", "workshop manager", "admin manager"),
    build: () => ({
      label: "Create a new job card",
      href: "/new-job",
      subtitle: "Service",
      keywords: ["new job", "create", "booking"],
    }),
  },
  {
    id: "next-jobs",
    weight: 50,
    when: (ctx) => hasRole(ctx, "workshop manager", "service manager"),
    build: () => ({
      label: "Check the next-jobs queue",
      href: "/nextjobs",
      subtitle: "Workshop",
      keywords: ["next jobs", "queue", "waiting"],
    }),
  },
  {
    id: "parts-planner",
    weight: 48,
    when: (ctx) => hasRole(ctx, "parts", "parts manager"),
    build: () => ({
      label: "Plan deliveries & collections",
      href: "/delivery-planner",
      subtitle: "Parts",
      keywords: ["delivery", "collection", "planner"],
    }),
  },
  // --- Behavioural (based on what they've been doing) ---
  {
    id: "back-to-reports",
    weight: 40,
    when: (ctx) => recentlyUsed(ctx, "report") && !onPath(ctx, /^\/reports/),
    build: () => ({
      label: "Back to your reports",
      href: "/reports/overview",
      subtitle: "Recently viewed",
      keywords: ["reports", "resume"],
    }),
  },
  {
    id: "hr-leave",
    weight: 30,
    when: (ctx) => hasRole(ctx, "hr manager", "admin manager", "owner"),
    build: () => ({
      label: "Review leave requests",
      href: "/hr/leave",
      subtitle: "HR",
      keywords: ["leave", "holiday", "hr"],
    }),
  },
];

// Resolve the applicable suggestions for a context. De-dupes by href, drops the
// page the user is already on, ranks by weight, and caps to `limit`.
export function resolveSuggestions(context = {}, { limit = 6 } = {}) {
  const ctx = {
    pathname: context.pathname || "",
    roles: Array.isArray(context.roles) ? context.roles : [],
    department: context.department || null,
    recentCategories: context.recentCategories || [],
    metrics: context.metrics || {},
  };
  const currentBase = ctx.pathname.split("?")[0].split("#")[0];

  const seen = new Set();
  const out = [];
  for (const rule of SUGGESTION_RULES) {
    let applies = false;
    try {
      applies = Boolean(rule.when(ctx));
    } catch {
      applies = false; // a broken rule must never break the palette
    }
    if (!applies) continue;
    const action = rule.build(ctx);
    if (!action?.href || seen.has(action.href)) continue;
    if (action.href === currentBase) continue; // don't suggest where they are
    seen.add(action.href);
    out.push({ id: `suggestion:${rule.id}`, weight: rule.weight, ...action });
  }
  out.sort((a, b) => b.weight - a.weight);
  return out.slice(0, limit).map((item) => ({
    id: item.id,
    label: item.label,
    href: item.href,
    subtitle: item.subtitle,
    keywords: item.keywords,
  }));
}

export const __test__ = { SUGGESTION_RULES };
