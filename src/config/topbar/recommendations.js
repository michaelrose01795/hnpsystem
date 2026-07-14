// file location: src/config/topbar/recommendations.js
//
// PREDICTIVE OPERATIONAL RECOMMENDATIONS (Phase 5.1) — PURE recommendation
// engine. Given the live workload (`metrics`), how it's moving (`trends`, from
// operationalTrends.js), who the user is (`roles` + `department`), where they are
// (`pathname`) and what they actually do (`behaviour`, the on-device 5.7 model),
// it produces a short, ranked, EXPLAINABLE list of the most useful next actions.
//
// Unlike the Phase 3.4 contextual suggestions (which react to the current state),
// these are PREDICTIVE: they weigh which way a metric is heading (a queue that is
// climbing outranks one that is merely non-zero) and personalise from behaviour
// (the pages this user opens most). Every item carries a plain-English `reason`
// and a `confidence`, so nothing is a black box.
//
// No React/window/storage/Date — deterministic and unit-testable. The hook
// (src/hooks/useOperationalRecommendations.js) supplies the live context; the
// assistant panel + command palette render whatever this returns.
//
// A recommendation:
//   { id, label, subtitle, href, tone, reason, confidence, source, weight,
//     keywords }
//   confidence ∈ "high" | "medium" | "low"; source ∈ "workload" | "trend" |
//   "behaviour" | "role".

import { trendFor, movementLabel } from "@/config/topbar/operationalTrends";

const CONFIDENCE_FACTOR = { high: 1, medium: 0.8, low: 0.6 };

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

// Ordered workload/trend/role rule set. Each rule decides if it applies (`when`)
// and produces a recommendation (`build`). Higher `weight` ranks higher; a rising
// trend bumps confidence (and the reason explains it). `id` dedupes.
const RECOMMENDATION_RULES = [
  // --- Overdue work (highest value; predictive on the trend) ---
  {
    id: "review-overdue",
    weight: 100,
    when: (ctx) => num(ctx.metrics, "overdueJobs") > 0,
    build: (ctx) => {
      const n = num(ctx.metrics, "overdueJobs");
      const t = trendFor(ctx.trends, "overdueJobs");
      const move = movementLabel(ctx.trends, "overdueJobs");
      return {
        label: `Review ${n} overdue ${plural(n, "job", "jobs")}`,
        subtitle: "Promised times slipping",
        href: "/job-cards",
        tone: "danger",
        source: t.rising ? "trend" : "workload",
        confidence: t.rising ? "high" : "medium",
        reason: t.rising
          ? `Overdue is climbing (${move}) — get ahead before customers chase.`
          : "These are past their promised update and need chasing.",
        keywords: ["overdue", "late", "jobs", "chase"],
      };
    },
  },
  // --- Queue building up (predictive: rising queue is worse than a static one) ---
  {
    id: "allocate-queue",
    weight: 88,
    when: (ctx) => num(ctx.metrics, "jobsWaiting") >= 3 || trendFor(ctx.trends, "jobsWaiting").rising,
    build: (ctx) => {
      const n = num(ctx.metrics, "jobsWaiting");
      const t = trendFor(ctx.trends, "jobsWaiting");
      const move = movementLabel(ctx.trends, "jobsWaiting");
      return {
        label: `Allocate ${n} waiting ${plural(n, "job", "jobs")}`,
        subtitle: "Keep the queue moving",
        href: "/nextjobs",
        tone: t.rising ? "warning" : "info",
        source: t.rising ? "trend" : "workload",
        confidence: t.rising ? "high" : "medium",
        reason: t.rising
          ? `The queue is building (${move}) — allocate now to stop it stacking.`
          : "Jobs are waiting to start — check technician allocation.",
        keywords: ["queue", "waiting", "allocate", "next jobs"],
      };
    },
  },
  // --- Approvals blocking work ---
  {
    id: "clear-approvals",
    weight: 84,
    when: (ctx) => num(ctx.metrics, "waitingApprovals") > 0,
    build: (ctx) => {
      const n = num(ctx.metrics, "waitingApprovals");
      const t = trendFor(ctx.trends, "waitingApprovals");
      return {
        label: `Clear ${n} waiting ${plural(n, "approval", "approvals")}`,
        subtitle: "Unblocks downstream work",
        href: "/job-cards",
        tone: "warning",
        source: t.rising ? "trend" : "workload",
        confidence: n >= 3 || t.rising ? "high" : "medium",
        reason: t.rising
          ? `Approvals are piling up (${movementLabel(ctx.trends, "waitingApprovals")}) — parts and labour are waiting on them.`
          : "Work can't proceed until these are authorised.",
        keywords: ["approval", "authorise", "vhc", "blocked"],
      };
    },
  },
  // --- Capacity draining (predictive: free techs falling towards zero) ---
  {
    id: "plan-capacity",
    weight: 78,
    when: (ctx) => {
      const t = trendFor(ctx.trends, "techniciansAvailable");
      const free = ctx.metrics?.techniciansAvailable;
      return typeof free === "number" && free <= 1 && num(ctx.metrics, "jobsWaiting") > 0 && (t.falling || free <= 0);
    },
    build: (ctx) => {
      const free = num(ctx.metrics, "techniciansAvailable");
      return {
        label: free <= 0 ? "Plan ahead — no technicians free" : "Capacity is tightening",
        subtitle: "Workload vs people",
        href: "/nextjobs",
        tone: "warning",
        source: "trend",
        confidence: "high",
        reason:
          free <= 0
            ? "Everyone is allocated with jobs still waiting — line up the next slot now."
            : `Only ${free} free with work waiting — plan the next allocation before it blocks.`,
        keywords: ["capacity", "technicians", "resource", "plan"],
      };
    },
  },
  // --- Diary prep for a busy day ---
  {
    id: "prep-diary",
    weight: 60,
    when: (ctx) => num(ctx.metrics, "appointmentsToday") >= 5,
    build: (ctx) => ({
      label: `Prep for ${num(ctx.metrics, "appointmentsToday")} appointments today`,
      subtitle: "Busy diary",
      href: "/job-cards/appointments",
      tone: "info",
      source: "workload",
      confidence: "medium",
      reason: "A full diary today — check the running order and resourcing early.",
      keywords: ["appointments", "diary", "today", "bookings"],
    }),
  },
  // --- Parts pressure (role-gated) ---
  {
    id: "book-parts",
    weight: 58,
    when: (ctx) => num(ctx.metrics, "partsOutstanding") >= 5 && hasRole(ctx.roles, "parts", "parts manager"),
    build: (ctx) => {
      const n = num(ctx.metrics, "partsOutstanding");
      const t = trendFor(ctx.trends, "partsOutstanding");
      return {
        label: `Progress ${n} outstanding ${plural(n, "part", "parts")}`,
        subtitle: "Holding jobs open",
        href: "/goods-in",
        tone: "warning",
        source: t.rising ? "trend" : "workload",
        confidence: t.rising ? "high" : "medium",
        reason: t.rising
          ? `Outstanding parts are rising (${movementLabel(ctx.trends, "partsOutstanding")}) — jobs will start stalling.`
          : "Outstanding parts are holding jobs open — book in what's arrived.",
        keywords: ["parts", "outstanding", "goods in", "book"],
      };
    },
  },
  {
    id: "chase-deliveries",
    weight: 52,
    when: (ctx) => num(ctx.metrics, "pendingDeliveries") >= 4 && hasRole(ctx.roles, "parts", "parts manager"),
    build: (ctx) => ({
      label: `Chase ${num(ctx.metrics, "pendingDeliveries")} pending deliveries`,
      subtitle: "Inbound stock",
      href: "/deliveries",
      tone: "info",
      source: "workload",
      confidence: "medium",
      reason: "Suppliers are behind on inbound stock — chase to unblock jobs.",
      keywords: ["deliveries", "supplier", "stock", "chase"],
    }),
  },
];

