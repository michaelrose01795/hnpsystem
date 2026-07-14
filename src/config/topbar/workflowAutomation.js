// file location: src/config/topbar/workflowAutomation.js
//
// CONFIGURABLE WORKFLOW AUTOMATION (Phase 5.5) — PURE engine + declarative flow
// registry. Given the current operational context (where the user is, their role,
// the live metrics), it surfaces the appropriate NEXT ACTIONS as an ordered,
// guided sequence — "you're on a job card → Start VHC → Request parts → Notify the
// customer" — so the right next step is one click away without the user mapping
// the process themselves.
//
// "Configurable" is the point: the whole behaviour lives in WORKFLOW_FLOWS. A flow
// declares when it applies (`when` over pathname/role/metrics), its ordered steps,
// and — per step — an optional `include` predicate (skip the step when it doesn't
// apply) and `done` predicate (mark it complete from live signal). Adding or
// re-sequencing a workflow is one edit here; nothing downstream changes.
//
// No React/window/storage/Date — deterministic and unit-testable.
//
// A resolved flow:
//   { id, title, icon, steps: [{ id, label, subtitle?, href?, done }] }

function num(metrics, key) {
  const v = metrics?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function hasRole(roles, ...wanted) {
  return wanted.some((r) => (Array.isArray(roles) ? roles : []).includes(r));
}
function onPath(ctx, re) {
  return re.test(ctx.pathname || "");
}

// The flow registry. Higher `priority` wins when several match. Page-contextual
// flows outrank operational-state flows, which outrank the role default.
const WORKFLOW_FLOWS = [
  // --- Page-contextual: acting on a specific job card ---
  {
    id: "progress-job",
    title: "Progress this job",
    icon: "🧭",
    priority: 100,
    when: (ctx) => onPath(ctx, /^\/(job-cards|jobcards|tech)\/[^/]+/),
    steps: [
      { id: "vhc", label: "Start a health check", subtitle: "VHC", href: "/vhc" },
      { id: "parts", label: "Request parts for this job", subtitle: "Parts", href: "/parts" },
      { id: "approve", label: "Send for authorisation", subtitle: "Approval", href: "/job-cards" },
      { id: "ready", label: "Mark ready & notify the customer", subtitle: "Handover", href: "/job-cards" },
    ],
  },
  // --- Page-contextual: completing a VHC ---
  {
    id: "complete-vhc",
    title: "Complete the health check",
    icon: "🧭",
    priority: 95,
    when: (ctx) => onPath(ctx, /^\/vhc\//),
    steps: [
      { id: "findings", label: "Record findings & severities", subtitle: "Inspection", href: null },
      { id: "authorise", label: "Send the VHC for authorisation", subtitle: "Approval", href: "/job-cards" },
      { id: "parts", label: "Request parts from the findings", subtitle: "Parts", href: "/parts" },
    ],
  },
  // --- Operational-state: approvals are blocking work ---
  {
    id: "clear-approvals",
    title: "Clear waiting approvals",
    icon: "✅",
    priority: 80,
    when: (ctx) => num(ctx.metrics, "waitingApprovals") > 0 && hasRole(ctx.roles, "service", "service manager", "service controller", "workshop manager"),
    steps: [
      {
        id: "review",
        label: (ctx) => `Review ${num(ctx.metrics, "waitingApprovals")} waiting approval${num(ctx.metrics, "waitingApprovals") === 1 ? "" : "s"}`,
        subtitle: "Awaiting authorisation",
        href: "/job-cards",
        done: (ctx) => num(ctx.metrics, "waitingApprovals") === 0,
      },
      { id: "allocate", label: "Allocate the freed-up work", subtitle: "Workshop", href: "/nextjobs" },
    ],
  },
  // --- Operational-state: queue needs allocating ---
  {
    id: "allocate-queue",
    title: "Allocate the queue",
    icon: "🗂",
    priority: 70,
    when: (ctx) => num(ctx.metrics, "jobsWaiting") > 0 && hasRole(ctx.roles, "workshop manager", "workshop controller", "service manager"),
    steps: [
      {
        id: "open",
        label: (ctx) => `Open the ${num(ctx.metrics, "jobsWaiting")}-job queue`,
        subtitle: "Next jobs",
        href: "/nextjobs",
      },
      { id: "assign", label: "Assign to available technicians", subtitle: "Balance load", href: "/nextjobs" },
      {
        id: "overdue",
        label: "Update customers on overdue work",
        subtitle: "Communication",
        href: "/job-cards",
        include: (ctx) => num(ctx.metrics, "overdueJobs") > 0,
      },
    ],
  },
  // --- Operational-state: parts pipeline (role-gated) ---
  {
    id: "process-parts",
    title: "Process the parts pipeline",
    icon: "📦",
    priority: 68,
    when: (ctx) => hasRole(ctx.roles, "parts", "parts manager") && (num(ctx.metrics, "partsOutstanding") > 0 || num(ctx.metrics, "pendingDeliveries") > 0),
    steps: [
      {
        id: "book",
        label: (ctx) => `Book in ${num(ctx.metrics, "partsOutstanding")} outstanding part${num(ctx.metrics, "partsOutstanding") === 1 ? "" : "s"}`,
        subtitle: "Goods in",
        href: "/goods-in",
        include: (ctx) => num(ctx.metrics, "partsOutstanding") > 0,
      },
      {
        id: "deliveries",
        label: (ctx) => `Chase ${num(ctx.metrics, "pendingDeliveries")} pending deliver${num(ctx.metrics, "pendingDeliveries") === 1 ? "y" : "ies"}`,
        subtitle: "Suppliers",
        href: "/deliveries",
        include: (ctx) => num(ctx.metrics, "pendingDeliveries") > 0,
      },
      { id: "notify", label: "Tell workshop what's landed", subtitle: "Handoff", href: "/nextjobs" },
    ],
  },
  // --- Role default: a sensible starting sequence when nothing else matches ---
  {
    id: "day-start",
    title: "Start your day",
    icon: "☀️",
    priority: 10,
    when: () => true,
    steps: [
      {
        id: "diary",
        label: "Check today's diary",
        subtitle: "Appointments",
        href: "/job-cards/appointments",
        include: (ctx) => hasRole(ctx.roles, "service", "service manager", "admin manager", "workshop manager") || num(ctx.metrics, "appointmentsToday") > 0,
      },
      { id: "queue", label: "Review the workshop queue", subtitle: "Next jobs", href: "/nextjobs" },
      { id: "board", label: "Open your dashboard", subtitle: "Overview", href: "/dashboard" },
    ],
  },
];

function resolveLabel(value, ctx) {
  try {
    return typeof value === "function" ? value(ctx) : value;
  } catch {
    return "";
  }
}

function evalPredicate(fn, ctx, fallback) {
  if (typeof fn !== "function") return fallback;
  try {
    return Boolean(fn(ctx));
  } catch {
    return fallback;
  }
}

// Resolve the single best-matching flow for the context, with its included steps
// (label interpolated, `done` evaluated). Returns null when — impossibly, since
// `day-start` always matches — nothing applies. Caps steps to `limit`.
export function resolveWorkflow(context = {}, { limit = 5 } = {}) {
  const ctx = {
    pathname: context.pathname || "",
    roles: Array.isArray(context.roles) ? context.roles : [],
    department: context.department || null,
    metrics: context.metrics || {},
  };

  const matched = WORKFLOW_FLOWS.filter((flow) => evalPredicate(flow.when, ctx, false)).sort(
    (a, b) => b.priority - a.priority
  );
  const flow = matched[0];
  if (!flow) return null;

  const steps = flow.steps
    .filter((step) => evalPredicate(step.include, ctx, true))
    .slice(0, limit)
    .map((step) => ({
      id: `${flow.id}:${step.id}`,
      label: resolveLabel(step.label, ctx),
      subtitle: step.subtitle || null,
      href: step.href || null,
      done: evalPredicate(step.done, ctx, false),
    }))
    .filter((step) => step.label);

  return { id: flow.id, title: flow.title, icon: flow.icon, steps };
}

// Backwards-friendly alias — the assistant reads "next actions" for the context.
export function resolveWorkflowActions(context = {}, options = {}) {
  return resolveWorkflow(context, options);
}

export const __test__ = { WORKFLOW_FLOWS };
