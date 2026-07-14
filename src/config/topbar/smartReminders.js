// file location: src/config/topbar/smartReminders.js
//
// SMART REMINDERS (Phase 5.4) — PURE engine. Automatically surfaces the work the
// user shouldn't let slip — incomplete work, things past/near a deadline, today's
// appointments and follow-up tasks — derived from the live metrics (Phase 2), the
// user's role/department and their own outstanding manual reminders (Phase 3.6).
//
// These are SYSTEM-GENERATED (the app noticing "you have 3 approvals to follow
// up"), distinct from the user-typed personal reminders — the two sit side by
// side: the manual list is what YOU chose to remember, smart reminders are what
// the OPERATION says needs remembering. The user's manual outstanding count is
// folded in as a gentle "you have N open reminders" follow-up.
//
// No React/window/storage — deterministic and unit-testable. `now` is injected by
// the caller (kept out of the pure module) so time-of-day phrasing is testable.
//
// A smart reminder:
//   { id, label, subtitle, href, tone, kind, weight }
//   kind ∈ "deadline" | "incomplete" | "appointment" | "follow-up".

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

// Ordered rule set. Each rule decides if it applies (`when`) and builds a reminder
// (`build`). Higher `weight` surfaces first; `id` dedupes.
const SMART_REMINDER_RULES = [
  {
    id: "overdue-update",
    kind: "deadline",
    weight: 100,
    when: (ctx) => num(ctx.metrics, "overdueJobs") > 0,
    build: (ctx) => {
      const n = num(ctx.metrics, "overdueJobs");
      return {
        label: `Update ${n} overdue ${plural(n, "job", "jobs")}`,
        subtitle: "Past the promised update",
        href: "/job-cards",
        tone: "danger",
      };
    },
  },
  {
    id: "approvals-followup",
    kind: "incomplete",
    weight: 90,
    when: (ctx) => num(ctx.metrics, "waitingApprovals") > 0,
    build: (ctx) => {
      const n = num(ctx.metrics, "waitingApprovals");
      return {
        label: `Follow up ${n} waiting ${plural(n, "approval", "approvals")}`,
        subtitle: "Awaiting authorisation",
        href: "/job-cards",
        tone: "warning",
      };
    },
  },
  {
    id: "appointments-today",
    kind: "appointment",
    weight: 80,
    when: (ctx) => num(ctx.metrics, "appointmentsToday") > 0,
    build: (ctx) => {
      const n = num(ctx.metrics, "appointmentsToday");
      return {
        label: `${n} appointment${n === 1 ? "" : "s"} today`,
        subtitle: "Check the running order",
        href: "/job-cards/appointments",
        tone: "info",
      };
    },
  },
  {
    id: "jobs-to-finish",
    kind: "incomplete",
    weight: 70,
    when: (ctx) =>
      num(ctx.metrics, "jobsInProgress") > 0 && hasRole(ctx.roles, "techs", "workshop manager", "workshop controller"),
    build: (ctx) => {
      const n = num(ctx.metrics, "jobsInProgress");
      return {
        label: `${n} ${plural(n, "job", "jobs")} in progress to complete`,
        subtitle: "Still open in the workshop",
        href: "/nextjobs",
        tone: "info",
      };
    },
  },
  {
    id: "parts-to-book",
    kind: "incomplete",
    weight: 66,
    when: (ctx) => num(ctx.metrics, "partsOutstanding") > 0 && hasRole(ctx.roles, "parts", "parts manager"),
    build: (ctx) => {
      const n = num(ctx.metrics, "partsOutstanding");
      return {
        label: `Book in ${n} outstanding ${plural(n, "part", "parts")}`,
        subtitle: "Holding jobs open",
        href: "/goods-in",
        tone: "warning",
      };
    },
  },
  {
    id: "deliveries-to-chase",
    kind: "follow-up",
    weight: 60,
    when: (ctx) => num(ctx.metrics, "pendingDeliveries") > 0 && hasRole(ctx.roles, "parts", "parts manager"),
    build: (ctx) => {
      const n = num(ctx.metrics, "pendingDeliveries");
      return {
        label: `Chase ${n} pending deliver${n === 1 ? "y" : "ies"}`,
        subtitle: "Inbound stock",
        href: "/deliveries",
        tone: "info",
      };
    },
  },
];

// Build the smart reminders for a context. `manualOutstanding` is the count of the
// user's own open manual reminders (Phase 3.6) — folded in as a gentle follow-up.
export function buildSmartReminders(context = {}, { limit = 6 } = {}) {
  const ctx = {
    metrics: context.metrics || {},
    roles: Array.isArray(context.roles) ? context.roles : [],
    department: context.department || null,
    pathname: context.pathname || "",
  };
  const manualOutstanding = num({ n: context.manualOutstanding }, "n");

  const out = [];
  for (const rule of SMART_REMINDER_RULES) {
    let applies = false;
    try {
      applies = Boolean(rule.when(ctx));
    } catch {
      applies = false;
    }
    if (!applies) continue;
    let body;
    try {
      body = rule.build(ctx);
    } catch {
      continue;
    }
    if (!body) continue;
    out.push({ id: `smart:${rule.id}`, kind: rule.kind, weight: rule.weight, ...body });
  }

  // The user's own open manual reminders — a gentle, lowest-priority nudge.
  if (manualOutstanding > 0) {
    out.push({
      id: "smart:manual-open",
      kind: "follow-up",
      weight: 20,
      label: `You have ${manualOutstanding} open ${plural(manualOutstanding, "reminder", "reminders")}`,
      subtitle: "In your workspace panel",
      href: null,
      tone: "info",
    });
  }

  out.sort((a, b) => b.weight - a.weight);
  return out.slice(0, limit).map((r) => ({
    id: r.id,
    kind: r.kind,
    label: r.label,
    subtitle: r.subtitle || null,
    href: r.href || null,
    tone: r.tone || "info",
  }));
}

// Count of auto-surfaced reminders (excludes the folded manual nudge) — for a
// compact badge without opening the assistant.
export function countSmartReminders(context = {}) {
  return buildSmartReminders(context, { limit: 50 }).filter((r) => r.id !== "smart:manual-open").length;
}

export const __test__ = { SMART_REMINDER_RULES };
