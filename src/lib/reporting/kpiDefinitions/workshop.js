// file location: src/lib/reporting/kpiDefinitions/workshop.js
//
// Seed Workshop KPI definitions (Phase-3 §5). R1 metrics buildable today.
// `wsh.jobs_completed` deliberately replaces the `.limit()`-truncated dashboard
// count with an exact count (Goal G1 / debt D8).

import { defineKpi } from "../kpiCatalog";
import { applyDateRange, countRows, fetchRows } from "../queryBuilder";

export const workshopKpis = [
  defineKpi({
    id: "wsh.jobs_completed",
    label: "Jobs Completed",
    department: "workshop",
    description: "Jobs whose work completed in the period.",
    purpose: "Throughput / daily output.",
    formula: "COUNT(jobs where completed_at in period)",
    sourceTables: ["jobs"],
    sourceEvents: ["JOB_COMPLETED"],
    sourceHistories: ["job_status_history"],
    tier: "operational",
    readiness: "R1",
    unit: "count",
    targetType: "higher_is_better",
    example: "18 today",
    futureNotes: "Replaces the .limit()-truncated dashboard count (D8).",
    drilldown: async ({ filter }) =>
      fetchRows(
        "jobs",
        "id,job_number,status,completed_at,assigned_to",
        (q) => applyDateRange(q.not("completed_at", "is", null), "completed_at", filter),
        { orderBy: "completed_at" }
      ),
    resolver: async ({ filter }) => {
      const count = await countRows("jobs", (q) =>
        applyDateRange(q.not("completed_at", "is", null), "completed_at", filter)
      );
      return { value: count, count };
    },
  }),

  defineKpi({
    id: "wsh.jobs_created",
    label: "Jobs Created",
    department: "workshop",
    relatedDepartments: ["service"],
    description: "New job cards opened in the period.",
    purpose: "Intake volume / demand.",
    formula: "COUNT(jobs where created_at in period)",
    sourceTables: ["jobs"],
    sourceEvents: ["JOB_CREATED"],
    tier: "operational",
    readiness: "R1",
    unit: "count",
    targetType: "informational",
    resolver: async ({ filter }) => {
      const count = await countRows("jobs", (q) => applyDateRange(q, "created_at", filter));
      return { value: count, count };
    },
  }),
];

export default workshopKpis;
