// file location: src/config/topbar/operationalAlerts.js
//
// PROACTIVE OPERATIONAL ALERTS (Phase 5.3) — PURE alert engine. Scans the live
// metrics (Phase 2) AND how they're trending (5.1) to flag important operational
// events — bottlenecks, overdue work, waiting approvals, capacity issues,
// parts/delivery backlogs — and, crucially, EMERGING versions of them: a queue
// climbing fast, approvals piling up, free capacity draining — so a manager acts
// BEFORE the problem lands.
//
// Relationship to Phase 4.5 escalations: escalations are the current-state,
// critical "act now" subset surfaced in the Team panel. Alerts are the broader,
// PREDICTIVE superset for the assistant — they add the "heading towards a problem"
// class the escalation rules (threshold-only) can't see, and a `kind` taxonomy so
// the panel can group them. Both reuse the same SEVERITY palette (no new tokens).
//
// No React/window/storage/Date — deterministic and unit-testable. A broken rule
// can never throw into the assistant (each rule is evaluated defensively).
//
// HOW TO ADD AN ALERT (no chrome edit): add a rule to ALERT_RULES — its `kind`,
// `severity`, when it fires (a threshold over metrics and/or a trend), whether
// it's `predictive`, the message, where it routes, and the audience to notify.

import { SEVERITY } from "@/config/topbar/escalations";
import { trendFor, movementLabel } from "@/config/topbar/operationalTrends";

