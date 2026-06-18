// file location: src/lib/reporting/kpiDefinitions/vhc.js
//
// Seed VHC KPI definitions (Phase-3 §8). R1 metrics — buildable from existing
// data today. These prove the catalogue plug-in pattern; the full ~110-KPI set
// (R2/R3) is added the same way as the event/history spine and missing entities
// land. NOTE: the Phase-3 §16.2 priority-1 list starts with VHC because it fixes
// the Service-dashboard "default amber" bug — these use real `severity`, not text.

import { defineKpi } from "../kpiCatalog";
import { applyDateRange, countRows, sumColumn, fetchRows } from "../queryBuilder";

const VHC_DATE_COL = "created_at";

export const vhcKpis = [
  defineKpi({
    id: "vhc.red_items",
    label: "Red Items Found",
    department: "workshop",
    relatedDepartments: ["service"],
    description: "VHC items raised at red severity in the period.",
    purpose: "Inspection quality / safety-critical findings volume.",
    formula: "COUNT(vhc_checks where severity = 'red')",
    sourceTables: ["vhc_checks"],
    sourceEvents: ["VHC_CREATED"],
    tier: "operational",
    readiness: "R1",
    unit: "count",
    targetType: "informational",
    example: "COUNT red severity rows in range",
    drilldown: async ({ filter }) =>
      fetchRows(
        "vhc_checks",
        "vhc_id,job_id,section,issue_title,severity,created_at",
        (q) => applyDateRange(q.eq("severity", "red"), VHC_DATE_COL, filter),
        { orderBy: VHC_DATE_COL }
      ),
    resolver: async ({ filter }) => {
      const count = await countRows("vhc_checks", (q) =>
        applyDateRange(q.eq("severity", "red"), VHC_DATE_COL, filter)
      );
      return { value: count, count };
    },
  }),

  defineKpi({
    id: "vhc.upsell_revenue",
    label: "Upsell Revenue (authorised)",
    department: "workshop",
    relatedDepartments: ["service", "accounts"],
    description: "Total £ of authorised VHC work in the period.",
    purpose: "Commercial value of inspection-driven upsell.",
    formula: "Σ vhc_checks.authorized_total_gbp",
    sourceTables: ["vhc_checks"],
    sourceEvents: ["VHC_AUTHORISED"],
    tier: "tactical",
    readiness: "R1",
    unit: "currency",
    format: "£0,0.00",
    targetType: "higher_is_better",
    relatedReports: ["mgt.upsell_contribution"],
    resolver: async ({ filter }) => {
      const { sum } = await sumColumn("vhc_checks", "authorized_total_gbp", (q) =>
        applyDateRange(q, VHC_DATE_COL, filter)
      );
      return { value: sum, amountGbp: sum };
    },
  }),

  defineKpi({
    id: "vhc.authorisation_rate",
    label: "Authorisation Rate",
    department: "workshop",
    relatedDepartments: ["service"],
    description: "Authorised value as a share of identified (authorised + declined) value.",
    purpose: "VHC conversion effectiveness.",
    formula: "Σ authorized_total_gbp ÷ Σ(authorized_total_gbp + declined_total_gbp) × 100",
    numerator: "Σ authorized_total_gbp",
    denominator: "Σ(authorized + declined)_total_gbp",
    sourceTables: ["vhc_checks"],
    sourceEvents: ["VHC_AUTHORISED", "VHC_DECLINED"],
    tier: "tactical",
    readiness: "R1",
    aggregation: "ratio",
    unit: "percent",
    format: "0.0%",
    targetType: "higher_is_better",
    resolver: async ({ filter }) => {
      const [{ sum: authorised }, { sum: declined }] = await Promise.all([
        sumColumn("vhc_checks", "authorized_total_gbp", (q) => applyDateRange(q, VHC_DATE_COL, filter)),
        sumColumn("vhc_checks", "declined_total_gbp", (q) => applyDateRange(q, VHC_DATE_COL, filter)),
      ]);
      const denominator = authorised + declined;
      const value = denominator > 0 ? (authorised / denominator) * 100 : null;
      return { value, numerator: authorised, denominator };
    },
  }),
];

export default vhcKpis;
