// file location: src/lib/reporting/kpiDefinitions/parts.js
//
// Seed Parts KPI definitions (Phase-3 §6). R1 metrics. `prt.open_by_status` is a
// point-in-time backlog distribution — the kind of "open parts by status" panel
// the audit found truncated by .limit(); here it is an exact, full distribution.

import { defineKpi } from "../kpiCatalog";
import { applyDateRange, countRows, groupCount, fetchRows } from "../queryBuilder";
import { normaliseStatus } from "../config/statusMaps";

export const partsKpis = [
  defineKpi({
    id: "prt.requests",
    label: "Parts Requests",
    department: "parts",
    relatedDepartments: ["workshop", "vhc"],
    description: "Part lines created/requested in the period.",
    purpose: "Demand / VHC→parts conversion denominator.",
    formula: "COUNT(parts_job_items created in period)",
    sourceTables: ["parts_job_items"],
    sourceEvents: ["PART_REQUESTED"],
    tier: "operational",
    readiness: "R1",
    unit: "count",
    targetType: "informational",
    resolver: async ({ filter }) => {
      const count = await countRows("parts_job_items", (q) => applyDateRange(q, "created_at", filter));
      return { value: count, count };
    },
  }),

  defineKpi({
    id: "prt.open_by_status",
    label: "Open Parts by Status",
    department: "parts",
    relatedDepartments: ["workshop"],
    description: "Point-in-time distribution of open part lines across the 14-status model.",
    purpose: "Backlog visibility per status (dwell candidates).",
    formula: "COUNT(parts_job_items) grouped by status (excluding terminal states)",
    sourceTables: ["parts_job_items"],
    sourceEvents: ["PART_STATUS_CHANGED"],
    snapshotSource: "report_entity_state_snapshot",
    tier: "operational",
    readiness: "R1",
    aggregation: "point_in_time",
    unit: "count",
    targetType: "informational",
    drilldown: async () =>
      fetchRows(
        "parts_job_items",
        "id,job_id,status,created_at",
        (q) => q.not("status", "in", "(fitted,cancelled,removed)"),
        { orderBy: "created_at", ascending: true }
      ),
    // Returns the headline open count as `value` and the full distribution in
    // `breakdown` (consumed by a future distribution panel; status-normalised).
    resolver: async () => {
      const raw = await groupCount("parts_job_items", "status");
      const breakdown = {};
      let open = 0;
      for (const [status, n] of Object.entries(raw)) {
        const canonical = normaliseStatus("part", status) || status;
        breakdown[canonical] = (breakdown[canonical] || 0) + n;
        if (!["fitted", "cancelled", "removed"].includes(canonical)) open += n;
      }
      return { value: open, count: open, breakdown };
    },
  }),
];

export default partsKpis;
