// file location: src/config/topbar/productivityWidgets.js
//
// Personal productivity widgets (Phase 3.6) — PURE widget registry. Turns the
// aggregated workspace context (live metrics, recent activity, favourites,
// contextual suggestions, personal reminders) into an ordered set of widget
// descriptors the productivity panel renders. No React/window/storage.
//
// A widget descriptor:
//   { id, title, icon, items: [{ id, label, subtitle?, href?, tone? }],
//     emptyText, interactive? }
// `interactive: "reminders"` tells the panel to render editable reminder rows.
//
// HOW TO ADD A WIDGET: add an entry to WIDGETS (id, title, build(context)).
// Personalisation (3.7) controls visibility + order via `prefs`.

import { resolveKpis } from "@/config/topbar/departmentKpis";
import { WORKSPACE_LIMITS } from "@/config/topbar/workspaceConfig";

// Live "upcoming & outstanding" items derived from the operational metrics.
// Each maps a metric to an actionable line + destination.
const UPCOMING_SIGNALS = [
  { key: "overdueJobs", label: (n) => `${n} overdue job${n === 1 ? "" : "s"}`, href: "/job-cards", tone: "danger" },
  { key: "jobsWaiting", label: (n) => `${n} job${n === 1 ? "" : "s"} waiting to start`, href: "/nextjobs", tone: "warning" },
  { key: "waitingApprovals", label: (n) => `${n} approval${n === 1 ? "" : "s"} pending`, href: "/job-cards", tone: "warning" },
  { key: "appointmentsToday", label: (n) => `${n} appointment${n === 1 ? "" : "s"} today`, href: "/job-cards/appointments", tone: "info" },
  { key: "pendingDeliveries", label: (n) => `${n} pending deliver${n === 1 ? "y" : "ies"}`, href: "/deliveries", tone: "info" },
  { key: "partsOutstanding", label: (n) => `${n} part${n === 1 ? "" : "s"} outstanding`, href: "/goods-in", tone: "warning" },
];

const WIDGETS = [
  {
    id: "upcoming",
    title: "Upcoming & outstanding",
    icon: "📌",
    emptyText: "Nothing outstanding right now.",
    build: (ctx) =>
      UPCOMING_SIGNALS.map((sig) => {
        const n = ctx.metrics?.[sig.key];
        if (typeof n !== "number" || n <= 0) return null;
        return { id: sig.key, label: sig.label(n), href: sig.href, tone: sig.tone };
      }).filter(Boolean),
  },
  {
    id: "suggested",
    title: "Suggested for you",
    icon: "✨",
    emptyText: "No suggestions right now.",
    build: (ctx) =>
      (ctx.suggestions || []).map((s) => ({
        id: s.id || s.href,
        label: s.label,
        subtitle: s.subtitle,
        href: s.href,
      })),
  },
  {
    id: "reminders",
    title: "Reminders",
    icon: "✅",
    interactive: "reminders",
    emptyText: "No reminders — add one below.",
    build: (ctx) =>
      (ctx.reminders || []).map((r) => ({
        id: r.id,
        label: r.text,
        done: Boolean(r.done),
      })),
  },
  {
    id: "recent",
    title: "Recent activity",
    icon: "↻",
    emptyText: "Nothing viewed yet.",
    build: (ctx) =>
      (ctx.recentItems || []).slice(0, WORKSPACE_LIMITS.panelRecent).map((item) => ({
        id: item.id,
        label: item.label,
        subtitle: item.subtitle,
        href: item.href,
      })),
  },
  {
    id: "favourites",
    title: "Favourites",
    icon: "★",
    emptyText: "Star pages to keep them here.",
    build: (ctx) =>
      (ctx.favourites || []).slice(0, WORKSPACE_LIMITS.panelFavourites).map((fav) => ({
        id: fav.href,
        label: fav.label,
        subtitle: fav.subtitle,
        href: fav.href,
      })),
  },
  {
    id: "operational",
    title: "Department snapshot",
    icon: "📊",
    emptyText: "No live metrics for your department.",
    build: (ctx) =>
      resolveKpis(ctx.department, ctx.metrics).map((kpi) => ({
        id: kpi.key,
        label: `${kpi.value} ${kpi.label}`,
      })),
  },
];

const DEFAULT_ORDER = WIDGETS.map((w) => w.id);

// Resolve widgets for a context, applying personalisation (visibility + order).
// `prefs = { widgets: { [id]: boolean }, widgetOrder: string[] }`. Hidden widgets
// are dropped; unknown ids ignored. Widgets with no items AND no interactivity
// are still returned (the panel shows their emptyText) so the layout is stable.
export function resolveWidgets(context = {}, prefs = {}) {
  const visibility = prefs.widgets || {};
  const order = Array.isArray(prefs.widgetOrder) && prefs.widgetOrder.length
    ? prefs.widgetOrder
    : DEFAULT_ORDER;

  const byId = new Map(WIDGETS.map((w) => [w.id, w]));
  const ordered = [];
  // Preferred order first, then any widgets not named in the order.
  for (const id of order) if (byId.has(id)) ordered.push(byId.get(id));
  for (const w of WIDGETS) if (!order.includes(w.id)) ordered.push(w);

  return ordered
    .filter((w) => visibility[w.id] !== false)
    .map((w) => {
      let items = [];
      try {
        items = w.build(context) || [];
      } catch {
        items = [];
      }
      return {
        id: w.id,
        title: w.title,
        icon: w.icon,
        emptyText: w.emptyText,
        interactive: w.interactive || null,
        items,
      };
    });
}

export const WIDGET_IDS = DEFAULT_ORDER;
export const WIDGET_META = WIDGETS.map((w) => ({ id: w.id, title: w.title, icon: w.icon }));
