// file location: src/config/topbar/assistant.js
//
// INTELLIGENT OPERATIONAL ASSISTANT (Phase 5.6) — PURE assembler + contextual
// guidance. Unifies the whole Phase 5 reasoning layer into ONE explainable,
// data-driven surface the assistant panel renders: proactive alerts (5.3),
// predictive recommendations (5.1), the workflow next-steps for where you are
// (5.5), smart reminders (5.4), workload balancing (5.2, managers/controllers)
// and short contextual guidance (5.6) — plus a single `headline` for a compact
// cue and `counts` for a badge.
//
// It is the composition seam: each feature stays a pure module; this assembler
// normalises them into a common section/item shape so the panel is fully
// data-driven (a new section is an edit here, never in the component). Contextual
// guidance — the "assistant" giving a tip for the current page — lives here too.
//
// No React/window/storage — deterministic and unit-testable.
//
// A section: { id, title, icon, tone?, items: [{ id, label, subtitle?, tone?,
//   href?, done?, messageAudience?, memberId?, reason? }] }

// ---------------------------------------------------------------------------
// Contextual guidance — a short, page-aware tip the assistant offers. Ordered,
// first-matches-win, capped by the caller. Pure over pathname + roles.
// ---------------------------------------------------------------------------
const GUIDANCE_RULES = [
  {
    id: "on-vhc",
    when: (ctx) => /^\/vhc\//.test(ctx.pathname),
    tip: { label: "Set severities as you inspect", subtitle: "They drive authorisation priority downstream." },
  },
  {
    id: "on-job",
    when: (ctx) => /^\/(job-cards|jobcards|tech)\/[^/]+/.test(ctx.pathname),
    tip: { label: "Capture extra work via the health check", subtitle: "Raising a VHC early avoids a second authorisation." },
  },
  {
    id: "on-queue",
    when: (ctx) => /^\/nextjobs/.test(ctx.pathname),
    tip: { label: "Balance by promised time, not arrival order", subtitle: "Overdue-risk jobs should jump the queue." },
  },
  {
    id: "on-reports",
    when: (ctx) => /^\/reports/.test(ctx.pathname),
    tip: { label: "Compare against last week", subtitle: "Trends matter more than a single day's figure." },
  },
  {
    id: "on-goods-in",
    when: (ctx) => /^\/(goods-in|deliveries)/.test(ctx.pathname),
    tip: { label: "Match parts to their jobs as you book in", subtitle: "It clears the 'outstanding parts' that hold jobs open." },
  },
];

export function contextualGuidance(context = {}, { limit = 3 } = {}) {
  const ctx = { pathname: context.pathname || "", roles: Array.isArray(context.roles) ? context.roles : [] };
  const tips = [];
  for (const rule of GUIDANCE_RULES) {
    let applies = false;
    try {
      applies = Boolean(rule.when(ctx));
    } catch {
      applies = false;
    }
    if (applies) tips.push({ id: `guidance:${rule.id}`, ...rule.tip });
  }
  // Always leave the user with the "how to reach me" tip so the assistant is
  // discoverable from anywhere.
  tips.push({
    id: "guidance:shortcut",
    label: "Open the assistant anytime with ⌘/Ctrl+I",
    subtitle: "Recommendations, alerts and next steps wherever you are.",
  });
  return tips.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Section normalisers — turn each feature's native output into common items.
// ---------------------------------------------------------------------------
function alertsSection(alerts) {
  const items = (alerts || []).map((a) => ({
    id: a.id,
    label: a.title,
    subtitle: `${a.severityLabel}${a.predictive ? " · forecast" : ""} · ${a.detail}`,
    tone: a.tone,
    href: a.href,
    messageAudience: a.audience || null,
  }));
  return { id: "assistant-alerts", title: "Needs attention", icon: "🚨", tone: "danger", items };
}

function recommendationsSection(recommendations) {
  const items = (recommendations || []).map((r) => ({
    id: r.id,
    label: r.label,
    subtitle: r.reason || r.subtitle || null,
    tone: r.tone,
    href: r.href,
    reason: r.reason || null,
  }));
  return { id: "assistant-recommendations", title: "Recommended for you", icon: "✨", items };
}

function workflowSection(workflow) {
  if (!workflow || !workflow.steps?.length) return { id: "assistant-workflow", title: "Next steps", icon: "🧭", items: [] };
  const items = workflow.steps.map((s) => ({
    id: s.id,
    label: s.label,
    subtitle: s.subtitle || null,
    href: s.href,
    done: Boolean(s.done),
    tone: s.done ? "success" : "info",
  }));
  return { id: "assistant-workflow", title: `Next steps · ${workflow.title}`, icon: workflow.icon || "🧭", items };
}

function remindersSection(smartReminders) {
  const items = (smartReminders || []).map((r) => ({
    id: r.id,
    label: r.label,
    subtitle: r.subtitle || null,
    tone: r.tone,
    href: r.href,
  }));
  return { id: "assistant-reminders", title: "Don't let these slip", icon: "⏰", items };
}

function balancingSection(balancing) {
  if (!balancing?.isEligible) return null;
  const items = (balancing.suggestions || []).map((s) => ({
    id: s.id,
    label: s.label,
    subtitle: s.subtitle || null,
    tone: s.tone,
    href: s.href,
    memberId: s.memberId != null ? s.memberId : null,
    messageAudience: s.deptCode || null,
  }));
  const title = balancing.utilisation ? `Workload balancing · ${balancing.utilisation.label}` : "Workload balancing";
  return { id: "assistant-balancing", title, icon: "⚖️", tone: balancing.utilisation?.tone, items };
}

function guidanceSection(guidance) {
  const items = (guidance || []).map((g) => ({ id: g.id, label: g.label, subtitle: g.subtitle || null, tone: "info" }));
  return { id: "assistant-guidance", title: "Tips for here", icon: "💡", items };
}

// ---------------------------------------------------------------------------
// The single compact headline — the most important thing right now.
// ---------------------------------------------------------------------------
function buildHeadline({ alerts, recommendations }) {
  if (alerts && alerts.length) {
    return { text: alerts[0].title, tone: alerts[0].tone, detail: alerts[0].detail };
  }
  if (recommendations && recommendations.length) {
    return { text: recommendations[0].label, tone: recommendations[0].tone, detail: recommendations[0].reason || null };
  }
  return { text: "All clear — nothing needs you right now", tone: "success", detail: null };
}

// Assemble the assistant. Empty sections are dropped (except the always-present
// guidance), so the panel shows only what's relevant. Returns everything the
// panel + palette need.
export function buildAssistant(context = {}) {
  const guidance = context.guidance || contextualGuidance(context);
  const rawSections = [
    alertsSection(context.alerts),
    recommendationsSection(context.recommendations),
    workflowSection(context.workflow),
    remindersSection(context.smartReminders),
    balancingSection(context.balancing),
    guidanceSection(guidance),
  ].filter(Boolean);

  // Keep a section if it has items, or if it's the guidance section (always shown).
  const sections = rawSections.filter((s) => s.items.length > 0 || s.id === "assistant-guidance");

  const headline = buildHeadline({ alerts: context.alerts, recommendations: context.recommendations });

  const counts = {
    alerts: (context.alerts || []).length,
    recommendations: (context.recommendations || []).length,
    reminders: (context.smartReminders || []).length,
    steps: (context.workflow?.steps || []).length,
    total:
      (context.alerts || []).length +
      (context.recommendations || []).length +
      (context.smartReminders || []).length,
  };

  return { headline, sections, counts };
}

export const __test__ = { GUIDANCE_RULES };
