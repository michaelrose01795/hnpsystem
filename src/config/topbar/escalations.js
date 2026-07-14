// file location: src/config/topbar/escalations.js
//
// ESCALATION & PRIORITY WORKFLOWS (Phase 4.5) — PURE rule engine.
//
// Turns the live operational `metrics` snapshot (the same one Phase 2 already
// gathers) into a prioritised list of urgent issues that need immediate
// attention, each with a severity, a destination, and — where relevant — who
// should be told (a role/department the communication layer can message, 4.4).
//
// No React/window/storage — deterministic and unit-testable. A broken rule can
// never throw into the chrome (each rule is evaluated defensively).
//
// HOW TO ADD AN ESCALATION (no chrome edit): add a rule to ESCALATION_RULES. It
// declares when it fires (a threshold over metrics + optional role scope), the
// severity, the message, where it routes, and the audience to notify.

// Severity ranks (higher = more urgent). Reuses the shared tone palette; no new
// tokens. "critical" leads the list and is what the bar could announce.
export const SEVERITY = {
  critical: { id: "critical", rank: 3, tone: "danger", label: "Critical" },
  high: { id: "high", rank: 2, tone: "warning", label: "High" },
  medium: { id: "medium", rank: 1, tone: "info", label: "Medium" },
};

const num = (metrics, key) => {
  const v = metrics?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
};

const hasRole = (roles, ...wanted) =>
  wanted.some((r) => (Array.isArray(roles) ? roles : []).includes(r));

// Each rule: { id, severity, when(ctx) => bool, build(ctx) => escalation }.
// An escalation: { id, severity, title, detail, href, audience?, keywords? }.
// `audience` is a department code or role the 4.4 comms layer can address.
const ESCALATION_RULES = [
  {
    id: "overdue-critical",
    severity: "critical",
    // A pile-up of overdue jobs is the clearest "act now" signal.
    when: (ctx) => num(ctx.metrics, "overdueJobs") >= 5,
    build: (ctx) => ({
      title: `${num(ctx.metrics, "overdueJobs")} jobs overdue`,
      detail: "Promised times are slipping — reassign or update customers now.",
      href: "/job-cards",
      audience: "workshop",
      keywords: ["overdue", "late", "urgent", "escalate"],
    }),
  },
  {
    id: "overdue-high",
    severity: "high",
    when: (ctx) => {
      const n = num(ctx.metrics, "overdueJobs");
      return n >= 1 && n < 5;
    },
    build: (ctx) => ({
      title: `${num(ctx.metrics, "overdueJobs")} overdue job${num(ctx.metrics, "overdueJobs") === 1 ? "" : "s"}`,
      detail: "Past the promised update — needs chasing.",
      href: "/job-cards",
      audience: "workshop",
      keywords: ["overdue", "late", "chase"],
    }),
  },
  {
    id: "approvals-waiting",
    severity: "high",
    // Approvals block downstream work (parts + technician time), so they escalate.
    when: (ctx) => num(ctx.metrics, "waitingApprovals") >= 3,
    build: (ctx) => ({
      title: `${num(ctx.metrics, "waitingApprovals")} approvals waiting`,
      detail: "Work can't proceed until these are authorised.",
      href: "/job-cards",
      audience: "service",
      keywords: ["approval", "authorise", "vhc", "blocked"],
    }),
  },
  {
    id: "queue-backing-up",
    severity: "medium",
    when: (ctx) => num(ctx.metrics, "jobsWaiting") >= 6,
    build: (ctx) => ({
      title: `${num(ctx.metrics, "jobsWaiting")} jobs waiting to start`,
      detail: "The queue is backing up — check technician allocation.",
      href: "/nextjobs",
      audience: "workshop",
      keywords: ["queue", "waiting", "backlog", "allocation"],
    }),
  },
  {
    id: "no-techs-free",
    severity: "high",
    // Zero free technicians while jobs are still waiting is a hard blocker.
    when: (ctx) =>
      typeof ctx.metrics?.techniciansAvailable === "number" &&
      ctx.metrics.techniciansAvailable <= 0 &&
      num(ctx.metrics, "jobsWaiting") > 0,
    build: (ctx) => ({
      title: "No technicians free",
      detail: `${num(ctx.metrics, "jobsWaiting")} job${num(ctx.metrics, "jobsWaiting") === 1 ? "" : "s"} waiting with everyone allocated.`,
      href: "/nextjobs",
      audience: "workshop",
      keywords: ["capacity", "technicians", "blocked", "resource"],
    }),
  },
  {
    id: "parts-outstanding",
    severity: "medium",
    when: (ctx) =>
      num(ctx.metrics, "partsOutstanding") >= 8 && hasRole(ctx.roles, "parts", "parts manager"),
    build: (ctx) => ({
      title: `${num(ctx.metrics, "partsOutstanding")} parts outstanding`,
      detail: "Outstanding parts are holding jobs open.",
      href: "/goods-in",
      audience: "parts",
      keywords: ["parts", "outstanding", "goods in"],
    }),
  },
  {
    id: "deliveries-pending",
    severity: "medium",
    when: (ctx) =>
      num(ctx.metrics, "pendingDeliveries") >= 5 && hasRole(ctx.roles, "parts", "parts manager"),
    build: (ctx) => ({
      title: `${num(ctx.metrics, "pendingDeliveries")} deliveries pending`,
      detail: "Chase suppliers on inbound stock.",
      href: "/deliveries",
      audience: "parts",
      keywords: ["deliveries", "supplier", "stock"],
    }),
  },
];

// Resolve the active escalations for a context, ranked by severity then declared
// order, deduped by id, capped to `limit`. Returns [] on any failure.
export function resolveEscalations(context = {}, { limit = 6 } = {}) {
  const ctx = {
    metrics: context.metrics || {},
    roles: Array.isArray(context.roles) ? context.roles : [],
    department: context.department || null,
  };

  const out = [];
  const seen = new Set();
  for (const rule of ESCALATION_RULES) {
    let applies = false;
    try {
      applies = Boolean(rule.when(ctx));
    } catch {
      applies = false;
    }
    if (!applies || seen.has(rule.id)) continue;
    let action;
    try {
      action = rule.build(ctx);
    } catch {
      continue;
    }
    if (!action) continue;
    const severity = SEVERITY[rule.severity] || SEVERITY.medium;
    seen.add(rule.id);
    out.push({
      id: `escalation:${rule.id}`,
      severity: severity.id,
      severityRank: severity.rank,
      tone: severity.tone,
      severityLabel: severity.label,
      ...action,
    });
  }

  out.sort((a, b) => b.severityRank - a.severityRank);
  return out.slice(0, limit);
}

// The single most-urgent escalation (or null) — used for a compact "needs
// attention" cue without opening the full panel.
export function topEscalation(context = {}) {
  return resolveEscalations(context, { limit: 1 })[0] || null;
}

export const __test__ = { ESCALATION_RULES };