function num(metrics, key) {
  const v = metrics?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function hasRole(roles, ...wanted) {
  return wanted.some((r) => (Array.isArray(roles) ? roles : []).includes(r));
}
function plural(n, one, many) {
  return n === 1 ? one : many;
}

// Each rule: { id, kind, severity, predictive?, when(ctx)=>bool, build(ctx)=>alert }.
// An alert body: { title, detail, href, audience?, keywords? }.
const ALERT_RULES = [
  // --- Bottleneck: work waiting with nobody free (a hard stop) ---
  {
    id: "bottleneck-critical",
    kind: "bottleneck",
    severity: "critical",
    when: (ctx) =>
      typeof ctx.metrics?.techniciansAvailable === "number" &&
      ctx.metrics.techniciansAvailable <= 0 &&
      num(ctx.metrics, "jobsWaiting") >= 3,
    build: (ctx) => ({
      title: "Bottleneck — work stalled",
      detail: `${num(ctx.metrics, "jobsWaiting")} ${plural(num(ctx.metrics, "jobsWaiting"), "job", "jobs")} waiting with every technician allocated.`,
      href: "/nextjobs",
      audience: "workshop",
      keywords: ["bottleneck", "blocked", "capacity", "stalled"],
    }),
  },
  // --- Capacity draining (PREDICTIVE: free techs falling towards zero) ---
  {
    id: "capacity-emerging",
    kind: "capacity",
    severity: "high",
    predictive: true,
    when: (ctx) => {
      const t = trendFor(ctx.trends, "techniciansAvailable");
      const free = ctx.metrics?.techniciansAvailable;
      return typeof free === "number" && free > 0 && free <= 2 && t.falling && num(ctx.metrics, "jobsWaiting") > 0;
    },
    build: (ctx) => ({
      title: "Capacity draining",
      detail: `Free technicians dropping (${movementLabel(ctx.trends, "techniciansAvailable")}) with work still waiting — line up the next slot now.`,
      href: "/nextjobs",
      audience: "workshop",
      keywords: ["capacity", "resource", "emerging", "plan"],
    }),
  },
  // --- Overdue pile-up (current-state) ---
  {
    id: "overdue-critical",
    kind: "overdue",
    severity: "critical",
    when: (ctx) => num(ctx.metrics, "overdueJobs") >= 5,
    build: (ctx) => ({
      title: `${num(ctx.metrics, "overdueJobs")} jobs overdue`,
      detail: "Promised times are slipping — reassign or update customers now.",
      href: "/job-cards",
      audience: "workshop",
      keywords: ["overdue", "late", "urgent"],
    }),
  },
  // --- Overdue emerging (PREDICTIVE: climbing before it's a pile-up) ---
  {
    id: "overdue-emerging",
    kind: "overdue",
    severity: "high",
    predictive: true,
    when: (ctx) => {
      const n = num(ctx.metrics, "overdueJobs");
      const t = trendFor(ctx.trends, "overdueJobs");
      return n >= 1 && n < 5 && t.rising && t.delta >= 2;
    },
    build: (ctx) => ({
      title: "Overdue work climbing",
      detail: `Overdue jobs rising (${movementLabel(ctx.trends, "overdueJobs")}) — get ahead before it becomes a pile-up.`,
      href: "/job-cards",
      audience: "workshop",
      keywords: ["overdue", "emerging", "trend"],
    }),
  },
  // --- Approvals blocking work (current-state) ---
  {
    id: "approvals-waiting",
    kind: "approvals",
    severity: "high",
    when: (ctx) => num(ctx.metrics, "waitingApprovals") >= 3,
    build: (ctx) => ({
      title: `${num(ctx.metrics, "waitingApprovals")} approvals waiting`,
      detail: "Work can't proceed until these are authorised.",
      href: "/job-cards",
      audience: "service",
      keywords: ["approval", "authorise", "blocked"],
    }),
  },
  // --- Approvals emerging (PREDICTIVE) ---
  {
    id: "approvals-emerging",
    kind: "approvals",
    severity: "medium",
    predictive: true,
    when: (ctx) => {
      const n = num(ctx.metrics, "waitingApprovals");
      const t = trendFor(ctx.trends, "waitingApprovals");
      return n >= 1 && n < 3 && t.rising;
    },
    build: (ctx) => ({
      title: "Approvals building up",
      detail: `Waiting approvals rising (${movementLabel(ctx.trends, "waitingApprovals")}) — clear them before they block labour.`,
      href: "/job-cards",
      audience: "service",
      keywords: ["approval", "emerging", "trend"],
    }),
  },
  // --- Queue building fast (PREDICTIVE) ---
  {
    id: "queue-emerging",
    kind: "bottleneck",
    severity: "medium",
    predictive: true,
    when: (ctx) => {
      const t = trendFor(ctx.trends, "jobsWaiting");
      return t.rising && t.delta >= 3;
    },
    build: (ctx) => ({
      title: "Queue building fast",
      detail: `Jobs waiting climbing quickly (${movementLabel(ctx.trends, "jobsWaiting")}) — check allocation before it stacks.`,
      href: "/nextjobs",
      audience: "workshop",
      keywords: ["queue", "emerging", "allocation"],
    }),
  },
  // --- Parts backlog (role-gated) ---
  {
    id: "parts-backlog",
    kind: "parts",
    severity: "medium",
    when: (ctx) => num(ctx.metrics, "partsOutstanding") >= 8 && hasRole(ctx.roles, "parts", "parts manager"),
    build: (ctx) => ({
      title: `${num(ctx.metrics, "partsOutstanding")} parts outstanding`,
      detail: "Outstanding parts are holding jobs open.",
      href: "/goods-in",
      audience: "parts",
      keywords: ["parts", "outstanding", "backlog"],
    }),
  },
  {
    id: "deliveries-pending",
    kind: "deliveries",
    severity: "medium",
    when: (ctx) => num(ctx.metrics, "pendingDeliveries") >= 5 && hasRole(ctx.roles, "parts", "parts manager"),
    build: (ctx) => ({
      title: `${num(ctx.metrics, "pendingDeliveries")} deliveries pending`,
      detail: "Chase suppliers on inbound stock.",
      href: "/deliveries",
      audience: "parts",
      keywords: ["deliveries", "supplier", "stock"],
    }),
  },
];

// Resolve the active alerts for a context, ranked by severity then current-state
// before emerging (a live problem outranks a forecast of the same severity),
// deduped by id, capped to `limit`. Returns [] on any failure.
export function resolveAlerts(context = {}, { limit = 6 } = {}) {
  const ctx = {
    metrics: context.metrics || {},
    trends: context.trends || { byKey: {} },
    roles: Array.isArray(context.roles) ? context.roles : [],
    department: context.department || null,
  };

  const out = [];
  const seen = new Set();
  for (const rule of ALERT_RULES) {
    let applies = false;
    try {
      applies = Boolean(rule.when(ctx));
    } catch {
      applies = false;
    }
    if (!applies || seen.has(rule.id)) continue;
    let body;
    try {
      body = rule.build(ctx);
    } catch {
      continue;
    }
    if (!body) continue;
    const severity = SEVERITY[rule.severity] || SEVERITY.medium;
    seen.add(rule.id);
    out.push({
      id: `alert:${rule.id}`,
      kind: rule.kind,
      predictive: Boolean(rule.predictive),
      severity: severity.id,
      severityRank: severity.rank,
      tone: severity.tone,
      severityLabel: severity.label,
      ...body,
    });
  }

  out.sort((a, b) => {
    if (b.severityRank !== a.severityRank) return b.severityRank - a.severityRank;
    // Same severity: live problems (predictive=false) before forecasts.
    return Number(a.predictive) - Number(b.predictive);
  });
  return out.slice(0, limit);
}

// The single most-important alert (or null) — for a compact assistant headline.
export function topAlert(context = {}) {
  return resolveAlerts(context, { limit: 1 })[0] || null;
}

// Count of currently active alerts by severity — for a compact badge/summary.
export function summariseAlerts(alerts = []) {
  return (alerts || []).reduce(
    (acc, a) => {
      acc.total += 1;
      if (a.severity === "critical") acc.critical += 1;
      else if (a.severity === "high") acc.high += 1;
      else acc.medium += 1;
      if (a.predictive) acc.predictive += 1;
      return acc;
    },
    { total: 0, critical: 0, high: 0, medium: 0, predictive: 0 }
  );
}

export const __test__ = { ALERT_RULES };