// Turn the on-device behaviour model's top actions into personalised
// recommendations ("you open this a lot"). Confidence scales with how strong the
// habit is; these rank below live-operational items but above nothing.
function behaviourRecommendations(behaviour, { currentBase }) {
  const top = Array.isArray(behaviour?.topActions) ? behaviour.topActions : [];
  return top
    .filter((a) => a?.href && a.href !== currentBase && (a.count || 0) >= 2)
    .slice(0, 4)
    .map((a, i) => {
      const strong = (a.count || 0) >= 5;
      return {
        id: `behaviour:${a.href}`,
        label: a.label ? `Open ${a.label}` : `Open ${a.href}`,
        subtitle: "You use this often",
        href: a.href,
        tone: "info",
        source: "behaviour",
        confidence: strong ? "medium" : "low",
        // Personalised but weaker than a live operational nudge.
        weight: 46 - i,
        reason: strong
          ? "One of your most-used pages — pinned here to save the hunt."
          : "You return to this regularly — surfaced for quick access.",
        keywords: ["frequent", "personalised", "quick access"],
      };
    });
}

function scoreOf(item) {
  return (item.weight || 0) * (CONFIDENCE_FACTOR[item.confidence] || 0.6);
}

// Resolve the ranked recommendations for a context. De-dupes by href, drops the
// page the user is already on, ranks by weight × confidence, caps to `limit`.
// Returns [] on any failure (a broken rule can never break the assistant).
export function buildRecommendations(context = {}, { limit = 5 } = {}) {
  const ctx = {
    metrics: context.metrics || {},
    trends: context.trends || { byKey: {} },
    roles: Array.isArray(context.roles) ? context.roles : [],
    department: context.department || null,
    pathname: context.pathname || "",
    behaviour: context.behaviour || null,
  };
  const currentBase = ctx.pathname.split("?")[0].split("#")[0];

  const collected = [];
  for (const rule of RECOMMENDATION_RULES) {
    let applies = false;
    try {
      applies = Boolean(rule.when(ctx));
    } catch {
      applies = false;
    }
    if (!applies) continue;
    let action;
    try {
      action = rule.build(ctx);
    } catch {
      continue;
    }
    if (!action?.href) continue;
    collected.push({ id: `recommend:${rule.id}`, weight: rule.weight, ...action });
  }

  // Personalised behaviour recommendations layered on top.
  try {
    collected.push(...behaviourRecommendations(ctx.behaviour, { currentBase }));
  } catch {
    // behaviour is best-effort; never breaks the operational recommendations.
  }

  const seen = new Set();
  const out = [];
  for (const item of collected.sort((a, b) => scoreOf(b) - scoreOf(a))) {
    if (!item.href || seen.has(item.href)) continue;
    if (item.href === currentBase) continue;
    seen.add(item.href);
    out.push({
      id: item.id,
      label: item.label,
      subtitle: item.subtitle || null,
      href: item.href,
      tone: item.tone || "info",
      reason: item.reason || null,
      confidence: item.confidence || "medium",
      source: item.source || "workload",
      keywords: item.keywords || [],
    });
    if (out.length >= limit) break;
  }
  return out;
}

// The single strongest recommendation (or null) — for a compact assistant cue.
export function topRecommendation(context = {}) {
  return buildRecommendations(context, { limit: 1 })[0] || null;
}

export const __test__ = { RECOMMENDATION_RULES, scoreOf };
