// file location: src/config/topbar/technicianKpis.js
//
// Pure formatter for technician-only topbar KPIs.
const formatMetric = (value, suffix) => {
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) ? Math.round(numeric * 10) / 10 : 0;
  return `${safe}${suffix}`;
};

export function buildTechnicianKpis(snapshot = {}) {
  const queuedJobNumbers = Array.isArray(snapshot.queuedJobNumbers)
    ? snapshot.queuedJobNumbers.filter(Boolean)
    : [];

  return [
    {
      key: "technicianJobsLinedUp",
      label: "jobs lined up",
      hint: "assigned in Next Jobs after the current job",
      value: Number.isFinite(Number(snapshot.jobsLinedUp))
        ? Number(snapshot.jobsLinedUp)
        : 0,
      detail: queuedJobNumbers,
    },
    {
      key: "technicianAllocatedToday",
      label: "allocated today",
      hint: "planned labour hours for today",
      value: formatMetric(snapshot.allocatedToday, "h"),
    },
    {
      key: "technicianEfficiency",
      label: "efficiency",
      hint: "allocated versus logged hours this month",
      value: formatMetric(snapshot.efficiencyPct, "%"),
    },
  ];
}
