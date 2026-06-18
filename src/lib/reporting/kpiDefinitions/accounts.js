// file location: src/lib/reporting/kpiDefinitions/accounts.js
//
// Seed Accounts KPI definitions (Phase-3 §12). R1 metrics. Financial-gated:
// `permission` requires Accounts roles or executives (Phase-1 §14.1 sensitive
// gate) — the engine refuses these to other roles even within department scope.

import { defineKpi } from "../kpiCatalog";
import { applyDateRange, sumColumn, countRows, fetchRows } from "../queryBuilder";
import { FINANCIAL_SENSITIVE_ROLES } from "../permissionScope";

const FINANCIAL_PERMISSION = [...FINANCIAL_SENSITIVE_ROLES];

export const accountsKpis = [
  defineKpi({
    id: "acc.revenue",
    label: "Total Revenue",
    department: "accounts",
    relatedDepartments: ["workshop", "parts", "service"],
    description: "Invoiced revenue (grand total of invoices raised in the period).",
    purpose: "Headline commercial output.",
    formula: "Σ invoices.grand_total (invoiced in period)",
    sourceTables: ["invoices"],
    sourceEvents: ["INVOICE_CREATED", "INVOICE_ISSUED"],
    tier: "executive",
    readiness: "R1",
    unit: "currency",
    format: "£0,0.00",
    targetType: "higher_is_better",
    permission: FINANCIAL_PERMISSION,
    futureNotes: "Prefer line-item recompute where the 7 denormalised totals disagree (D12).",
    resolver: async ({ filter }) => {
      const { sum } = await sumColumn("invoices", "grand_total", (q) =>
        applyDateRange(q, "invoice_date", filter)
      );
      return { value: sum, amountGbp: sum };
    },
  }),

  defineKpi({
    id: "acc.outstanding_invoices",
    label: "Outstanding Invoices",
    department: "accounts",
    description: "Count of invoices in Sent/Overdue (unpaid) state.",
    purpose: "AR pipeline / collection workload.",
    formula: "COUNT(invoices where payment_status in {Sent, Overdue})",
    sourceTables: ["invoices"],
    sourceEvents: ["INVOICE_STATUS_CHANGED"],
    tier: "operational",
    readiness: "R1",
    unit: "count",
    targetType: "lower_is_better",
    permission: FINANCIAL_PERMISSION,
    drilldown: async () =>
      fetchRows(
        "invoices",
        "id,invoice_number,job_id,payment_status,grand_total,due_date",
        (q) => q.in("payment_status", ["Sent", "Overdue", "sent", "overdue"]),
        { orderBy: "due_date", ascending: true }
      ),
    resolver: async () => {
      const count = await countRows("invoices", (q) =>
        q.in("payment_status", ["Sent", "Overdue", "sent", "overdue"])
      );
      return { value: count, count };
    },
  }),
];

export default accountsKpis;
