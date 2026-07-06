// file location: src/config/topbar/departmentKpis.js
//
// Compact role-specific live KPI widgets (Phase 2.2). Each department declares an
// ordered list of KPI descriptors; the top bar renders them as a compact line
// within its existing dimensions (see statusViews.js). Adding a department's KPIs
// is a single edit here — the chrome never changes.
//
// A KPI descriptor: { key, label (short), get(metrics) => number|null }.
// `label` is intentionally terse so several fit the bar ("4 waiting · 7 running").

const KPI = {
  jobsWaiting: { key: "jobsWaiting", label: "waiting", get: (m) => m.jobsWaiting },
  jobsInProgress: { key: "jobsInProgress", label: "in progress", get: (m) => m.jobsInProgress },
  appointmentsToday: { key: "appointmentsToday", label: "appts today", get: (m) => m.appointmentsToday },
  techniciansAvailable: { key: "techniciansAvailable", label: "techs free", get: (m) => m.techniciansAvailable },
  overdueJobs: { key: "overdueJobs", label: "overdue", get: (m) => m.overdueJobs },
  waitingApprovals: { key: "waitingApprovals", label: "approvals", get: (m) => m.waitingApprovals },
  partsOutstanding: { key: "partsOutstanding", label: "parts out", get: (m) => m.partsOutstanding },
  pendingDeliveries: { key: "pendingDeliveries", label: "deliveries", get: (m) => m.pendingDeliveries },
  motTesters: { key: "motTesters", label: "testers", get: (m) => m.motTesters },
  valeters: { key: "valeters", label: "valeters", get: (m) => m.valeters },
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
export function resolveKpis(department, metrics = {}) {
  const list = DEPARTMENT_KPIS[department] || [];
  return list
    .map((kpi) => ({ key: kpi.key, label: kpi.label, value: kpi.get(metrics) }))
    .filter((kpi) => typeof kpi.value === "number");
}

// Compact one-line rendering, capped so it always fits the bar.
export function formatKpiLine(kpis, max = 3) {
  return kpis
    .slice(0, max)
    .map((kpi) => `${kpi.value} ${kpi.label}`)
    .join(" · ");
}
