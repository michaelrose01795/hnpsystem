// file location: src/config/topbar/statusViews.js
//
// Assembles the rotating content for the top bar's status line — the single
// mechanism that lets live summaries (2.1), compact KPIs (2.2) and smart
// insights (2.6) share ONE line without changing the bar's dimensions. Returns
// an ordered, de-duplicated list of short strings; the bar rotates through them.
//
// PURE — deterministic and unit-testable. Presentation mode collapses to just
// the static summary (no live KPIs/insights leak into the demo).

import { buildDepartmentStatus } from "@/config/topbar/departmentStatus";
import { resolveKpis, formatKpiLine } from "@/config/topbar/departmentKpis";
import { resolveInsights } from "@/config/topbar/departmentInsights";

export function buildStatusViews(
  department,
  metrics = {},
  { isPresentation = false, maxKpis = 3, maxInsights = 3 } = {}
) {
  const summary = buildDepartmentStatus(department, { metrics, isPresentation });
  const views = [summary.text];

  if (!isPresentation) {
    const kpiLine = formatKpiLine(resolveKpis(department, metrics), maxKpis);
    if (kpiLine) views.push(kpiLine);
    resolveInsights(department, metrics)
      .slice(0, maxInsights)
      .forEach((insight) => views.push(insight));
  }

  // De-dupe (a summary and an insight can coincide) while preserving order, and
  // guarantee at least one non-empty view.
  const unique = [];
  const seen = new Set();
  for (const view of views) {
    const text = (view || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    unique.push(text);
  }
  return unique.length > 0 ? unique : [summary.text];
}

// Structured sections for the simplified top bar (2026-07 layout refinement).
// Phase 2 folded the department summary, KPIs and insights into ONE rotating
// line inside the identity block. The refined bar drops the identity/summary and
// surfaces Live KPIs (2.2) and Smart Insight (2.6) as their own sections, so this
// returns them separately rather than merged into a rotation.
//
// Still PURE + presentation-safe: the demo shell gets no live KPIs/insights, so
// nothing real leaks into the deck. `kpis` are the resolved descriptors
// (`{ key, label, value }`) — the bar renders each as a compact widget; `insights`
// are the ordered prompt strings the bar rotates through in its own section.
export function buildTopbarSections(
  department,
  metrics = {},
  { isPresentation = false, maxKpis = 4, maxInsights = 4 } = {}
) {
  if (isPresentation) return { kpis: [], insights: [] };
  return {
    kpis: resolveKpis(department, metrics).slice(0, maxKpis),
    insights: resolveInsights(department, metrics).slice(0, maxInsights),
  };
}
