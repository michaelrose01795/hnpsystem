// file location: src/config/topbar/departmentKpis.js
//
// Compact role-specific live KPI widgets (Phase 2.2). Each department declares an
// ordered list of KPI descriptors; the top bar renders them as a compact line
// within its existing dimensions (see statusViews.js). Adding a department's KPIs
// is a single edit here — the chrome never changes.
//
// A KPI descriptor: { key, label (short), hint (what the number means), get(metrics)
// => number|null }. `label` is intentionally terse so several fit the bar ("4
// waiting · 7 running"); `hint` is the one-line explanation shown as the header of
// the widget's hover tooltip (above the detail list, see formatKpiTooltip).

const KPI = {
  jobsWaiting: { key: "jobsWaiting", label: "waiting", hint: "checked in, not yet started", get: (m) => m.jobsWaiting },
  jobsInProgress: { key: "jobsInProgress", label: "in progress", hint: "currently being worked on", get: (m) => m.jobsInProgress },
  appointmentsToday: { key: "appointmentsToday", label: "appts today", hint: "appointments scheduled today", get: (m) => m.appointmentsToday },
  techniciansAvailable: { key: "techniciansAvailable", label: "techs free", hint: "technicians not clocked onto a job", get: (m) => m.techniciansAvailable },
  overdueJobs: { key: "overdueJobs", label: "overdue", hint: "past their next update time", get: (m) => m.overdueJobs },
  waitingApprovals: { key: "waitingApprovals", label: "approvals", hint: "VHC checks awaiting authorisation", get: (m) => m.waitingApprovals },
  partsOutstanding: { key: "partsOutstanding", label: "parts out", hint: "parts still on a live job", get: (m) => m.partsOutstanding },
  pendingDeliveries: { key: "pendingDeliveries", label: "deliveries", hint: "deliveries pending", get: (m) => m.pendingDeliveries },
  motTesters: { key: "motTesters", label: "testers", hint: "MOT testers on shift", get: (m) => m.motTesters },
  valeters: { key: "valeters", label: "valeters", hint: "valeters on shift", get: (m) => m.valeters },
};

export const DEPARTMENT_KPIS = {
  workshop: [KPI.jobsWaiting, KPI.jobsInProgress, KPI.techniciansAvailable, KPI.overdueJobs],
  service: [KPI.appointmentsToday, KPI.jobsWaiting, KPI.waitingApprovals],
  mot: [KPI.motTesters, KPI.appointmentsToday],
  valeting: [KPI.valeters, KPI.jobsWaiting],
  parts: [KPI.partsOutstanding, KPI.pendingDeliveries],
  management: [KPI.jobsInProgress, KPI.appointmentsToday, KPI.overdueJobs],
};

// Resolve the concrete KPIs (value present) for a department from live metrics.
// Each KPI also carries its `hint` and, when the server provided one, a `detail`
// list (metrics.details[key]) — a short sample of the underlying records/people —
// used to build the widget's hover tooltip (see formatKpiTooltip).
export function resolveKpis(department, metrics = {}) {
  const list = DEPARTMENT_KPIS[department] || [];
  const details = (metrics && metrics.details) || {};
  return list
    .map((kpi) => ({
      key: kpi.key,
      label: kpi.label,
      hint: kpi.hint || null,
      value: kpi.get(metrics),
      detail: Array.isArray(details[kpi.key]) ? details[kpi.key] : null,
    }))
    .filter((kpi) => typeof kpi.value === "number");
}

// Build the compact multi-line hover tooltip for a KPI widget:
//   "techs free — technicians not clocked onto a job
//    Alex Smith
//    Priya Patel
//    +3 more"
// Header line always present; the detail list + "+N more" only when the server
// supplied a sample. Returns null if there's nothing worth showing. Newlines are
// honoured by GlobalTooltip (white-space: pre-line).
export function formatKpiTooltip(kpi) {
  if (!kpi) return null;
  const header = kpi.hint ? `${kpi.label} — ${kpi.hint}` : kpi.label;
  const detail = Array.isArray(kpi.detail) ? kpi.detail.filter(Boolean) : [];
  if (detail.length === 0) return header || null;
  const lines = [header, ...detail];
  const total = typeof kpi.value === "number" ? kpi.value : detail.length;
  const overflow = total - detail.length;
  if (overflow > 0) lines.push(`+${overflow} more`);
  return lines.join("\n");
}

// Compact one-line rendering, capped so it always fits the bar.
export function formatKpiLine(kpis, max = 3) {
  return kpis
    .slice(0, max)
    .map((kpi) => `${kpi.value} ${kpi.label}`)
    .join(" · ");
}
