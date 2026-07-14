// file location: src/config/topbar/departmentStatus.js
//
// THE TOP-BAR DEPARTMENT STATUS REGISTRY (Phase 2.1).
//
// Turns a live operational `metrics` snapshot into a concise, department-
// appropriate status summary, falling back to fixed contextual copy when no live
// signal is available. The metrics are gathered elsewhere (useOperationalSnapshot
// merges the /api/status/operational-summary counts with roster headcounts); this
// module only decides what text to show, keeping the top bar presentational.
//
// HOW TO ADD A DEPARTMENT (no chrome edit):
//   1. Add a fallback string to DEPARTMENT_STATUS_FALLBACKS.
//   2. Optionally add a builder to DEPARTMENT_STATUS_BUILDERS reading `metrics`.
//
// metrics fields (all optional, defensively read):
//   endpoint : jobsInProgress, jobsWaiting, appointmentsToday, overdueJobs,
//              waitingApprovals, techniciansAvailable, techniciansOnJobs,
//              techniciansTotal, partsOnOrder, pendingDeliveries, partsOutstanding
//   roster   : techsOnShift, motTesters, valeters, partsStaff, serviceAdvisors

export const DEPARTMENT_STATUS_FALLBACKS = {
  workshop: "Workshop floor active",
  parts: "Parts desk open",
  service: "Service reception open",
  mot: "MOT bay ready",
  valeting: "Valeting bay ready",
  paint: "Bodyshop active",
  accounts: "Accounts office open",
  admin: "Front office open",
  hr: "HR office",
  management: "Company overview",
};

export const DEFAULT_DEPARTMENT_STATUS = "On shift";

// count(1, "job") → "1 job"; count(3, "job") → "3 jobs"; optional irregular plural.
export function count(n, singular, plural) {
  const value = Number(n) || 0;
  const word = value === 1 ? singular : plural || `${singular}s`;
  return `${value} ${word}`;
}

// Treat a metric as "present" only when it is a real, positive number.
const has = (v) => typeof v === "number" && v > 0;

// Per-department live builders: (metrics) => string | null (null → fall back).
export const DEPARTMENT_STATUS_BUILDERS = {
  workshop: (m) => {
    if (has(m.jobsInProgress)) return `${count(m.jobsInProgress, "job")} in progress`;
    if (has(m.techsOnShift)) return `${count(m.techsOnShift, "technician")} on the floor`;
    return null;
  },
  service: (m) => {
    if (has(m.appointmentsToday)) return `${count(m.appointmentsToday, "appointment")} booked today`;
    if (has(m.serviceAdvisors)) return `${count(m.serviceAdvisors, "advisor")} on duty`;
    return null;
  },
  mot: (m) => {
    if (has(m.motTesters)) return `${count(m.motTesters, "MOT tester")} on shift`;
    return null;
  },
  valeting: (m) => {
    if (has(m.valeters)) return `${count(m.valeters, "valeter")} on shift`;
    return null;
  },
  parts: (m) => {
    if (has(m.partsOutstanding)) return `${count(m.partsOutstanding, "part")} outstanding`;
    if (has(m.partsStaff)) return `${count(m.partsStaff, "person", "people")} on the parts desk`;
    return null;
  },
  management: (m) => {
    if (has(m.jobsInProgress)) return `${count(m.jobsInProgress, "job")} in progress`;
    return null;
  },
};

// Resolve the status line for a department. Returns { text, isLive }: `isLive` is
// true when a builder produced the copy from real data. Never throws.
export function buildDepartmentStatus(departmentCode, { metrics = {}, isPresentation = false } = {}) {
  const builder = DEPARTMENT_STATUS_BUILDERS[departmentCode];
  if (builder && !isPresentation) {
    try {
      const live = builder(metrics || {});
      if (live) return { text: live, isLive: true };
    } catch {
      // Never let a status builder break the chrome — fall through to fallback.
    }
  }
  const fallback =
    (departmentCode && DEPARTMENT_STATUS_FALLBACKS[departmentCode]) || DEFAULT_DEPARTMENT_STATUS;
  return { text: fallback, isLive: false };
}
